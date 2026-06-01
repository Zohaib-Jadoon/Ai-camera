# Madad Vision AI — Consumer Readiness Checklist

> What separates a working prototype from a product customers will pay for and trust.

---

## How to Use This Checklist

- **🔴 Blocker** — Cannot ship without this. Customer will churn or refuse to buy.
- **🟡 Critical** — Major friction without this. Expect support tickets and bad reviews.
- **🟢 Important** — Expected by enterprise customers. Needed for upsells.
- **⚪ Nice-to-Have** — Differentiator. Can ship without but adds polish.

---

## 1. Core Functionality — "Does It Actually Work?"

### 1.1 No Mocked Features

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 1.1.1 | **Settings page persistence** | ❌ Mocked | 🔴 Blocker | 8h | Every toggle is `defaultChecked` with no state. Save button has no `onClick`. |
| 1.1.2 | **Password reset flow** | ❌ Mocked | 🔴 Blocker | 8h | Frontend form uses `setTimeout(1500)`. No SMTP backend endpoint. |
| 1.1.3 | **Contact form** | ❌ Mocked | 🟡 Critical | 2h | `setTimeout` + `alert()`. Needs SMTP or webhook. |
| 1.1.4 | **AI Engine Status bar** | ❌ Hardcoded | 🟡 Critical | 4h | Dashboard shows static "YOLOv8 98%, Face 94%". Needs real metrics endpoint. |
| 1.1.5 | **Add User button** | ❌ Non-functional | 🟡 Critical | 6h | Settings > Users tab has a dead button. No modal or API. |
| 1.1.6 | **Header search** | ❌ Decorative | 🟡 Critical | 12h | Search input exists but has no implementation. |
| 1.1.7 | **Live view controls** | ❌ Decorative | 🟢 Important | 4h | Maximize, Zoom, Rotate, Volume buttons have no `onClick`. |
| 1.1.8 | **Camera card thumbnails** | ❌ CSS placeholder | 🟡 Critical | 6h | Shows `scan-line` animation instead of actual snapshot. |

### 1.2 Complete Stubbed Systems

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 1.2.1 | **Video recording (FFmpeg)** | ❌ Commented out | 🔴 Blocker | 16h | `RecordingService.startClip()` is entirely commented. No clips recorded. |
| 1.2.2 | **HLS streaming serving** | ❌ No HTTP route | 🔴 Blocker | 12h | FFmpeg writes `.m3u8` to `/tmp/hls/` but nothing serves it. |
| 1.2.3 | **Alert severity assignment** | ❌ Defaults to MEDIUM | 🔴 Blocker | 4h | `AlertSeverity` enum exists but `create()` never sets it. |
| 1.2.4 | **Alert assignee system** | ❌ Schema only | 🔴 Blocker | 6h | `assignee_id` field exists but no API or UI. |
| 1.2.5 | **Analytics cache invalidation** | ❌ Never called | 🟡 Critical | 2h | `invalidateCache()` exists but never triggered on new data. |
| 1.2.6 | **SOP rule engine** | ❌ Model swap only | 🟢 Important | 16h | `sop_name` accepted but only swaps `.pt` file — no logic like "hardhat required". |
| 1.2.7 | **MinIO/S3 integration** | ❌ Docker only | 🟡 Critical | 8h | MinIO runs in Docker but `StorageService` writes local disk. |
| 1.2.8 | **Email/SMTP service** | ❌ Missing | 🔴 Blocker | 8h | No password reset, no alert emails, no notifications. |

### 1.3 Fix Critical Bugs

