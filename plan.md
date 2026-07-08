# thumbcraft — Platform Architecture

A distributed AI thumbnail generation platform built to learn microservices, event-driven architecture, and cloud-native deployment at scale.

The thumbnail generator is the **business domain**. The primary goal is understanding how independently deployable services communicate asynchronously, own their data, share contracts safely, run in containers, and scale under load.

---

## Vision

Users authenticate and walk through a fixed multi-step form: set preferences (category, mood, style, etc.), enter a prompt, optionally upload a base image, pick a model, and hit **Generate**. The gateway checks wallet balance, reserves coins, creates a job record, publishes a queue event, and returns `202` with a `jobId` immediately. The frontend polls the gateway for job status until the generation worker finishes. The worker owns all generation data; the gateway never stores it — it only proxies read requests.

---

## High-Level Architecture

```
┌─────────────┐
│     web     │  React app — existing flow + model toggle, wallet, history
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐     validate JWT      ┌──────────────┐
│ API Gateway │ ────────────────────► │ Auth Service │
└──────┬──────┘                       └──────────────┘
       │
       │ sync HTTP (wallet, job reads)
       ├──────────────────────────► ┌──────────────┐
       │                            │Wallet Service│◄── Stripe webhooks
       │                            └──────┬───────┘
       │                                   │ consume events
       │ publish events                    ▼
       ▼                            ┌─────────────────────┐
┌─────────────┐                     │ Notification      │
│  RabbitMQ   │                     │ Service           │
│ platform.   │                     └─────────────────────┘
│ events      │
└──┬──────────┘
   │
   ▼
┌────────────────┐
│  Generation    │  Multi-model adapters (Gemini, OpenAI, …)
│  Worker        │  Prompt build, enhance, upload, job storage
└────────────────┘

Databases (one per service):
  auth_db · generation_db · wallet_db · notification_db
```

**Core principles:**

- Each service is independently deployable and owns its database
- Async work flows through RabbitMQ; HTTP only where synchronous access is required (auth, wallet, job status reads)
- Shared message contracts live in a monorepo package — never duplicated across services
- Generation workers scale horizontally; the gateway handles user traffic
- Coin cost is determined by the selected model at job submission time
- Form-based single-pass flow only — no chat, no iteration

---

## User Flow (Frontend)

A linear wizard, same as the current app:

```
1. Mode        → text-to-image or image-to-image
2. Prompt      → description + optional AI enhance toggle
3. Preferences → category, mood, theme, color, text style, template
4. Base image  → upload (image-to-image only)
5. Model       → toggle between providers (Gemini Flash, Gemini Pro, OpenAI, …) with coin cost shown
6. Generate    → submit job, show loading state, poll until done
7. Results     → display images; entry saved to history automatically
```

No conversational UI. User configures everything upfront, submits once.

---

## Job Submission & Polling

Generation data lives in `generation_db`, owned exclusively by the **Generation Worker**. The API Gateway does not store jobs. Polling still works because the gateway acts as a **read proxy** to the worker's internal HTTP API.

### Why not store jobs in the gateway?

Service boundaries: the worker owns the job lifecycle and the database. The gateway is stateless — it orchestrates submission and forwards status queries. This is a standard microservices pattern (sync read API on the data owner, edge proxy for clients).

### Job lifecycle

```
queued → processing → completed
                   → failed
```

| Status | Meaning |
|--------|---------|
| `queued` | Job row created, event published (or about to be consumed) |
| `processing` | Worker picked up the event, AI generation in progress |
| `completed` | Images uploaded, `image_urls` populated |
| `failed` | Error occurred; coins released by Wallet Service |

### Submit flow (failure-prone — must handle partial failures)

