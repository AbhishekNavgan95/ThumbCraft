/**
 * One-off smoke test: load GEMINI_API_KEY from .env and generate a tiny image.
 * Usage: pnpm exec tsx scripts/test-gemini-image.ts
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { createGeminiClient } from "../src/providers/gemini/gemini.client.js";
import { GeminiImageAdapter } from "../src/providers/gemini/gemini.image-adapter.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: resolve(root, ".env") });

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("FAIL: GEMINI_API_KEY is missing from .env");
  process.exit(1);
}

console.log(`Key present: ${apiKey.slice(0, 6)}…${apiKey.slice(-4)} (${apiKey.length} chars)`);
console.log("Calling Gemini image generation…");

const adapter = new GeminiImageAdapter(createGeminiClient(apiKey));
const started = Date.now();

try {
  const result = await adapter.generate({
    model: "gemini-3.1-flash-image",
    input:
      "A simple flat YouTube thumbnail: bright red circle on white background, no text.",
    aspectRatio: "16:9",
    resolution: "1K",
    mimeType: "image/jpeg",
  });

  const ms = Date.now() - started;
  const image = result.images[0];
  if (!image) {
    console.error("FAIL: no image in response", JSON.stringify(result.raw, null, 2)?.slice(0, 2000));
    process.exit(1);
  }

  const outPath = resolve(root, "scripts", "gemini-test-output.jpg");
  writeFileSync(outPath, image.buffer);

  console.log("OK: Gemini key works");
  console.log(`  interactionId: ${result.interactionId ?? "(none)"}`);
  console.log(`  images: ${result.images.length}`);
  console.log(`  mimeType: ${image.mimeType}`);
  console.log(`  bytes: ${image.buffer.length}`);
  console.log(`  elapsedMs: ${ms}`);
  console.log(`  saved: ${outPath}`);
} catch (error) {
  const ms = Date.now() - started;
  console.error(`FAIL after ${ms}ms`);
  if (error && typeof error === "object" && "message" in error) {
    console.error((error as { message: string }).message);
  } else {
    console.error(error);
  }
  process.exit(1);
}
