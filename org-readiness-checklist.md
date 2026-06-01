# Madad Vision AI — Organizational / B2B Readiness Checklist

> Target: Enterprises, traffic management authorities, security operations centers, manufacturing plants, retail chains, smart cities. Web-first. No mobile required.

---

## Target Personas

| Persona | Needs | Deal-Breakers |
|---------|-------|---------------|
| **SOC Manager** | Dashboard overview, alert escalation, audit reports, user management | No audit trail, no RBAC, no reporting |
| **Security Operator** | Live view, alert acknowledgment, event investigation, video export | Alerts don't work, no video clips, clunky UX |
| **Traffic Engineer** | Vehicle counts, speed data, congestion alerts, LPR, API access | Inaccurate data, no API, no historical trends |
| **IT Administrator** | Easy deploy, camera bulk import, health monitoring, backups, updates | Complex install, no health checks, manual DB ops |
| **C-Suite / Procurement** | ROI data, compliance, data security, vendor lock-in avoidance | No security audit, no export, proprietary formats |

---

## 1. Foundation — "Does the Core Product Work?"

### 1.1 No Mocked Features (Blockers for Demos)

| # | Feature | Status | Severity | Effort |
|---|---------|--------|----------|--------|
| 1.1 | **Settings persistence** | ❌ Mocked | 🔴 Blocker | 8h |
| 1.2 | **Password reset (SMTP)** | ❌ Mocked | 🔴 Blocker | 8h |
| 1.3 | **Alert severity assignment** | ❌ Defaults MEDIUM | 🔴 Blocker | 4h |
| 1.4 | **Alert assignee + handoff** | ❌ Schema only | 🔴 Blocker | 6h |
| 1.5 | **Analytics cache invalidation** | ❌ Never called | 🟡 Critical | 2h |
| 1.6 | **AI Engine Status metrics** | ❌ Hardcoded | 🟡 Critical | 4h |
| 1.7 | **Camera card snapshots** | ❌ CSS placeholder | 🟡 Critical | 6h |

### 1.2 Complete Stubbed Systems

| # | Feature | Status | Severity | Effort |
|---|---------|--------|----------|--------|
| 1.8 | **Video recording (FFmpeg)** | ❌ Commented out | 🔴 Blocker | 16h |
| 1.9 | **HLS streaming serving** | ❌ No HTTP route | 🔴 Blocker | 12h |
| 1.10 | **MinIO/S3 integration** | ❌ Docker only | 🟡 Critical | 8h |
| 1.11 | **Email/SMTP service** | ❌ Missing | 🔴 Blocker | 8h |
| 1.12 | **SOP rule engine** | ❌ Model swap only | 🟢 Important | 16h |

### 1.3 Fix Critical Bugs

| # | Bug | Severity | Effort |
|---|-----|----------|--------|
| 1.13 | **Live stream bbox not drawn** | 🟡 Critical | 2h |
| 1.14 | **Face similarity threshold hardcoded** | 🟡 Critical | 1h |
| 1.15 | **GPU auto-detection** | 🟡 Critical | 2h |
| 1.16 | **Use CameraManager (cleanup)** | 🟢 Important | 4h |

**Foundation Total: ~87 hours (~3.5 weeks)**

---

## 2. Security — "Will Our InfoSec Team Approve This?"

For B2B, InfoSec approval is often a **hard gate** before purchase.

### 2.1 Authentication & Access Control

| # | Issue | Severity | Effort | Why It Matters |
|---|-------|----------|--------|----------------|
| 2.1 | **AI Engine Socket.IO unauthenticated** | 🔴 Blocker | 4h | Any network access = fake alerts injected. SOC can't trust data. |
| 2.2 | **PrivacyMaskController lacks `@Roles()`** | 🔴 Blocker | 1h | VIEWER can modify privacy zones. Compliance violation. |
| 2.3 | **RecordingController lacks `@Roles()`** | 🔴 Blocker | 1h | VIEWER can purge evidence recordings. Legal risk. |
| 2.4 | **RTSP URLs exposed to all roles** | 🔴 Blocker | 2h | Camera credentials leaked to every user. InfoSec will reject. |
| 2.5 | **Snapshot path traversal** | 🔴 Blocker | 2h | `../../../etc/passwd` style attacks possible. |
| 2.6 | **JWT refresh token decode without verify** | 🟡 Critical | 2h | User enumeration + potential token confusion. |
| 2.7 | **No rate limiting on Socket.IO events** | 🟡 Critical | 4h | Event flooding = DoS on alert pipeline. |