```
Frontend                    API Gateway                 Wallet Svc        Gen Worker         RabbitMQ
   │                             │                         │                │                │
   │ POST /api/generations       │                         │                │                │
   │────────────────────────────►│                         │                │                │
   │                             │ POST /wallet/quote      │                │                │
   │                             │────────────────────────►│                │                │
   │                             │◄────────────────────────│                │                │
   │                             │ POST /wallet/reserve    │                │                │
   │                             │────────────────────────►│                │                │
   │                             │◄── 402 or ok ───────────│                │                │
   │                             │                         │                │                │
   │                             │ POST /internal/jobs     │                │                │
   │                             │ (create row: queued)    │                │                │
   │                             │─────────────────────────────────────────►│                │
   │                             │◄─────────────────────────────────────────│                │
   │                             │                         │                │                │
   │                             │ publish generation.requested              │                │
   │                             │─────────────────────────────────────────────────────────►│
   │                             │                         │                │                │
   │◄── 202 { jobId } ───────────│                         │                │                │
   │                             │                         │                │  consume event │
   │                             │                         │                │◄───────────────│
   │                             │                         │                │ processing…    │
   │                             │                         │                │ completed      │
```

**Submit steps (gateway):**

1. Validate JWT and request payload
2. `POST /wallet/quote` → get coin cost for selected model
3. `POST /wallet/reserve` → hold coins; return `402` if insufficient balance
4. Generate `jobId` (UUID)
5. `POST /internal/jobs` on Generation Worker → insert row with `status: queued` and full payload
6. Publish `generation.requested` to RabbitMQ
7. Return `202 { jobId, status: "queued", estimatedCost }`

**If step 5 fails** → release reserved coins, return `500`.

**If step 6 fails** (event publish) → mark job `failed` via worker internal API, release coins, return `500`.

This makes submission failure-prone by design — the gateway must compensate on partial failure.

### Poll flow

```
Frontend                         API Gateway                    Generation Worker
   │                                  │                                  │
   │ GET /api/generations/:jobId      │                                  │
   │─────────────────────────────────►│                                  │
   │                                  │ GET /internal/jobs/:jobId        │
   │                                  │ (forward userId for auth check)  │
   │                                  │─────────────────────────────────►│
   │                                  │◄── { status, imageUrls, error } ─│
   │◄── same response ────────────────│                                  │
   │                                  │                                  │
   │  repeat every 2–3s               │                                  │
   │  until status is terminal        │                                  │
```

The worker's `GET /internal/jobs/:id` enforces ownership: returns `404` if `job.user_id !== requesting userId`. The gateway never caches job state.

**Poll response shape:**

```json
{
  "jobId": "uuid",
  "status": "processing",
  "imageUrls": null,
  "error": null,
  "createdAt": "…",
  "completedAt": null
}
```

When `status` is `completed`, `imageUrls` is populated and the frontend stops polling and renders results. When `failed`, show error (coins already released asynchronously).

**Frontend polling logic:**

```js
const poll = async (jobId) => {
  const { status, imageUrls, error } = await api.get(`/api/generations/${jobId}`);
  if (status === 'completed') return imageUrls;
  if (status === 'failed') throw new Error(error);
  await sleep(2500);
  return poll(jobId);
};
```

Stop polling after a timeout (e.g. 5 minutes) and show a "still processing, check history" message.

### Why internal HTTP on the worker is acceptable

The worker is queue-driven for **writes** (processing) but exposes a small **internal read API** for the gateway. This is not a violation of service boundaries — the data owner serves its own reads. Alternatives like WebSockets or SSE add complexity without teaching more; polling via gateway proxy is the right starting point.

---

## Services

### web

Single-page React application. No business database.

**Responsibilities:**
- Existing multi-step generation flow (mode → prompt → filters → template → results)
- **Model toggle** — user picks one provider/model before submitting (e.g. Gemini Flash, Gemini Pro, OpenAI DALL·E); UI shows coin cost per model
- Wallet balance display and coin purchase (Stripe Checkout redirect)
- Job status polling after submit (replaces blocking 2–3 min wait)
- Generation history (search, filter, download)

**Does not own:** Auth logic, AI calls, payments, job execution.

---

### API Gateway

Single public entry point for all client traffic.

