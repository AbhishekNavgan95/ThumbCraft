export type SystemPromptKey = "prompt_enhance" | "generation_base";

export interface SystemPromptDefinition {
  key: SystemPromptKey;
  /** Bump when the prompt text changes meaningfully. */
  version: number;
  description: string;
  content: string;
}

/** Prompt-embedded wizard answers (never include model/aspect/resolution). */
export interface ThumbnailPreferences {
  niche?: string;
  mood?: string;
  visualStyle?: string;
  primaryColor?: string;
  backgroundStyle?: string;
  lighting?: string;
  composition?: string;
  faceEmphasis?: string;
  includeText?: boolean | "Yes" | "No";
  textStyle?: string;
  textContent?: string;
}

export type PreferenceFieldType =
  | "single-select"
  | "boolean"
  | "text"
  | "dynamic-select";

export interface PreferenceFieldDefinition {
  id: string;
  type: PreferenceFieldType;
  title: string;
  description: string;
  options?: string[];
  placeholder?: string;
  dependsOn?: { field: string; value: string };
  source?: string;
}
