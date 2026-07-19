# ThumbCraft Production Deployment Roadmap (ECS Version)

## Project Goal

Deploy ThumbCraft as a production-inspired distributed microservices platform on AWS **without Kubernetes**, using **Amazon ECS**. The primary objective is to demonstrate Cloud Engineering, DevOps, Infrastructure as Code, CI/CD automation, distributed systems, and production deployment practices.

The system should require **zero manual deployment steps** after the initial infrastructure has been provisioned.

The architecture should be completely reproducible using Terraform and GitHub Actions.

---

# High Level Objectives

The project should demonstrate experience with:

- Infrastructure as Code (Terraform)
- Cloud Networking (VPC)
- Docker + ECR
- ECS (EC2 launch type / capacity providers)
- Microservices that scale independently
- RabbitMQ / Amazon MQ
- Redis / ElastiCache (BullMQ)
- CI/CD (GitHub Actions + OIDC)
- Auto Scaling (ECS services + EC2 capacity)
- Immutable task deployments
- Secrets Management
- Monitoring & centralized logging
- High Availability
- Multi-environment Deployments (staging / prod)

---



# Target Topology

```
Internet
   │
   ├─► CloudFront (web static) ──► S3 (Vite build)
   │
   └─► ALB (public) ──► api-gateway (ECS service)
                              │  Service Connect / Cloud Map
                ┌─────────────┼──────────────┐
                ▼             ▼              ▼
           auth-service  wallet-service  generation-worker
                │             │              │
                └────── Amazon MQ (RabbitMQ) ┘──► notification-service
                                 │
                            ElastiCache Redis ◄── generation (BullMQ)
                                 │
                      RDS PostgreSQL (DB per service)
                                 │
                      S3 assets + CloudFront CDN (images)
```

**Rule:** one ECS service = one app = one ECR repository = its own desired count / autoscaling.

---



# Infrastructure

Everything should be provisioned using Terraform.

No AWS Console except for initial IAM bootstrap (and optional early CloudFront/S3 experiments).

## Networking

- Custom VPC
- Public Subnets (ALB, NAT, optional bastion)
- Private Subnets (ECS tasks, RDS, Redis, MQ)
- Internet Gateway
- NAT Gateway
- Route Tables
- Security Groups (least privilege between ALB → gateway → backends → data stores)

Goal: understand AWS networking rather than relying on default VPCs.

---



## Compute — Amazon ECS on EC2

Use:

- **ECS cluster** (EC2 launch type)
- **Capacity provider** backed by an Auto Scaling Group of ECS-optimized AMIs
- **Launch Template** + ASG for cluster capacity (more instances when tasks need room)
- **One ECS task definition + one ECS service per microservice**
- **Application Load Balancer** in front of **api-gateway only**
- **Service Connect** (or Cloud Map) for private service-to-service DNS

Requirements:

- Tasks run in private subnets
- Stateless containers (no local app data)
- Rolling ECS deployments (`minimumHealthyPercent` / `maximumPercent`)
- ALB health checks on gateway
- Container health checks on all services



### Why ECS (not Compose on EC2)

- Each service scales and deploys independently
- No SSH / `docker compose up` on production hosts
- Task definitions pin immutable image digests
- ALB + Service Connect handle discovery and load balancing



### Network mode for same container ports

- Prefer `awsvpc`: each task gets its own ENI/IP — replicas can all listen on e.g. `:3000`
- Alternative: `bridge` with dynamic host ports (`hostPort: 0`) if packing denser on fewer instances

Do **not** use `host` mode for scaled same-port services.

### ECS services


| ECS service            | Container port | Notes                                         |
| ---------------------- | -------------- | --------------------------------------------- |
| `api-gateway`          | 3000           | Public ALB target                             |
| `auth-service`         | 3001           | Private; Prisma → `auth_db`                   |
| `wallet-service`       | 3002           | Private; Prisma → `wallet_db`; Stripe         |
| `generation-worker`    | 3003           | Private; Prisma → `generation_db`; S3; BullMQ |
| `notification-service` | 3004           | Private; RabbitMQ consumers                   |


Optional later split for generation:

- `generation-api` (HTTP only)
- `generation-worker` (BullMQ only)

so workers scale independently of the HTTP API.

### Frontend — not on ECS


| App          | Deploy as                          |
| ------------ | ---------------------------------- |
| `web` (Vite) | `vite build` → **S3 + CloudFront** |


Static SPA; browsers call the API via the ALB / API domain. No Node container required for the UI.

---



## Database Layer

Use Amazon RDS PostgreSQL.

Database per service:

```
auth_db
generation_db
wallet_db
notification_db
```

Each service should only access its own database (SG + credentials).

---



## Messaging

RabbitMQ topic exchange `platform.events` (same contracts as local).


| Environment | Option                                                       |
| ----------- | ------------------------------------------------------------ |
| Development | Docker Compose                                               |
| Production  | **Amazon MQ** (managed) or dedicated EC2 RabbitMQ (learning) |


Used for wallet / generation / notification events — **not** for image generate (that is BullMQ).

---



## Redis

