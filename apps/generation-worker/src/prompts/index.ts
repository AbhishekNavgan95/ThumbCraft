import { AppError } from "@platform/errors";
import { GENERATION_BASE_SYSTEM } from "./generation-base.js";
import { PROMPT_ENHANCE_SYSTEM } from "./prompt-enhance.js";
import type { SystemPromptDefinition, SystemPromptKey } from "./types.js";

const REGISTRY: Record<SystemPromptKey, SystemPromptDefinition> = {
  prompt_enhance: PROMPT_ENHANCE_SYSTEM,
  generation_base: GENERATION_BASE_SYSTEM,
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

export type {
  PreferenceFieldDefinition,
  PreferenceFieldType,
  SystemPromptDefinition,
  SystemPromptKey,
  ThumbnailPreferences,
} from "./types.js";
export {
  buildFinalGenerationPrompt,
  buildPreferencesBlock,
  isTextEnabled,
  resolveProviderInput,
  resolveUserText,
} from "./build-generation-prompt.js";
export {
  getPreferenceOptions,
  getPromptEmbeddedPreferenceIds,
  PREFERENCE_CATALOG,
  PREFERENCE_CATALOG_VERSION,
} from "./preference-catalog.js";
export { GENERATION_BASE_SYSTEM } from "./generation-base.js";
export { PROMPT_ENHANCE_SYSTEM } from "./prompt-enhance.js";
