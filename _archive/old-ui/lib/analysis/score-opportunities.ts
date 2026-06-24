import { getAIProvider } from "@/lib/ai";
import { buildScoringPrompt } from "@/lib/ai/prompts";
import { OPPORTUNITY_SCORING_SCHEMA } from "@/lib/ai/schemas";
import type {
  IssueClusterDraft,
  OpportunityScoreResult,
  ProjectInfo,
} from "@/lib/ai/types";

type AIScoreInput = {
  cluster_name: string;
  frequency_score: number;
  sentiment_score: number;
  user_value_score: number;
  business_value_score: number;
  strategic_fit_score: number;
  complexity_score: number;
  evidence_score: number;
  recommendation: string;
  suggested_action: string;
  risk_notes: string;
  missing_evidence: string;
};

function normalizeScore(score: number): number {
  return Math.min(5, Math.max(1, Math.round(score)));
}

function calculateOpportunityScore(
  frequency: number,
  sentiment: number,
  userValue: number,
  businessValue: number,
  strategicFit: number,
  complexity: number,
  evidence: number
): number {
  // All scores are 1-5
  const rawScore =
    frequency * 0.2 +
    sentiment * 0.2 +
    userValue * 0.2 +
    businessValue * 0.2 +
    strategicFit * 0.1 +
    evidence * 0.1 -
    complexity * 0.1;

  // Convert to 0-100 scale
  // Max possible: 5 * 0.2 + 5 * 0.2 + 5 * 0.2 + 5 * 0.2 + 5 * 0.1 + 5 * 0.1 - 1 * 0.1 = 4.5
  // Min possible: 1 * 0.2 + 1 * 0.2 + 1 * 0.2 + 1 * 0.2 + 1 * 0.1 + 1 * 0.1 - 5 * 0.1 = 0.5
  // Range: 0.5 to 4.5 -> map to 0-100
  const normalized = ((rawScore - 0.5) / 4) * 100;
  return Math.round(Math.min(100, Math.max(0, normalized)));
}

function getPriority(score: number): "P0" | "P1" | "P2" | "P3" {
  if (score >= 80) return "P0";
  if (score >= 65) return "P1";
  if (score >= 45) return "P2";
  return "P3";
}

const VALID_SUGGESTED_ACTIONS = [
  "fix_now",
  "improve_experience",
  "add_to_backlog",
  "validate_with_interviews",
  "validate_with_data",
  "ignore_for_now",
  "build_mvp",
] as const;

function normalizeSuggestedAction(action: string): OpportunityScoreResult["suggested_action"] {
  if (
    VALID_SUGGESTED_ACTIONS.includes(
      action as (typeof VALID_SUGGESTED_ACTIONS)[number]
    )
  ) {
    return action as OpportunityScoreResult["suggested_action"];
  }
  return "add_to_backlog";
}

export async function scoreOpportunities(
  project: ProjectInfo,
  clusters: IssueClusterDraft[]
): Promise<OpportunityScoreResult[]> {
  const provider = getAIProvider();
  const { system, user } = buildScoringPrompt(project, clusters);

  const aiScores = await provider.generateJSON<AIScoreInput[]>({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    schemaName: OPPORTUNITY_SCORING_SCHEMA,
    temperature: 0.1,
  });

  // Map AI scores to clusters and calculate final scores
  const results: OpportunityScoreResult[] = [];

  for (const cluster of clusters) {
    // Find matching AI score
    const aiScore = (Array.isArray(aiScores) ? aiScores : []).find(
      (s) => s.cluster_name === cluster.name
    );

    // Use AI scores or defaults
    const frequency = normalizeScore(
      aiScore?.frequency_score || Math.min(5, cluster.feedback_count)
    );
    const sentiment = normalizeScore(aiScore?.sentiment_score || 3);
    const userValue = normalizeScore(aiScore?.user_value_score || 3);
    const businessValue = normalizeScore(aiScore?.business_value_score || 3);
    const strategicFit = normalizeScore(aiScore?.strategic_fit_score || 3);
    const complexity = normalizeScore(aiScore?.complexity_score || 3);
    const evidence = normalizeScore(aiScore?.evidence_score || 3);

    // Calculate opportunity score with code (not relying on AI)
    const opportunityScore = calculateOpportunityScore(
      frequency,
      sentiment,
      userValue,
      businessValue,
      strategicFit,
      complexity,
      evidence
    );

    results.push({
      cluster_name: cluster.name,
      frequency_score: frequency,
      sentiment_score: sentiment,
      user_value_score: userValue,
      business_value_score: businessValue,
      strategic_fit_score: strategicFit,
      complexity_score: complexity,
      evidence_score: evidence,
      opportunity_score: opportunityScore,
      priority: getPriority(opportunityScore),
      recommendation: aiScore?.recommendation || "",
      suggested_action: normalizeSuggestedAction(
        aiScore?.suggested_action || "add_to_backlog"
      ),
      risk_notes: aiScore?.risk_notes || "",
      missing_evidence: aiScore?.missing_evidence || "",
    });
  }

  // Sort by opportunity_score descending
  results.sort((a, b) => b.opportunity_score - a.opportunity_score);

  return results;
}
