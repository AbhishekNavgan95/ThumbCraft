# ThumbCraft Production Deployment Roadmap (Cloud & DevOps Version)

## Project Goal

Deploy ThumbCraft as a production-inspired distributed microservices platform on AWS without Kubernetes. The primary objective is to demonstrate Cloud Engineering, DevOps, Infrastructure as Code, CI/CD automation, distributed systems, and production deployment practices.

The system should require **zero manual deployment steps** after the initial infrastructure has been provisioned.

The architecture should be completely reproducible using Terraform and GitHub Actions.

---

# High Level Objectives

The project should demonstrate experience with:

* Infrastructure as Code
* Cloud Networking
* Docker
* Microservices
* RabbitMQ
* CI/CD
* Auto Scaling
* Immutable Infrastructure
* Infrastructure Automation
* Monitoring
* Secrets Management
* Production Deployments
* High Availability
* Multi-environment Deployments

---

# Infrastructure

Everything should be provisioned using Terraform.

No AWS Console except for initial IAM bootstrap.

Infrastructure should include:

## Networking

* Custom VPC
* Public Subnets
* Private Subnets
* Internet Gateway
* NAT Gateway
* Route Tables
* Security Groups
* Network ACLs (basic)

Goal:

Completely understand AWS networking rather than relying on default VPCs.

---

## Compute

Use:

* Launch Template
* Auto Scaling Group
* Application Load Balancer

Requirements:

* Minimum 2 instances
* Health checks enabled
* Instance Refresh enabled
* Rolling replacement
* Automatic registration with ALB

Instances must remain stateless.

No application data stored locally.

---

## Database Layer

Use Amazon RDS PostgreSQL.

Database per service.

Example:

```
auth_db
generation_db
wallet_db
notification_db
```

Each service should only access its own database.

---

## Messaging

RabbitMQ

Options:

Development

Docker Compose

Production

Dedicated EC2 (preferred for learning)

or

Amazon MQ

---

## Redis

Use:

Elasticache

or

Dedicated EC2

Purpose:

* Celery
* Caching
* Background tasks

---

## Storage

Use:

Amazon S3

* Dedicated bucket(s) for base image uploads and generated thumbnails
* Optional CloudFront distribution for CDN delivery of image URLs
* EC2 instance IAM role grants upload/read access — avoid long-lived AWS keys in env where possible

No local file storage.

---

## Secrets

Use:

AWS Secrets Manager

or

SSM Parameter Store

Never commit:

```
.env.production
```

to Git.

---

# Docker Architecture

Every service owns its own image.

Example:

```
api-gateway

auth-service

wallet-service

generation-worker

notification-service
```

Each image:

* Multi-stage build
* Small production image
* Healthcheck
* Version tagged

Example:

```
thumbcraft/api-gateway:v1.2.0

thumbcraft/auth-service:v1.2.0
```

---

# Deployment Strategy

NO SSH deployment.

Never:

```
git pull

docker compose up
```

on production.

Deployment flow should be:

```
Git Push

↓

GitHub Actions

↓

Tests

↓

Build Docker Images

↓

Push Images to Registry

↓

Terraform Apply (if infrastructure changed)

↓

Start ASG Instance Refresh

↓

New EC2 launches

↓

User Data Script executes

↓

Install Docker

↓

Authenticate Registry

↓

Pull latest images

↓

Start Docker Compose

↓

Health Checks

↓

ALB Routes Traffic

↓

Terminate old EC2
```

Everything should happen automatically.

---

# EC2 Bootstrapping

Every EC2 instance should configure itself.

User Data Script responsibilities:

* Install Docker
* Install Docker Compose
* Configure Docker
* Authenticate with Docker Registry
* Download compose file
* Retrieve secrets
* Start services
* Configure logging
* Register monitoring

After an EC2 launches:

No manual commands should be required.

---

# CI/CD

GitHub Actions should handle:

## Pull Request

* Install dependencies
* Run lint
* Run tests
* Build Docker image

No deployment.

---

## Main Branch

* Build images
* Tag images
* Push images
* Run Terraform if required
* Trigger Instance Refresh

Deployment should be automatic.

---

## Secrets

Authentication should use:

OIDC

instead of long-lived AWS credentials.

GitHub assumes an IAM Role.

