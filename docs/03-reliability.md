# Reliability

## What this word means here

Reliability is not “the site never errors.” Gemini will error. Reliability means: **the same user action has a predictable outcome even when the process restarts, the client retries, or one hop is slow.** The user is not charged twice. A completed image is not lost because the HTTP connection dropped. A worker crash does not forget the job.

Failure tolerance (the next plan) is about *what happens when Gemini or RabbitMQ is actually down*. This plan is about the happy path remaining correct under retries and crashes.

## Choices already made, and why they stay

**HTTP generate is 202 Accepted, then a queue.** A thumbnail can take half a minute. If the gateway waited on Gemini, the browser, load balancer, and Node request would all sit open. A timeout would look like failure even if Gemini later succeeded, and you might reserve coins twice. Async is the reliable shape for this product.

**BullMQ on Redis runs image jobs. RabbitMQ carries platform events.** People often ask why there are two brokers. They are different jobs. BullMQ gives you a stable `jobId`, attempt counts, exponential backoff, stalled-job recovery, and concurrency. RabbitMQ’s topic exchange is good at “fan out this fact to wallet and notification.” If you pushed image generation through RabbitMQ, you would reimplement delayed retry and visibility timeouts. If you pushed coin capture through BullMQ, the notification service would have to speak Redis. Keep both; do not add Kafka.

**Idempotency keys already exist** on generate and on wallet `reserve:` / `capture:` / `release:{jobId}`. That is the core of reliable money. A double click, a retried axios call, or a gateway timeout followed by a retry must hit the unique constraint and return the original job, not a second reserve.

**Database per service** means you cannot run a single SQL transaction across generation and wallet. That is fine. You use a **sequence with compensating actions**: reserve (HTTP) → work → capture (event). Reliability then depends on never skipping the compensate step. The outbox in the next plan makes that sequence crash-safe. This plan says: do not try two-phase commit across two Postgres instances. It is harder than the problem.

## What to strengthen in this repo

**Graceful shutdown.** The generation worker already starts Prisma, Redis, BullMQ, and HTTP together. On `SIGTERM`, stop taking new HTTP generates, let the current BullMQ job finish or fail so it can retry, then close Redis and Prisma. If you kill the process in the middle of an S3 upload, BullMQ should retry the job. `processQueuedJob` already skips work if the job is already `captured` or the assistant message is `completed`. Keep that guard; it is what makes retries safe.

**Job id in BullMQ equals your Prisma job id.** You already enqueue with that id. Do not let BullMQ invent a second identifier as the only handle. Logs, wallet, and the poll API should all use the same UUID.

**Reserve before enqueue, and reverse if enqueue fails.** If Redis is down after a successful reserve, the HTTP handler must release coins and mark the job failed in the same request. Leaving `reserved` with no queue item is a stuck wallet. You have some of this; tests from plan 01 should lock it.

**Health versus ready.** `/health` can mean “the process is up.” `/ready` should mean “this instance can do useful work”: Postgres ping, Redis ping, RabbitMQ channel, S3 configured. Orchestrators (and later ECS) should take an unready instance out of rotation. A worker that is “up” but cannot reach Redis will accept 202s and then fail every job.

**Do not remove completed jobs from BullMQ so fast that you cannot debug**, but do not keep them forever either. Your current retention (`removeOnComplete` count 200, fail 500) is reasonable. Reliability does not require a forever queue; Postgres is the record.

## What not to build

Do not add a distributed lock service (ZooKeeper, etcd). Postgres unique keys and BullMQ job ids are enough.

Do not add a shared “saga orchestrator” product. A small state machine on `GenerationJobStatus` (`created` → `reserved` → `processing` → `captured` | `released` | `failed`) is the saga. Keep it in `generate.service.ts` where you can read it.

Do not retry HTTP generate at the gateway automatically. The client has an idempotency key. Silent retries without that header are how you get two jobs.

## Reasoning you should be able to say out loud

“Generate is async because a long provider call is not a reliable HTTP response. I use BullMQ for work and RabbitMQ for facts because they fit those shapes. I use idempotency keys instead of distributed transactions because wallet and generation do not share a database. I treat `/ready` as ‘dependencies are reachable’ so a broken worker does not keep accepting jobs. I keep skip-if-already-completed in the worker so retries cannot upload a second image and capture twice.”

## Done when

You can kill the worker mid-job and, after restart, either complete the image once or fail and release coins — never charge twice. Duplicate generate requests with the same key do not double reserve. `/ready` fails if Redis or Postgres is down. Tests from plan 01 cover those cases.

## Refine here, then move on

If job states in the UI do not match `GenerationJobStatus`, fix the mapping now. Failure tolerance will add a sweeper that depends on those states meaning what they say.