| # | Bug | Severity | Effort | Notes |
|---|-----|----------|--------|-------|
| 1.3.1 | **Live stream bbox not drawn** | 🔴 Blocker | 2h | Frame encoder looks for `"bbox"`, tracker outputs `"box"` / `"smooth_box"`. |
| 1.3.2 | **Face similarity threshold hardcoded** | 🔴 Blocker | 1h | Config says 0.6, code uses 0.45. Config value ignored. |
| 1.3.3 | **GPU disabled by default** | 🔴 Blocker | 2h | InsightFace defaults to CPU (`ctx_id=-1`). Auto-detect CUDA. |
| 1.3.4 | **CameraManager unused** | 🟡 Critical | 4h | Well-designed class exists but `main.py` uses raw dicts. |
| 1.3.5 | **Dead code cleanup** | 🟢 Important | 1h | `advanced_ai.py`, `motion_detector.py` not imported anywhere. |

**Phase 1 Total Effort: ~98 hours (~4 weeks realistic)**

---

## 2. Security — "Will Customer Data Be Safe?"

### 2.1 Authentication & Access Control

| # | Issue | Severity | Effort | Notes |
|---|-------|----------|--------|-------|
| 2.1.1 | **AI Engine Socket.IO unauthenticated** | 🔴 Blocker | 4h | Any tokenless connection = trusted AI Engine. Inject fake detections. |
| 2.1.2 | **PrivacyMaskController lacks `@Roles()`** | 🔴 Blocker | 1h | VIEWER can create/delete privacy masks. |
| 2.1.3 | **RecordingController lacks `@Roles()`** | 🔴 Blocker | 1h | VIEWER can trigger recording purges. |
| 2.1.4 | **RTSP URLs exposed to all roles** | 🔴 Blocker | 2h | VIEWER can read camera credentials. Should exclude `rtsp_url` from response. |
| 2.1.5 | **Snapshot path traversal** | 🔴 Blocker | 2h | `filename` parameter not sanitized. `../../../etc/passwd` possible. |
| 2.1.6 | **JWT refresh token decode without verify** | 🟡 Critical | 2h | `jwtService.decode()` on refresh token enables user ID enumeration. |
| 2.1.7 | **No rate limiting on Socket.IO events** | 🟡 Critical | 4h | Client can flood `detection` events. Add per-connection throttling. |
| 2.1.8 | **No API versioning** | 🟢 Important | 4h | `/api/v1/` prefix needed before public customers depend on endpoints. |

### 2.2 Data Protection

| # | Issue | Severity | Effort | Notes |
|---|-------|----------|--------|-------|
| 2.2.1 | **RTSP credentials stored plaintext** | 🔴 Blocker | 4h | `rtsp_url` in DB contains username/password. Encrypt with AES-256. |
| 2.2.2 | **No audit logging** | 🟡 Critical | 6h | Who deleted a camera? Who dismissed an alert? No traceability. |
| 2.2.3 | **No data retention policies** | 🟡 Critical | 4h | How long are detections/snapshots kept? GDPR requires defined retention. |
| 2.2.4 | **No encryption at rest for snapshots** | 🟢 Important | 4h | MinIO supports SSE-S3. Enable server-side encryption. |
| 2.2.5 | **No HTTPS in dev / default deploy** | 🟡 Critical | 2h | `upgradeInsecureRequests` is null in dev. Production needs TLS cert. |

### 2.3 Compliance Basics

| # | Requirement | Severity | Effort | Notes |
|---|-------------|----------|--------|-------|
| 2.3.1 | **Privacy policy** | 🔴 Blocker | 4h | Required for any customer-facing SaaS. |
| 2.3.2 | **Terms of service** | 🔴 Blocker | 4h | Required for paid subscriptions. |
| 2.3.3 | **GDPR/CCPA data export** | 🟡 Critical | 8h | User can request all their data. |
| 2.3.4 | **GDPR right to deletion** | 🟡 Critical | 4h | User can request account + data deletion. |
| 2.3.5 | **Cookie consent banner** | 🟢 Important | 2h | Required in EU. |

**Phase 2 Total Effort: ~58 hours (~2.5 weeks realistic)**

---

## 3. Reliability — "Will It Stay Up?"

