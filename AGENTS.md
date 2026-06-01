# Madad Vision AI — Agent Guide

## Project Overview

Madad Vision AI is an AI-powered smart CCTV surveillance platform. It ingests live RTSP camera streams, runs real-time object detection (YOLOv8), face recognition (InsightFace), intrusion detection, traffic analysis, PPE compliance, fall/fight detection, licence plate recognition (LPR), re-identification (ReID), and CLIP-based semantic search. Results are surfaced through a web dashboard in real-time via WebSocket.

The repository is an **npm workspaces monorepo** with three JavaScript/TypeScript applications, one Python service, and one shared package:

| App / Package | Tech Stack | Purpose |
|---|---|---|
| `apps/backend` | NestJS 11 + Prisma 6 + PostgreSQL + Socket.IO | REST API, WebSocket gateway, auth, persistence |
| `apps/web` | Next.js 16.2.5 + React 19 + Tailwind CSS v4 | Web dashboard (marketing pages + auth + full dashboard) |
| `apps/ai-engine` | Python 3.11 + asyncio + YOLOv8 + InsightFace + OpenCV | Real-time multi-camera video processing engine |
| `packages/types` | TypeScript | Shared type definitions consumed by backend and web |

There is **no mobile app** in this repository (the `apps/mobile` workspace no longer exists).

---

## Architecture & Runtime

### Service Topology (Docker Compose)

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   nginx     │────▶│    web      │     │   minio          │
│   (:80)     │     │  (:3000)    │     │ (:9000 / :9001)  │
└─────────────┘     └─────────────┘     └──────────────────┘
       │
       ├──────────▶ backend (:3001) ──▶ postgres (:5432)
       │                    │         ┌▶ valkey  (:6379)
       │                    │         │
       │              ┌─────┘         │
       │              ▼               │
       │         ai-engine (:8000) ───┘
       │
       └──────────▶ /socket.io/  (WebSocket passthrough)
