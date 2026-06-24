import { getAIProvider } from "@/lib/ai";
import { buildClusteringPrompt } from "@/lib/ai/prompts";
import { ISSUE_CLUSTERING_SCHEMA } from "@/lib/ai/schemas";
import type {
  IssueClusterDraft,
  ProjectInfo,
  ClassifiedFeedback,
} from "@/lib/ai/types";

const MAX_CLUSTERS = 10;

export async function clusterIssues(
  project: ProjectInfo,
  classifiedFeedback: ClassifiedFeedback[]
): Promise<IssueClusterDraft[]> {
  const provider = getAIProvider();

  // Limit to 100 items to avoid huge prompts
  const MAX_ITEMS = 100;
  const validFeedback = classifiedFeedback
    .filter((f) => f.classification.is_valid)
    .slice(0, MAX_ITEMS);

  // Prepare feedback list for the prompt (use summary to reduce size)
  const feedbackList = validFeedback
    .map(
      (f) =>
        `ID: ${f.id}\n内容: ${f.classification.ai_summary || f.classification.cleaned_content.substring(0, 200)}\n类型: ${f.classification.feedback_type}\n情绪: ${f.classification.sentiment}`
    )
    .join("\n---\n");

  const { system, user } = buildClusteringPrompt(project, feedbackList);

  const results = await provider.generateJSON<IssueClusterDraft[]>({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    schemaName: ISSUE_CLUSTERING_SCHEMA,
    temperature: 0.2,
  });

  // Validate and limit results
  const validClusters = (Array.isArray(results) ? results : [])
    .filter(
      (cluster) =>
        cluster.name &&
        cluster.summary &&
        Array.isArray(cluster.feedback_ids) &&
        cluster.feedback_ids.length > 0
    )
    .slice(0, MAX_CLUSTERS)
    .map((cluster) => ({
      name: cluster.name,
      summary: cluster.summary,
      feedback_ids: cluster.feedback_ids,
      feedback_count: cluster.feedback_count || cluster.feedback_ids.length,
      main_complaint: cluster.main_complaint || "",
      affected_user_types: Array.isArray(cluster.affected_user_types)
        ? cluster.affected_user_types
        : [],
      related_modules: Array.isArray(cluster.related_modules)
        ? cluster.related_modules
        : [],
      possible_metrics: Array.isArray(cluster.possible_metrics)
        ? cluster.possible_metrics
        : [],
      representative_feedback_ids: Array.isArray(
        cluster.representative_feedback_ids
      )
        ? cluster.representative_feedback_ids.slice(0, 3)
        : cluster.feedback_ids.slice(0, 3),
    }));

  return validClusters;
}
