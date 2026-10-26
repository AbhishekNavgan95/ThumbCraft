# Observability

## Why this exists

When a user says “my thumbnail failed” or “it took a minute,” you need one id that follows the request from the browser through the gateway, wallet reserve, BullMQ wait, Gemini, S3, and the billing event. Today you have Pino JSON logs and an `X-Correlation-Id`. That is a start. It is not enough to see *which hop* ate 38 of 40 seconds, or whether coins were captured.

Observability is not a Grafana hobby. It is the ability to answer: **this jobId — did we reserve, how long did we wait in queue, how long was Gemini, did S3 succeed, did wallet capture, what error class was it?**

## Three signals, one story

**Logs** tell you the narrative in words. Keep Pino. Add the same fields on every line: `service`, `jobId` when you have one, `userId` when you have one, `correlationId`, and later `traceId`. Put this in `packages/logger` so auth, wallet, worker, and gateway cannot drift. Do not log full image base64, OTP codes, or access tokens. Do not use `pino-pretty` in production; pretty logs are for local terminals.

**Traces** tell you timing across services. Use **OpenTelemetry**. One SDK boot in each service (`@opentelemetry/sdk-node` plus HTTP/Fastify/Redis instrumentations) creates a span per request and per BullMQ job. Propagate W3C `traceparent` in addition to your existing `X-Correlation-Id` so you do not throw away the id you already send on events. The generate trace should look like: gateway POST /api/generate → worker enqueue → (async) worker process → Gemini → S3 put → publish. Wallet reserve should be a child span of enqueue.

**Metrics** tell you rate and shape over time. You do not need fifty of them. Start with: generate requests, generate 4xx/5xx, jobs completed, jobs failed, queue waiting/active, `job_duration_ms` histogram, `queue_wait_ms`, `gemini_ms`, `s3_put_ms`, `wallet_http_ms`, capture vs release counts. If waiting depth climbs while Gemini latency is flat, you have a worker capacity problem. If Gemini p95 explodes, you have a provider problem. Those two are different actions.

**Errors** that reach humans should also go to **Sentry** (gateway, worker, and React). Sentry is an inbox with stack traces. It is not a substitute for traces. Use it so you do not SSH into logs to find a Fastify crash.

## What not to adopt yet

Do not install Datadog, New Relic, or a full Prometheus-Grafana-Kubernetes stack on day one. They cost money or time and you have no production traffic. OpenTelemetry is the API; you can export to the console locally, and later to CloudWatch or an OTLP collector when you deploy (see plan 09). If you want a local view, a Prometheus exporter on each process is enough.

Do not build an admin “observability page” inside Thumbcraft. You would maintain a second product. Use Sentry’s UI and, later, CloudWatch Logs Insights queries by `jobId`.

Do not trace every health check at full sample rate. Health noise hides real generate traces. Sample `/health` at a low rate or exclude it.

## How to integrate in this repo

Initialize OpenTelemetry **before** Fastify listens, in each `apps/*/src/index.ts`. Shared helper in `packages/` is fine so resource `service.name` matches `SERVICE_NAME`.

Pass `correlationId` into BullMQ payload (you already do) and set it as a span attribute on the worker. When you publish RabbitMQ events, copy `traceparent` / `correlationId` onto the envelope that `packages/messaging-contract` already has.

Replace “always ok” health aggregation on the gateway (plan 03) so a dashboard of “gateway is healthy” means something.

Frontend: send the correlation id header if the gateway returns one; Sentry `setTag('jobId')` when polling fails. You do not need OpenTelemetry in the browser yet.

## Reasoning you should be able to say out loud

“I kept Pino because structured logs are cheap and we already have them. I added OpenTelemetry because a 40 second job has four hops and logs cannot show parent/child timing. I added Sentry so crashes have an inbox. I did not buy Datadog because the export format is OTLP and CloudWatch matches the later AWS plan. Every signal is keyed by jobId because that is the unit the user and the wallet both understand.”

## Done when

A single generate in local dev prints one correlation id through gateway logs, worker logs, and the completed event. You can point to histograms or at least timed log fields for queue wait versus Gemini. Sentry receives a test error from the worker. Health checks are excluded from traces or sampled down.

## Refine here, then move on

Once you can explain a slow job from logs, add cost fields (next plan) onto the same spans. Do not start security headers until you can debug generate; you will break something and need this.