**Responsibilities:**
- JWT validation (local verify with shared secret/public key from Auth Service)
- Proxy auth routes to Auth Service
- `POST /generations` — quote → reserve coins → create job on worker → publish event → `202 { jobId }` (with compensation on partial failure)
- `POST /generations/from-image` — upload base image to Cloudinary, then same submit flow
- `GET /generations/:id` — **read proxy** to Generation Worker `GET /internal/jobs/:id` (no local job storage)
- `GET /history` — proxy to Generation Worker
- Wallet proxy routes (`/wallet`, `/wallet/checkout`, `/models`)
- Attach `userId`, `correlationId` to all downstream calls and published events

**Does not own:** User records, coin balances, job/generation data, AI logic, long-running work.

---

### Auth Service

User identity and token issuance.

**Owns:** `auth_db`

| Entity | Purpose |
|--------|---------|
| `users` | id, email, name, password_hash, created_at |
| `refresh_tokens` | Optional — session rotation in production |

**Exposes:** Internal HTTP — `POST /register`, `POST /login`, `POST /refresh`, `GET /users/:id`

**Publishes:** `user.registered` → Wallet Service creates account with welcome coins

**Does not consume** RabbitMQ events.

---

### Generation Worker

Executes image generation jobs. Queue-driven for processing; exposes a small internal HTTP API for job creation and reads (called only by the gateway).

**Owns:** `generation_db` — **all job and history data lives here**

| Entity | Purpose |
|--------|---------|
| `jobs` | id, user_id, model_id, status, type (text-to-image \| image-to-image), prompt, filters_json, input_image_url, image_urls[], coin_cost, created_at, completed_at, error |

**Consumes:** `generation.requested`

**Internal HTTP (gateway only, not exposed to clients):**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/internal/jobs` | Create job row (`status: queued`) — called by gateway before event publish |
| GET | `/internal/jobs/:id` | Return job status + results — powers frontend polling via gateway |
| PATCH | `/internal/jobs/:id` | Mark `failed` — gateway compensation on publish failure |
| GET | `/internal/history` | List past jobs for user |
| DELETE | `/internal/jobs/:id` | Delete history entry |

All internal endpoints verify `userId` from gateway-forwarded header (e.g. `X-User-Id`).

**Processing pipeline (on event consume):**
1. Load job by `jobId` from event, set status → `processing`
2. Resolve **model adapter** by `model_id`
3. Build structured prompt from job payload (port logic from current `imageController.js`)
4. Optional OpenAI prompt enhancement if requested (cost included in reserve)
5. Generate images via selected provider
6. Upload results to Cloudinary
7. Save `image_urls`, set status → `completed`
8. Publish `generation.completed` — or `generation.failed` on error

**Model adapters** (pluggable registry inside worker):

| Model ID | Provider | Adapter | Example coin cost |
|----------|----------|---------|-------------------|
| `gemini-flash` | Google | `GeminiAdapter` | 3 coins/image |
| `gemini-pro` | Google | `GeminiAdapter` | 6 coins/image |
| `openai-dalle` | OpenAI | `OpenAIAdapter` | 10 coins/image |

Adding a new model = implement adapter + add row to `wallet_db.model_pricing`. No new service.

Port from current monolith:
- `backend/utils/imageGenerator.js` → Gemini adapters
- `backend/utils/promptEnhancer.js` → shared enhance step
- `backend/utils/cloudinaryUpload.js` → upload step
- `backend/controllers/imageController.js` → prompt building logic

---

### Wallet Service

Coins, per-model pricing, and Stripe integration. Teaches ledger patterns and idempotent event consumption.

**Owns:** `wallet_db`

| Entity | Purpose |
|--------|---------|
| `wallets` | user_id, balance_coins, reserved_coins |
| `transactions` | id, user_id, type, amount, job_id, model_id, stripe_payment_id, status, idempotency_key, created_at |
| `model_pricing` | model_id, coins_per_image, prompt_enhance_cost, enabled |
| `coin_packages` | id, name, coins, price_cents, stripe_price_id |
| `stripe_customers` | user_id, stripe_customer_id |

**Transaction types:**

| Type | Trigger |
|------|---------|
| `welcome_bonus` | `user.registered` event |
| `purchase` | Stripe `checkout.session.completed` webhook |
| `reserve` | Gateway calls `POST /reserve` before publishing job |
| `capture` | `generation.completed` event |
| `release` | `generation.failed` event |

**Exposes:** Internal HTTP
- `GET /wallet` — balance + reserved
- `GET /models/pricing` — all models and coin costs (powers UI toggle)
- `POST /wallet/quote` — `{ modelId, imageCount, enhancePrompt }` → total cost
- `POST /wallet/reserve` — atomic hold; `402` if insufficient
- `POST /wallet/checkout` — Stripe Checkout Session

**Webhook:** `POST /webhooks/stripe` — verify signature, credit coins idempotently

**Consumes:** `user.registered`, `generation.completed`, `generation.failed`

**Idempotency:** `idempotency_key = jobId` on reserve/capture/release.

**Coin cost formula:**
```
total = (model_pricing.coins_per_image × imageCount)
      + (enhancePrompt ? model_pricing.prompt_enhance_cost : 0)
