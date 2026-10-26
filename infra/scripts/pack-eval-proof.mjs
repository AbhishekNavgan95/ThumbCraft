/**
 * Build a Drive / GitHub-ready proof pack from the latest (or given) eval run.
 *
 * Usage:
 *   node infra/scripts/pack-eval-proof.mjs
 *   node infra/scripts/pack-eval-proof.mjs 2026-10-26T18-46-32-822Z
 *
 * Output:
 *   evals/proof-packs/thumbcraft-golden-eval-<stamp>/
 *   evals/proof-packs/thumbcraft-golden-eval-<stamp>.zip
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const resultsRoot = join(root, "evals/results");
const casesDir = join(root, "evals/cases");
const fixturesDir = join(root, "evals/fixtures");
const packsRoot = join(root, "evals/proof-packs");

const requested = process.argv[2];
const runIds = readdirSync(resultsRoot).filter(
  (name) => name !== ".gitkeep" && existsSync(join(resultsRoot, name, "summary.json")),
);
if (runIds.length === 0) {
  console.error("No eval results found under evals/results/. Run pnpm eval:golden first.");
  process.exit(1);
}
runIds.sort();
const runId = requested ?? runIds[runIds.length - 1];
const runDir = join(resultsRoot, runId);
if (!existsSync(join(runDir, "summary.json"))) {
  console.error(`Run not found: ${runId}`);
  process.exit(1);
}

const packName = `thumbcraft-golden-eval-${runId}`;
const packDir = join(packsRoot, packName);
const zipPath = join(packsRoot, `${packName}.zip`);

rmSync(packDir, { recursive: true, force: true });
mkdirSync(join(packDir, "01-inputs/cases"), { recursive: true });
mkdirSync(join(packDir, "01-inputs/fixtures"), { recursive: true });
mkdirSync(join(packDir, "02-outputs/images"), { recursive: true });
mkdirSync(join(packDir, "02-outputs/scores"), { recursive: true });

cpSync(casesDir, join(packDir, "01-inputs/cases"), { recursive: true });
for (const name of readdirSync(fixturesDir)) {
  if (name === "README.md") continue;
  cpSync(join(fixturesDir, name), join(packDir, "01-inputs/fixtures", name));
}

const rawSummary = JSON.parse(readFileSync(join(runDir, "summary.json"), "utf8"));
const cleanedResults = [];

for (const name of readdirSync(runDir)) {
  if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png")) {
    cpSync(join(runDir, name), join(packDir, "02-outputs/images", name));
  }
}

for (const name of readdirSync(runDir)) {
  if (!name.endsWith(".json") || name === "summary.json") continue;
  const record = JSON.parse(readFileSync(join(runDir, name), "utf8"));
  const imageName = `${record.id}.jpg`;
  const cleaned = {
    ...record,
    imagePath: `02-outputs/images/${imageName}`,
  };
  writeFileSync(
    join(packDir, "02-outputs/scores", name),
    JSON.stringify(cleaned, null, 2),
  );
}

for (const row of rawSummary.results ?? []) {
  cleanedResults.push({
    ...row,
    imagePath: `02-outputs/images/${row.id}.jpg`,
  });
}

const summary = {
  product: "Thumbcraft",
  kind: "manual-golden-eval",
  runId,
  createdAt: rawSummary.createdAt,
  passedAutomated: rawSummary.passed,
  total: rawSummary.total,
  note: "Automated checks: has_image_bytes, min_bytes, aspect_ratio. human_glance checks are manual review prompts, not CI gates. Evals are not part of pull-request CI.",
  results: cleanedResults,
};
writeFileSync(
  join(packDir, "02-outputs/summary.json"),
  JSON.stringify(summary, null, 2),
);

const lines = [
  "# Thumbcraft — golden eval proof pack",
  "",
  "Manual Gemini golden-set evaluation (not CI). Use this folder as evidence for GitHub releases, issues, or social posts.",
  "",
  "## Run",
  "",
  `| | |`,
  `|---|---|`,
  `| Run id | \`${runId}\` |`,
  `| Created | ${summary.createdAt} |`,
  `| Automated pass | **${summary.passedAutomated}/${summary.total}** |`,
  `| Model | \`gemini-3.1-flash-image\` (per case JSON) |`,
  "",
  "## Layout",
  "",
  "```",
  "01-inputs/",
  "  cases/       # prompts + preferences + checks (what we asked for)",
  "  fixtures/    # reference image used by multimodal cases",
  "02-outputs/",
  "  images/      # generated JPGs",
  "  scores/      # per-case pass/fail + latency",
  "  summary.json # rollup",
  "```",
  "",
  "## Case index",
  "",
  "| Case | Feature | Automated | Image |",
  "|------|---------|-----------|-------|",
];

for (const row of cleanedResults) {
  const auto = row.pass ? "PASS" : "FAIL";
  lines.push(
    `| \`${row.id}\` | ${row.feature ?? "—"} | ${auto} | [jpg](02-outputs/images/${row.id}.jpg) |`,
  );
}

lines.push(
  "",
  "## How to share",
  "",
  "1. Upload this folder (or the sibling `.zip`) to Google Drive.",
  "2. Link the Drive folder from a GitHub release / issue / tweet.",
  "3. For a quick social preview, attach a few images from `02-outputs/images/` directly.",
  "",
  "## Reproduce",
  "",
  "```bash",
  "pnpm eval:golden",
  "node infra/scripts/pack-eval-proof.mjs",
  "```",
  "",
);

writeFileSync(join(packDir, "README.md"), lines.join("\n"));

rmSync(zipPath, { force: true });
const zip = spawnSync(
  "powershell",
  [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${packDir}\\*' -DestinationPath '${zipPath}' -Force`,
  ],
  { stdio: "inherit" },
);
if (zip.status !== 0) {
  console.warn("Zip failed — folder pack is still available.");
} else {
  console.log(`zip: ${zipPath}`);
}

console.log(`pack: ${packDir}`);
console.log(`score: ${summary.passedAutomated}/${summary.total} automated`);