### 2.2 Data Protection

| # | Issue | Severity | Effort | Why It Matters |
|---|-------|----------|--------|----------------|
| 2.8 | **RTSP credentials stored plaintext** | 🔴 Blocker | 4h | InfoSec audit will flag immediately. Encrypt at rest. |
| 2.9 | **No audit logging** | 🔴 Blocker | 6h | SOC 2 / ISO 27001 require audit trails. Who dismissed an alert? |
| 2.10 | **No data retention policies** | 🟡 Critical | 4h | GDPR / organizational policies require defined retention + auto-purge. |
| 2.11 | **No encryption at rest for snapshots** | 🟡 Critical | 4h | Evidence stored unencrypted. Chain of custody risk. |
| 2.12 | **No HTTPS by default** | 🔴 Blocker | 4h | Credentials and video frames over plaintext. Unacceptable for enterprise. |

### 2.3 Compliance & Certifications (Future)

| # | Requirement | Severity | Effort | Timeline |
|---|-------------|----------|--------|----------|
| 2.13 | **SOC 2 Type II readiness** | 🟢 Important | 40h | Year 2+ |
| 2.14 | **ISO 27001 documentation** | 🟢 Important | 80h | Year 2+ |
| 2.15 | **GDPR data processing agreement** | 🟡 Critical | 8h | Before EU customers |
| 2.16 | **Penetration test report** | 🟡 Critical | $5-15k | Before first enterprise deal |

**Security Total: ~48 hours (~2 weeks)**

---

## 3. Operations at Scale — "Can It Handle 50+ Cameras?"

Organizations don't have 3 cameras. They have 30, 100, or 1,000.

### 3.1 Camera Management

| # | Feature | Status | Severity | Effort | Why It Matters |
|---|---------|--------|----------|--------|----------------|
| 3.1 | **Camera bulk import (CSV)** | ❌ Missing | 🟡 Critical | 6h | Adding 50 cameras one-by-one is impossible. |
| 3.2 | **Camera groups / sites** | ❌ Missing | 🟡 Critical | 8h | "Warehouse A", "Parking Lot B", "HQ Floor 3". |
| 3.3 | **Camera health monitoring** | ❌ Missing | 🔴 Blocker | 8h | Which of my 80 cameras are down? |
| 3.4 | **Camera tampering detection** | ❌ Missing | 🟡 Critical | 8h | Lens covered, angle changed, spray paint. |
| 3.5 | **Camera firmware / config tracking** | ❌ Missing | 🟢 Important | 8h | Track camera model, firmware version, last config change. |
| 3.6 | **Camera maintenance schedule** | ❌ Missing | 🟢 Important | 6h | Reminders for lens cleaning, firmware updates. |

### 3.2 System Health & Monitoring

| # | Feature | Status | Severity | Effort |
|---|---------|--------|----------|--------|
| 3.7 | **AI Engine health heartbeat** | ❌ Missing | 🔴 Blocker | 4h |
| 3.8 | **Disk space monitoring + alert** | ❌ Missing | 🟡 Critical | 4h |
| 3.9 | **CPU/GPU utilization metrics** | ❌ Missing | 🟡 Critical | 4h |
| 3.10 | **Inference latency tracking** | ❌ Missing | 🟡 Critical | 4h |
| 3.11 | **Prometheus metrics endpoint** | ❌ Missing | 🟡 Critical | 8h |
| 3.12 | **Grafana dashboard** | ❌ Missing | 🟢 Important | 4h |
| 3.13 | **Structured JSON logging** | ⚠️ Partial | 🟡 Critical | 4h |
| 3.14 | **Log aggregation (Loki/ELK)** | ❌ Missing | 🟢 Important | 4h |
| 3.15 | **Error tracking (Sentry)** | ❌ Missing | 🟡 Critical | 4h |
| 3.16 | **Database backup automation** | ❌ Missing | 🔴 Blocker | 4h |
| 3.17 | **Snapshot backup to S3/MinIO** | ❌ Missing | 🟡 Critical | 4h |

### 3.3 Performance & Scale

