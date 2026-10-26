# Security, guardrails, and privacy

## Why this is not an afterthought, but not first either

You needed tests and correct job/coin behavior before locking things down, because you will break generate while adding headers and limits. Now the pipeline is real: users upload reference images, you store prompts, you charge money, you call a model that will follow instructions in the prompt. That is enough to deserve a serious, still-small security story.

## Trust boundaries

The **browser** is untrusted. The **API gateway** is the only public backend. It checks JWT, CORS, body size (you already cap JSON and multipart), and soon rate limits. It forwards `X-User-Id` and friends to internal services.

**Auth, wallet, and generation-worker must not be reachable from the internet.** They currently trust `X-User-*`. That is acceptable on a private network with a shared **internal service token** (or mTLS later on ECS). It is not acceptable if someone can hit `:3003` and send `X-User-Id` of another customer. Internal upload routes without auth are a bug once the worker has a public IP.

Stripe webhooks should stay on the wallet service (or a dedicated public path) with signature verification. Do not send Stripe events through the JWT gateway.

Keep **your own JWT auth**. Moving to Auth0 or Clerk would not teach you more about this architecture and would hide OTP, roles, and cookies you already own. If you later want social login, that can be a feature. It is not a security upgrade by itself.

## Web and API hardening

Add `@fastify/helmet` on the gateway for standard headers. Add `@fastify/rate-limit` with a **Redis store** so two gateway processes share the same counters. Limit generally by IP, and limit `/api/generate` and uploads **by user id** more tightly. Coin reserve is a backstop, not a flood defense: an attacker with a stolen token or a funded account can still fill Gemini quota.

Validate every body with the Zod schemas you already use. Reject unknown fields on generate so extra prompt-injection keys do not sneak into `preferences`.

Keep JWT secrets and Stripe keys in environment variables, later Secrets Manager. Never log them. Never commit `.env`.

## Guardrails for a thumbnail model

You are not building a general chatbot, which helps. The user wants a YouTube thumbnail, not unconstrained image generation.

Use **Gemini’s safety settings** (block obvious sexual and violent content at the provider). Add a **short policy prefix** in prompt assembly: no sexual content involving minors, no non-consensual deepfakes of private people, no scams or malware UI. That prefix is a guardrail you can show in an eval case.

Do not stand up a separate moderation microservice on day one. If you need more, a single pre-check (keyword list plus optional cheap classifier) before reserve is enough to save coins on obvious abuse. Log that you blocked a prompt without storing the full illegal content if you can avoid it.

Treat **prompt injection** as “the user tries to override the template.” Your assemble step should keep system rules outside the user string, and you should not let preferences contain raw `providerInput` from the client. The client sends prefs; the server builds `providerInput`.

## Privacy and user data

Prompts, reference photos, and generated faces are personal data even if the user thinks they are “just thumbnails.”

**Storage:** private S3, public-looking URLs only via CloudFront OAC (already in the deploy plan). List access on the bucket should be impossible for the world. Server-side Gemini refs use `GetObject`, not a world-readable URL.

**Logs and events:** `auth.otp_requested` currently carries the OTP in the RabbitMQ payload so email can send it. That is convenient and it is a leak if logs or the broker UI are shared. Prefer storing a hashed OTP in auth_db only, and passing the code to the mailer in memory, or encrypting that payload. Never write OTP at `info` log level. Redact email in logs if you can still debug with `userId`.

**Retention:** session delete should remove messages and, when you can do it safely, S3 objects. Do not keep reference images forever “for analytics” without a reason. `providerInput` is useful for evals; it is also a copy of the user’s words. Access to production Postgres should be as tight as access to the bucket.

**Emails:** completion mail should not attach the image to a random CC or include the full prompt if the user did not ask for that. A link to the session is enough.

Frontend: do not put JWT in `localStorage` if you can use a safer pattern later; if you already use localStorage, document the XSS tradeoff (any script on the origin steals the session). Helmet and a strict CSP on the CloudFront SPA later reduce that risk.

## Reasoning you should be able to say out loud

“The gateway is the security perimeter; workers trust headers only because they are private and I will add an internal token. I rate-limit generate because coins do not stop a flood of reserved jobs. I keep prompt assembly on the server so the client cannot overwrite the system policy. I use Gemini safety plus a short deny-list instead of a moderation platform. Private S3 and OTP redaction are the privacy work that matches actual data we hold. I did not migrate auth to a vendor because it would not change those boundaries.”

## Done when

Internal routes require a service token or are bound to localhost in Compose. Helmet and per-user generate limits are on the gateway. Provider input is server-built. OTP is not in info logs. Session delete story includes coins and, at least as a written follow-up, S3. You have a one-page threat list: stolen JWT, public worker port, prompt abuse, leaked OTP, public bucket.

## Refine here, then move on

Load handling will reuse the same Redis rate-limit infrastructure. If helmet or CORS breaks the Vite app, fix CORS explicitly for the frontend origin instead of turning helmet off.
