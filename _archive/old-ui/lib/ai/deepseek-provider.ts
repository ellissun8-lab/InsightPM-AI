/**
 * DeepSeek AI Provider
 * 用于验证和语义审查
 */

import type {
  AIProvider,
  AIMessage,
  GenerateJSONOptions,
} from "./types";

export class DeepSeekProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; model: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl || "https://api.deepseek.com";
  }

  async generateText(
    messages: AIMessage[],
    options?: { temperature?: number }
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? 0.3,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || "";
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateJSON<T>(options: GenerateJSONOptions): Promise<T> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const text = await this.generateText(options.messages, {
          temperature: options.temperature ?? 0.1,
        });

        const jsonStr = this.extractJSON(text);
        return JSON.parse(jsonStr) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `DeepSeek JSON parse attempt ${attempt}/${maxRetries} failed:`,
          lastError.message
        );

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    throw new Error(
      `Failed to parse DeepSeek JSON response after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  private extractJSON(text: string): string {
    const codeBlockMatch = text.match(
      /```(?:json)?\s*\n?([\s\S]*?)\n?```/
    );
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      return jsonMatch[1];
    }

    return text.trim();
  }
}