| # | Feature | Status | Severity | Effort |
|---|---------|--------|----------|--------|
| 3.18 | **Camera capacity documentation** | ❌ Missing | 🟡 Critical | 2h |
| 3.19 | **Horizontal scaling design** | ❌ Missing | 🟢 Important | 16h | Multiple AI Engine instances behind load balancer |
| 3.20 | **Database connection pooling tuning** | ⚠️ Default | 🟢 Important | 2h |
| 3.21 | **Redis/Valkey for session + cache** | ✅ Exists | — | — | Already using. Good. |

**Operations Total: ~96 hours (~4 weeks)**

---

## 4. Alerting & Response — "Will the Right Person Know at the Right Time?"

This is the **core value proposition** for organizations.

### 4.1 Alert Intelligence

| # | Feature | Status | Severity | Effort | Why It Matters |
|---|---------|--------|----------|--------|----------------|
| 4.1 | **Alert cooldown / deduplication** | ❌ Missing | 🔴 Blocker | 4h | Same person in zone = 1 alert, not 50/sec. SOC operators quit otherwise. |
| 4.2 | **Custom alert rules** | ❌ Missing | 🔴 Blocker | 12h | "Alert if person in Zone A AND after 10 PM AND object type = truck" |
| 4.3 | **Alert schedules / time-based rules** | ❌ Missing | 🔴 Blocker | 6h | Perimeter alerts only during off-hours. |
| 4.4 | **Alert severity logic** | ❌ Defaults MEDIUM | 🔴 Blocker | 4h | Knife detected = CRITICAL. Person walking = LOW. |
| 4.5 | **Alert escalation chains** | ❌ Missing | 🟡 Critical | 8h | Unacknowledged → email supervisor → SMS manager after 15 min. |
| 4.6 | **Alert acknowledgment with notes** | ⚠️ Partial | 🟡 Critical | 4h | Operator adds: "False alarm — maintenance staff." |
| 4.7 | **Alert assignment + handoff** | ❌ Schema only | 🔴 Blocker | 6h | Shift handoff: "Your alerts, my alerts." |
| 4.8 | **Alert bulk actions** | ❌ Missing | 🟡 Critical | 4h | Select 20 alerts → acknowledge all. |
| 4.9 | **Alert filters (date, camera, type, severity)** | ⚠️ Partial | 🟡 Critical | 6h | Date range + camera + object type filters. |

### 4.2 Notification Channels

| # | Feature | Status | Severity | Effort | Why It Matters |
|---|---------|--------|----------|--------|----------------|
| 4.10 | **Email alerts (SMTP)** | ❌ Missing | 🔴 Blocker | 8h | Basic requirement. Every VMS has this. |
| 4.11 | **Webhook notifications** | ❌ Missing | 🟡 Critical | 6h | Integrate with Slack, Teams, PagerDuty, existing SOAR. |
| 4.12 | **SMS alerts (Twilio)** | ❌ Missing | 🟡 Critical | 8h | Critical alerts after hours. |
| 4.13 | **In-app notification center** | ❌ Missing | 🟡 Critical | 8h | Persistent notification list, not just toasts. |
| 4.14 | **Alert sound / audio alarm** | ❌ Missing | 🟢 Important | 2h | SOC operators need audible alerts. |

### 4.3 Incident Management

| # | Feature | Status | Severity | Effort | Why It Matters |
|---|---------|--------|----------|--------|----------------|
| 4.15 | **Alert detail view with evidence** | ❌ Missing | 🔴 Blocker | 6h | Snapshot + video clip + detection metadata. |
| 4.16 | **Case / incident creation** | ❌ Missing | 🟡 Critical | 12h | Group related alerts into an incident case. |
| 4.17 | **Evidence export (MP4 + PDF report)** | ❌ Missing | 🔴 Blocker | 12h | Police / insurance need evidence packages. |
| 4.18 | **Audit trail per incident** | ❌ Missing | 🔴 Blocker | 6h | Who saw what when. Chain of custody. |
| 4.19 | **Incident status workflow** | ❌ Missing | 🟡 Critical | 6h | Open → Under Investigation → Closed → Archived. |

**Alerting Total: ~120 hours (~5 weeks)**

---

## 5. Traffic & Analytics — "Can We Replace the Traffic Study Vendor?"

For traffic management authorities, this is your **differentiation**.

### 5.1 Vehicle Analytics

