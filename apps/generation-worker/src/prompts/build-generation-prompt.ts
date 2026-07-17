import { GENERATION_BASE_SYSTEM } from "./generation-base.js";
import type { ThumbnailPreferences } from "./types.js";

export function isTextEnabled(
  includeText: ThumbnailPreferences["includeText"],
): boolean {
  return includeText === true || includeText === "Yes";
}

/**
 * Build the full first-turn LLM input:
 * baseSystemPrompt + userText + preferencesBlock
 */
export function buildFinalGenerationPrompt(args: {
  primaryPrompt: string;
  preferences: ThumbnailPreferences;
}): string {
  const base = GENERATION_BASE_SYSTEM.content.trim();
  const prefsBlock = buildPreferencesBlock(args.preferences);
  const lines = [
    base,
    "",
    "Main objective (highest priority):",
    args.primaryPrompt.trim(),
  ];

  if (prefsBlock) {
    lines.push("", prefsBlock);
  }

  return lines.join("\n").trim();
}

/** Supporting style parameters only — never includes model/aspect/resolution. */
export function buildPreferencesBlock(
  preferences: ThumbnailPreferences,
): string {
  const p = preferences;
  const lines: string[] = [
    "Supporting style parameters (apply lightly; do not override the main objective):",
  ];

  if (p.niche) lines.push(`- Content niche: ${p.niche}`);
  if (p.mood) lines.push(`- Emotional mood: ${p.mood}`);
  if (p.visualStyle) lines.push(`- Visual style: ${p.visualStyle}`);

  if (p.primaryColor && p.primaryColor !== "Auto") {
    lines.push(
      `- Accent color: use ${p.primaryColor} as an accent on elements ` +
        `(highlights, UI chrome, text, borders, props) — do NOT tint the entire image that color.`,
    );
  }

  if (p.backgroundStyle && p.backgroundStyle !== "Auto") {
    lines.push(
      `- Background: ${p.backgroundStyle} (keep the main subject clear and readable)`,
    );
  }

  if (p.lighting) lines.push(`- Lighting: ${p.lighting}`);
  if (p.composition) lines.push(`- Composition: ${p.composition}`);

  if (p.faceEmphasis && p.faceEmphasis !== "None") {
    lines.push(
      `- Face emphasis: ${p.faceEmphasis} (only if a face is already part of the main objective)`,
    );
  }

  if (isTextEnabled(p.includeText)) {
    lines.push("- Include overlay text on the thumbnail.");
    if (p.textStyle) lines.push(`- Text style: ${p.textStyle}`);
    if (p.textContent?.trim()) {
      lines.push(`- Exact text to render: "${p.textContent.trim()}"`);
    }
  } else if (p.includeText !== undefined) {
    lines.push("- Do not include any overlay text.");
  }

  // Only base heading → empty block
  return lines.length > 1 ? lines.join("\n") : "";
}

/**
 * Resolve what to send as LLM `input` for this turn.
 * First turn: assembled. Later turns: userText only.
 */
export function resolveProviderInput(args: {
  isFirstTurn: boolean;
  userText: string;
  preferences: ThumbnailPreferences;
}): string {
  if (args.isFirstTurn) {
    return buildFinalGenerationPrompt({
      primaryPrompt: args.userText,
      preferences: args.preferences,
    });
  }
  return args.userText.trim();
}

export function resolveUserText(args: {
  originalPrompt: string;
  enhancedPrompt?: string | null;
  usedEnhancedPrompt?: boolean;
}): string {
  if (args.usedEnhancedPrompt && args.enhancedPrompt?.trim()) {
    return args.enhancedPrompt.trim();
  }
  return args.originalPrompt.trim();
}
