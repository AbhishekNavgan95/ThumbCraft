# Load handling and scale

## The important fact

Thumbcraft does not get faster when you add API gateway replicas. **Gemini accepts a limited number of in-flight image calls.** Redis and Postgres will not be the first bottleneck on a student or indie traffic level. Load handling means: **do not accept work you cannot finish**, and **run only as many Gemini calls as the quota allows**. Scale means: when the queue is honestly too long, add **workers**, not random services.

## Admit work at the door

Use the gateway rate limit from the security plan as the first valve. A logged-in user should not be able to fire dozens of generates per minute. Return 429 with a clear body so the UI can say “wait a moment.”

Add a **queue depth cap**. Before enqueue, ask BullMQ how many jobs are waiting. If waiting is above a number you pick (start conservative, for example 20 on a single worker with concurrency 2), reject generate with 429 and `Retry-After`. Release the reserve if you already reserved, or better: check depth **before** reserve so you do not churn coins. This is backpressure. It is kinder than accepting 200 jobs that will sit for an hour and then time out in the browser.

Cap **in-flight jobs per user** (for example one or two). Fairness matters more than total RPS: one scripted account should not occupy both worker slots forever.

These limits are how you “handle load” without Kubernetes. They are also cost control.

## Run work at a fixed parallelism

`concurrency: 2` on the BullMQ worker is a **quota knob**. Raising it to 20 will not magically use 20 GPUs; it will 429 Gemini and retry, which makes latency worse and can increase spend. Tune concurrency against provider limits, then leave it.

When you need more throughput, run **more worker processes** (later: more ECS tasks) each with the same small concurrency, if the provider quota allows. If the quota does not allow it, more processes only shuffle who gets the 429. In that case the honest product behavior is 429 at the door.

**Split HTTP and worker when you feel pain**, not before. Today generation-worker serves routes and consumes the queue in one process. A flood of job polling will share the event loop with Gemini work. When you see poll traffic delaying jobs, run two node processes: one Fastify, one `Worker`. Same database, same Redis. Your deployment plan already mentions this split. Do it when metrics (plan 05) show the fight.

## What to scale later, and what not to

| Piece | Scale trigger | Why |
|---|---|---|
| Generation worker | BullMQ waiting depth stays high while Gemini is healthy | More parallel jobs if quota allows |
| API gateway | ALB or CPU on JSON/auth, not on generate time | Cheap, stateless |
| Auth / wallet | CPU or connection count | Unlikely first |
| Notification | RabbitMQ queue depth | Email can lag |
| Redis / Postgres | Memory, connections | Unlikely at this size |

Do not autoscale the gateway on “generate latency.” Latency is inside the worker. Autoscaling the wrong service is how people get a large bill and the same spinner.

Do not introduce Kubernetes to scale five Node processes. ECS (plan 09) is the path you already chose. Locally, Compose replicas or a second `node dist/worker.js` is enough to practice the split.

## Caching and “performance” work to skip

Do not cache generate results across users. Do not put CloudFront in front of the API for POST /api/generate. Do not add an in-memory prompt cache in the worker process; it will not be shared and the old Express app already made that mistake.

Do cache **static catalog** data if you want (models, gallery templates) in memory with a short TTL, because those are admin-sized lists. That is optional and unrelated to Gemini.

## Reasoning you should be able to say out loud

“The bottleneck is the image provider, not Node. I shed load with per-user limits and a max queue depth so users get 429 instead of a ten minute poll. Worker concurrency matches Gemini quota. I add worker processes when wait time is high, and I split HTTP from the worker if polling fights the event loop. I do not scale the gateway to fix generate slowness. I am not using Kubernetes because ECS and this admission control already match the size of the product.”

## Done when

Generate can return 429 when the queue is full or the user is over rate. Queue depth is visible as a metric. Concurrency is documented next to Gemini limits. You have a written rule for when you would split the worker process. Fairness (per-user inflight) exists or is an explicit deferral.

## Refine here, then move on

Only after admission control works should you read the deployment plan. Deploying without a 429 path means the first burst of traffic creates a giant bill and a pile of stuck reserves.