Use **ElastiCache Redis** (or small EC2 for learning).

Purpose:

- BullMQ queues for async image generation
- Optional caching later

---



## Storage



### Asset bucket (uploads / generated thumbnails)

- Private S3 bucket + **Block Public Access ON**
- **CloudFront + Origin Access Control (OAC)** for public-looking CDN URLs
- App sets `AWS_S3_PUBLIC_BASE_URL` to the CloudFront domain
- ECS task role grants `s3:GetObject` / `PutObject` / `DeleteObject` — avoid long-lived keys in prod
- Server loads refs for the LLM via **S3 SDK** `GetObject`, not via CloudFront



### Web static hosting

- Separate S3 bucket for the Vite build
- CloudFront distribution for the site (SPA-friendly error/default behaviors)

No local file storage on tasks or EC2 hosts.

---



## Secrets

Use AWS Secrets Manager or SSM Parameter Store.

Inject into ECS task definitions as secrets (not baked into images).

Never commit:

```
.env.production
```

to Git.

---



# Docker + ECR Architecture

Every **backend** service owns its own image and ECR repository.

```
thumbcraft/api-gateway
thumbcraft/auth-service
thumbcraft/wallet-service
thumbcraft/generation-worker
thumbcraft/notification-service
```

Build from `infra/docker/Dockerfile.template` (per-app Dockerfile under each `apps/<service>/`).

Each image:

- Multi-stage pnpm build
- Small production runner (`node dist/index.js`)
- HEALTHCHECK against `/health`
- Tags: `sha-<gitsha>` (immutable deploy pin); optional `env-staging` / `env-prod`

Example:

```
123456789012.dkr.ecr.ap-south-1.amazonaws.com/thumbcraft/api-gateway:sha-abc1234
```

Do not rely on `latest` for production deploys.

---



# Service Communication


| Path                                 | Mechanism                                        |
| ------------------------------------ | ------------------------------------------------ |
| Browser → API                        | CloudFront/S3 (web) → ALB → `api-gateway`        |
| Gateway → auth / wallet / generation | HTTP over Service Connect                        |
| Generation → wallet (quote/reserve)  | HTTP private                                     |
| Events → notification                | RabbitMQ `platform.events`                       |
| Async generate                       | BullMQ on ElastiCache                            |
| Images                               | Private S3; CDN URLs for clients; SDK for server |


Env URLs become stable names, e.g.:

```
AUTH_SERVICE_URL=http://auth-service:3001
WALLET_SERVICE_URL=http://wallet-service:3002
GENERATION_WORKER_URL=http://generation-worker:3003
REDIS_URL=redis://...
RABBITMQ_URL=amqps://...
AWS_S3_PUBLIC_BASE_URL=https://dxxxx.cloudfront.net
```

No hardcoded task IPs. No SSH deploys. Never `git pull` + `docker compose up` on production.

---



# Deployment Strategy

```
Git Push (main)
       ↓
GitHub Actions
       ↓
Lint / typecheck / test (turbo)
       ↓
Build changed service image(s)
       ↓
Push to ECR (tag sha-<gitsha>)
       ↓
Terraform apply (if infra/** changed)
       ↓
Register new ECS task definition revision
       ↓
Update ECS service (rolling deploy)
       ↓
ALB / Service Connect health checks
       ↓
Drain old tasks
```

Frontend path:

```
Build Vite → sync S3 → CloudFront invalidation (optional)
```

Everything after the first Terraform bootstrap should be automatic.

---



# CI/CD

GitHub Actions + **OIDC** → IAM role (no long-lived AWS keys in GitHub).

## Pull Request

- Install dependencies (`pnpm`)
- Lint / typecheck / test (`turbo`)
- Optionally build Docker images (no push / no deploy)



## Main Branch


| Workflow             | Trigger                                      | Does                                                     |
| -------------------- | -------------------------------------------- | -------------------------------------------------------- |
| `ci.yml`             | PR / main                                    | Verify                                                   |
| `deploy-service.yml` | Path filter `apps/<svc>/**` or `packages/**` | Build/push ECR → roll that ECS service                   |
| `deploy-web.yml`     | Path filter `apps/web/**`                    | Build → S3 → CloudFront                                  |
| `infra.yml`          | `infra/terraform/**`                         | `terraform plan` → apply (prod via approval environment) |


---



# Rolling Deployments & Scaling



## Per-service scale (ECS)

```
Metric (CPU / ALB RPS / queue depth)
       ↓
ECS Service Auto Scaling
       ↓
More / fewer tasks of that service
```

Examples:

- Gateway / auth / wallet → CPU or ALB request count
- Generation → Redis BullMQ depth + CPU
- Notification → RabbitMQ queue depth



## Cluster capacity (EC2)

```
Pending ECS tasks / capacity provider reservation
       ↓
ASG scales out ECS container instances
       ↓
New tasks place on new hosts
```

Application scale and cluster capacity are separate concerns.

## Zero downtime

- ECS rolling update
- ALB target deregistration delay / drain
- Health checks must pass before traffic shifts
- Failed task definition → stop rollout; previous revision remains

