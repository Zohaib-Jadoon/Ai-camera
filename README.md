# Madad Vision AI

### Enterprise-Grade Smart CCTV Surveillance & Real-Time AI Analytics Platform

Madad Vision AI is a state-of-the-art smart surveillance and computer vision platform designed for enterprise security operations centers (SOCs), manufacturing plants, and municipal traffic networks. By combining high-speed YOLOv8 object detection, facial matching, license plate extraction, PPE compliance auditing, and natural language CLIP visual search, it converts passive camera streams into actionable, real-time security insights.

---

## Table of Contents
1. [Core Features & AI Capabilities](#1-core-features--ai-capabilities)
2. [Monorepo Workspace Structure](#2-monorepo-workspace-structure)
3. [Advanced System Architecture](#3-advanced-system-architecture)
4. [Production Security Hardening](#4-production-security-hardening)
5. [Database Schema & Models](#5-database-schema--models)
6. [Docker Deployment Guide](#6-docker-deployment-guide)
7. [API & Webhook Integrations](#7-api--webhook-integrations)

---

## 1. Core Features & AI Capabilities

### A. Real-Time Bounding Box Detection & CENTROID Tracking
- **Detection Loop**: Processes raw camera streams concurrently using highly-optimized OpenCV pipelines. Gated by an **Improved Motion Detector** that flags frame changes, saving up to 70% CPU cycles by executing YOLOv8 inference only when movement occurs.
- **Centroid Tracker**: Persists unique track IDs for persons, vehicles, and other targets across frame boundaries, preventing double-counting and filtering out redundant alerts.

### B. Facial Recognition & Secure ArcFace Enrollment
- **Analysis Pipeline**: Employs InsightFace RetinaFace for high-speed facial localization and alignment, followed by ArcFace to generate 512-dimensional vector embeddings.
- **Enrollment Flow**: Security operators can upload photographs via the Next.js UI. The NestJS backend routes the image to the Python AI Engine via Socket.IO, extracts the 512-dim embedding, persists the float vector in PostgreSQL, and syncs the in-memory face index on all active stream processors.

### C. License Plate Recognition (LPR) & Watchlists
- **Text Extraction**: Bounding box vehicle crops are straightened via perspective homography matrices and processed using deep learning OCR models (EasyOCR/PaddleOCR).
- **Watchlist Engine**: Extracted text is checked against active database watchlists. Matches immediately trigger a high-severity alert.
- **Audit Persistence**: Every read license plate is recorded in the `Detection` table under the identifier `LICENSE_PLATE:<text>` for instant historical queries and analytics.

### D. Industrial Safety Compliance & Fall Auditing
- **Pose Estimation**: Analyzes keypoint locations to automatically trigger alerts on dangerous slip-and-fall events or active physical altercations.
- **PPE Verification**: Audits worker safety in real-time by running secondary classifiers over person bounding boxes to ensure hardhats and high-visibility safety vests are worn in designated areas.

### E. Semantic Visual Search via CLIP
- **Text-to-Image Map**: Integrates OpenAI's Contrastive Language-Image Pretraining (CLIP) engine. Generates dense visual embeddings of processed snapshots.
- **Natural Language Querying**: Allows operators to search history using conversational phrases (e.g. *"person in a red jacket near camera 3"*) by matching text queries directly against stored visual vector coordinates.

---

## 2. Monorepo Workspace Structure

Madad Vision AI is structured as a decoupled, single-repository npm workspaces monorepo:

```
madad-vision-ai/                   (Root Workspace)
├── package.json                   # Monorepo configuration and workspace links
├── docker-compose.yml             # Local orchestrator for standard containers
├── docker/                        # Custom container Dockerfiles and Nginx configs
├── packages/
│   └── types/                     # Shared TypeScript interface definitions
└── apps/
    ├── web/                       # Next.js 16 (React 19) client dashboard interface
    ├── backend/                   # NestJS 11 + Prisma 6 PostgreSQL backend engine
    └── ai-engine/                 # Python 3.11 asynchronous stream processing engine
```

### Decoupled Service Isolation:
- **`apps/web`**: Responsive client frontend built with Next.js App Router, Zustand, and TanStack Query. Contains interactive Konva canvas editors for direct camera calibration and per-camera zone calibration.
- **`apps/backend`**: Fully-fledged REST and WebSockets API gateway serving live streams, event logs, configurations, and escalations.
- **`apps/ai-engine`**: High-performance Python core processing all frame data concurrently using threads to prevent event loop delay.

---

## 3. Advanced System Architecture

The platform is built as a zero-trust, high-throughput distributed system:

```
                  ┌──────────────────────────────────────────────┐
                  │                 Nginx Proxy                  │
                  │                 (Port: 80)                   │
                  └──────────────────────┬───────────────────────┘
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
          [Next.js Client]                            [NestJS Backend]
             (Port: 3000)                               (Port: 3001)
                   │                                           ▲
                   ▼                                           │
         [Socket.IO Client] ──(Live feeds & BBoxes)────────────┤
                                                               │  (Sync commands
                                                               │   & heartbeats)
                                                               ▼
                                                       [Python AI Engine]
                                                          (Port: 8000)
```

- **Reverse Proxy**: Nginx routes all `/api/*` REST queries and `/socket.io/*` WebSocket requests to the backend gateway, serving static client files directly.
- **Inter-Service Real-Time Bus**: The Python Engine operates as an authenticated Socket.IO client, streaming detection metadata and camera heartbeats up to the backend, which is then broadcast directly to connected Next.js panels.

---

## 4. Production Security Hardening

To support B2B corporate compliance, the platform includes the following built-in security features:

1. **Database-Level RTSP Encryption at Rest**: Camera streaming URLs containing plain-text credentials are encrypted using AES-256-CBC using keys derived from the server's environment `JWT_SECRET`.
2. **Granular Role-Based Access Control (RBAC)**: Enforces NestJS RolesGuard across all routes. Low-level `VIEWER` logins are restricted to read-only views, while sensitive actions (downloading clips, exporting incident reports, face enrollment) are locked to `ADMIN` and `SECURITY_OPERATOR` accounts.
3. **Dynamic Username Redaction**: Real-time REST endpoints automatically redact plain-text passwords and credentials (`***:***`) from camera RTSP URLs for `VIEWER` users.
4. **Anti-Path-Traversal Protections**: served camera snapshot controllers restrict paths to strict regular expressions (`/^[a-zA-Z0-9_-]+$/` for camera ID and `/^[a-zA-Z0-9_.-]+$/` for filename), explicitly rejecting relative path indicators (`..`, `/`, `\`) to block illegal directory reading.
5. **Zero-Trust WebSocket Authentication**: Locks the EventsGateway. All incoming AI Engine payloads are verified against the authenticated internal socket list; any unauthorized spoofing attempts are dropped instantly.

---

## 5. Database Schema & Models

Core Prisma schemas run on PostgreSQL. Every table uses auto-generated UUIDs to ensure secure, unique identifiers:

- **`User`**: Manages emails, role state (`ADMIN`, `SECURITY_OPERATOR`, `VIEWER`), and audit trails.
- **`Camera`**: Encrypted RTSP URLs, location metadata, stream status, and system parameters.
- **`Zone`**: Coordinates for per-camera perimeters represented as normalized polygon coordinates.
- **`PrivacyMask`**: Admin-drawn blackout regions sent to the AI Engine to mask sensitive frames before model inference.
- **`Detection`**: Indexed table recording historical targets (persons, vehicles, plate texts).
- **`FaceEmbedding`**: Relates `Person` definitions to 512-dimension ArcFace vectors.
- **`Alert`**: Event state tracks (`PENDING`, `ACKNOWLEDGED`, `RESOLVED`), severity grades, and operator notes.
- **`AuditLog`**: Automatically intercepts and logs all write operations with IP addresses and user IDs.

---

## 6. Docker Deployment Guide

The entire system boots using a single command:

```bash
docker-compose up --build
```

### Standard Environment Checklist (`apps/backend/.env`):
- `DATABASE_URL` — PostgreSQL connection string.
- `JWT_SECRET` — Cryptographically secure token signing key.
- `AI_ENGINE_KEY` — Shared internal handshake token (must match the engine environment).

This script automatically handles schema migrations, triggers admin database seeding, boots the Valkey cache container, mounts local snapshot storage directories, and runs the reverse proxy.

---

## 7. API & Webhook Integrations
- **JSON REST Endpoints**: Developers can manage camera configurations, query detections, and inspect security audit logs using standard JSON APIs.
- **Outbound Webhooks**: Supports POST integrations with external SOARs, PagerDuty, Slack, or MS Teams, sending event payloads and visual snapshot links immediately on alarm triggers.