### 3.1 System Health & Monitoring

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 3.1.1 | **Camera health monitoring** | ❌ Missing | 🔴 Blocker | 8h | Detect black frames, frozen images, offline cameras. Alert operators. |
| 3.1.2 | **Camera tampering detection** | ❌ Missing | 🟡 Critical | 8h | Detect lens cover, sudden angle change, spray paint. |
| 3.1.3 | **AI Engine health check** | ❌ Missing | 🔴 Blocker | 4h | Backend should know if AI Engine is alive. Heartbeat timeout. |
| 3.1.4 | **Database connection resilience** | ⚠️ Partial | 🟡 Critical | 4h | Prisma reconnects on `onModuleInit` but no retry logic for transient failures. |
| 3.1.5 | **Graceful shutdown** | ⚠️ Partial | 🟡 Critical | 4h | `app.enableShutdownHooks()` exists but FFmpeg processes aren't killed on SIGTERM. |
| 3.1.6 | **Disk space monitoring** | ❌ Missing | 🟡 Critical | 4h | Snapshots fill disk. Alert before 90% full. Auto-purge old data. |

### 3.2 Error Handling & Recovery

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 3.2.1 | **WebSocket error handling** | ❌ Missing | 🔴 Blocker | 4h | Unhandled exceptions in `EventsGateway` crash the process or silently fail. |
| 3.2.2 | **RTSP reconnection with backoff** | ✅ Exists | — | — | Already implemented with exponential backoff. Good. |
| 3.2.3 | **AI Engine auto-restart** | ❌ Missing | 🟡 Critical | 2h | Docker `restart: unless-stopped` helps but no health-based restart. |
| 3.2.4 | **Database backup strategy** | ❌ Missing | 🔴 Blocker | 4h | Automated daily backups to S3/MinIO. Document restore procedure. |
| 3.2.5 | **Snapshot backup / replication** | ❌ Missing | 🟡 Critical | 4h | Snapshots are local volume. Backup to MinIO or remote storage. |

### 3.3 Testing

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 3.3.1 | **Backend unit tests** | ⚠️ Minimal | 🔴 Blocker | 16h | Only `app.controller.spec.ts` exists. Test auth, services, guards. |
| 3.3.2 | **AI Engine unit tests** | ❌ Missing | 🔴 Blocker | 12h | No tests for detector, tracker, face engine. Mock camera streams. |
| 3.3.3 | **Integration tests (AI ↔ Backend)** | ❌ Missing | 🔴 Blocker | 12h | Socket.IO contract changes break silently. Test event flow end-to-end. |
| 3.3.4 | **Frontend E2E tests** | ❌ Missing | 🟡 Critical | 16h | Playwright or Cypress. Test login → dashboard → camera CRUD → alert. |
| 3.3.5 | **Load testing** | ❌ Missing | 🟢 Important | 8h | How many cameras can one AI Engine handle? Document limits. |

**Phase 3 Total Effort: ~106 hours (~4.5 weeks realistic)**

---

## 4. User Experience — "Can a Non-Technical User Operate This?"

### 4.1 Onboarding

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 4.1.1 | **First-run setup wizard** | ❌ Missing | 🔴 Blocker | 12h | Create admin account, configure first camera, test connection. |
| 4.1.2 | **Demo mode / sample data** | ❌ Missing | 🟡 Critical | 8h | Let prospects try without configuring cameras. |
| 4.1.3 | **Camera auto-discovery** | ❌ Missing | 🟢 Important | 12h | Scan local network for ONVIF cameras. |
| 4.1.4 | **RTSP URL helper** | ❌ Missing | 🟡 Critical | 4h | Common camera brand presets (Hikvision, Dahua, Axis). |
| 4.1.5 | **Tooltips / onboarding tour** | ❌ Missing | 🟢 Important | 8h | First-time user guidance through dashboard. |

