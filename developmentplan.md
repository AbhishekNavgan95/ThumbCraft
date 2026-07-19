# Development checklist

Keep this file as the only living todo list for generation-worker work.

## Done

- [x] **Models** — admin CRUD; public visible models; seed script
- [x] **Gallery** — categories + templates; admin CRUD; public browse
- [x] **Sessions** — CRUD + empty-session dedupe; `pinned`; gateway `/api/sessions`
- [x] **Messages** — user + assistant on generate; `GET /api/sessions/:id/messages`; `providerInput`
- [x] **Preferences / prompt assemble** — catalog + first-turn assemble / later `userText` only
- [x] **Jobs / billing** — `generation_jobs`; wallet quote/reserve; capture/release via events
- [x] **Prompt enhance** — `POST /api/enhance-prompt` (`prompt_enhance`)
- [x] **Gemini image provider** — Interactions adapter + refs + `previous_interaction_id`
- [x] **S3 storage code** — upload refs / templates / generated outputs
- [x] **Notifications** — generation completed / failed emails
- [x] **Gateway** — uploads, models, gallery, sessions, messages, enhance, generate (JSON)
- [x] **Fake generation mode** — `FAKE_IMAGE_GENERATION` for E2E without LLM
- [x] **Async generate (BullMQ)** — HTTP enqueues job (202); BullMQ worker runs Gemini; poll `GET /api/jobs/:jobId`
- [x] **Seed resolutions** — Gemini `image_size` values (`512`, `1K`, `2K`, `4K`)
- [x] **S3 production config** — private bucket + CloudFront / CDN wiring

## Next

- [ ] **Frontend** — migrate web UI to session + JSON generate + prefs + job poll (do last)

## Later / pending

- [ ] **AI Review** — vision critique attached to assistant messages

## Won’t do

- [x] ~~OpenAI image provider~~ — Gemini only for now
- [x] ~~History API~~ — session + messages replace `/api/history`
- [x] ~~RabbitMQ consumer for generate~~ — BullMQ + poll; RabbitMQ stays for wallet/notification events
