# Evaluation and testing

## Why this comes first

Thumbcraft charges coins and calls Gemini. A small change in prompt assembly, job status, or wallet reserve can charge a user twice, skip capture, or enqueue a job that never finishes. You cannot see those bugs by clicking the UI once. Tests are how you change the worker without being afraid of it. A manual golden eval is how you document that real Gemini still returns a usable thumbnail (bytes, size, aspect)—not how every PR proves picture quality.

If you skip this and jump to tracing or ECS, you will not know whether a failure is a real regression or an environment problem.

## What “good” looks like

A pull request can run without Gemini, Stripe, or AWS. Fake generation still walks the real path: create session messages, reserve coins, enqueue BullMQ, complete or fail the job, capture or release coins. Separately, a **manual** golden-set script can call real Gemini once (for docs or a release check) and score each image against a short checklist—not against a stored “expected” PNG.

You should be able to say: “CI proves the pipeline with fakes. Evals are manual, use real Gemini, and pass or fail on checks. I do not put evals in CI.”

## Testing: choose Vitest and Fastify inject

Use **Vitest** as the runner for every app under `apps/` and for shared packages. The frontend already lives on Vite. The backend is TypeScript ESM. Jest would work, but it adds a second module system and slower startup for no benefit here.

Do not stand up real HTTP ports in unit tests. Fastify’s `app.inject()` sends a fake request through the same plugins and routes. That is enough to test the gateway proxies, generate returning 202, idempotency 409, and auth rejecting a missing JWT.

Keep **Prisma** against a real Postgres when the test is about jobs or wallet rows. In-memory fakes hide unique constraints on `idempotencyKey` and transaction keys like `reserve:{jobId}`. Docker Compose already runs Postgres. A dedicated `generation_test` / `wallet_test` database, wiped in `beforeEach` or wrapped in transactions, is simpler than mocking the database.

Do **not** call Gemini or OpenAI in pull-request CI. `FAKE_IMAGE_GENERATION` already exists on the generation worker so you can finish a job without a provider. Point tests at that flag. The suite stays free, fast, and deterministic.

Do **not** start with Playwright covering the whole wizard. Browser tests are slow and they break when you rename a button. Add a thin UI test later for “submit generate → see polling → see image.” The money bugs live in the worker and wallet, not in Tailwind.

### What to test first (the cases that pay for themselves)

Cover the generate happy path: authenticated generate creates a user message, an assistant message, a job, a wallet reserve, and a BullMQ job, then returns 202.

Cover idempotency: the same `Idempotency-Key` does not create a second job or a second reserve.

Cover wallet: reserve then capture on `generation.completed`; reserve then release on `generation.failed` or exhausted retries. Sending the same capture twice must not subtract coins twice.

Cover fake worker success and fake worker failure, including `finalizeJobFailure` after BullMQ attempts are exhausted.

Cover “not enough coins” so generate never enqueues if reserve fails.

A few gateway tests are enough: missing JWT is 401; generate forwards `X-Correlation-Id` and `Idempotency-Key`.

### How to wire it in this repo

Add a `test` script to each app’s `package.json` that runs Vitest. Root `pnpm test` already calls `turbo run test`; once apps define the script, Turbo will run them.

Put tests next to the code or under `apps/<service>/src/**/*.test.ts`. Prefer calling services with a test Fastify instance rather than importing half of `index.ts` (that file starts Redis and workers).

Use Fastify inject for HTTP. Use a short-lived Redis from Compose if you must enqueue a real BullMQ job; otherwise inject a fake queue that records `enqueue` calls, and keep one integration test that uses real Redis so the worker file stays honest.

Do not add a coverage gate on day one. Coverage numbers hide untested billing paths if you only test health routes. Add coverage later on `generate.service.ts` and `wallet.service.ts` only.

## Evaluation: manual golden set, checks—not image diffs

An eval is **not** a CI job and **not** “expected image vs actual image.” Generative output will never match a golden PNG pixel-for-pixel. Pass/fail is about the **provider contract and basic thumbnail fitness**: did Gemini return a usable image that matches what we asked for?

### How expected vs actual works

Each case in `evals/cases/` is JSON: id, prompt, optional preferences (aspect ratio, mood), optional reference image, model id, and a **list of checks**. The script calls real Gemini, then scores the **actual** output against those checks—for example:

- image bytes exist (not empty / not an error payload)
- width and height match the requested aspect (within a small tolerance)
- file is not tiny (below a minimum byte size → fail)

