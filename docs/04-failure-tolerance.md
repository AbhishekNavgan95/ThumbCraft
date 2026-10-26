# Failure tolerance

## How this differs from reliability

Reliability is “retries and crashes still leave one correct outcome.” Failure tolerance is “Gemini, S3, Redis, or RabbitMQ misbehaves, and the product still degrades in a way a human understands.” The user should see a failed thumbnail and coins back, not a spinner that never ends and a frozen reserve.

## The failures that actually happen in this product

**Gemini returns 429 or 5xx, or times out.** This is normal. BullMQ already retries three times with exponential backoff starting at two seconds. Keep that. Change the *policy*: retry only when a retry might work. Rate limits and timeouts are retryable. A 400, a safety block, or “this prompt cannot be imaged” is not. Retrying a safety block burns latency and can burn quota. Map provider errors to `retryable: true | false` in the Gemini adapter and throw a typed error the worker understands. Non-retryable errors should fail the job immediately, mark the assistant message failed, and release coins.

**Gemini succeeds but S3 put fails.** Retry is correct; you do not have a public URL yet. Make sure you do not publish `generation.completed` until the object exists. Otherwise wallet captures and the UI shows a dead link.

**RabbitMQ consumer throws.** Today the shared client nacks the message without requeue, which **drops** it. If that message was `generation.completed`, wallet may never capture. If it was `generation.failed`, coins may stay reserved forever. That is the highest-severity hole in the repo. Give the exchange a **dead-letter exchange (DLX)** and a dead-letter queue. Failed handlers should nack to DLQ after a few retries, not vanish. Alert when the DLQ has messages (even a log line you grep for). Humans replay DLQ after a code fix.

**Publish fails after a successful image.** The worker has a fallback that tries to release coins over HTTP if publish fails. That is dangerous: the image succeeded, so the right bill is **capture**, not release. A race can capture from a delayed event and also release. The tolerant design is an **outbox**: in the same Postgres transaction as “message completed + job captured (or at least ‘ready to bill’),” insert an `outbox` row. A small loop publishes outbox rows to RabbitMQ until the broker acks, then marks them sent. Wallet already treats capture/release as idempotent. Duplicate publishes become no-ops. Missing publishes get sent on the next loop, even after a crash.

**Jobs stuck in `reserved` or `processing`.** The process died after reserve and before enqueue, or BullMQ lost the job, or finalize failed. A **sweeper** every minute looks for jobs older than a timeout (for example ten minutes past update) and calls the same `finalizeJobFailure` path: fail the message, publish failed or release directly, never leave coins frozen. This is boring and it is what production billing systems do.

**Redis or BullMQ is down.** Generate should fail the HTTP request after reserve is rolled back. Do not return 202 for a job that is not on the queue. The UI should show “queue unavailable,” not poll forever.

**Partial downstream: notification email fails.** Email is not money. Log and DLQ the notification message. Do not fail the generation job because MailHog or SES had a bad day. That is why notification is a separate consumer.

## Circuit breakers (optional, later in this aspect)

If Gemini is down hard, retrying every job with concurrency 2 still hammers the API and delays the DLQ of human-facing failures. A small circuit breaker around the Gemini adapter (the `opossum` library is enough) opens after N failures in a window and fails fast with “provider unavailable.” Coins release quickly. Close the circuit after a probe succeeds. Do not wrap the whole Fastify app in a breaker. Only wrap the provider.

Do not add a service mesh for this. You have one critical dependency: Gemini.

## Timeouts

Set an explicit timeout on Gemini and on wallet HTTP, shorter than the user’s poll timeout (the UI waits about 180 seconds). If Gemini can run 60 seconds, the worker timeout should be slightly above that, and BullMQ’s lock/stalled interval should be above the worker timeout so BullMQ does not start a second attempt while the first is still running. Mismatched timeouts cause **double generation**, which costs real money.

## Reasoning you should be able to say out loud

“Retries are for temporary provider errors, not for bad prompts. I will not drop RabbitMQ messages that move coins; they go to a DLQ. I publish billing events from a Postgres outbox so a crash after a successful image still charges once. A sweeper releases coins for jobs that got stuck. Email failure must not roll back a finished thumbnail. I may open a circuit on Gemini so we fail fast instead of queueing work we know will 429.”

## Done when

Retryable vs not is implemented in the Gemini adapter. RabbitMQ has a DLX and the client no longer silently drops. Outbox exists for `generation.completed` and `generation.failed`. A sweeper exists and is tested with an old `reserved` row. Timeout values are written down next to BullMQ stall settings. Wallet capture/release remain idempotent under duplicate events.

## Refine here, then move on

If you cannot explain what happens to coins for each failure above, do not add dashboards yet. Observability will attach traces to these paths; the paths need to be correct first.
