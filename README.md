# E-Commerce Microservices

A backend-only practice project implementing an e-commerce order flow using independent Node.js microservices, coordinated through choreography-based events over RabbitMQ.

## Architecture

```
Client → API Gateway (JWT auth, proxying)
              │
   ┌──────────┼──────────────┬──────────────┐
   ▼          ▼               ▼
Identity    Order          Inventory
Service     Service         Service
              │                │
              └── order.created ──┴──► Payment Service
                                          │
        inventory.reserved/failed ◄──────┤
        payment.completed/failed ◄───────┘
                     │
         Order Service (fan-in) → confirmed / cancelled
```

Each service owns its own database. No shared collections — all cross-service communication happens via the gateway (client-facing requests) or RabbitMQ (async events).

## Services

- **API Gateway** — JWT verification, rate limiting, proxies requests, forwards `x-user-id` downstream
- **Identity Service** — registration/login, argon2 password hashing, JWT + refresh tokens, Redis cache-aside
- **Order Service** — creates orders, publishes `order.created`, tracks fan-in state from downstream events, confirms/cancels orders
- **Inventory Service** — product catalog, atomic stock reservation (`findOneAndUpdate`) to prevent overselling
- **Payment Service** — minimal, event-only service that simulates a payment outcome (no DB, no REST API)

## Tech Stack

Node.js, Express, MongoDB (Mongoose), Redis (`ioredis`), RabbitMQ (`amqplib`), JWT, argon2, Joi, Winston.

## Known Simplifications

- Price lookup is a synchronous HTTP call from Order → Inventory Service (not fully event-driven)
- No rollback on partial reservation failure across multi-item orders
- No idempotency key on order creation
- No dead-letter queue for failed message processing
- No frontend — backend-only, tested via Postman and the RabbitMQ management UI