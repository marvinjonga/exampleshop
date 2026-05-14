# exampleshop

This is a fully tested horizontally scalable application framework built with **TypeScript**, **Fastify**(fast Node.js framework), **MongoDB**, **Kafka**, **Docker**, and **Kubernetes**. Designed for high-traffic systems capable of handling millions of transactions per second, exampleshop ships as a production-ready microservices blueprint that teams can build on immediately.

While structured as an ecommerce platform, the architecture is general-purpose — the same patterns apply to any domain requiring high throughput, event-driven communication, and independent service scaling.

---

## What this solves

Most backend projects start simple and become expensive to scale later. exampleshop is designed from day one for horizontal scale. You can add more instances of a service under load rather than upgrading hardware. The infrastructure, patterns, and tooling choices all serve that goal:

- **Fastify** over Express — benchmarks consistently 2-3x faster, lower memory footprint and schema-first by design
- **Native MongoDB driver** over Mongoose — no ODM abstraction layer, direct connection pool control and full query performance
- **Kafka** for inter-service communication — services never call each other directly, so any service can scale, fail or be replaced without coupling
- **Typebox** as the single schema source — one definition covers runtime validation, TypeScript types and **Swagger** documentation simultaneously
- **Kubernetes** with a Deployment per service — each microservice scales independently based on its own load profile

---

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐
│   Products Service   │     │  Inventory Service   │
│   :8081              │     │  :8082               │
│                      │     │                      │
│  /api/v1/products    │     │  /api/v1/inventory   │
│  Swagger: /docs      │     │  Swagger: /docs      │
└──────────┬───────────┘     └──────────┬───────────┘
           │                            │
           └──────────────┬─────────────┘
                          │
           ┌──────────────▼─────────────┐
           │          MongoDB           │
           │   Sharded by storeid       │
           │   Native driver, no ODM    │
           └────────────────────────────┘

           ┌────────────────────────────┐
           │           Kafka            │
           │   inventory.low-stock      │
           │   inventory.out-of-stock   │
           └────────────────────────────┘
```

Event flow — inventory changes propagate without direct service coupling:

```
Inventory Service
  → publishes event to Kafka topic
    → Products Service consumes event
      → updates product stock field
```

---

## Project structure

```
/
├── microservices/
│   ├── products/
│   │   ├── server.ts              Entry point for products pod
│   │   ├── product.routes.ts
│   │   ├── product.model.ts
│   │   ├── product.schema.ts      Typebox schema — shared across all layers
│   │   └── product.consumer.ts    Kafka consumer for inventory events
│   └── inventory/
│       ├── server.ts              Entry point for inventory pod
│       ├── inventory.routes.ts
│       ├── inventory.model.ts
│       └── inventory.schema.ts
├── plugins/
│   └── swagger.ts                 Swagger registration — dev and staging only with zero prod environment overhead
├── lib/
│   └── kafka.ts                   Shared producer, consumer factory and topic constants
├── scripts/
│   └── setup-db.ts                One time MongoDB index and sharding setup
├── k8s/
│   ├── namespaces.yaml
│   ├── configmaps/
│   │   └── app-config.yaml
│   ├── secrets/
│   │   └── app-secrets.yaml.example
│   ├── mongo/
│   │   ├── statefulset.yaml
│   │   └── service.yaml
│   ├── kafka/
│   │   ├── statefulset.yaml
│   │   └── service.yaml
│   ├── app/
│   │   ├── products-deployment.yaml
│   │   ├── products-service.yaml
│   │   ├── inventory-deployment.yaml
│   │   └── inventory-service.yaml
│   └── jobs/
│       └── db-setup-job.yaml
├── docker/
│   └── mongo/
│       └── init/                  Mongo init scripts, run once on first boot
├── index.ts                       Local dev runner — starts both services together
├── Dockerfile                     Single file, build arg selects service
├── docker-compose.yml
└── .env.example
```

---

## Getting started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running

### 1. Environment setup

```bash
cp .env.example .env
```

The defaults work out of the box for local development. No changes needed to run locally.

### 2. Start everything

```bash
docker compose up --build
```

Docker Compose starts services in dependency order: MongoDB and Kafka first, then `kafka-init` creates the required topics then both application services start automatically once all health checks pass.

### 3. Verify

```bash
curl http://localhost:8081/ping   # products  → pong
curl http://localhost:8082/ping   # inventory → pong
```

### 4. Swagger UI

```
Products:  http://localhost:8081/docs
Inventory: http://localhost:8082/docs
```

Swagger is only available when `NODE_ENV=development`. In production it is not registered at all — no routes, no memory allocation and no performance cost.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Set to `production` to disable Swagger and enable structured JSON logging |
| `PORT` | `8081` | Overridden per service in docker-compose |
| `MONGO_URI` | `mongodb://mongo:27017` | MongoDB connection string. Uses Docker service name internally |
| `MONGO_DB` | `exampleshop` | Database name |
| `KAFKA_BROKERS` | `kafka:9092` | Comma-separated broker list. Uses Docker service name internally |
| `KAFKA_CLIENT_ID` | `exampleshop-api` | Identifies this app to the Kafka cluster |
| `JWT_SECRET` | — | For JWT auth middleware — infrastructure ready|

