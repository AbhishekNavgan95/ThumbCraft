import { AppError } from "@platform/errors";
import { PROMPT_ENHANCE_SYSTEM } from "./prompt-enhance.js";
import type { SystemPromptDefinition, SystemPromptKey } from "./types.js";

const REGISTRY: Record<SystemPromptKey, SystemPromptDefinition> = {
  prompt_enhance: PROMPT_ENHANCE_SYSTEM,
};

export function getSystemPrompt(key: SystemPromptKey): SystemPromptDefinition {
  const prompt = REGISTRY[key];
  if (!prompt) {
    throw new AppError("NOT_FOUND", `Unknown system prompt: ${key}`, 404);
  }
  return prompt;
}

export function listSystemPrompts(): SystemPromptDefinition[] {
  return Object.values(REGISTRY);
}

export type { SystemPromptDefinition, SystemPromptKey };
export { PROMPT_ENHANCE_SYSTEM };