### 4.2 Daily Workflow Friction

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 4.2.1 | **Alert detail view** | ❌ Missing | 🔴 Blocker | 6h | Eye icons in tables are non-interactive. Need modal with snapshot + video. |
| 4.2.2 | **Detection detail view** | ❌ Missing | 🔴 Blocker | 6h | Same issue — no drill-down from event list. |
| 4.2.3 | **Bulk alert actions** | ❌ Missing | 🟡 Critical | 4h | Select 10 alerts → resolve all. |
| 4.2.4 | **Alert filters (date range, camera, type)** | ⚠️ Partial | 🟡 Critical | 4h | Status filter exists but no date range or camera filter. |
| 4.2.5 | **Export alerts / events** | ❌ Missing | 🟡 Critical | 6h | CSV or PDF export for incident reports. |
| 4.2.6 | **Keyboard shortcuts** | ❌ Missing | ⚪ Nice | 4h | `ESC` to close modal, `J/K` to navigate alerts. |
| 4.2.7 | **Dark/light mode toggle** | ❌ Missing | ⚪ Nice | 4h | Currently forced dark mode. |

### 4.3 Mobile Experience

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 4.3.1 | **Mobile app exists** | ❌ Missing | 🔴 Blocker | 24h | `apps/mobile/` referenced in docs but doesn't exist in branch. |
| 4.3.2 | **Mobile live view** | ❌ Missing | 🔴 Blocker | 12h | Security guards need mobile access. |
| 4.3.3 | **Push notifications** | ❌ Missing | 🔴 Blocker | 12h | Critical alerts must reach operators off-desk. |
| 4.3.4 | **Mobile-responsive dashboard** | ⚠️ Partial | 🟡 Critical | — | Sidebar/mobile menu exists but live events hidden below `xl`. |
| 4.3.5 | **SMS alerts** | ❌ Missing | 🟢 Important | 8h | Twilio integration for critical alerts. |

**Phase 4 Total Effort: ~130 hours (~5.5 weeks realistic)**

---

## 5. Deployment & Operations — "Can I Install This Without a PhD?"

### 5.1 Deployment

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 5.1.1 | **One-command production deploy** | ⚠️ Partial | 🔴 Blocker | 8h | `docker-compose up` works but needs TLS, env config, migration run. |
| 5.1.2 | **TLS/SSL certificates** | ❌ Missing | 🔴 Blocker | 4h | Let's Encrypt auto-renewal via nginx or Traefik. |
| 5.1.3 | **Reverse proxy for AI Engine** | ❌ Missing | 🟡 Critical | 4h | AI Engine exposed on port 8000. Should go through nginx. |
| 5.1.4 | **Automated database migrations** | ⚠️ Partial | 🔴 Blocker | 4h | `prisma migrate deploy` exists but not automated in startup. |
| 5.1.5 | **Seed data for fresh installs** | ❌ Missing | 🟡 Critical | 4h | Admin user, sample camera, demo zones. |
| 5.1.6 | **Environment validation** | ⚠️ Partial | 🟡 Critical | 4h | Joi validation exits early but doesn't check connectivity (DB, MinIO). |
| 5.1.7 | **Update mechanism** | ❌ Missing | 🟢 Important | 8h | How does a customer update to v1.1? Documented procedure needed. |

### 5.2 Observability

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 5.2.1 | **Structured logging** | ⚠️ Partial | 🟡 Critical | 4h | NestJS Logger used but no JSON format for log aggregation. |
| 5.2.2 | **Application metrics** | ❌ Missing | 🟡 Critical | 8h | Prometheus metrics: detection rate, alert rate, camera uptime, inference latency. |
| 5.2.3 | **Log aggregation** | ❌ Missing | 🟢 Important | 4h | Centralized logs (Loki, ELK, or CloudWatch). |
| 5.2.4 | **Uptime monitoring** | ❌ Missing | 🟡 Critical | 2h | Health check endpoint + external ping (UptimeRobot, Pingdom). |
| 5.2.5 | **Error tracking** | ❌ Missing | 🟡 Critical | 4h | Sentry integration for frontend + backend crash reports. |

