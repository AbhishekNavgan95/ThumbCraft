import type OpenAI from "openai";
import { AppError } from "@platform/errors";
import { getSystemPrompt } from "../../prompts/index.js";

export class PromptEnhancer {
  constructor(
    private readonly openai: OpenAI,
    private readonly model: string,
  ) {}

  async enhance(originalPrompt: string): Promise<{
    enhancedPrompt: string;
    model: string;
    systemPromptKey: string;
    systemPromptVersion: number;
  }> {
    const system = getSystemPrompt("prompt_enhance");

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: system.content },
          {
            role: "user",
            content: `Enhance this thumbnail prompt:\n\n${originalPrompt}`,
          },
        ],
        max_completion_tokens: 300,
      });

      const enhanced = response.choices[0]?.message?.content?.trim();
      if (!enhanced) {
        throw new AppError(
          "INTERNAL_ERROR",
          "Prompt enhancement returned an empty response",
          500,
        );
      }

      return {
        enhancedPrompt: enhanced,
        model: this.model,
        systemPromptKey: system.key,
        systemPromptVersion: system.version,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      const message =
        error instanceof Error ? error.message : "OpenAI request failed";
      throw new AppError(
        "INTERNAL_ERROR",
        `Prompt enhancement failed: ${message}`,
        502,
      );
    }
  }
}