```

---

### Notification Service

Transactional email. Queue-driven — no public API. Demonstrates a pure event consumer with no HTTP surface.

**Owns:** `notification_db` — `sent_emails` audit log

**Consumes:**
- `generation.completed`
- `generation.failed`
- `wallet.purchase_completed`

**Dev:** Mailhog. **Production:** Resend / SendGrid / SES.

---

## System Flow

### Generation (end-to-end)

```
1. User logs in → Auth Service → JWT

2. User walks through form wizard
   → preferences, prompt, base image (optional), model toggle
   → UI shows coin cost via GET /api/models

3. User hits Generate
   → Gateway: quote → reserve coins (402 if insufficient)
   → Gateway: POST /internal/jobs on worker (status: queued)
   → Gateway: publish generation.requested
   → Gateway: 202 { jobId, status: "queued" }
   → on partial failure: compensate (release coins, mark job failed)

4. Frontend begins polling GET /api/generations/:jobId every 2–3s
   → Gateway proxies to worker GET /internal/jobs/:id
   → returns { status: "queued" | "processing" | … }

5. Worker consumes event → processing → AI gen → Cloudinary → completed
   → publishes generation.completed or generation.failed

6. Wallet Service: capture or release reserved coins

7. Notification Service: email (optional)

8. Poll returns status: "completed" with imageUrls
   → frontend stops polling, renders ResultsGrid
```

### Payment flow

```
1. User clicks "Buy Coins"
   → Gateway → Wallet: POST /wallet/checkout { packageId }
   → Stripe Checkout URL

2. Stripe webhook → Wallet Service
   → credit coins (idempotent on stripe_payment_id)
   → publish wallet.purchase_completed

3. Notification Service → receipt email
```

---

## Event-Driven Messaging

### Exchange

| Item | Value |
|------|-------|
| Exchange | `platform.events` |
| Type | `topic` |
| Routing key format | `{domain}.{action}` |

### Events

| Routing Key | Publisher | Consumer(s) | Purpose |
|-------------|-----------|-------------|---------|
| `user.registered` | Auth Service | Wallet Service | Create wallet + welcome bonus |
| `generation.requested` | API Gateway | Generation Worker | Start job |
| `generation.completed` | Generation Worker | Wallet Service, Notification Service | Capture coins, notify |
| `generation.failed` | Generation Worker | Wallet Service, Notification Service | Release coins, notify |
| `wallet.purchase_completed` | Wallet Service | Notification Service | Purchase receipt |

### Message contract

Every event includes:
```json
{
  "eventId": "uuid",
  "correlationId": "uuid",
  "timestamp": "ISO-8601",
  "userId": "uuid",
  "jobId": "uuid",
  "payload": {}
}
```

- Payloads carry IDs and references — not full records from other services
- Contracts defined in `@platform/messaging-contract`
- Schema changes versioned across services

### Failure handling

- Manual acknowledgment on all consumers
- Retry with exponential backoff for transient failures
- Dead Letter Queue (DLQ) for permanently failed messages
- Idempotency keys on wallet and generation consumers
- `prefetch(1)` on generation worker for fair distribution across replicas

---

## Monorepo Structure

```
thumbcraft/
├── pnpm-workspace.yaml
├── package.json
├── docker-compose.yml
│
├── packages/
│   ├── messaging-contract/     # Events, routing keys, queues, bindings, types
│   ├── rabbitmq-client/        # Connection, publish, consume helpers
│   ├── config/                 # Environment validation (zod)
│   ├── logger/                 # Structured logging + correlationId
│   └── errors/                 # Shared error types
│
├── apps/
│   ├── web/                    # React + Vite (existing UI + model toggle)
│   ├── api-gateway/
│   ├── auth-service/
│   ├── generation-worker/
│   ├── wallet-service/
│   └── notification-service/
│
└── infra/
    ├── docker/                 # Dockerfiles per app
    ├── k8s/                    # Kubernetes manifests
    └── scripts/                # RabbitMQ topology bootstrap, DB migrations
