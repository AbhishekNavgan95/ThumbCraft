import { AppError } from "@platform/errors";
import {
  getPreferenceOptions,
  isTextEnabled,
  type ThumbnailPreferences,
} from "../../prompts/index.js";
import type { GenerateRequestBody } from "./generate.types.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SELECT_FIELDS = [
  "niche",
  "mood",
  "visualStyle",
  "primaryColor",
  "backgroundStyle",
  "lighting",
  "composition",
  "faceEmphasis",
  "textStyle",
] as const;

function assertUuid(value: string, field: string): void {
  if (!UUID_RE.test(value)) {
    throw new AppError("VALIDATION_ERROR", `${field} must be a valid UUID`, 422);
  }
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", `${field} is required`, 422);
  }
  return value.trim();
}

function assertOptionalStringArray(
  value: unknown,
  field: string,
): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${field} must be an array of strings`,
      422,
    );
  }
  return value.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        `${field}[${index}] must be a non-empty string`,
        422,
      );
    }
    return item.trim();
  });
}

function parseIncludeText(
  value: unknown,
): ThumbnailPreferences["includeText"] | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "Yes" || value === "No") return value;
  throw new AppError(
    "VALIDATION_ERROR",
    'includeText must be boolean or "Yes"/"No"',
    422,
  );
}

function assertSelectOption(field: string, value: string): void {
  const options = getPreferenceOptions(field);
  if (!options) return;
  if (!options.includes(value)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `${field} must be one of: ${options.join(", ")}`,
      422,
    );
  }
}

export function parseGenerateBody(
  body: Record<string, unknown>,
): GenerateRequestBody {
  const originalPrompt = assertNonEmptyString(
    body.originalPrompt ?? body.prompt,
    "originalPrompt",
  );
  if (originalPrompt.length > 4000) {
    throw new AppError(
      "VALIDATION_ERROR",
      "originalPrompt must be at most 4000 characters",
      422,
    );
  }

  const modelId = assertNonEmptyString(body.modelId, "modelId");
  assertUuid(modelId, "modelId");

  const requiredAspectRatio = assertNonEmptyString(
    body.requiredAspectRatio ?? body.aspectRatio,
    "requiredAspectRatio",
  );
  const requiredResolution = assertNonEmptyString(
    body.requiredResolution ?? body.resolution,
    "requiredResolution",
  );

  let sessionId: string | undefined;
  if (body.sessionId !== undefined) {
    sessionId = assertNonEmptyString(body.sessionId, "sessionId");
    assertUuid(sessionId, "sessionId");
  }

  let enhancedPrompt: string | null | undefined;
  if (body.enhancedPrompt !== undefined && body.enhancedPrompt !== null) {
    enhancedPrompt = assertNonEmptyString(body.enhancedPrompt, "enhancedPrompt");
  } else if (body.enhancedPrompt === null) {
    enhancedPrompt = null;
  }

  let usedEnhancedPrompt = false;
  if (body.usedEnhancedPrompt !== undefined) {
    if (typeof body.usedEnhancedPrompt !== "boolean") {
      throw new AppError(
        "VALIDATION_ERROR",
        "usedEnhancedPrompt must be a boolean",
        422,
      );
    }
    usedEnhancedPrompt = body.usedEnhancedPrompt;
  } else if (enhancedPrompt) {
    usedEnhancedPrompt = true;
  }

  const preferences = parsePreferences(
    (body.preferences ?? {}) as Record<string, unknown>,
  );

  return {
    sessionId,
    originalPrompt,
    enhancedPrompt,
    usedEnhancedPrompt,
    preferences,
    modelId,
    requiredAspectRatio,
    requiredResolution,
    referenceImageUrls: assertOptionalStringArray(
      body.referenceImageUrls,
      "referenceImageUrls",
    ),
    referenceTemplateIds: assertOptionalStringArray(
      body.referenceTemplateIds,
      "referenceTemplateIds",
    ),
  };
}

function parsePreferences(
  raw: Record<string, unknown>,
): ThumbnailPreferences {
  const preferences: ThumbnailPreferences = {};

  for (const field of SELECT_FIELDS) {
    if (raw[field] === undefined) continue;
    if (typeof raw[field] !== "string" || !raw[field].trim()) {
      throw new AppError(
        "VALIDATION_ERROR",
        `${field} must be a non-empty string`,
        422,
      );
    }
    const value = raw[field].trim();
    assertSelectOption(field, value);
    preferences[field] = value;
  }

  if (raw.includeText !== undefined) {
    preferences.includeText = parseIncludeText(raw.includeText);
  }

  if (raw.textContent !== undefined) {
    if (typeof raw.textContent !== "string") {
      throw new AppError(
        "VALIDATION_ERROR",
        "textContent must be a string",
        422,
      );
    }
    preferences.textContent = raw.textContent.trim();
  }

  if (!isTextEnabled(preferences.includeText)) {
    delete preferences.textStyle;
    delete preferences.textContent;
  }

  return preferences;
}
