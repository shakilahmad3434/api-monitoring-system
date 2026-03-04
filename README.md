<div align="center">

# 📡 API Monitoring System

**Real-Time API Hit Tracking & Monitoring**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![GitHub](https://img.shields.io/badge/GitHub-shakilahmad3434-black?logo=github)](https://github.com/shakilahmad3434/api-monitoring-system)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey.svg)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-green.svg)](https://mongoosejs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pg-blue.svg)](https://www.postgresql.org)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-amqplib-orange.svg)](https://www.rabbitmq.com)

> Monitor every API hit in real time — track latency, error rates, traffic patterns, and more, all from a single unified system.

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the Server](#running-the-server)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 Overview

The **API Monitoring System** is a backend service that tracks every HTTP request hitting your APIs in real time. Inspired by tools like Grafana and Datadog, it provides:

- **Live traffic dashboards** — requests per second, endpoint popularity
- **Latency tracking** — P50 / P95 / P99 response times
- **Error rate alerts** — automatic detection of spike anomalies
- **Audit logs** — full request/response payloads stored for replay and debugging
- **Rate-limiting** — protect upstream services from overload

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔴 **Real-Time Tracking** | Every API hit is captured and stored with metadata |
| 📊 **Metrics Aggregation** | Aggregated stats per endpoint, method, and time window |
| 🐇 **Event Queuing** | RabbitMQ decouples ingestion from processing for high throughput |
| 🔐 **JWT Auth** | Secure admin dashboard and API access |
| 🛡️ **Security Hardened** | Helmet headers, CORS, bcrypt password hashing |
| 🚦 **Rate Limiting** | Configurable per-IP and per-route request throttling |
| 📝 **Structured Logging** | Winston-powered JSON logs with log-level control |
| 🐳 **Docker Ready** | First-class Docker & Docker Compose support |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      API Clients                        │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Express Server  (server.ts)                │
│    Helmet · CORS · Rate-Limit · JWT Middleware          │
└──────────┬────────────────────────┬─────────────────────┘
           │                        │
           ▼                        ▼
   ┌───────────────┐       ┌─────────────────┐
   │  API Routes   │       │  Monitoring MW  │
   │  (business)   │       │  (hit recorder) │
   └───────┬───────┘       └────────┬────────┘
           │                        │ publish
           │               ┌────────▼────────┐
           │               │    RabbitMQ     │
           │               │  (amqplib AMQP) │
           │               └────────┬────────┘
           │                        │ consume
           ▼                        ▼
   ┌───────────────┐       ┌─────────────────┐
   │  PostgreSQL   │       │    MongoDB      │
   │ (relational   │       │ (hit logs,      │
   │  user data)   │       │  metrics store) │
   └───────────────┘       └─────────────────┘
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22.x |
| Language | TypeScript 5.x |
| Framework | Express 5.x |
| Relational DB | PostgreSQL (`pg`) |
| Document DB | MongoDB (`mongoose`) |
| Message Broker | RabbitMQ (`amqplib`) |
| Auth | JSON Web Tokens (`jsonwebtoken`) |
| Hashing | `bcryptjs` |
| Logging | `winston` |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Dev Tools | `tsx`, `typescript` |

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) `>= 20.x`
- [npm](https://www.npmjs.com/) `>= 10.x`
- [PostgreSQL](https://www.postgresql.org/) `>= 14`
- [MongoDB](https://www.mongodb.com/) `>= 6`
- [RabbitMQ](https://www.rabbitmq.com/) `>= 3.12`

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/shakilahmad3434/api-monitoring-system.git
cd api-monitoring-system

# 2. Install server dependencies
cd server
npm install
```

### Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

```dotenv
# ── Server ────────────────────────────────────
PORT=3000
NODE_ENV=development

# ── PostgreSQL ────────────────────────────────
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=api_monitoring
PG_USER=postgres
PG_PASSWORD=your_password

# ── MongoDB ───────────────────────────────────
MONGO_URI=mongodb://localhost:27017/api_monitoring

# ── RabbitMQ ──────────────────────────────────
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_QUEUE=api_hits

# ── Auth ──────────────────────────────────────
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

# ── Rate Limiting ─────────────────────────────
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

### Running the Server

```bash
# Development (hot-reload)
npm run dev

# Production build
npm run build
npm start
```

The server will be available at `http://localhost:3000`.

---

## 📁 Project Structure

```
api-monitoring-system/
├── server/
│   ├── src/
│   │   ├── server.ts          # Entry point
│   │   ├── config/            # Environment & DB config
│   │   ├── middleware/        # Auth, rate-limit, hit-logger
│   │   ├── modules/           # Feature modules (routes, controllers, services)
│   │   │   ├── auth/
│   │   │   ├── metrics/
│   │   │   └── hits/
│   │   ├── queue/             # RabbitMQ producer / consumer
│   │   ├── models/            # Mongoose schemas
│   │   ├── db/                # PostgreSQL client
│   │   └── utils/             # Logger, uuid helpers, etc.
│   ├── package.json
│   └── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 📡 API Reference

### Health Check

```http
GET /health
```

| Response | Description |
|---|---|
| `200 OK` | Server is healthy |

### Authentication

```http
POST /api/auth/register
POST /api/auth/login
```

### Metrics

```http
GET /api/metrics                # All-time aggregated stats
GET /api/metrics/:endpoint      # Stats for a specific endpoint
GET /api/metrics/errors         # Error rate summary
```

### Hit Logs

```http
GET /api/hits                   # Paginated raw hit log
GET /api/hits/:id               # Single hit detail
```

> 🔒 All `/api/metrics` and `/api/hits` routes require a valid `Authorization: Bearer <token>` header.

---

## 🗺️ Roadmap

- [x] Express server bootstrap
- [x] JWT authentication
- [x] Rate limiting & security headers
- [ ] API hit recording middleware
- [ ] RabbitMQ producer / consumer
- [ ] MongoDB hit-log storage
- [ ] PostgreSQL user & config storage
- [ ] Metrics aggregation service
- [ ] REST API for querying metrics
- [ ] WebSocket live-feed endpoint
- [ ] Dashboard UI (React + Chart.js)
- [ ] Docker Compose setup
- [ ] Alerting engine (threshold-based)
- [ ] OpenTelemetry / Prometheus export

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

Please make sure your code passes linting and includes relevant tests.

---

## 📄 License

This project is licensed under the **ISC License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ❤️ by **Shakil Ahmad**

</div>
