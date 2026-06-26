export type RunListItem = {
  id?: string;
  caseName: string;
  scenario?: string;
  dataset?: string;
  status?: string;
  feedbackCount?: number;
  hardScore?: number | null;
  semanticScore?: number | null;
  evidenceBroken?: number | null;
  hardValidation?: any | null;
  semanticValidation?: any | null;
  artifacts?: {
    markdown?: boolean;
    report?: boolean;
    json?: boolean;
  } | null;
  validation?: any | null;
  summary?: any | null;
  hard?: number | string | { score?: number | string } | null;
  hardValidationScore?: number | string | null;
  hardValidationPassed?: boolean | null;
  criticalIssues?: number | null;
  isRunning?: boolean | null;
  error?: unknown;
  errors?: unknown;
  createdAt?: string | null;
  updatedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  metadata?: any | null;

  // legacy compatibility
  case_name?: string;
  count?: number;
  timestamp?: string | null;
  duration_ms?: number | null;
};