No permanent AWS keys.

---

# Deployment Strategy

Implement:

Rolling Deployment

Requirements:

* Zero downtime
* Health checks
* Automatic rollback if deployment fails

Use:

ASG Instance Refresh

instead of recreating infrastructure manually.

---

# Reverse Proxy

Use:

Nginx

Responsibilities:

* Reverse Proxy
* TLS termination (future)
* Routing
* Compression
* Security headers

---

# Monitoring

Implement:

CloudWatch

Monitor:

* CPU
* Memory
* Disk
* Network

---

Later:

Prometheus

Grafana

Node Exporter

cAdvisor

---

# Logging

Application

↓

stdout

↓

CloudWatch Agent

↓

CloudWatch Logs

Centralized logging.

---

# Health Checks

Every service should expose:

```
/health

/ready
```

Docker

↓

Docker HEALTHCHECK

↓

ALB Health Check

↓

Auto Scaling

Everything should work together.

---

# Scaling

Application Load Balancer

↓

Auto Scaling Group

↓

CPU Threshold

↓

Launch new EC2

↓

Startup Script

↓

Containers Start

↓

Health Check

↓

Traffic Shift

↓

Old Instance Removed

---

# Microservice Architecture

Services:

* API Gateway
* Auth
* Generation
* Wallet
* Notification

Communication:

HTTP

for synchronous APIs

RabbitMQ

for asynchronous workflows

Every service owns:

* Database
* Docker Image
* Environment Variables

No shared database.

---

# Infrastructure Repository Structure

```
thumbcraft/

apps/

packages/

infra/

terraform/

docker/

.github/workflows/

monitoring/

docs/
```

---

# Documentation

Create:

* Architecture Diagram
* AWS Infrastructure Diagram
* CI/CD Diagram
* Deployment Flow
* RabbitMQ Event Flow
* Database Relationship Diagram

---

# Production Principles

The project should demonstrate:

* Infrastructure as Code
* Immutable Infrastructure
* Stateless Compute
* Database per Service
* Event-driven Architecture
* Automated Deployments
* Auto Scaling
* Health Checks
* Secrets Management
* Monitoring
* Centralized Logging
* Failure Recovery
* Multi-environment Support
* Docker Best Practices
* Linux Administration
* AWS Networking
* Secure IAM Design

---

# Things to Learn While Building

Instead of treating learning as separate courses, each topic should naturally arise while implementing the project.

Infrastructure

* Terraform Modules
* Remote State
* Workspaces
* IAM
* VPC Design

Cloud

* EC2
* ALB
* Auto Scaling Groups
* Launch Templates
* RDS
* Secrets Manager
* CloudWatch

DevOps

* GitHub Actions
* OIDC
* Docker Registry
* Multi-stage Docker Builds
* Image Versioning
* Rolling Deployments
* User Data Scripts

Platform Engineering

* RabbitMQ
* API Gateway
* Reverse Proxy
* Health Checks
* Monitoring
* Logging
* Failure Recovery

Backend Engineering

* Microservices
* Event-driven Communication
* Saga Pattern (where applicable)
* Idempotency
* Retry Mechanisms
* Distributed Transactions
* Database per Service

---

# Final Goal

By the end of this project, the platform should demonstrate that you can:

* Design distributed backend systems.
* Provision production-ready AWS infrastructure entirely through Terraform.
* Build and version Docker images for independently deployable services.
* Automate CI/CD pipelines with GitHub Actions and OIDC authentication.
* Deploy immutable infrastructure using Auto Scaling Groups and Launch Templates.
* Operate production workloads with health checks, centralized logging, monitoring, and automatic scaling.
* Explain every architectural decision, tradeoff, and operational workflow from a Cloud, Platform, and DevOps engineering perspective.

**One final recommendation:** build this incrementally rather than trying to deploy everything at once.

A sensible milestone sequence would be:

1. Local microservices with Docker Compose.
2. Terraform networking and EC2.
3. RDS and RabbitMQ.
4. Deploy a single service end-to-end.
5. Add the remaining services.
6. Implement CI/CD.
7. Add Auto Scaling and immutable deployments.
8. Add monitoring and logging.
9. Harden security (IAM, Secrets Manager, OIDC).
10. Document the architecture and deployment decisions.
