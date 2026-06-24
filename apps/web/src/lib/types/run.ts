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
