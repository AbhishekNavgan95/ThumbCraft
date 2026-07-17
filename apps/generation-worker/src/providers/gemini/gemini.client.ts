import { GoogleGenAI } from "@google/genai";
import { AppError } from "@platform/errors";

export function createGeminiClient(apiKey: string): GoogleGenAI {
  if (!apiKey.trim()) {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "GEMINI_API_KEY is not configured",
      503,
    );
  }
  return new GoogleGenAI({ apiKey });
}