```

**Workspace rules:**
- `apps/` = deployable services, each with its own `Dockerfile` and `package.json`
- `packages/` = shared libraries via `"workspace:*"` — never deployed alone
- One `pnpm install` at the root

---

## Data Ownership

Each service has its own PostgreSQL database. No shared schemas.

| Service | Database | Key entities |
|---------|----------|--------------|
| Auth | `auth_db` | users, refresh_tokens |
| Generation Worker | `generation_db` | jobs |
| Wallet | `wallet_db` | wallets, transactions, model_pricing, coin_packages |
| Notification | `notification_db` | sent_emails |

Local development: single Postgres instance, separate databases per service.
Production: isolated database instances per service.

---

## API Surface (Gateway)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/register` | — | Create account |
| POST | `/api/login` | — | Get JWT |
| GET | `/api/profile` | JWT | Current user |
| GET | `/api/models` | JWT | Available models + coin costs |
| POST | `/api/wallet/quote` | JWT | Quote cost for model + count |
| GET | `/api/wallet` | JWT | Balance + reserved |
| POST | `/api/wallet/checkout` | JWT | Stripe Checkout session |
| POST | `/api/generations` | JWT | Text-to-image job → 202 |
| POST | `/api/generations/from-image` | JWT | Image-to-image job → 202 |
| GET | `/api/generations/:id` | JWT | Job status + results |
| GET | `/api/history` | JWT | Past generations |
| DELETE | `/api/history/:id` | JWT | Delete history entry |
| GET | `/health` | — | Liveness |
| GET | `/ready` | — | Dependency check |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + TypeScript |
| Package manager | pnpm workspaces |
| Message broker | RabbitMQ |
| Databases | PostgreSQL (one per service) |
| ORM / migrations | Drizzle or Prisma |
| HTTP framework | Fastify |
| Auth | JWT (Auth Service) |
| Prompt enhancement | OpenAI |
| Image generation | Gemini, OpenAI (model adapters in worker) |
| Image hosting | Cloudinary |
| Payments | Stripe Checkout + webhooks |
| Email | Mailhog (dev), Resend/SendGrid (prod) |
| Containers | Docker |
| Local orchestration | Docker Compose |
| Production orchestration | Kubernetes |
| CI/CD | GitHub Actions |
| Logging | Structured JSON (pino) |
| Metrics | Prometheus + Grafana |

---

## Infrastructure

### Local (Docker Compose)

```
Infrastructure:  postgres, rabbitmq, mailhog
Apps:            api-gateway, auth-service, generation-worker,
                 wallet-service, notification-service

Scale workers:
  docker compose up --scale generation-worker=3
```

### Production (Kubernetes)

- Deployment per service with resource limits
- HPA on `generation-worker` (scale by queue depth or CPU)
- ConfigMaps for non-secret config
- Secrets for DB URLs, JWT secret, API keys, Stripe keys, RabbitMQ credentials
- Ingress exposes API Gateway only
- Messaging bootstrap Job provisions RabbitMQ topology
- Centralized logging and metrics

