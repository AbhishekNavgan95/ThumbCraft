/**
 * Manual golden-set eval — calls real Gemini through the same prompt-assembly
 * path as production (resolveUserText + resolveProviderInput), then scores
 * checks. Not for CI.
 *
 * Usage: pnpm eval:golden
 */
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import {
  resolveProviderInput,
  resolveUserText,
  type ThumbnailPreferences,
} from "../src/prompts/index.js";
import { createGeminiClient } from "../src/providers/gemini/gemini.client.js";
import { GeminiImageAdapter } from "../src/providers/gemini/gemini.image-adapter.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workerRoot = resolve(scriptDir, "..");
const repoRoot = resolve(workerRoot, "../..");
const casesDir = resolve(repoRoot, "evals/cases");
const resultsRoot = resolve(repoRoot, "evals/results");
const evalsRoot = resolve(repoRoot, "evals");

loadDotenv({ path: resolve(workerRoot, ".env") });

type Check =
  | { kind: "has_image_bytes" }
  | { kind: "min_bytes"; value: number }
  | { kind: "aspect_ratio"; value: string; tolerance?: number }
  | { kind: "human_glance"; description: string };

interface EvalCase {
  id: string;
  /** Short description of which pipeline feature this case exercises. */
  feature?: string;
  /** User-typed prompt (originalPrompt). */
  prompt: string;
  /** Optional enhance-feature rewrite; used when usedEnhancedPrompt is true. */
  enhancedPrompt?: string;
  usedEnhancedPrompt?: boolean;
  preferences?: ThumbnailPreferences;
  /**
   * First chat turn assembles base system + prefs.
   * Follow-ups send userText only (matches production).
   */
  isFirstTurn?: boolean;
  /**
   * Reuse `interactionId` from a prior case in this run (iterative edit).
   * Case files are sorted by name — put the parent case earlier alphabetically.
   */
  continueFrom?: string;
  /** Path relative to `evals/` for a local reference image fixture. */
  referenceImage?: string;
  modelId: string;
  aspectRatio: string;
  resolution: string;
  checks: Check[];
}

interface CheckResult {
  kind: string;
  pass: boolean | "manual";
  detail?: string;
  description?: string;
}

function parseAspect(value: string): number {
  const [w, h] = value.split(":").map(Number);
  if (!w || !h) {
    throw new Error(`Invalid aspect ratio: ${value}`);
  }
  return w / h;
}

function mimeFromPath(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

/** Minimal PNG / JPEG dimension reader (no native deps). */
function readImageSize(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer.toString("ascii", 1, 4) === "PNG"
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1]!;
      const size = buffer.readUInt16BE(offset + 2);
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + size;
    }
  }

  return null;
}

function scoreChecks(
  checks: Check[],
  image: { buffer: Buffer; width?: number | null; height?: number | null },
): CheckResult[] {
  const size = readImageSize(image.buffer);
  const width = image.width ?? size?.width ?? null;
  const height = image.height ?? size?.height ?? null;

  return checks.map((check) => {
    if (check.kind === "human_glance") {
      return {
        kind: check.kind,
        pass: "manual",
        description: check.description,
      };
    }
    if (check.kind === "has_image_bytes") {
      const pass = image.buffer.length > 0;
      return {
        kind: check.kind,
        pass,
        detail: pass ? `${image.buffer.length} bytes` : "empty buffer",
      };
    }
    if (check.kind === "min_bytes") {
      const pass = image.buffer.length >= check.value;
      return {
        kind: check.kind,
        pass,
        detail: `${image.buffer.length} >= ${check.value}`,
      };
    }
    if (check.kind === "aspect_ratio") {
      if (!width || !height) {
        return {
          kind: check.kind,
          pass: false,
          detail: "could not read image dimensions",
        };
      }
      const expected = parseAspect(check.value);
      const actual = width / height;
      const tolerance = check.tolerance ?? 0.08;
      const pass = Math.abs(actual - expected) <= tolerance;
      return {
        kind: check.kind,
        pass,
        detail: `${width}x${height} ratio=${actual.toFixed(4)} expected=${expected.toFixed(4)} ±${tolerance}`,
      };
    }
    return { kind: "unknown", pass: false, detail: JSON.stringify(check) };
  });
}

function loadReferenceImage(relativePath: string) {
  const absolute = resolve(evalsRoot, relativePath);
  if (!existsSync(absolute)) {
    throw new Error(`Reference image not found: ${absolute}`);
  }
  const buffer = readFileSync(absolute);
  return {
    base64: buffer.toString("base64"),
    mimeType: mimeFromPath(absolute),
    url: absolute,
  };
}

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("FAIL: GEMINI_API_KEY is missing from apps/generation-worker/.env");
  process.exit(1);
}

