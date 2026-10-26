# Data and conversation state

## Why this is its own plan

Thumbcraft is not a single “generate and forget” form anymore. A user has a **session** (one thumbnail thread), **messages** (what they asked and what the model returned), and **jobs** (the billable unit that went through the queue). If those three ideas blur, you will invent a history table, stash chat in Redis, or resend the entire transcript to Gemini on every turn. This plan locks the model you already designed in Prisma so later work (evals, traces, scale) has one place to hang metadata.

## The model that already exists

`GenerationSession` is the thread. It belongs to a `userId`. It can be pinned or archived. It remembers `latestInteractionId` from Gemini so the next image can continue from the last successful turn instead of starting from a blank model. It also points at the latest message and the latest assistant message so the UI can show “the current thumbnail” without scanning the whole table.

`GenerationMessage` is a turn. User rows store the typed prompt, optional enhanced prompt, the exact `providerInput` sent to the model, preferences, and reference image URLs. Assistant rows store the image URL, status (`queued` / `processing` / `completed` / `failed`), and errors. An assistant row points back at the user message it fulfills.

`GenerationJob` is money plus queue. Its id is what the wallet uses for reserve, capture, and release. A job knows which session and message it belongs to. Image generation jobs hang off the assistant message. Prompt-enhance jobs hang off the user message.

This split is the important design choice. **Conversation is not a job, and a job is not a chat bubble.** If you store image URLs only on the job, the chat UI has to join awkwardly. If you charge per message without a job row, retries and idempotency have nowhere to live.

## Where truth lives

**Postgres `generation_db` is the source of truth** for sessions, messages, and jobs. Redis holds BullMQ only: waiting work, locks, attempts. If Redis is wiped, you should still know from Postgres that job X is `reserved` and message Y is `processing`. That is why a sweeper (see the failure-tolerance plan) can repair stuck work. If you copied the chat into Redis for “speed,” a restart would lie to the user.

RabbitMQ must not be the source of truth for conversation either. Events tell wallet and notification “this job finished.” They can be retried or delayed. The image URL and message status belong in Postgres before you publish.

Auth users live in `auth_db`. Coin balances live in `wallet_db`. Do not join those into generation’s schema. The worker already calls wallet over HTTP and listens for events. That is database-per-service done in a small way: each service can change its tables without a giant shared migration.

## How a turn actually flows

The user sends `POST /api/generate` with a session id, prompt, prefs, and optional references. The worker writes a user message and an assistant message (`queued`/`processing`), creates a job, reserves coins, and enqueues BullMQ. The HTTP response is 202 with the job id. The frontend polls `GET /api/jobs/:jobId` (and session messages) until the assistant row is `completed` or `failed`.

Later turns should not dump the whole chat into Gemini. The worker already uses `latestInteractionId` / previous interaction on the provider. Turn one may assemble base prompt plus preferences. Later turns send the new user text against that interaction. That is cheaper and it keeps style continuity. The full transcript still lives in Postgres for the UI and for evals.

**Polling versus WebSockets.** Polling is the right default. Jobs last tens of seconds, not milliseconds. A WebSocket or SSE stream would need reconnects, gateway idle timeouts, and sticky connections. Add SSE later if you have many users staring at a spinner and you can measure that polling is wasteful. Until then, a 180 second poll with backoff is honest and easy to test.

## What to add without changing the model

Always persist `providerInput` when the worker dispatches. That string is what you eval against and what you show when debugging “the model ignored my mood filter.” If it is null after a successful generate, the assemble step is incomplete.

Keep `originalPrompt` untouched when enhance runs. The enhanced text is a separate column. That lets you compare evals with and without enhance, and it is a privacy/audit trail of what the human typed.

Treat S3 URLs on the message as pointers, not as files in the database. The worker reads reference bytes with the S3 SDK when calling Gemini, not through CloudFront. The browser may use the CDN URL. Those two paths should stay different so a private bucket still works.

Add a real “delete this session” that cascades messages and jobs (or anonymizes them) and deletes reference objects in S3 when you are ready for privacy. The schema already cascades messages on session delete. Wire the API and make sure jobs that are still `reserved` release coins first, otherwise deletion becomes a billing leak.

Do not revive `/api/history`. The gateway still has a leftover history route. Sessions plus messages replaced it. Remove or stop proxying that route so you do not maintain two stories.

Do not store the conversation in the wallet or in notification emails beyond a link or a short subject. Emails can mention success/failure; they should not become a second copy of prompts.

## Reasoning you should be able to say out loud

“I modeled a thumbnail chat as sessions and messages, and I modeled money as jobs, because retries and coins have a different lifecycle than a chat bubble. Postgres is truth because Redis is a queue that can be flushed. I poll the job instead of opening a socket because generation is long and rare. I pass Gemini a previous interaction id instead of the full transcript because the product is iterative editing of one image, not a long text chat. I will not add a history table or Redis cache of messages unless I measure a real read problem.”

## Done when

You can draw one diagram: UI → gateway → worker → job row → BullMQ → assistant message → event → wallet. Every field you need for evals (`providerInput`, model, prefs) is on the message. History API is documented as dead. You know what happens to coins if the user deletes a session mid-job.

## Refine here, then move on

If the frontend is still thinking in “history items” instead of sessions, finish that mapping before reliability work. Reliability assumes there is one job id to retry and one message to mark failed.
