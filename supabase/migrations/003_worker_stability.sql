-- ===========================================
-- Phase 3: Worker Stability Fields
-- ===========================================

-- 添加 Worker 稳定性字段到 runs 表
ALTER TABLE runs ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS max_retry integer DEFAULT 2;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS failed_at timestamptz;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS last_error jsonb;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_runs_status_retry ON runs(status, retry_count);
CREATE INDEX IF NOT EXISTS idx_runs_locked_by ON runs(locked_by);
CREATE INDEX IF NOT EXISTS idx_runs_heartbeat_at ON runs(heartbeat_at);

-- ===========================================
-- Atomic Claim Function
-- ===========================================

CREATE OR REPLACE FUNCTION claim_next_run(worker_id text)
RETURNS TABLE(
  run_id uuid,
  case_name text,
  scenario text,
  feedback_count int,
  metadata jsonb
) AS $$
DECLARE
  claimed_run RECORD;
BEGIN
  -- 查找可认领的 run：
  -- 1. status = pending
  -- 2. 或 status = running 但 heartbeat 超时（stale）
  SELECT * INTO claimed_run
  FROM runs
  WHERE (
    (status = 'pending' AND (retry_count IS NULL OR retry_count < max_retry))
    OR
    (status = 'running' AND (
      (heartbeat_at IS NULL AND updated_at < NOW() - INTERVAL '10 minutes')
      OR
      (heartbeat_at < NOW() - INTERVAL '10 minutes')
    ))
  )
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    -- 更新为 running
    UPDATE runs SET
      status = 'running',
      locked_by = worker_id,
      locked_at = NOW(),
      heartbeat_at = NOW(),
      started_at = COALESCE(started_at, NOW()),
      updated_at = NOW(),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{worker}',
        '"railway-worker"'
      )
    WHERE id = claimed_run.id;

    -- 返回认领的 run
    RETURN QUERY
    SELECT
      claimed_run.id,
      claimed_run.case_name,
      claimed_run.scenario,
      claimed_run.feedback_count,
      claimed_run.metadata;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- Update Heartbeat Function
-- ===========================================

CREATE OR REPLACE FUNCTION update_run_heartbeat(
  run_id uuid,
  worker_step text
) RETURNS boolean AS $$
BEGIN
  UPDATE runs SET
    heartbeat_at = NOW(),
    updated_at = NOW(),
    metadata = jsonb_set(
      COALESCE(metadata, '{}'),
      '{workerStep}',
      to_jsonb(worker_step)
    )
  WHERE id = run_id AND status = 'running';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- Mark Run Completed Function
-- ===========================================

CREATE OR REPLACE FUNCTION mark_run_completed(
  run_id uuid,
  p_hard_score int DEFAULT NULL,
  p_semantic_score int DEFAULT NULL,
  p_evidence_broken int DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS boolean AS $$
BEGIN
  UPDATE runs SET
    status = 'completed',
    hard_score = COALESCE(p_hard_score, hard_score),
    semantic_score = COALESCE(p_semantic_score, semantic_score),
    evidence_broken = COALESCE(p_evidence_broken, evidence_broken),
    completed_at = NOW(),
    updated_at = NOW(),
    metadata = COALESCE(p_metadata, metadata)
  WHERE id = run_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- Mark Run Failed Function
-- ===========================================

CREATE OR REPLACE FUNCTION mark_run_failed(
  run_id uuid,
  error_message text,
  error_category text DEFAULT 'unknown',
  retryable boolean DEFAULT false
) RETURNS boolean AS $$
DECLARE
  current_retry int;
  current_max_retry int;
BEGIN
  -- 获取当前重试次数
  SELECT retry_count, max_retry INTO current_retry, current_max_retry
  FROM runs WHERE id = run_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF retryable AND current_retry < current_max_retry then
    -- 可重试：回到 pending
    UPDATE runs SET
      status = 'pending',
      retry_count = COALESCE(retry_count, 0) + 1,
      locked_by = NULL,
      locked_at = NULL,
      heartbeat_at = NULL,
      updated_at = NOW(),
      last_error = jsonb_build_object(
        'message', error_message,
        'category', error_category,
        'retryable', retryable,
        'failedAt', NOW()
      ),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{retryHistory}',
        COALESCE(metadata->'retryHistory', '[]'::jsonb) || jsonb_build_object(
          'retryAt', NOW(),
          'error', error_message,
          'category', error_category
        )
      )
    WHERE id = run_id;
  ELSE
    -- 不可重试或超过最大重试：标记 failed
    UPDATE runs SET
      status = 'failed',
      failed_at = NOW(),
      updated_at = NOW(),
      last_error = jsonb_build_object(
        'message', error_message,
        'category', error_category,
        'retryable', retryable,
        'failedAt', NOW()
      ),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{error}',
        jsonb_build_object(
          'message', error_message,
          'category', error_category,
          'retryable', retryable,
          'failedAt', NOW()
        )
      )
    WHERE id = run_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
