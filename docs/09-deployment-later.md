# Deployment (later)

## Why this file is short and last

The other plans make Thumbcraft behave like a product on one machine: tests, correct conversation state, safe money, traces, limits. **Deployment copies that system onto AWS.** If you deploy first, you will debug IAM and VPC while coins still drop on a nack. Do not do that.

The long version already lives at the repo root in [`deploymentPlan.md`](../deploymentPlan.md). This page only records **when** to open it and **what must be true** so ECS is not a science fair.

## Preconditions (the other plans)

You should have: `pnpm test` on generate and wallet; fail-closed `/ready`; DLQ and outbox; jobId in logs; generate 429 under load; private-S3-shaped config; no leftover public worker ports in Compose.

You should be able to run **app containers**, not only Postgres/Redis/RabbitMQ. Uncomment the services in `docker-compose.yml` and use `infra/docker/Dockerfile.template` so “works on my machine” means “works as a container.” That is the rehearsal for ECR.

## What you will build (reminder, not a second plan)

Internet users hit CloudFront for the Vite app and an ALB for `api-gateway` only. Auth, wallet, generation, and notification stay private on ECS. RDS holds one database per service. ElastiCache is Redis for BullMQ and rate limits. Amazon MQ (or equivalent) is RabbitMQ with the same `platform.events` contracts. Images stay on a private bucket with CloudFront OAC. GitHub Actions builds images tagged with git sha and rolls ECS services. Secrets come from Secrets Manager, not `.env` files on a VM.

You chose **ECS on EC2, not Kubernetes**, because you want to learn AWS networking, task definitions, and autoscaling without running a control plane. Do not switch that decision in these engineering plans unless the whole project goal changes.

Scale rules from plan 08 still apply in the cloud: autoscale **workers from queue depth**, gateway from CPU/RPS, cluster capacity from pending ECS tasks. Health checks on ALB should hit gateway `/health` only after gateway `/ready` is honest about downstreams you care about (or the gateway stays up and workers go unready separately — pick one story and document it in `deploymentPlan.md` when you get there).

## What not to do when you start deploy

Do not put the frontend in an ECS Node container. Static S3 + CloudFront is enough.

Do not deploy `latest` tags. Pin `sha-…`.

Do not expose RabbitMQ management or Postgres to 0.0.0.0/0.

Do not treat Terraform as optional “if I have time.” The point of `deploymentPlan.md` is reproducible infra. Clicking a cluster together in the console is not the project.

## Reasoning you should be able to say out loud

“I delayed deploy until the job and coin paths were correct and observable, because a cluster does not fix a dropped capture event. I will run the same containers locally via Compose, then copy the topology in Terraform: ALB to gateway, private tasks, RDS, Redis, MQ, S3. I use ECS instead of Kubernetes to match the learning goal and the size of the app. Workers scale on queue depth because that is the real load.”

## Done when (much later)

Staging exists, a push to main rolls a changed service, rollback is a previous task definition, logs land in CloudWatch with jobId, and you can point at `deploymentPlan.md` milestones 1–9 with honest checkmarks.

Until then, keep working through files 01–08 and leave this file as a gate, not a backlog of YAML.
