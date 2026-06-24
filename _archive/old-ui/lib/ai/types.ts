export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GenerateJSONOptions = {
  messages: AIMessage[];
  schemaName: string;
  temperature?: number;
};

export interface AIProvider {
  generateText(
    messages: AIMessage[],
    options?: { temperature?: number }
  ): Promise<string>;
  generateJSON<T>(options: GenerateJSONOptions): Promise<T>;
}

export type FeedbackClassification = {
  is_valid: boolean;
  invalid_reason?: string;
  cleaned_content: string;
  feedback_type:
    | "bug"
    | "ux_issue"
    | "feature_request"
    | "pricing"
    | "performance"
    | "complaint"
    | "praise"
    | "question"
    | "other";
  product_module: string;
  sentiment: "positive" | "neutral" | "negative" | "strong_negative";
  sentiment_strength: number;
  user_intent: string;
  possible_metrics: string[];
  ai_summary: string;
  labels: string[];
};

export type IssueClusterDraft = {
  name: string;
  summary: string;
  feedback_ids: string[];
  feedback_count: number;
  main_complaint: string;
  affected_user_types: string[];
  related_modules: string[];
  possible_metrics: string[];
  representative_feedback_ids: string[];
};

export type OpportunityScoreResult = {
  cluster_name: string;
  frequency_score: number;
  sentiment_score: number;
  user_value_score: number;
  business_value_score: number;
  strategic_fit_score: number;
  complexity_score: number;
  evidence_score: number;
  opportunity_score: number;
  priority: "P0" | "P1" | "P2" | "P3";
  recommendation: string;
  suggested_action:
    | "fix_now"
    | "improve_experience"
    | "add_to_backlog"
    | "validate_with_interviews"
    | "validate_with_data"
    | "ignore_for_now"
    | "build_mvp";
  risk_notes: string;
  missing_evidence: string;
};

export type ProjectInfo = {
  name: string;
  product_type?: string | null;
  business_goal?: string | null;
  target_user?: string | null;
  key_metric?: string | null;
};

export type ClassifiedFeedback = {
  id: string;
  raw_content: string;
  classification: FeedbackClassification;
};
