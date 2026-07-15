export type SystemPromptKey = "prompt_enhance";

export interface SystemPromptDefinition {
  key: SystemPromptKey;
  /** Bump when the prompt text changes meaningfully. */
  version: number;
  description: string;
  content: string;
}
