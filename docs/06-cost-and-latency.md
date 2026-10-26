# Cost and latency

## Why they belong together

For Thumbcraft, **latency is mostly Gemini, and cost is mostly Gemini plus a little S3 and OpenAI enhance.** Node CPU is not what the user waits on and not what you pay for. If you optimize the Fastify JSON serializer or add a CDN in front of the API, you will not make generate feel faster or cheaper. This plan is about measuring the expensive parts and giving the product knobs (model, resolution, queue) that trade money for speed.

## Latency: keep async, then measure the three clocks

The HTTP path should stay **202 + poll**. That is a latency design, not only a reliability design. The user can keep the tab open. The gateway does not hold a 60 second socket. The worker can retry without the browser knowing.

Inside the job, record three durations on the job row or as metrics:

1. **Queue wait** — from enqueue to worker start. If this is large, you have too few workers or a backlog (see load handling).
2. **Provider time** — Gemini (or fake sleep in tests). If this is large, the model or resolution is the cause.
3. **Upload time** — S3 put. If this is large, the image is huge or the region is wrong.

Their sum should roughly match **end-to-end job duration**, which should stay under the frontend poll timeout. If poll timeout is 180 seconds and Gemini p95 is 90 seconds, you still have room for one retry. If Gemini p95 is 170 seconds, a single retry will look like a UI timeout even when the job later succeeds. Align those numbers on purpose.

Enhance-prompt is **synchronous** today and cheaper/faster than image gen. That is acceptable. If OpenAI enhance starts taking several seconds, you could queue it too; do not do that until you measure it. Extra queues have a cost in complexity.

Do not add WebSockets to “improve latency.” Polling every couple of seconds does not add seconds to Gemini. It only adds tiny HTTP load.

Default the catalog toward a **faster/cheaper** Gemini flash-class model. Offer 2K/4K as explicit choices that quote more coins. Users who pick 4K have opted into slower and more expensive. That is product, not a hidden infra tax.

## Cost: coins are the product; USD is the operator view

Users pay in **coins** that you already quote, reserve, capture, and release. That gate is the most important cost control in the app. Generate should never start without a successful reserve. Enhance should be quoted too (it already is a job kind).

For you as the operator, store on `generation_jobs` something like: model id, resolution, `durationMs`, coins, and if the provider returns usage, token or image units. A weekly query “coins captured versus estimated USD” is enough to notice a model change that doubled spend. You do not need a FinOps platform.

**Fake generation in development and CI** is a cost control. Never point a shared staging environment at production Gemini keys without a budget cap.

**Retries cost money.** Three attempts on a 4K image can be three bills at the provider even if you only capture coins once from the user. That is why failure tolerance says: do not retry non-retryable errors, and consider a circuit breaker when Gemini is 429ing. Align user coins with “one successful image or a refund,” and accept that failed retries are your margin risk. If retries become expensive, drop attempts from 3 to 2 for 4K only.

Do not cache final images as a cost hack unless the same user resubmits the same idempotency key (already handled). Thumbnails are unique. Caching other users’ prompts would also be a privacy problem.

Prompt enhance could be cached by hash of the original prompt later. Only do that if you see a lot of identical enhance calls. An in-memory cache in the old Express app is not a design to copy; if you cache, use Redis with a TTL so workers share it.

## How to integrate

Add timing around `processQueuedJob` using `Date.now()` or the OpenTelemetry spans from plan 05. Persist durations on the job so the poll payload can eventually show “took 22s” if you want. Export the same numbers as histograms.

Keep wallet quote visible in the UI before generate so the user sees cost before you reserve.

Set `concurrency: 2` as a **cost and quota** knob, not as a performance trophy. Higher concurrency means more overlapping Gemini calls and more 429s, which means more retries, which means more spend.

## Reasoning you should be able to say out loud

“I do not treat API gateway latency as the problem; Gemini is. I keep 202 and poll so the user waits on the job, not on an HTTP timeout. I record queue, provider, and S3 time separately so I know whether to add workers, change model, or change storage region. Coins stop unpaid work. I track estimated USD on the job so I can see if a model change burned money. I retry less when a retry would only pay the provider again for a hopeless prompt.”

## Done when

Job rows (or metrics) show the three clocks. Quote still happens before reserve. You have written the poll timeout, Gemini timeout, and BullMQ attempts in one place and they fit together. Fake mode is the default for local work. You know which model is the cheap default.

## Refine here, then move on

If 4K jobs routinely exceed the poll window, either raise the UI timeout with a clear “still working” state, or stop offering 4K until workers and timeouts are honest. Then add security; cost knobs are easy to abuse without rate limits.
