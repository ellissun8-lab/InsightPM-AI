import { getAIProvider } from "@/lib/ai";
import { buildClassificationPrompt } from "@/lib/ai/prompts";
import { FEEDBACK_CLASSIFICATION_SCHEMA } from "@/lib/ai/schemas";
import type {
  FeedbackClassification,
  ProjectInfo,
} from "@/lib/ai/types";

export async function classifySingleFeedback(
  project: ProjectInfo,
  feedbackContent: string
): Promise<FeedbackClassification> {
  const provider = getAIProvider();
  const { system, user } = buildClassificationPrompt(project, feedbackContent);

  const result = await provider.generateJSON<FeedbackClassification>({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    schemaName: FEEDBACK_CLASSIFICATION_SCHEMA,
    temperature: 0.1,
  });

  return {
    is_valid: Boolean(result.is_valid),
    invalid_reason: result.invalid_reason || undefined,
    cleaned_content: result.cleaned_content || feedbackContent,
    feedback_type: result.feedback_type || "other",
    product_module: result.product_module || "unknown",
    sentiment: result.sentiment || "neutral",
    sentiment_strength: Math.min(5, Math.max(1, result.sentiment_strength || 3)),
    user_intent: result.user_intent || "",
    possible_metrics: Array.isArray(result.possible_metrics)
      ? result.possible_metrics
      : [],
    ai_summary: result.ai_summary || feedbackContent.substring(0, 100),
    labels: Array.isArray(result.labels) ? result.labels : [],
  };
}

const MAX_ITEMS = 50;

export async function classifyFeedbackBatch(
  project: ProjectInfo,
  feedbackItems: { id: string; raw_content: string }[],
  onProgress?: (processed: number, total: number) => Promise<void>
): Promise<
  { id: string; raw_content: string; classification: FeedbackClassification }[]
> {
  const items = feedbackItems.slice(0, MAX_ITEMS);
  const results: {
    id: string;
    raw_content: string;
    classification: FeedbackClassification;
  }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      console.log(`[Classify] ${i + 1}/${items.length}: ${item.id}`);
      const classification = await classifySingleFeedback(
        project,
        item.raw_content
      );
      results.push({ id: item.id, raw_content: item.raw_content, classification });
    } catch (error) {
      console.error(`Failed to classify ${item.id}:`, error);
      results.push({
        id: item.id,
        raw_content: item.raw_content,
        classification: {
          is_valid: true,
          cleaned_content: item.raw_content,
          feedback_type: "other",
          product_module: "unknown",
          sentiment: "neutral",
          sentiment_strength: 3,
          user_intent: "unknown",
          possible_metrics: [],
          ai_summary: item.raw_content.substring(0, 100),
          labels: [],
        },
      });
    }

    if (onProgress) {
      await onProgress(i + 1, items.length);
    }
  }

  return results;
}