### CI/CD

```
Push / PR
  ├─ pnpm install
  ├─ lint + unit tests
  ├─ integration tests (Compose stack)
  ├─ build Docker images (path-filtered per changed app)
  └─ on merge to main:
        ├─ push images to registry
        └─ deploy to Kubernetes
```

---

## Observability

### Logging

JSON structured logs from every service:
`timestamp`, `level`, `service`, `correlationId`, `jobId`, `userId`, `modelId`, `event`

Same `correlationId` from HTTP request through all async events.

### Metrics

| Metric | Type |
|--------|------|
| `jobs_processed_total` | Counter (by status, model) |
| `job_duration_seconds` | Histogram (by model) |
| `queue_depth` | Gauge |
| `events_published_total` / `events_consumed_total` | Counter |
| `http_request_duration_seconds` | Histogram (gateway) |
| `wallet_reserve_total` / `wallet_capture_total` / `wallet_release_total` | Counter |

### Health & shutdown

- `GET /health` — process alive
- `GET /ready` — dependencies up (DB, RabbitMQ)
- Graceful shutdown: finish in-flight jobs on `SIGTERM` before ack

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| User flow | Keep existing multi-step form | No new product engineering; focus on distributed systems |
| Model selection | Toggle at submit time; per-model coin pricing | Simple UI change; teaches pricing + adapter pattern |
| Charge timing | Pre-reserve before job publish | Fail fast; no unpaid AI calls |
| Failed generation | Auto-release reserved coins | Correct ledger without manual intervention |
| Job data ownership | Generation Worker owns `generation_db` | Clear service boundary |
| Job status reads | Gateway proxies `GET` to worker internal HTTP | Worker is data owner; gateway is stateless read proxy |
| Job creation | Gateway calls `POST /internal/jobs` before event publish | Polling works immediately after `202`; job row exists before worker consumes |
| Submit failures | Compensate: release coins + mark job failed | Submission spans wallet + DB + queue — must handle partial failure |
| Client polling | Frontend polls gateway, not worker directly | Worker has no public API; gateway is sole client entry point |
| Exchange type | Topic | Flexible routing as consumers are added |
| Auth validation | Local JWT verify at gateway | No per-request auth round-trip |
| Image upload | Gateway uploads to Cloudinary, passes URL in event | Workers stay stateless and scalable |
| New image model | Adapter in worker + row in model_pricing | Extend without new services |
| RabbitMQ topology | Bootstrap script in dev; K8s Job in prod | Reproducible infrastructure |

---

## What Exists Today (reference only)

The current monolith (`backend/` + `frontend/`) is reference code to port — not the target architecture.

| Current code | Target service |
|--------------|----------------|
| `backend/routes/auth.js`, `models/User.js` | auth-service |
| `backend/utils/promptEnhancer.js` | generation-worker |
| `backend/utils/imageGenerator.js` | generation-worker (Gemini adapters) |
| `backend/utils/cloudinaryUpload.js` | generation-worker |
| `backend/controllers/imageController.js` | generation-worker (prompt building) |
| `frontend/src/**` | web (add model toggle + async polling) |

The existing questionnaire UI stays. The main frontend changes are: model toggle with coin costs, async job polling instead of blocking requests, and wallet UI.

---

## Service Summary

| # | Service | Type | Learning focus |
|---|---------|------|----------------|
| 1 | web | Frontend | Client integration with async API |
| 2 | api-gateway | Sync HTTP | Edge routing, JWT, orchestration |
| 3 | auth-service | Sync HTTP | Service boundaries, DB isolation |
| 4 | generation-worker | Async worker | Queue consumption, horizontal scaling, adapter pattern |
| 5 | wallet-service | Sync HTTP + consumer | Ledgers, idempotency, Stripe webhooks |
| 6 | notification-service | Async consumer | Pure event-driven side effects |

Six deployable services. Each maps to a distinct distributed-systems concept without extra layers for chat, agents, or CQRS.
