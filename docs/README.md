# Engineering plans

These notes are how Thumbcraft becomes a product you can operate and explain, not a pile of extra features. Each file is one aspect. Finish that aspect (or decide what to skip) before opening the next file.

Deployment stays last on purpose. The application should already behave correctly on your laptop and in Compose before you spend time on ECS.

## How to use a plan

Read the file once for the story. Then use the “What to change in this repo” section as a checklist. When you finish an aspect, write a short note at the bottom of that file: what you actually built, what you deferred, and why. That note is the answer you will give later when someone asks how you designed it.

## Suggested order

1. [Evaluation and testing](./01-evaluation-and-testing.md) — **done:** CI proves generate/wallet/jobs with fakes; manual golden evals in `evals/` (see completion note in that file).
2. [Data and conversation state](./02-data-and-conversation-state.md) — lock sessions, messages, and jobs as the source of truth.
3. [Reliability](./03-reliability.md) — same request twice, crash mid-job, money that cannot double-charge.
4. [Failure tolerance](./04-failure-tolerance.md) — Gemini outages, dropped events, stuck reservations.
5. [Observability](./05-observability.md) — answer why a job was slow, failed, or unpaid.
6. [Cost and latency](./06-cost-and-latency.md) — measure wait vs generate vs upload; keep coins honest.
7. [Security, guardrails, and privacy](./07-security-guardrails-privacy.md) — public gateway, private workers, user images, OTP.
8. [Load handling and scale](./08-load-handling-and-scale.md) — stop overload before you add machines.
9. [Deployment (later)](./09-deployment-later.md) — pointer into `deploymentPlan.md` once the app deserves a cluster.

## What we are not doing in these plans

Do not introduce Kubernetes, Kafka, Auth0, a second image provider, or an in-app Grafana clone in order to look “complete.” Those tools solve problems this repo does not have yet. If a plan mentions an optional tool, it says why you can wait.