| # | Feature | Status | Severity | Effort | Why It Matters |
|---|---------|--------|----------|--------|----------------|
| 5.1 | **Vehicle counting (directional)** | ❌ Missing | 🔴 Blocker | 8h | AADT (Annual Average Daily Traffic) calculation. |
| 5.2 | **Vehicle classification** | ⚠️ YOLO classes | 🟡 Critical | 4h | Car, truck, bus, motorcycle, bicycle. Already detected — need aggregation. |
| 5.3 | **Speed estimation** | ❌ Missing | 🔴 Blocker | 8h | Requires camera calibration (pixels/meter). |
| 5.4 | **Traffic congestion detection** | ❌ Missing | 🔴 Blocker | 8h | Queue length + avg speed per zone. |
| 5.5 | **Wrong-way detection** | ❌ Missing | 🟡 Critical | 8h | Trajectory vs allowed direction vector. |
| 5.6 | **Illegal turn detection** | ❌ Missing | 🟢 Important | 12h | Trajectory analysis at intersections. |
| 5.7 | **Parking occupancy** | ❌ Missing | 🟡 Critical | 8h | Spots available per lot. |
| 5.8 | **License Plate Recognition (LPR)** | ❌ Missing | 🔴 Blocker | 16h | EasyOCR / PaddleOCR on vehicle ROIs. |
| 5.9 | **LPR watchlists** | ❌ Missing | 🟡 Critical | 8h | Stolen, authorized, VIP, blacklisted. |
| 5.10 | **Traffic dashboard** | ❌ Missing | 🔴 Blocker | 12h | Peak hours, flow rates, congestion index. |
| 5.11 | **Historical traffic reports** | ❌ Missing | 🟡 Critical | 8h | Weekly/monthly PDF exports for DOT. |
| 5.12 | **API for traffic data** | ❌ Missing | 🟡 Critical | 8h | Third-party traffic platforms need data feeds. |

### 5.2 People & Crowd Analytics

| # | Feature | Status | Severity | Effort |
|---|---------|--------|----------|--------|
| 5.13 | **People counting (in/out)** | ❌ Missing | 🟡 Critical | 8h |
| 5.14 | **Crowd density estimation** | ❌ Missing | 🟡 Critical | 8h |
| 5.15 | **Footfall heatmaps** | ❌ Missing | 🟡 Critical | 12h |
| 5.16 | **Queue analytics** | ❌ Missing | 🟢 Important | 8h |
| 5.17 | **Dwell time tracking** | ❌ Missing | 🟢 Important | 8h |

### 5.3 Camera Calibration (Prerequisite)

| # | Feature | Status | Severity | Effort |
|---|---------|--------|----------|--------|
| 5.18 | **Camera calibration API** | ❌ Missing | 🔴 Blocker | 8h | Pixels-per-meter for speed/density accuracy. |
| 5.19 | **Calibration UI** | ❌ Missing | 🟡 Critical | 4h | Draw reference line of known length. |
| 5.20 | **Counting line configuration** | ❌ Missing | 🟡 Critical | 6h | Virtual lines for in/out counting. |

**Traffic Analytics Total: ~160 hours (~6.5 weeks)**

---

## 6. Enterprise Integration — "Does It Play Nice With Our Stack?"

Organizations have existing tools. You must integrate or be replaced.

| # | Integration | Status | Severity | Effort | Why It Matters |
|---|-------------|--------|----------|--------|----------------|
| 6.1 | **REST API with versioning** | ⚠️ No versions | 🟡 Critical | 4h | `/api/v1/` prefix. Customers build against this. |
| 6.2 | **API key authentication** | ❌ Missing | 🟡 Critical | 6h | Third-party integrations need API keys, not JWT cookies. |
| 6.3 | **OpenAPI/Swagger docs** | ✅ Exists | — | — | Already have. Maintain it. |
| 6.4 | **Webhook outbound** | ❌ Missing | 🟡 Critical | 6h | POST alert JSON to customer's endpoint. |
| 6.5 | **Slack/Teams notification** | ❌ Missing | 🟡 Critical | 6h | SOC uses Slack/Teams. |
| 6.6 | **PagerDuty integration** | ❌ Missing | 🟢 Important | 8h | Enterprise incident management. |
| 6.7 | **SIEM integration (Syslog/CEF)** | ❌ Missing | 🟢 Important | 8h | Splunk, QRadar, Sentinel need alert feeds. |
| 6.8 | **SSO / SAML / OIDC** | ❌ Missing | 🟡 Critical | 16h | Azure AD, Okta, Google Workspace SSO. |
| 6.9 | **LDAP/Active Directory sync** | ❌ Missing | 🟢 Important | 12h | Large orgs don't manually create users. |
| 6.10 | **ONVIF camera discovery** | ❌ Missing | 🟢 Important | 12h | Auto-discover IP cameras on network. |
| 6.11 | **RTMP ingestion** | ❌ Missing | 🟢 Important | 8h | Some cameras stream RTMP, not RTSP. |
| 6.12 | **H.265 / HEVC support** | ❌ Missing | 🟢 Important | 8h | Newer cameras use H.265 for bandwidth. |