---



# Reverse Proxy / Edge

- **ALB** terminates TLS (ACM) and routes to `api-gateway`
- Optional path/host rules later; start with single API host
- Nginx on EC2 is **not** required when using ALB + ECS Service Connect
- CloudFront in front of web + asset buckets

---



# Monitoring

CloudWatch:

- ECS service CPU / memory
- ALB 5xx / latency / healthy host count
- ASG / capacity provider metrics
- RDS / Redis / MQ basic metrics
- Custom metrics later (queue depth)

Later (optional): Prometheus / Grafana / Container Insights dashboards.

---



# Logging

```
Application stdout/stderr
       ↓
ECS awslogs driver
       ↓
CloudWatch Logs (one log group per service)
```

Centralized logging; no SSH to scrape files.

---



# Health Checks

Every service exposes:

```
/health
/ready   (optional)
```

Chain:

```
Container HEALTHCHECK
       ↓
ECS service health
       ↓
ALB health check (gateway)
       ↓
Autoscaling / replacement decisions
```

---

# Microservice Architecture

Services:

- API Gateway
- Auth
- Generation (HTTP + BullMQ worker; split later if needed)
- Wallet
- Notification
- Web (static)

Communication:

- HTTP for synchronous APIs
- RabbitMQ for async platform events
- BullMQ / Redis for generation jobs

Every backend service owns:

- Database (where applicable)
- Docker image / ECR repo
- ECS task definition + service
- Environment / secrets

No shared application database.

---



# Infrastructure Repository Structure

```
thumbcraft/
  apps/
  packages/
  infra/
    docker/                 # Dockerfile template / helpers
    terraform/
      modules/
        vpc/
        ecr/
        ecs_cluster/        # cluster + capacity provider + ASG
        ecs_service/        # reusable task def + service + SG + logs
        alb/
        rds/
        elasticache_redis/
        amazon_mq/
        s3_assets/          # private bucket + CloudFront OAC
        s3_web/             # static site + CloudFront
        secrets/
      envs/
        staging/
        prod/
  .github/workflows/
  monitoring/
  docs/
```

---



# Documentation

Create:

- Architecture diagram (ECS topology)
- AWS infrastructure diagram
- CI/CD diagram
- Deployment / rollback flow
- RabbitMQ event flow
- BullMQ generate flow
- Database-per-service diagram

---



# Production Principles

The project should demonstrate:

- Infrastructure as Code
- Immutable task deployments (image digests)
- Stateless compute
- Database per service
- Event-driven architecture
- Automated deployments
- Independent service autoscaling
- Health checks
- Secrets management
- Monitoring & centralized logging
- Failure recovery
- Multi-environment support
- Docker best practices
- AWS networking & secure IAM (task roles, OIDC)
- Private origin + CDN for assets

---



# Things to Learn While Building

Infrastructure

- Terraform modules, remote state, workspaces
- IAM (task roles, execution roles, GitHub OIDC)
- VPC design

Cloud

- ECS (services, task definitions, capacity providers)
- EC2 ASG for ECS capacity
- ECR
- ALB + Service Connect / Cloud Map
- RDS, ElastiCache, Amazon MQ
- S3 + CloudFront (OAC)
- Secrets Manager / SSM
- CloudWatch

DevOps

- GitHub Actions
- OIDC
- Multi-stage Docker builds
- Image versioning
- Rolling ECS deployments
- Path-filtered service deploys

Platform Engineering

- RabbitMQ + BullMQ
- API gateway patterns
- Health checks
- Logging & monitoring
- Failure recovery

Backend Engineering

- Microservices
- Event-driven communication
- Idempotency & retries
- Database per service

---



# Final Goal

By the end of this project, the platform should demonstrate that you can:

- Design distributed backend systems.
- Provision production-ready AWS infrastructure entirely through Terraform.
- Build and version Docker images for independently deployable services on ECS.
- Automate CI/CD with GitHub Actions and OIDC.
- Deploy immutably via new task definition revisions and rolling ECS updates.
- Scale services independently and scale cluster capacity separately.
- Host the SPA on S3 + CloudFront and assets on a private bucket + CDN.
- Operate with health checks, centralized logging, monitoring, and automated recovery.
- Explain every architectural decision and tradeoff from a Cloud, Platform, and DevOps perspective.

**Build incrementally** rather than deploying everything at once.

Suggested milestones:

1. Local microservices with Docker Compose + per-service Dockerfiles.
2. Terraform VPC + ECR + ECS cluster (EC2 capacity) + one service (`api-gateway`) behind ALB.
3. RDS + Redis + RabbitMQ/Amazon MQ.
4. Deploy remaining backend services + Service Connect wiring.
5. Private S3 assets + CloudFront; wire `AWS_S3_PUBLIC_BASE_URL`.
6. Deploy `web` to S3 + CloudFront.
7. GitHub Actions CI + path-filtered ECS / web deploys (OIDC).
8. Service autoscaling + capacity provider scaling.
9. Monitoring, logging, and security hardening (secrets, IAM).
10. Document architecture and deployment decisions.