```

- **nginx** — reverse proxy. Routes `/api/` and `/socket.io/` to backend, everything else to web.
- **postgres** — primary database (Prisma schema).
- **valkey** — Redis-compatible cache (Linux Foundation fork); used by NestJS `CacheModule`. Configured with 256 MB max memory, LRU eviction.
- **minio** — S3-compatible object storage for snapshots (declared in compose; wire via `S3_*` env vars when ready).

### Communication Patterns

1. **Web → Backend** — REST (`/api/*`) + Socket.IO (`/socket.io/`). The web client authenticates every Socket.IO connection with its JWT.
2. **AI Engine → Backend** — Socket.IO **client** connects TO the backend gateway. The AI Engine uses a shared secret (`AI_ENGINE_KEY` header) instead of a JWT token because it is a trusted internal service.
3. **Backend → AI Engine** — backend pushes camera lists, zone/polygon updates, face embeddings, and model swap commands to the engine via Socket.IO emissions.
4. **Face Enrollment Flow** — `Dashboard (base64 upload)` → `POST /api/faces/persons/:id/upload-image` → `EventsGateway.extractFaceEmbedding()` → `AI Engine on_extract_face` → `extract_face_result` event → `streamTestBus` Promise resolves → embedding saved to DB.

---

## Technology Stack Details

### Backend (`apps/backend`)

- **Framework:** NestJS 11 (TypeScript 5.9)
- **ORM:** Prisma 6 with PostgreSQL driver (`pg`); connection pool set to 20 via `connection_limit=20` in `DATABASE_URL`
- **Auth:**
  - Local: Passport + JWT (`@nestjs/jwt`, `passport-jwt`); bcrypt password hashing; refresh-token rotation stored as bcrypt hashes in DB
  - OAuth: Google OAuth2 (`passport-google-oauth20`); strategy gracefully degrades if `GOOGLE_CLIENT_ID` is not set
  - Access tokens: 15-minute expiry (`JWT_EXPIRES_IN=15m`)
  - Refresh tokens: 7-day expiry (`JWT_REFRESH_EXPIRY=7d`)
- **Real-time:** `@nestjs/websockets` + `socket.io` (gateway bound to the same HTTP server)
- **Security:**
  - `helmet` with hardened CSP, HSTS (production only), referrer policy, clickjacking prevention
  - `@nestjs/throttler` — 100 req / 60 s per IP, globally applied
  - Global `ValidationPipe` — `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
  - Global `JwtAuthGuard` + `RolesGuard` registered as `APP_GUARD` (every route is protected by default)
  - Global `AuditInterceptor` — automatically logs all POST/PATCH/DELETE mutations to `AuditLog`
  - Global `GlobalExceptionFilter` — registered via `APP_FILTER` for DI-aware exception handling
- **Env validation:** Joi schema in `ConfigModule.forRoot` validates required vars at bootstrap and exits with a descriptive error if any are missing
- **API docs:** Swagger UI at `/api/docs` (dev only, disabled in production)
- **Global prefix:** all REST routes are under `/api`
- **Path alias:** `@madad/types` resolves to `../../packages/types`
- **PDF generation:** `pdf-lib` (used by `EvidenceService` for alert evidence reports)
- **Video recording:** `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg` for FFmpeg-based clip recording
- **Email:** `nodemailer` via `EmailService` (requires SMTP env vars)
- **S3/MinIO:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` for object storage

### Web (`apps/web`)

- **Framework:** Next.js 16.2.5 (App Router), React 19.2.4
- **Styling:** Tailwind CSS v4 (`tailwindcss@^4`) + `tw-animate-css`; uses `lightningcss` for processing
- **UI:** shadcn/ui component pattern (`@base-ui/react`, `class-variance-authority`, `tailwind-merge`, `lucide-react`)
- **State:** Zustand 5 (`useAuthStore` in `src/store/auth-store.ts`) with `persist` middleware (localStorage)
- **Data fetching:** TanStack React Query v5 + Axios — all queries/mutations are defined in `src/hooks/use-api.ts`
- **Charts:** Recharts
- **Animations:** Framer Motion
- **Canvas / Zone drawing:** Konva + react-konva (used on the zones / calibration pages)
- **Real-time:** `socket.io-client` for live detection feeds, alert toasts, and camera status updates
- **Build:** standard server mode (`next start`). **Do not** add `output: 'export'` — it breaks middleware-based auth redirects
- **Proxy:** `src/proxy.ts` — Next.js API route that proxies requests to the backend

### AI Engine (`apps/ai-engine`)

- **Runtime:** Python 3.11
- **Concurrency:** `asyncio` with `loop.run_in_executor` for all CPU-bound inference (keeps the event loop responsive)
- **Entry point:** `uvicorn src.main:app` — the module is **not** a FastAPI app; it uses an asyncio shim to keep uvicorn alive. There are **no HTTP routes** in the AI Engine.
- **Communication:** `python-socketio` `AsyncClient` connecting to the backend gateway

**AI Modules:**

| Module | File | Purpose |
|---|---|---|
| YOLOv8 detector | `detector.py` | Object detection with Frigate-ported per-class NMS |
| Object tracker | `tracker.py` | Centroid-based IoU tracker with track ID persistence |
| Motion detector | `motion.py` | Frigate-ported `ImprovedMotionDetector`; gates YOLO to save CPU |
| Intrusion detector | `intrusion.py` | OpenCV `pointPolygonTest` on normalized polygon zones |
| Face engine | `face_engine.py` | InsightFace RetinaFace + ArcFace for detection and embedding matching |
| Stationary classifier | `stationary_classifier.py` | Flags tracks that stop moving for `STATIONARY_FRAMES` consecutive frames |
| Safety analyzer | `safety_analyzer.py` | Fall detection, fight detection, PPE compliance (keypoint-based) |
| Traffic analyzer | `traffic_analyzer.py` | Congestion detection, speed estimation, wrong-way detection |
| LPR engine | `lpr_engine.py` | Licence plate recognition |
| ReID engine | `reid_engine.py` | Re-identification across cameras |
| CLIP engine | `clip_engine.py` | Semantic text-based video search |
| Forecast engine | `forecast_engine.py` | Crowd/event forecasting |
| Data collector | `data_collector.py` | Saves annotated frames for model re-training |
| Model registry | `model_registry.py` | Maps SOP names to `.pt` file paths; supports hot model swap |
| Stream handler | `stream_handler.py` | OpenCV `VideoCapture` wrapper with reconnect logic |
| Config | `config.py` | All env vars in one `Config` class with sensible defaults |

---

## Code Organization

### Backend Module Map

```
src/
  main.ts                   # bootstrap: helmet, CORS, validation, Swagger, global prefix "api"
  app.module.ts             # root module: all feature modules, global guards/filters/interceptors
  prisma/                   # PrismaService + PrismaModule (global)
  auth/                     # JWT strategy, Google OAuth2 strategy, guards, RolesGuard, login/register/refresh/password-reset
  users/                    # User CRUD
  camera/                   # Camera CRUD + RTSP URL management
  camera-groups/            # Group cameras by location
  zone/                     # Polygon intrusion zones per camera
  privacy-mask/             # Rectangular blackout regions sent to AI Engine before inference
  ai-events/                # Persist detections from AI Engine
  alerts/                   # Alert lifecycle (PENDING → ACKNOWLEDGED → RESOLVED)
  alert-rules/              # User-configurable alert rules with schedules and cooldowns
  faces/                    # Person management + FaceEmbedding storage + upload-image endpoint
  analytics/                # Aggregation queries for dashboards
  streaming/                # HLS/RTSP streaming stubs (FFmpeg spawning)
  recording/                # Event-triggered FFmpeg clip recording with retention purge
  storage/                  # Snapshot file storage service (local or S3/MinIO)
  evidence/                 # PDF evidence report generation via pdf-lib
  email/                    # Nodemailer email service (password reset, invitations)
  notifications/            # In-app notification centre (persisted to DB)
  webhooks/                 # Outbound webhook config for Slack, Teams, PagerDuty, etc.
  escalation/               # Escalation policies for un-acknowledged alerts
  settings/                 # Per-user settings
  audit/                    # AuditLog model + AuditInterceptor (auto-logs mutations)
  events/                   # EventsGateway — Socket.IO hub bridging web clients and AI Engine
  common/filters/           # GlobalExceptionFilter
```

### Web Route Groups

```
src/app/
  (auth)/                   # login, register, forgot-password, reset-password
  (dashboard)/              # all authenticated pages (sidebar + header shell):
    dashboard/              #   overview cards
    cameras/                #   camera management
    camera-groups/          #   group management
    live/                   #   live stream grid
    zones/                  #   polygon zone editor (Konva canvas)
    calibration/            #   camera calibration tools
    alerts/                 #   alert list and lifecycle management
    alert-rules/            #   configurable alert rule builder
    analytics/              #   charts and aggregation views
    events/                 #   detection event log
    faces/                  #   person management and face enrollment
    recordings/             #   recorded clip browser
    safety/                 #   safety event dashboard
    traffic/                #   traffic analysis dashboard
    reid/                   #   re-identification view
    forecast/               #   crowd forecast view
    escalation/             #   escalation policy editor
    webhooks/               #   webhook configuration
    users/                  #   user management (admin only)
    settings/               #   per-user settings
  about/                    # marketing
  contact/                  # marketing
  auth/                     # Google OAuth2 callback redirect handler
  layout.tsx                # root layout (fonts, metadata)
  page.tsx                  # marketing landing page
```

### AI Engine Socket.IO Events

| Direction | Event | Payload | Description |
|---|---|---|---|
| Engine → Backend | `detection` | `{ camera_id, detections[], timestamp }` | Object detections |
| Engine → Backend | `intrusion` | `{ camera_id, zone_id, object_type, confidence }` | Zone intrusion |
| Engine → Backend | `face_event` | `{ camera_id, person_id?, is_known, confidence }` | Face recognition |
| Engine → Backend | `camera_status` | `{ camera_id, status }` | ONLINE/OFFLINE heartbeat |
| Engine → Backend | `extract_face_result` | `{ request_id, embedding[], error? }` | Face embedding response |
| Engine → Backend | `start_recording` | `{ camera_id, trigger }` | Trigger FFmpeg clip |
| Engine → Backend | `safety_event` | `{ camera_id, event_type, track_id }` | Fall/fight/PPE event |
| Backend → Engine | `sync_cameras` | `Camera[]` | Push camera list |
| Backend → Engine | `sync_embeddings` | `FaceEmbedding[]` | Push known face embeddings |
| Backend → Engine | `update_zones` | `{ camera_id, zones[] }` | Push zone polygon update |
| Backend → Engine | `update_privacy_masks` | `{ camera_id, masks[] }` | Push privacy mask update |
| Backend → Engine | `extract_face` | `{ request_id, image_b64 }` | Request face embedding extraction |
| Backend → Engine | `request_model_swap` | `{ sop_name }` | Hot-swap YOLO model |

---

## Build and Development Commands

### Prerequisites

- Node.js 20+ (for backend and web)
- Python 3.11 + pip (for AI Engine)
- PostgreSQL 16 running locally or via Docker
- Populate `apps/backend/.env` and `apps/web/.env.local` (see Environment Variables section)

### Root-level (npm workspaces)

```bash
npm run dev      # runs "dev" in all workspaces that define it
npm run build    # runs "build" in all workspaces
npm run test     # runs "test" in all workspaces
```

### Backend

```bash
cd apps/backend

npm run start:dev          # watch mode (NestJS CLI) — listens on port 3001
npm run build              # NestJS compile → dist/
npm run start:prod         # node dist/main
npm run test               # Jest unit tests (*.spec.ts)
npm run test:e2e           # Jest e2e tests (test/jest-e2e.json)
npm run test:cov           # Jest with coverage
npm run format             # prettier --write
npm run lint               # eslint --fix

# Database
npx prisma migrate dev     # run Prisma migrations in dev
npx prisma generate        # regenerate Prisma Client after schema changes
npx ts-node prisma/seed.ts # seed the initial ADMIN account (idempotent)
```

### Web

```bash
cd apps/web

npm run dev    # next dev — listens on port 3000
npm run build  # next build
npm run start  # next start (production server)
npm run lint   # eslint
```

> **Port conflict:** if another process holds port 3000, Next.js will try 3001 and then fail because NestJS is already there. Kill all node processes first:
> ```powershell
> taskkill /F /IM node.exe /T
> ```
> Then start the backend first, then the web.

### AI Engine

```bash
cd apps/ai-engine

# Create a Python 3.11 virtual environment first
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Run (development, with auto-reload)
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Or via npm scripts in this workspace
npm run dev    # uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
npm run start  # uvicorn src.main:app --host 0.0.0.0 --port 8000
```

### Full Stack (Docker)

```bash
docker-compose up --build
```

Brings up: postgres, valkey, backend (runs `npx prisma generate` in Dockerfile build), ai-engine, web, minio, nginx.

---

## Environment Variables

### `apps/backend/.env`

```env
# Database
DATABASE_URL="postgresql://USER:PASS@localhost:5432/ai-camera?schema=public&connection_limit=20"

# Auth — use cryptographically random 32-byte hex strings in production
JWT_SECRET="<64-char hex>"
JWT_REFRESH_SECRET="<64-char hex>"
JWT_EXPIRES_IN="15m"
JWT_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Server
PORT=3001
CORS_ORIGIN="http://localhost:3000,http://localhost:8081"
NODE_ENV=development

# Cache
CACHE_TTL=30

# AI Engine shared secret (must match AI_ENGINE_KEY in ai-engine)
AI_ENGINE_URL="http://localhost:8000"
AI_ENGINE_KEY="change-this"

# Google OAuth2 (optional — Google auth is disabled if not set)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"

# Email (optional — email features disabled if not set)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="noreply@madadvision.ai"

# Object storage (optional — falls back to local filesystem if not set)
S3_ENDPOINT=
S3_REGION=us-east-1
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=madad-snapshots
```

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

### `apps/ai-engine/.env`

```env
BACKEND_WS_URL=http://localhost:3001
INSIGHTFACE_CTX_ID=-1          # -1 = CPU; 0 = first GPU
MODEL_CONFIDENCE_THRESHOLD=0.55
BASE_MODEL=yolov8n.pt
COLLECT_TRAINING_DATA=false
TRAINING_DATA_DIR=./training_data
MAX_TRAINING_FRAMES=5000
MODELS_DIR=./models
```

---

## Database Schema

Core Prisma models (all use UUID primary keys):

| Model | Key Fields | Notes |
|---|---|---|
| `User` | `email` (unique), `role`, `oauth_provider`, `oauth_id` | Roles: `ADMIN`, `SECURITY_OPERATOR`, `VIEWER` |
| `CameraGroup` | `name`, `location` | Groups cameras by physical location |
| `Camera` | `rtsp_url`, `detect_url`, `record_url`, `status`, `sop_name`, `group_id` | `detect_url` = low-res for AI; `record_url` = high-res for FFmpeg |
| `Zone` | `camera_id`, `polygon_points` (Json), `rule_type` | Normalised 0.0–1.0 polygon coordinates |
| `PrivacyMask` | `camera_id`, `x`, `y`, `width`, `height` | Normalised 0.0–1.0 coordinates; sent to AI Engine before inference |
| `Detection` | `camera_id`, `object_type`, `confidence`, `timestamp` | Indexed on `camera_id`, `timestamp`, `object_type` |
| `Person` | `name`, `tag`, `photo_url`, `alert_enabled`, `alert_message` | |
| `FaceEmbedding` | `person_id`, `embedding_vector` (Float[]) | Stores InsightFace ArcFace 512-dim float vectors |
| `FaceEvent` | `camera_id`, `person_id?`, `confidence`, `timestamp` | `person_id` null for unknown faces |
| `Alert` | `event_id`, `alert_type`, `status`, `severity`, `camera_id` | Status: `PENDING`, `ACKNOWLEDGED`, `RESOLVED` |
| `AlertRule` | `camera_id`, `zone_id`, `object_type`, `alert_type`, `cooldown_sec`, `actions` | User-configurable with schedule support |
| `AlertRuleSchedule` | `rule_id`, `day_of_week`, `start_time`, `end_time` | Active windows for schedule-mode rules |
| `Recording` | `camera_id`, `filepath`, `trigger`, `duration_sec`, `size_bytes` | FFmpeg clip metadata |
| `AuditLog` | `user_id`, `action`, `resource`, `ip_address` | Written by `AuditInterceptor` for all mutations |
| `Notification` | `user_id`, `title`, `message`, `type`, `read` | In-app notification centre |
| `WebhookConfig` | `url`, `events[]`, `secret`, `headers` | Outbound webhook destinations |
| `EscalationPolicy` + `EscalationStep` | `steps[]`, `delay_min`, `channel`, `target` | Sequential escalation for un-acknowledged alerts |
| `RefreshToken` | `token` (bcrypt hash), `user_id`, `expiresAt` | Refresh token rotation |
| `PasswordResetToken` | `email`, `token`, `expiresAt` | Password reset flow |
| `UserSettings` | `user_id`, `ai_enabled`, `confidence_threshold`, notification flags | Per-user preferences |

---

## Code Style Guidelines

### TypeScript / JavaScript

- **Backend Prettier:** `singleQuote: true`, `trailingComma: 'all'`, `endOfLine: auto`
- **Backend ESLint:** `@typescript-eslint/no-explicit-any: off`, `@typescript-eslint/no-floating-promises: warn`, `prettier/prettier`
- **Web ESLint:** `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- **TypeScript strictness:** backend has `strictNullChecks: true` but `noImplicitAny: false` for pragmatic NestJS DI compatibility

### Python

- Python 3.11 syntax throughout
- `pyrightconfig.json` targets Python 3.14 with `basic` type-checking mode (missing imports silenced)
- All CPU-bound work (YOLO inference, OpenCV I/O) **must** be offloaded via `loop.run_in_executor` to keep the asyncio event loop responsive
- Docstrings on public classes and functions
- Module-level `logger = logging.getLogger(__name__)`

---

## Testing

### Backend Unit Tests

```bash
cd apps/backend
npm run test           # Jest — matches *.spec.ts in src/
npm run test:cov       # with coverage report
npm run test:e2e       # e2e tests in test/ directory
```

- Test framework: Jest + `ts-jest`
- Only `app.controller.spec.ts` exists currently; the suite is sparse
- E2E config: `test/jest-e2e.json`; uses Supertest against the full `AppModule`

### AI Engine Tests

```bash
cd apps/ai-engine
pytest tests/
```

- Minimal pytest suite in `tests/test_main.py`

### Web / AI Engine Integration — No automated tests configured

---

## Security Considerations

1. **JWT Secrets** — `JWT_SECRET` and `JWT_REFRESH_SECRET` must be cryptographically random 32+ byte hex strings. The current `apps/backend/.env` already has production-quality values. **Never commit these to git.** Default Joi minimum is 16 chars; use 64-char hex in production.

2. **Refresh Tokens** — stored as bcrypt hashes in the `RefreshToken` table. The raw token is returned to the client only once. On use the token is rotated (old deleted, new issued).

3. **First Admin Account** — run `npx ts-node prisma/seed.ts` once to create `admin@madadvision.ai` / `Admin@12345`. **Change the password immediately after first login.** The seed is idempotent.

4. **CORS** — `CORS_ORIGIN` in `.env` must list exact origins in production (comma-separated). When set to `*` (dev), the backend reflects the request origin so credentials still work with browsers.

5. **Rate Limiting** — 100 req / 60 s per IP globally. Auth endpoints may need stricter per-route limits for production hardening.

6. **Helmet** — all security headers applied globally. CSP, HSTS (prod only), referrer policy, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-Powered-By` removed.

7. **AI Engine Authentication** — the AI Engine connects without a JWT but with a shared `x-ai-engine-key` header that must match `AI_ENGINE_KEY` in the backend `.env`. Keep this secret out of version control.

8. **WebSocket Auth** — all non-AI-Engine socket connections require a valid JWT on handshake. The gateway disconnects unknown clients.

9. **Google OAuth2** — the `GoogleStrategy` uses `'DISABLED'` as a sentinel client ID when env vars are not set, preventing a crash while keeping the route registered. The controller guards handle the rest.

10. **Audit Logging** — every POST/PATCH/DELETE mutation is automatically written to `AuditLog` with user ID, IP address, resource, and action via `AuditInterceptor`.

11. **Privacy Masks** — rectangular regions can be configured per camera. The AI Engine blacks out these regions before running inference, preventing the AI from detecting people or faces in e.g. a neighbour's window.

---

## Adding New Features

### Adding a new backend module

1. `nest generate module <name>` inside `apps/backend/src/`
2. Register the module in `app.module.ts`
3. Routes are automatically prefixed with `/api` (set globally in `main.ts`)
4. Decorate controller methods with `@Roles(Role.ADMIN)` (or another role) to restrict access; `@Public()` to bypass JWT

### Adding a new WebSocket event

- **Engine → Backend:** add a `@SubscribeMessage('event_name')` handler in `events/events.gateway.ts`
- **Backend → Engine:** call `this.server.emit('event_name', payload)` from the gateway; handle it with `@sio.on('event_name')` in `apps/ai-engine/src/main.py`

### Adding a new AI Engine module

1. Create a Python file in `apps/ai-engine/src/`
2. Import and instantiate the module in `main.py` (at module level, shared across all cameras)
3. Call `loop.run_in_executor(None, module.analyze, frame)` inside the per-camera `process_camera` coroutine
4. Emit results to the backend via `sio.emit(...)` with a new event name
5. Do **not** add HTTP routes or FastAPI routers — all communication is Socket.IO only

### Shared types

The `packages/types` package is consumed via `file:` protocol. After editing `packages/types/src/index.ts`, run `npm install` from the repo root to propagate the change to dependent workspaces.

---

## Known Limitations / Remaining Work

- **SMTP not configured** — email flows (password reset, admin invitations) are disabled until `SMTP_*` vars are filled in `.env`
- **SSL/HTTPS** — production deployment requires SSL certificates configured in the nginx `docker/nginx/nginx.conf`
- **MinIO not wired in code** — storage falls back to local filesystem (`STORAGE_PATH`). Wire `S3_*` env vars and update `StorageModule` to use S3 for production
- **Recording purge** — `RecordingService.purgeOldClips()` is implemented but not yet scheduled via a NestJS cron job
- **PPE accuracy** — the heuristic PPE detector (`safety_analyzer.py`) achieves ~70% accuracy. Train a custom YOLOv8 model on a PPE dataset for production accuracy
- **Web / Mobile test coverage** — no automated tests for the web app
- **No mobile app** — the `apps/mobile` workspace mentioned in older documentation does not exist in this repository