### 5.3 Documentation

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 5.3.1 | **Installation guide** | ⚠️ Partial | 🔴 Blocker | 4h | Docker Compose exists but no step-by-step for non-technical users. |
| 5.3.2 | **API documentation** | ✅ Exists | — | — | Swagger at `/api/docs`. Good. |
| 5.3.3 | **User manual** | ❌ Missing | 🟡 Critical | 8h | How to add a camera, draw zones, manage alerts. |
| 5.3.4 | **Troubleshooting guide** | ❌ Missing | 🟡 Critical | 4h | "Camera shows offline" — what to check? |
| 5.3.5 | **Changelog** | ❌ Missing | 🟢 Important | 2h | What's new in v1.1? |

**Phase 5 Total Effort: ~74 hours (~3 weeks realistic)**

---

## 6. Business-Ready Features — "Can I Charge Money For This?"

### 6.1 Multi-Tenancy & Organizations

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 6.1.1 | **Organization/tenant model** | ❌ Missing | 🟢 Important | 16h | Each customer sees only their cameras, users, alerts. |
| 6.1.2 | **User invitation system** | ❌ Missing | 🟡 Critical | 8h | Admin invites security operators via email. |
| 6.1.3 | **Role permissions matrix** | ⚠️ Partial | 🟡 Critical | 4h | Roles exist but no granular permissions (e.g., "can view live but not settings"). |

### 6.2 Billing & Licensing (For SaaS)

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 6.2.1 | **Camera-based pricing tiers** | ❌ Missing | 🟢 Important | 12h | "Starter: 5 cameras", "Pro: 25 cameras", "Enterprise: unlimited". |
| 6.2.2 | **Usage analytics** | ❌ Missing | 🟢 Important | 8h | How many detections this month? API call volume. |
| 6.2.3 | **License key validation** | ❌ Missing | 🟢 Important | 8h | For on-premise deployments. Offline license validation. |

### 6.3 White-Label & Customization

| # | Feature | Status | Severity | Effort | Notes |
|---|---------|--------|----------|--------|-------|
| 6.3.1 | **Custom branding** | ❌ Missing | 🟢 Important | 8h | Logo, colors, company name in emails. |
| 6.3.2 | **Custom alert rules** | ❌ Missing | 🟡 Critical | 12h | Customer defines: "Alert me if person in zone A after 10 PM". |
| 6.3.3 | **Alert schedules** | ❌ Missing | 🟡 Critical | 6h | Zone intrusion only active during business hours. |
| 6.3.4 | **Alert cooldown / deduplication** | ❌ Missing | 🟡 Critical | 4h | Same person in zone = 1 alert, not 50/sec. |
| 6.3.5 | **Alert escalation** | ❌ Missing | 🟢 Important | 8h | Unacknowledged alert → email manager after 5 min → SMS after 15 min. |

**Phase 6 Total Effort: ~82 hours (~3.5 weeks realistic)**

---

## 7. Summary — Minimum Viable Consumer Release

### What MUST Be Done Before First Paying Customer

**Estimated effort: ~340 hours (~3 months for 1 developer, ~6 weeks for 2)**

#### From Section 1 (Core Functionality)
- [ ] Settings page persistence (8h)
- [ ] Password reset with SMTP (8h)
- [ ] Alert severity assignment (4h)
- [ ] Alert assignee API + UI (6h)
- [ ] Fix bbox drawing bug (2h)
- [ ] Fix face threshold config (1h)
- [ ] Enable GPU auto-detection (2h)
- [ ] MinIO/S3 integration (8h)
- [ ] Email/SMTP service (8h)
- [ ] Video recording (FFmpeg) (16h)
- [ ] HLS streaming endpoint (12h)

#### From Section 2 (Security)
- [ ] Secure AI Engine Socket.IO (4h)
- [ ] Fix RBAC gaps (2h)
- [ ] Fix snapshot path traversal (2h)
- [ ] Encrypt RTSP credentials (4h)
- [ ] Audit logging (6h)
- [ ] Privacy policy (4h)
- [ ] Terms of service (4h)

