-- Projects table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  product_type text,
  business_goal text,
  target_user text,
  key_metric text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Feedback batches table
create table public.feedback_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  filename text,
  source_type text not null default 'file',
  total_count integer not null default 0,
  valid_count integer not null default 0,
  invalid_count integer not null default 0,
  status text not null default 'uploaded',
  created_at timestamptz not null default now()
);

-- Feedback items table
create table public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  batch_id uuid references public.feedback_batches(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,

  raw_content text not null,
  cleaned_content text,

  source text,
  user_type text,
  external_created_at timestamptz,

  is_valid boolean default true,
  invalid_reason text,

  feedback_type text,
  product_module text,
  sentiment text,
  sentiment_strength integer,
  user_intent text,
  possible_metrics text[],

  ai_summary text,
  ai_labels jsonb default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Analysis runs table
create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  batch_id uuid references public.feedback_batches(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,

  status text not null default 'pending',
  progress integer not null default 0,
  current_step text,

  total_items integer not null default 0,
  analyzed_items integer not null default 0,

  error_message text,

  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- Issue clusters table
create table public.issue_clusters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  summary text not null,

  feedback_count integer not null default 0,
  sentiment_score numeric,
  frequency_score numeric,
  user_value_score numeric,
  business_value_score numeric,
  strategic_fit_score numeric,
  complexity_score numeric,
  evidence_score numeric,
  opportunity_score numeric,

  priority text,
  recommendation text,
  suggested_action text,
  possible_metrics text[],
  evidence_feedback_ids uuid[],

  risk_notes text,
  missing_evidence text,

  created_at timestamptz not null default now()
);

-- Reports table
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  summary text,
  content_markdown text not null,
  report_json jsonb default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.projects enable row level security;
alter table public.feedback_batches enable row level security;
alter table public.feedback_items enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.issue_clusters enable row level security;
alter table public.reports enable row level security;

-- RLS Policies for projects
create policy "Users can view own projects"
on public.projects for select
using (auth.uid() = owner_id);

create policy "Users can insert own projects"
on public.projects for insert
with check (auth.uid() = owner_id);

create policy "Users can update own projects"
on public.projects for update
using (auth.uid() = owner_id);

create policy "Users can delete own projects"
on public.projects for delete
using (auth.uid() = owner_id);

-- RLS Policies for feedback_batches
create policy "Users can view own feedback_batches"
on public.feedback_batches for select
using (auth.uid() = owner_id);

create policy "Users can insert own feedback_batches"
on public.feedback_batches for insert
with check (auth.uid() = owner_id);

create policy "Users can update own feedback_batches"
on public.feedback_batches for update
using (auth.uid() = owner_id);

create policy "Users can delete own feedback_batches"
on public.feedback_batches for delete
using (auth.uid() = owner_id);

-- RLS Policies for feedback_items
create policy "Users can view own feedback_items"
on public.feedback_items for select
using (auth.uid() = owner_id);

create policy "Users can insert own feedback_items"
on public.feedback_items for insert
with check (auth.uid() = owner_id);

create policy "Users can update own feedback_items"
on public.feedback_items for update
using (auth.uid() = owner_id);

create policy "Users can delete own feedback_items"
on public.feedback_items for delete
using (auth.uid() = owner_id);

-- RLS Policies for analysis_runs
create policy "Users can view own analysis_runs"
on public.analysis_runs for select
using (auth.uid() = owner_id);

create policy "Users can insert own analysis_runs"
on public.analysis_runs for insert
with check (auth.uid() = owner_id);

create policy "Users can update own analysis_runs"
on public.analysis_runs for update
using (auth.uid() = owner_id);

create policy "Users can delete own analysis_runs"
on public.analysis_runs for delete
using (auth.uid() = owner_id);

-- RLS Policies for issue_clusters
create policy "Users can view own issue_clusters"
on public.issue_clusters for select
using (auth.uid() = owner_id);

create policy "Users can insert own issue_clusters"
on public.issue_clusters for insert
with check (auth.uid() = owner_id);

create policy "Users can update own issue_clusters"
on public.issue_clusters for update
using (auth.uid() = owner_id);

create policy "Users can delete own issue_clusters"
on public.issue_clusters for delete
using (auth.uid() = owner_id);

-- RLS Policies for reports
create policy "Users can view own reports"
on public.reports for select
using (auth.uid() = owner_id);

create policy "Users can insert own reports"
on public.reports for insert
with check (auth.uid() = owner_id);

create policy "Users can update own reports"
on public.reports for update
using (auth.uid() = owner_id);

create policy "Users can delete own reports"
on public.reports for delete
using (auth.uid() = owner_id);

-- Indexes
create index idx_projects_owner_id on public.projects(owner_id);
create index idx_feedback_items_project_id on public.feedback_items(project_id);
create index idx_feedback_items_batch_id on public.feedback_items(batch_id);
create index idx_analysis_runs_project_id on public.analysis_runs(project_id);
create index idx_issue_clusters_run_id on public.issue_clusters(analysis_run_id);
create index idx_reports_run_id on public.reports(analysis_run_id);
