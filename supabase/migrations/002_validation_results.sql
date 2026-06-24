-- Validation results table
create table public.validation_results (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,
  analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
  report_id uuid references public.reports(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,

  status text not null default 'pending',
  score numeric,

  feedback_count_check jsonb default '{}'::jsonb,
  cluster_check jsonb default '{}'::jsonb,
  metric_check jsonb default '{}'::jsonb,
  report_check jsonb default '{}'::jsonb,
  hallucination_check jsonb default '{}'::jsonb,
  semantic_review jsonb default '{}'::jsonb,

  validation_provider text,
  validation_model text,
  model_fallback boolean default false,

  failed_checks jsonb default '[]'::jsonb,
  warnings jsonb default '[]'::jsonb,
  recommendations jsonb default '[]'::jsonb,

  summary jsonb default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.validation_results enable row level security;

-- RLS Policies for validation_results
create policy "Users can view own validation_results"
on public.validation_results for select
using (auth.uid() = owner_id);

create policy "Users can insert own validation_results"
on public.validation_results for insert
with check (auth.uid() = owner_id);

create policy "Users can update own validation_results"
on public.validation_results for update
using (auth.uid() = owner_id);

create policy "Users can delete own validation_results"
on public.validation_results for delete
using (auth.uid() = owner_id);

-- Indexes
create index idx_validation_results_run_id on public.validation_results(analysis_run_id);
create index idx_validation_results_report_id on public.validation_results(report_id);
create index idx_validation_results_project_id on public.validation_results(project_id);
