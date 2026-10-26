# Golden-set evaluations (manual)

**Not part of CI.** These cases call real Gemini, cost money, and take time. Run them when you need docs evidence, after a prompt/model change you care about, or before a release.

```bash
pnpm eval:golden
```

Requires `GEMINI_API_KEY` in `apps/generation-worker/.env`.

## How pass/fail works

Each file under `cases/` is JSON: prompt, optional preferences, model id, and a **list of checks**. The script generates an image, then scores the **actual** output against those checks. There is no stored reference PNG to diff.

### Automated checks (script)

| Check | Meaning |
|-------|---------|
| `has_image_bytes` | Response contains a non-empty image buffer |
| `min_bytes` | File size ≥ `value` (rejects tiny/error payloads) |
| `aspect_ratio` | Width/height matches `value` (e.g. `16:9`) within `tolerance` |

### Human glance (documented, not automated)

Cases may list checks with `"kind": "human_glance"` — for example “large title text” or “looks like a YouTube thumbnail.” The script records these as **manual** and does not fail the case on them. Glance the saved image in the dated results folder and tick them yourself.

## Results

Output lands in `evals/results/<ISO-date>/`: per-case JSON (pass/fail per check, latency, error, image path) plus a `summary.json`.