const caseFiles = readdirSync(casesDir)
  .filter((name) => name.endsWith(".json"))
  .sort();

if (caseFiles.length === 0) {
  console.error(`No cases found in ${casesDir}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = resolve(resultsRoot, stamp);
mkdirSync(outDir, { recursive: true });

const adapter = new GeminiImageAdapter(createGeminiClient(apiKey));
const interactionByCaseId = new Map<string, string>();
const summary: Array<{
  id: string;
  feature?: string;
  pass: boolean;
  latencyMs: number;
  error?: string;
  imagePath?: string;
  checks: CheckResult[];
}> = [];

console.log(`Running ${caseFiles.length} golden cases → ${outDir}`);
console.log(
  "Prompt assembly uses production resolveUserText + resolveProviderInput.\n",
);

for (const file of caseFiles) {
  const evalCase = JSON.parse(
    readFileSync(resolve(casesDir, file), "utf8"),
  ) as EvalCase;
  const started = Date.now();
  const featureLabel = evalCase.feature ? ` [${evalCase.feature}]` : "";
  process.stdout.write(`  ${evalCase.id}${featureLabel}… `);

  try {
    const isFirstTurn = evalCase.isFirstTurn ?? true;
    const userText = resolveUserText({
      originalPrompt: evalCase.prompt,
      enhancedPrompt: evalCase.enhancedPrompt,
      usedEnhancedPrompt: evalCase.usedEnhancedPrompt,
    });
    const providerInput = resolveProviderInput({
      isFirstTurn,
      userText,
      preferences: evalCase.preferences ?? {},
    });

    let previousInteractionId: string | null = null;
    if (evalCase.continueFrom) {
      previousInteractionId =
        interactionByCaseId.get(evalCase.continueFrom) ?? null;
      if (!previousInteractionId) {
        throw new Error(
          `continueFrom "${evalCase.continueFrom}" has no interactionId yet — run parent case first (sort order)`,
        );
      }
    }

    const referenceImages = evalCase.referenceImage
      ? [loadReferenceImage(evalCase.referenceImage)]
      : undefined;

    const result = await adapter.generate({
      model: evalCase.modelId,
      input: providerInput,
      aspectRatio: evalCase.aspectRatio,
      resolution: evalCase.resolution,
      mimeType: "image/jpeg",
      previousInteractionId,
      referenceImages,
    });

    const image = result.images[0];
    if (!image) {
      throw new Error("Provider returned no images");
    }

    if (result.interactionId) {
      interactionByCaseId.set(evalCase.id, result.interactionId);
    }

    const imagePath = resolve(outDir, `${evalCase.id}.jpg`);
    writeFileSync(imagePath, image.buffer);

    const checks = scoreChecks(evalCase.checks, image);
    const automatedFailed = checks.some((c) => c.pass === false);
    const latencyMs = Date.now() - started;

    const record = {
      id: evalCase.id,
      feature: evalCase.feature,
      pass: !automatedFailed,
      latencyMs,
      imagePath,
      checks,
      interactionId: result.interactionId ?? null,
      isFirstTurn,
      usedEnhancedPrompt: Boolean(evalCase.usedEnhancedPrompt),
      continueFrom: evalCase.continueFrom ?? null,
      referenceImage: evalCase.referenceImage ?? null,
      providerInputPreview: providerInput.slice(0, 500),
      providerInputLength: providerInput.length,
    };
    writeFileSync(
      resolve(outDir, `${evalCase.id}.json`),
      JSON.stringify(record, null, 2),
    );
    summary.push({
      id: record.id,
      feature: record.feature,
      pass: record.pass,
      latencyMs: record.latencyMs,
      imagePath: record.imagePath,
      checks: record.checks,
    });
    console.log(
      automatedFailed ? `FAIL (${latencyMs}ms)` : `PASS (${latencyMs}ms)`,
    );
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    const record = {
      id: evalCase.id,
      feature: evalCase.feature,
      pass: false,
      latencyMs,
      error: message,
      checks: [] as CheckResult[],
    };
    writeFileSync(
      resolve(outDir, `${evalCase.id}.json`),
      JSON.stringify(record, null, 2),
    );
    summary.push(record);
    console.log(`ERROR (${latencyMs}ms): ${message}`);
  }
}

const passed = summary.filter((s) => s.pass).length;
writeFileSync(
  resolve(outDir, "summary.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      passed,
      total: summary.length,
      results: summary,
    },
    null,
    2,
  ),
);

console.log(`\nDone: ${passed}/${summary.length} passed (automated checks).`);
console.log(`Results: ${outDir}`);
console.log(
  "Human-glance checks are recorded as manual — open the images and review them.",
);

if (passed < summary.length) {
  process.exit(1);
}