In Kubernetes, all variables are injected via ConfigMap and Secret. The `.env` file is local only and is gitignored.

---

## API reference

### Products — `http://localhost:8081`

| Method | Route | Description |
|---|---|---|
| `GET` | `/ping` | Health check |
| `GET` | `/api/v1/products?storeid=x` | List products, filtered by store |
| `GET` | `/api/v1/products/:id?storeid=x` | Get single product |
| `POST` | `/api/v1/products/add` | Create product |
| `PATCH` | `/api/v1/products/:id?storeid=x` | Partial update |

### Inventory — `http://localhost:8082`

| Method | Route | Description |
|---|---|---|
| `GET` | `/ping` | Health check |
| `GET` | `/api/v1/inventory/:id?storeid=x` | Get inventory for a product |
| `POST` | `/api/v1/inventory/add` | Create inventory record |
| `PATCH` | `/api/v1/inventory/:id?storeid=x` | Update inventory fields |
| `PATCH` | `/api/v1/inventory/:id/decrement?storeid=x` | Decrement stock — triggers Kafka events |

`storeid` is required on all GET and PATCH routes for MongoDB shard targeting. Omitting it causes a scatter-gather query across all shards.

---

## Schema and validation

All validation uses [@sinclair/typebox](https://github.com/sinclairzx81/typebox). A single schema definition serves three layers simultaneously with no duplication:

**Runtime validation** — Fastify validates every incoming request body against the schema before the handler runs. Non-conforming requests are rejected with a 400 automatically before any business logic executes.

**TypeScript types** — `Static<typeof Schema>` derives the TypeScript type from the same definition. No separate interface files.

**Swagger documentation** — `@fastify/swagger` reads the typebox schemas directly and generates the OpenAPI spec automatically. Routes stay as the single source of truth.

**Frontend reuse** — the same schema objects can be imported into a React or TypeScript frontend and used with `@sinclair/typebox/value` for form validation. No schema synchronisation between backend and frontend.

---

## Kafka events

Services communicate exclusively via events for async operations. No service calls another service's API directly.

| Topic | Published by | Trigger | Payload |
|---|---|---|---|
| `inventory.low-stock` | Inventory | Stock falls below 10 | `{ product_id, storeid, quantity, timestamp }` |
| `inventory.out-of-stock` | Inventory | Stock reaches 0 or below | `{ product_id, storeid, quantity, timestamp }` |

The Products service consumes `inventory.out-of-stock` and updates the product's stock field. Adding a new consumer — notifications, purchasing, analytics requires no changes to the Inventory service.

### Watch events in real time

To watch events in real time and to do some testing when you call the exampleshop APIs to decrement inventory stock levels you can run the following commands in your terminals and monitor:
```bash
# Terminal 1 — low stock
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:9092 \
  --topic inventory.low-stock \
  --from-beginning

# Terminal 2 — out of stock
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server kafka:9092 \
  --topic inventory.out-of-stock \
  --from-beginning
```

---


## Sharding

MongoDB sharding is keyed on `storeid`. All data for a store lives on the same shard. Any query that includes `storeid` in its filter is routed to a single shard by the `mongos` router — no broadcast.

The rule enforced throughout: **`storeid` must appear in every query filter**. Functions that deliberately omit it for admin purposes are named with an `Admin` suffix to make the scatter-gather cost explicit.

One-time shard setup runs via `scripts/setup-db.ts`, executed as a Kubernetes Job during initial cluster provisioning.

---

## Horizontal scaling

Each microservice is an independent Kubernetes Deployment. Scaling a service under load is a single command:

```bash
kubectl scale deployment inventory-service --replicas=10 -n shop-prod
```

This scales only inventory — products, MongoDB, and Kafka are unaffected. Services that need Redis for high read/write throughput (cart, sessions, rate limiting) can be added as separate Deployments with their own Redis StatefulSet, following the same pattern as the existing services.

---

## Adding a new microservice

1. Copy `microservices/inventory/` to `microservices/your-service/`
2. Replace schema, model, routes and server with your domain logic
3. Add the service to `docker-compose.yml` with a new port and `SERVICE` build arg
4. Copy `k8s/app/inventory-deployment.yaml` to `k8s/app/your-service-deployment.yaml`, update names, image and port
5. Register your server function in `index.ts` for local development

Dockerfile, Kafka setup, MongoDB connection, Swagger registration and health checks require no changes. The pattern is designed to be copied, not configured.

---

## Adding Redis for high-throughput services

For services like cart, sessions, or rate limiting where read/write volume is too high for MongoDB, the pattern is:

1. Add a Redis StatefulSet to `k8s/` following the same structure as the MongoDB manifests
2. Add `REDIS_URI` to the ConfigMap
3. Install `ioredis` in the service that needs it
4. Create a `plugins/redis.ts` plugin following the same conditional registration pattern as `plugins/swagger.ts`

Redis and MongoDB coexist in the same service — MongoDB for persistence, Redis for speed-sensitive operations on the same data.

---

## Kubernetes deployment

```bash
kubectl apply -f k8s/namespaces.yaml
kubectl apply -f k8s/secrets/app-secrets.yaml    
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/mongo/
kubectl apply -f k8s/kafka/
kubectl apply -f k8s/jobs/db-setup-job.yaml
kubectl apply -f k8s/app/
```

Each service defaults to 3 replicas. Autoscaling based on CPU or custom Kafka consumer-lag metrics can be added via Kubernetes HorizontalPodAutoscaler against any Deployment.

---

## Tech stack

| Technology | Role |
|---|---|
| [TypeScript](https://www.typescriptlang.org) | Type safety across all layers |
| [Fastify](https://fastify.dev) | HTTP framework — schema-first, significantly faster than Express |
| [@sinclair/typebox](https://github.com/sinclairzx81/typebox) | Single schema source for validation, types, and API documentation |
| [@fastify/swagger](https://github.com/fastify/fastify-swagger) | OpenAPI spec generation from route schemas — dev only, zero prod overhead |
| [@fastify/swagger-ui](https://github.com/fastify/fastify-swagger-ui) | Interactive API documentation — dev only |
| [MongoDB](https://www.mongodb.com) | Primary database — native driver sharded by storeid |
| [KafkaJS](https://kafka.js.org) | Kafka client for async inter-service events |
| [Docker](https://www.docker.com) | Single Dockerfile build arg selects service |
| [Kubernetes](https://kubernetes.io) | Independent Deployment per service scales horizontally |
| [@fastify/helmet](https://github.com/fastify/fastify-helmet) | Security headers |
| [@fastify/mongodb](https://github.com/fastify/fastify-mongodb) | MongoDB plugin with connection lifecycle management |
