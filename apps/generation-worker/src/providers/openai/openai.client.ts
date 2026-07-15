import OpenAI from "openai";
import { AppError } from "@platform/errors";

export function createOpenAIClient(apiKey: string): OpenAI {
  if (!apiKey.trim()) {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "OPENAI_API_KEY is not configured",
      503,
    );
  }
  return new OpenAI({ apiKey });
}