#### From Section 3 (Reliability)
- [ ] Camera health monitoring (8h)
- [ ] AI Engine health check (4h)
- [ ] Database backup strategy (4h)
- [ ] Backend unit tests (16h)
- [ ] AI Engine unit tests (12h)
- [ ] Integration tests (12h)

#### From Section 4 (UX)
- [ ] First-run setup wizard (12h)
- [ ] Alert detail view (6h)
- [ ] Detection detail view (6h)
- [ ] Mobile app scaffold (24h)
- [ ] Mobile live view (12h)
- [ ] Push notifications (12h)
- [ ] Export alerts/events (6h)

#### From Section 5 (Deployment)
- [ ] TLS/SSL certificates (4h)
- [ ] One-command deploy script (8h)
- [ ] Automated migrations (4h)
- [ ] Seed data (4h)
- [ ] Installation guide (4h)
- [ ] User manual (8h)
- [ ] Error tracking (Sentry) (4h)
- [ ] Health check + uptime monitoring (2h)

#### From Section 6 (Business)
- [ ] Alert cooldown / deduplication (4h)
- [ ] Custom alert rules (12h)
- [ ] Alert schedules (6h)
- [ ] User invitation system (8h)

---

## 8. Recommended Execution Order

### Sprint 1–2: Security + Stability (Weeks 1–2)
Secure the platform so you can safely give demo access to prospects.

1. Fix AI Engine authentication
2. Fix RBAC gaps
3. Fix snapshot path traversal
4. Encrypt RTSP credentials
5. Add audit logging
6. Add camera health monitoring
7. Fix bbox drawing bug
8. Fix face threshold config

### Sprint 3–4: Core Completion (Weeks 3–4)
Finish every mocked feature. No more stubs.

1. Settings page persistence
2. Password reset with SMTP
3. Alert severity + assignee
4. Email service
5. MinIO/S3 integration
6. Video recording (FFmpeg)
7. HLS streaming
8. GPU auto-detection

### Sprint 5–6: Quality (Weeks 5–6)
Add tests and monitoring so you sleep at night.

1. Backend unit tests
2. AI Engine tests
3. Integration tests
4. Database backups
5. Error tracking (Sentry)
6. Health checks + uptime monitoring
7. Structured logging

### Sprint 7–8: Mobile + Polish (Weeks 7–8)
Make it usable on-the-go and smooth out friction.

1. Scaffold mobile app
2. Mobile live view
3. Push notifications
4. Alert detail view
5. Detection detail view
6. First-run setup wizard
7. Export alerts/events

### Sprint 9–10: Business-Ready (Weeks 9–10)
Add the features that let you charge money.

1. Alert cooldown / deduplication
2. Custom alert rules
3. Alert schedules
4. User invitation system
5. Privacy policy + Terms
6. Installation guide + User manual
7. TLS + One-command deploy

---

## 9. The "Can We Ship Tomorrow?" Test

Ask yourself these questions. If any answer is "no," you're not consumer-ready.

| Question | Your Answer |
|----------|-------------|
| Can a non-technical user install this in under 30 minutes? | ❌ No install guide, no seed data, no setup wizard |
| Can they add a camera without knowing what RTSP means? | ❌ No auto-discovery, no URL helper |
| Will they get an alert if someone breaks in at 3 AM? | ✅ Yes, but no SMS/push — only web |
| Can they watch the recording of that break-in? | ❌ Recording is commented out |
| Can they prove to insurance what happened? | ❌ No export, no case management |
| Will the system tell them if a camera goes offline? | ❌ No health monitoring |
| Can a security guard check alerts from their phone? | ❌ No mobile app |
| Is their camera password safe in the database? | ❌ Stored plaintext |
| Can they invite their team without editing the database? | ❌ No invitation system |
| Will they get 50 alerts for the same person in a zone? | ❌ No cooldown/deduplication |

**Score: 1/10** — Solid prototype, not yet a consumer product.

---

*Last updated: 2026-05-08*
