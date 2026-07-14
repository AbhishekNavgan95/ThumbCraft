/**
 * Seed generation_models from reference/Gemini-models.json.
 *
 * Usage (from apps/generation-worker):
 *   pnpm db:seed:models
 *
 * Requires DATABASE_URL (loads .env via dotenv).
 * Re-runs upsert catalog fields; does not overwrite existing `visible` flags.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "../src/db/index.js";

type GeminiModelRef = {
  id: string;
  name: string;
  alias?: string;
  recommended_for?: string;
  supported_aspect_ratios: string[];
  supported_resolutions: string[];
  deprecated?: boolean;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_PATH = join(__dirname, "../../../reference/Gemini-models.json");

/** First-time defaults only (existing rows keep their visibility). */
const VISIBLE_ON_CREATE = new Set([
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite-image",
  "gemini-3-pro-image",
]);

async function main() {
  const raw = readFileSync(REF_PATH, "utf8");
  const entries = JSON.parse(raw) as GeminiModelRef[];

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`No models found in ${REF_PATH}`);
  }

  const prisma = createPrismaClient();

  try {
    let created = 0;
    let updated = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry?.id || !entry.name) {
        console.warn(`Skipping invalid entry at index ${i}`);
        continue;
      }

      const data = {
        provider: "gemini" as const,
        title: entry.name,
        description: entry.recommended_for?.trim() || entry.name,
        supportedAspectRatios: entry.supported_aspect_ratios ?? [],
        supportedResolutions: entry.supported_resolutions ?? [],
        sortOrder: i,
      };

      const existing = await prisma.generationModel.findUnique({
        where: { providerModelId: entry.id },
      });

      if (existing) {
        await prisma.generationModel.update({
          where: { providerModelId: entry.id },
          data,
        });
        updated += 1;
        console.log(`updated  ${entry.id}`);
      } else {
        await prisma.generationModel.create({
          data: {
            ...data,
            providerModelId: entry.id,
            visible: VISIBLE_ON_CREATE.has(entry.id) && !entry.deprecated,
          },
        });
        created += 1;
        console.log(`created  ${entry.id}`);
      }
    }

    console.log(`\nDone. created=${created} updated=${updated} total=${entries.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