**Integration Total: ~94 hours (~4 weeks)**

---

## 7. Deployment & Operations — "Can Our IT Team Run This?"

### 7.1 Deployment

| # | Feature | Status | Severity | Effort |
|---|---------|--------|----------|--------|
| 7.1 | **One-command production deploy** | ⚠️ Partial | 🔴 Blocker | 8h |
| 7.2 | **TLS/SSL auto-certificates** | ❌ Missing | 🔴 Blocker | 4h |
| 7.3 | **Reverse proxy for all services** | ⚠️ Partial | 🟡 Critical | 4h |
| 7.4 | **Automated DB migrations on startup** | ⚠️ Partial | 🔴 Blocker | 4h |
| 7.5 | **Seed data (admin user, demo camera)** | ❌ Missing | 🟡 Critical | 4h |
| 7.6 | **Environment validation on boot** | ⚠️ Partial | 🟡 Critical | 4h |
| 7.7 | **Graceful shutdown (kill FFmpeg)** | ⚠️ Partial | 🟡 Critical | 4h |
| 7.8 | **Update procedure documentation** | ❌ Missing | 🟡 Critical | 4h |
| 7.9 | **Kubernetes manifests** | ❌ Missing | 🟢 Important | 16h | For cloud-native deployments |
| 7.10 | **Helm chart** | ❌ Missing | 🟢 Important | 12h | Standard K8s package manager |

### 7.2 Documentation

| # | Feature | Status | Severity | Effort |
|---|---------|--------|----------|--------|
| 7.11 | **Installation guide (on-premise)** | ❌ Missing | 🔴 Blocker | 8h |
| 7.12 | **System requirements / sizing guide** | ❌ Missing | 🟡 Critical | 4h |
| 7.13 | **API integration guide** | ❌ Missing | 🟡 Critical | 8h |
| 7.14 | **User manual for operators** | ❌ Missing | 🟡 Critical | 8h |
| 7.15 | **Admin guide for IT** | ❌ Missing | 🟡 Critical | 8h |
| 7.16 | **Troubleshooting runbook** | ❌ Missing | 🟡 Critical | 4h |
| 7.17 | **Changelog** | ❌ Missing | 🟢 Important | 2h |

**Deployment Total: ~98 hours (~4 weeks)**

---

## 8. User Management — "Can We Onboard Our Whole Team?"

| # | Feature | Status | Severity | Effort |
|---|---------|--------|----------|--------|
| 8.1 | **User invitation system** | ❌ Missing | 🔴 Blocker | 8h |
| 8.2 | **Organization/tenant isolation** | ❌ Missing | 🟢 Important | 16h |
| 8.3 | **Granular permissions** | ⚠️ 3 roles | 🟡 Critical | 8h | "View live only", "Manage cameras", "Export evidence", etc. |
| 8.4 | **User groups / teams** | ❌ Missing | 🟡 Critical | 6h | "Night shift", "Traffic team", "Security" |
| 8.5 | **Shift scheduling** | ❌ Missing | 🟢 Important | 12h | Auto-assign alerts based on who's on duty |
| 8.6 | **User activity log** | ❌ Missing | 🔴 Blocker | 4h | Who logged in when, from where |
| 8.7 | **Session management** | ⚠️ Basic | 🟡 Critical | 4h | View active sessions, force logout |
| 8.8 | **Password policy enforcement** | ❌ Missing | 🟡 Critical | 2h | Min length, complexity, expiry |

**User Management Total: ~60 hours (~2.5 weeks)**

---

## 9. The B2B "Can We Buy This?" Test

Ask your champion at a prospect organization these questions:

| Question | Your Answer | Impact |
|----------|-------------|--------|
| Can our InfoSec team audit this? | ❌ No audit logs, no pentest, plaintext passwords | **Deal-killer** |
| Can we install this on-premise behind our firewall? | ✅ Docker Compose exists, but no K8s, no sizing guide | Friction |
| Can our operators acknowledge alerts from the SOC? | ✅ Web works, but no audible alarm, no notification center | Friction |
| Can we export incident evidence for police? | ❌ No recording, no export, no case management | **Deal-killer** |
| Can we integrate alerts into our Slack/Splunk? | ❌ No webhooks, no SIEM integration | Friction |
| Can our 50 cameras be managed efficiently? | ❌ No bulk import, no health monitoring, no groups | **Deal-killer** |
| Will we get 500 alerts for one person walking? | ❌ No cooldown, no custom rules | **Deal-killer** |
| Can our traffic engineers get AADT reports? | ❌ No vehicle counting, no historical reports | **Deal-killer for traffic** |
| Can our users log in with Azure AD? | ❌ No SSO/SAML | Friction |
| Is our camera footage encrypted? | ❌ Snapshots unencrypted, RTSP URLs plaintext | **Deal-killer** |

**Score: 1.5/10** for B2B readiness.

---

## 10. Recommended Roadmap for Organizational Readiness

### Phase 1: Trust & Security (Weeks 1–2)
*InfoSec approval is the gate. Fix this first.*

- Encrypt RTSP credentials at rest
- Secure AI Engine Socket.IO with API key
- Fix RBAC gaps (PrivacyMask, Recording controllers)
- Add comprehensive audit logging
- Fix snapshot path traversal
- Add HTTPS/TLS
- Add password policy enforcement
- Add user activity log

### Phase 2: Core Works (Weeks 3–4)
*Finish every stub. No mocked features allowed.*

- Wire settings page to backend
- SMTP service + password reset
- Alert severity logic
- Alert assignee + handoff
- Alert cooldown / deduplication
- Email notifications for alerts
- MinIO/S3 integration for snapshots
- FFmpeg recording + HLS streaming endpoint
- Camera health monitoring

### Phase 3: Scale & Operations (Weeks 5–6)
*Organizations have 50+ cameras. Make it manageable.*

- Camera bulk import (CSV)
- Camera groups / sites
- Camera health dashboard
- Disk space + system alerts
- Prometheus metrics + Grafana
- Database backup automation
- Snapshot backup to S3
- Sentry error tracking
- Structured JSON logging

### Phase 4: Incident Response (Weeks 7–8)
*This is why they buy. Make alerts actionable.*

- Alert detail view with evidence
- Custom alert rules + schedules
- Alert escalation chains
- Webhook notifications (Slack, Teams)
- SMS alerts (Twilio)
- Case/incident creation
- Evidence export (MP4 + PDF)
- In-app notification center

### Phase 5: Traffic Analytics (Weeks 9–11)
*Your differentiator for traffic management.*

- Camera calibration (pixels/meter)
- Counting line configuration
- Vehicle counting + classification
- Speed estimation
- Traffic congestion detection
- Wrong-way detection
- LPR (License Plate Recognition)
- LPR watchlists
- Traffic dashboard + historical reports
- Traffic data API

### Phase 6: Integration & Deploy (Weeks 12–13)
*Make it easy for IT to buy, deploy, and integrate.*

- API versioning + API key auth
- SSO / SAML / OIDC
- Webhook outbound
- Syslog/CEF for SIEM
- Kubernetes manifests
- Helm chart
- Installation guide + sizing guide
- API integration guide
- Troubleshooting runbook

**Total: ~13 weeks for 1 developer, ~7 weeks for 2.**

---

## 11. What You Can SKIP (For Now)

Since you're B2B web-first, deprioritize:

| Feature | Why Skip |
|---------|----------|
| Mobile app | Web works for SOC operators at desks |
| Push notifications | Email + webhook + SMS cover alerting |
| Cookie consent banner | B2B tool, not consumer website |
| Fancy onboarding tour | IT admin reads docs, doesn't need tooltips |
| Social login (Google OAuth) | SSO/SAML is what enterprises want |
| Dark/light mode | Minor nice-to-have |
| Demographics / age-gender | Privacy concern for B2B, low value |
| Video synopsis | Extremely complex, thumbnail timeline is fine for now |
| Predictive analytics | Needs months of data first. Phase 2 feature. |
| Neuromorphic computing | Research-level. Not relevant for 2+ years. |

---

*Last updated: 2026-05-08*
