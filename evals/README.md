# Golden-set evaluations (manual)

**Not part of CI.** These cases call real Gemini, cost money, and take time. Run them when you need docs evidence, after a prompt/model change you care about, or before a release.

```bash
pnpm eval:golden
```

Requires `GEMINI_API_KEY` in `apps/generation-worker/.env`.

The runner assembles prompts the same way production does: `resolveUserText` → `resolveProviderInput` (first-turn base system + preferences block, or follow-up user text only). Optional `continueFrom` reuses a prior `interactionId`; optional `referenceImage` loads a fixture under `evals/`.

## Feature coverage

| Case | Pipeline feature under test |
|------|-----------------------------|
| `01-first-turn-full-preferences` | First-turn assembly + nearly full preference catalog |
| `02-no-text-photoreal-product` | `includeText=No` |
| `03-exact-text-overlay` | Exact `textContent` + `textStyle` + safe margins |
| `04-face-emphasis-creator` | `faceEmphasis=Strong` |
| `05-gaming-mrbeast-energy` | Niche / mood / visualStyle extremes |
| `06-aspect-square-1x1` | Aspect `1:1` |
| `07-aspect-vertical-9x16` | Aspect `9:16` |
| `08-color-accent-not-wash` | `primaryColor` as accent (not full-frame wash) |
| `09-enhanced-prompt-path` | `usedEnhancedPrompt` (enhanced text wins) |
| `10-follow-up-iterate` | Follow-up turn + `previousInteractionId` |
| `11-reference-image-edit` | Multimodal `referenceImages` |
| `12-composition-lighting-background` | Composition + lighting + background combo |
| `13-illustration-anime-style` | Non-photoreal `visualStyle` (Anime) |
| `14-3d-render-education` | `3D Render` + education niche |

## How pass/fail works

Each file under `cases/` is JSON: descriptive prompt, optional preferences / enhance / refs, model id, and a **list of checks**. The script generates an image, then scores the **actual** output against those checks. There is no stored reference PNG to diff.

### Automated checks (script)

| Check | Meaning |
|-------|---------|
| `has_image_bytes` | Response contains a non-empty image buffer |
| `min_bytes` | File size ≥ `value` (rejects tiny/error payloads) |
| `aspect_ratio` | Width/height matches `value` (e.g. `16:9`) within `tolerance` |

### Human glance (documented, not automated)

Cases list `"kind": "human_glance"` checks for thumbnail fitness (title readability, accent-vs-wash, style branch, iterative continuity). The script records these as **manual** and does not fail the case on them. Glance the saved image in the dated results folder and tick them yourself.

## Results

Output lands in `evals/results/<ISO-date>/`: per-case JSON (pass/fail per check, latency, error, provider-input preview, path to the saved image) plus a `summary.json`.