Optional later: a vision model or a human glance for “large title text,” “looks like a YouTube thumbnail.” That human glance is documented as manual; it is not automated in CI.

There is **no** stored reference image to diff against. The “expected” side of the comparison is the checklist on the case file; the “actual” side is the generated file (and its metadata). Results go to a dated folder you can attach to docs: case id, pass/fail per check, latency, error, path to the saved image.

### When to run

Run **manually** with something like `pnpm eval:golden` when you need documentation evidence, after a prompt/model change you care about, or before a release. Do **not** wire this into the pull-request CI pipeline. Gemini is slow, costs money, and flakes; it must not block frontend or wallet PRs.

A handful of cases (even five to ten) is enough for the plan. Twenty to fifty is optional later. A Node script next to `apps/generation-worker/scripts/test-gemini-image.ts` is enough—no LangSmith, Promptfoo, or eval SaaS required for this stage.

After a generation-worker deploy (when you have deploys), three **canary** prompts against the live worker are still useful: if S3 put fails or Gemini returns nothing, fail the rollout. That is a smoke check, not this golden-set eval.

Online eval (download vs regenerate signals) can wait.

## Reasoning you should be able to say out loud

“I split pipeline tests from picture evals because CI must be free and deterministic. I use Vitest and Fastify inject because the stack is already Fastify and Vite. I keep Prisma on real Postgres for billing tests because idempotency is a database constraint. Evals stay manual: real Gemini, scored against checks (bytes, aspect, min size), never against a golden PNG, and never in CI. I did not buy an eval SaaS because a small case folder and a script already prove the provider path for docs.”

## Done when

`pnpm test` runs and covers generate + wallet. Fake generation is used in CI. `evals/cases/` exists with a handful of prompts plus checks, and a script you can run **manually** that writes pass/fail results. You have written down which checks are automated and which still need a human glance. Evals are **not** part of the CI pipeline.

## Refine here, then move on

If a test is painful to write, the production code is probably too tangled with `index.ts`. Fix that seam in the worker before you add more product features. Do not start OpenTelemetry until this file’s “done when” is true.

---

## What we actually built (completion note)

Status: **done** for this aspect. Move on to [02 — data and conversation state](./02-data-and-conversation-state.md).

### Pipeline tests (CI-safe)

| Piece | Where |
|-------|--------|
| Vitest scripts | `apps/api-gateway`, `apps/wallet-service`, `apps/generation-worker` — root `pnpm test` → turbo |
| Test DBs | `wallet_test` / `generation_test` via Compose init + `pnpm test:prepare` |
| Wallet seam | `createApp` extracted; reserve/capture/release + billing handlers against real Postgres |
| Generate path | Happy path, idempotency 409, insufficient funds (no enqueue), fake worker success/failure, Fastify inject |
| Gateway | Missing JWT → 401; forwards `X-Correlation-Id` + `Idempotency-Key` |
| Fakes | Mock wallet / BullMQ queue / RabbitMQ; `FAKE_IMAGE_GENERATION` for worker image path — no Gemini/Stripe in CI |

### Manual golden evals (not CI)

| Piece | Where |
|-------|--------|
| Cases | `evals/cases/` — 14 cases covering first-turn prefs, text on/off, face emphasis, aspects, enhance path, follow-up, reference images, style branches |
| Runner | `pnpm eval:golden` → `apps/generation-worker/scripts/eval-golden.ts` (same `resolveUserText` + `resolveProviderInput` as production) |
| Operator guide | [`evals/README.md`](../evals/README.md) — automated vs human-glance checks, feature matrix, results layout |
| Results | `evals/results/<ISO-date>/` (gitignored except `.gitkeep`) — attach a dated folder when you need release/docs evidence |

### How to run

```bash
pnpm infra:up
pnpm test:prepare   # once, or after schema migrations
pnpm test           # free, deterministic — use on every PR

# Manual only (needs GEMINI_API_KEY in apps/generation-worker/.env):
pnpm eval:golden
```

### Deferred on purpose

- No coverage gate yet (would greenwash if only health routes were covered).
- No Playwright wizard E2E — money bugs live in worker/wallet.
- No eval SaaS / image pixel diffs / evals in CI.
- Canary prompts against a live deploy still wait until there is a deploy story.

### Why this shape

CI must stay free and deterministic. Picture quality is scored manually against checks (bytes, aspect, min size + human glance), never against a golden PNG. Painful tests pushed a small seam fix (`wallet-service` `createApp`) instead of mocking the database for billing.
