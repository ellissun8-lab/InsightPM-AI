-- ===========================================
-- Fix mark_run_failed: full error payload + lock cleanup + protection
-- ===========================================

-- Drop old function signature (4 params) and replace with new (2 params)
DROP FUNCTION IF EXISTS mark_run_failed(uuid, text, text, boolean);

CREATE OR REPLACE FUNCTION mark_run_failed(
  run_id uuid,
  error_payload jsonb,
  retryable boolean DEFAULT false
) RETURNS boolean AS $$
DECLARE
  current_retry int;
  current_max_retry int;
  current_status text;
  current_metadata jsonb;
  current_input_file jsonb;
BEGIN
  -- 获取当前状态
  SELECT retry_count, max_retry, status, metadata
    INTO current_retry, current_max_retry, current_status, current_metadata
  FROM runs WHERE id = run_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 保护：不允许终态覆盖
  IF current_status IN ('completed', 'failed', 'cancelled') THEN
    RAISE WARNING 'mark_run_failed: run % already in terminal status %, skipping', run_id, current_status;
    RETURN false;
  END IF;

  -- 保留 inputFile（从现有 metadata 中提取）
  current_input_file := COALESCE(current_metadata->'inputFile', 'null'::jsonb);

  IF retryable AND current_retry < current_max_retry THEN
    -- 可重试：回到 pending
    UPDATE runs SET
      status = 'pending',
      retry_count = COALESCE(retry_count, 0) + 1,
      locked_by = NULL,
      locked_at = NULL,
      heartbeat_at = NULL,
      updated_at = NOW(),
      last_error = error_payload,
      metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{retryHistory}',
        COALESCE(metadata->'retryHistory', '[]'::jsonb) || jsonb_build_object(
          'retryAt', (error_payload->>'failedAt')::text,
          'error', error_payload->>'message',
          'category', error_payload->>'category',
          'stdoutPreview', error_payload->>'stdoutPreview',
          'stderrPreview', error_payload->>'stderrPreview'
        )
      )
    WHERE id = run_id;
  ELSE
    -- 不可重试或超过最大重试：标记 failed
    UPDATE runs SET
      status = 'failed',
      failed_at = NOW(),
      updated_at = NOW(),
      locked_by = NULL,
      locked_at = NULL,
      last_error = error_payload,
      metadata = jsonb_set(
        jsonb_set(
          COALESCE(metadata, '{}'),
          '{error}',
          error_payload
        ),
        '{inputFile}',
        current_input_file
      )
    WHERE id = run_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- Protection: prevent running + error state
-- ===========================================

-- Add a check constraint that prevents status='running' with metadata->'error' IS NOT NULL
-- This is enforced via a trigger since CHECK constraints can't reference JSONB fields easily

CREATE OR REPLACE FUNCTION prevent_running_with_error()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'running' AND NEW.metadata IS NOT NULL AND NEW.metadata ? 'error' THEN
    -- If error is being set, force status out of 'running'
    IF NEW.metadata->>'error' != 'null' AND NEW.metadata->>'error' != '{}' THEN
      RAISE EXCEPTION 'Cannot have status=running with metadata.error set. Use status=failed instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_running_with_error ON runs;
CREATE TRIGGER trg_prevent_running_with_error
  BEFORE INSERT OR UPDATE ON runs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_running_with_error();
