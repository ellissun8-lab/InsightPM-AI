-- ===========================================
-- ProofLoop Cloud Schema
-- Supabase PostgreSQL
-- ===========================================

-- 1. workspaces
-- ===========================================
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. runs
-- ===========================================
create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  case_name text not null,
  scenario text,
  status text,
  feedback_count int default 0,
  hard_score int,
  semantic_score int,
  evidence_broken int default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata jsonb default '{}'
);

create index if not exists idx_runs_workspace_id on runs(workspace_id);
create index if not exists idx_runs_case_name on runs(case_name);
create index if not exists idx_runs_updated_at on runs(updated_at desc);

-- 3. report_artifacts
-- ===========================================
create table if not exists report_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade,
  artifact_type text not null,
  file_name text,
  storage_bucket text,
  storage_path text,
  content_type text,
  size_bytes bigint,
  created_at timestamptz default now(),
  metadata jsonb default '{}'
);

create index if not exists idx_report_artifacts_run_id on report_artifacts(run_id);
create index if not exists idx_report_artifacts_type on report_artifacts(artifact_type);

-- artifact_type values:
-- source-upload
-- overall-md
-- overall-json
-- segment-json
-- segment-md
-- hard-validation-json
-- semantic-validation-json
-- validation-summary-json
-- evidence-chain-csv
-- pdf
-- zip

-- 4. report_segments
-- ===========================================
create table if not exists report_segments (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade,
  segment_id text not null,
  display_name text,
  segment_type text,
  business_goal text,
  feedback_count int default 0,
  cluster_count int default 0,
  metadata jsonb default '{}'
);

create index if not exists idx_report_segments_run_id on report_segments(run_id);
create index if not exists idx_report_segments_segment_id on report_segments(segment_id);

-- 5. report_clusters
-- ===========================================
create table if not exists report_clusters (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade,
  segment_id text,
  cluster_id text,
  title text,
  priority text,
  opportunity_score int,
  feedback_count int default 0,
  summary text,
  recommendation text,
  evidence_ids text[] default '{}',
  metadata jsonb default '{}'
);

create index if not exists idx_report_clusters_run_id on report_clusters(run_id);
create index if not exists idx_report_clusters_segment_id on report_clusters(segment_id);

-- 6. evidence_items
-- ===========================================
create table if not exists evidence_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade,
  feedback_id text,
  feedback_text text,
  source text,
  sentiment text,
  created_at timestamptz default now(),
  metadata jsonb default '{}'
);

create index if not exists idx_evidence_items_run_id on evidence_items(run_id);
create index if not exists idx_evidence_items_feedback_id on evidence_items(feedback_id);

-- 7. training_datasets
-- ===========================================
create table if not exists training_datasets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  scenario text,
  status text default 'pending',
  feedback_count int default 0,
  quality_score int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata jsonb default '{}'
);

create index if not exists idx_training_datasets_workspace_id on training_datasets(workspace_id);

-- 8. training_feedback
-- ===========================================
create table if not exists training_feedback (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references training_datasets(id) on delete cascade,
  feedback_id text,
  feedback_text text,
  label jsonb default '{}',
  accepted boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_training_feedback_dataset_id on training_feedback(dataset_id);

-- 9. custom_scenarios
-- ===========================================
create table if not exists custom_scenarios (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  scenario_id text not null,
  label text not null,
  business_goal text,
  description text,
  default_metrics text[] default '{}',
  default_segments text[] default '{}',
  issue_keyword_map jsonb default '{}',
  priority_rules jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_custom_scenarios_workspace_id on custom_scenarios(workspace_id);
create index if not exists idx_custom_scenarios_scenario_id on custom_scenarios(scenario_id);

-- 10. workspace_settings
-- ===========================================
create table if not exists workspace_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_workspace_settings_workspace_id on workspace_settings(workspace_id);

-- 11. api_key_settings
-- ===========================================
create table if not exists api_key_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  provider text not null,
  is_configured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_api_key_settings_workspace_id on api_key_settings(workspace_id);

-- Note: MVP does not store plaintext API keys in the database.
-- Production API keys should use Vercel Environment Variables.
-- api_key_settings only stores whether a provider is configured.
