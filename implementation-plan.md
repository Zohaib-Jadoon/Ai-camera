# Madad Vision AI — Implementation Plan

> **Goal:** Transform Madad Vision AI from a capable surveillance MVP into a differentiated, market-leading AI video intelligence platform.

---

## 1. Current State Assessment

### 1.1 What Works (Production-Ready)

| Layer | Feature | Status |
|-------|---------|--------|
| **AI Engine** | YOLOv8 object detection (person, car, truck, bus, motorcycle, bicycle, dog, cat, bird, backpack, suitcase, knife, scissors) | ✅ Production-ready with Frigate-style filtering |
| **AI Engine** | Multi-object tracking (CentroidTracker with per-label matching, smoothed boxes) | ✅ |
| **AI Engine** | Motion gating (Frigate ImprovedMotionDetector — 60-80% CPU reduction on static scenes) | ✅ |
| **AI Engine** | Stationary suppression (NCC + phase-correlation for parked cars, unattended bags) | ✅ |
| **AI Engine** | Face recognition (InsightFace ArcFace + RetinaFace, 512-D embeddings) | ✅ (CPU by default) |
| **AI Engine** | Polygon zone intrusion (cv2.pointPolygonTest, live zone updates) | ✅ |
| **AI Engine** | RTSP auto-discovery, reconnection, dual-stream support | ✅ |
| **AI Engine** | Model hot-swapping per SOP | ✅ (global only) |
| **AI Engine** | Training data collection (YOLO-format, auto-rotation) | ✅ (disabled by default) |
| **Backend** | JWT auth with refresh token rotation (bcrypt-hashed) | ✅ |
| **Backend** | Role-based access (ADMIN, SECURITY_OPERATOR, VIEWER) | ✅ |
| **Backend** | Throttling (global + per-route) | ✅ |
| **Backend** | Prisma ORM with PostgreSQL | ✅ |
| **Backend** | Socket.IO gateway (AI ↔ Backend ↔ Web) | ✅ |
| **Backend** | Privacy masks, recordings DB schema | ✅ |
| **Web** | Dashboard with Recharts analytics | ✅ |
| **Web** | Live monitoring (Socket.IO JPEG frames, multi-layout) | ✅ |
| **Web** | Interactive zone editor (Konva polygon drawer) | ✅ |
| **Web** | Alert lifecycle, face watchlist, camera CRUD | ✅ |
| **Web** | Responsive design (Tailwind v4) | ✅ |
| **DevOps** | Docker Compose (postgres, valkey, backend, ai-engine, web, minio, nginx) | ✅ |

### 1.2 What's Stubbed / Incomplete

| Feature | Gap |
|---------|-----|
| **Video Recording** | `RecordingService.startClip()` is commented out — no FFmpeg invocation |
| **HLS Streaming** | FFmpeg processes spawn but no HTTP route serves `.mjs` / `.ts` segments |
| **Settings Page** | Entirely mocked — toggles have no state, Save button has no `onClick` |
| **Password Reset** | Frontend forms exist, no backend SMTP endpoints |
| **Contact Form** | Mock submission only |
| **Mobile App** | Referenced in docs but **does not exist** in current branch |
| **Analytics Cache** | `invalidateCache()` exists but is **never called** — stays stale |
| **Alert Severity** | Enum exists but always defaults to `MEDIUM` |
| **Alert Assignee** | Schema field exists but no API to assign alerts |
| **SOP Rule Engine** | Only model path swaps — no logic (e.g., "hardhat required") |
| **CameraManager** | Class exists but `main.py` uses raw dicts instead |
| **Dead Code** | `advanced_ai.py`, `motion_detector.py`, `camera_manager.py` unused |
| **BBox Drawing** | Live stream frames look for `"bbox"` key but tracker outputs `"box"` / `"smooth_box"` |
| **Face Threshold** | Config says 0.6, code hardcodes 0.45 |
| **GPU Default** | InsightFace defaults to CPU (`ctx_id=-1`) |
| **ONNX Runtime** | Listed in requirements but never used |
| **MinIO/S3** | Mentioned in docker-compose but `StorageService` only writes local disk |

### 1.3 Security Gaps

| Risk | Severity |
|------|----------|
| AI Engine trust model — any tokenless Socket.IO connection is treated as AI Engine | 🔴 High |
| `PrivacyMaskController` & `RecordingController` lack `@Roles()` — VIEWER can modify | 🟡 Medium |
| RTSP URLs exposed to all authenticated users (including VIEWER) | 🟡 Medium |
| Snapshot serving has potential path traversal (`../` in filename) | 🟡 Medium |
| JWT refresh token decode without verification enables user ID enumeration | 🟡 Medium |

---

## 2. Vision — What Makes This "One of Its Kind"

After analyzing the competitive landscape (BriefCam, Vaidio, VOLT AI, IRIS+, Genetec, Axis, iOmniscient), here's what **no single open-source platform** combines today:

### 2.1 The Differentiator Stack

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5: PREDICTIVE INTELLIGENCE                           │
│  • Anomaly prediction (LSTM on time-series detection data)   │
│  • Crowd surge forecasting                                   │
│  • Traffic congestion prediction (15-min ahead)              │
│  • Equipment failure prediction (camera health)              │
├─────────────────────────────────────────────────────────────┤
│  LAYER 4: BUSINESS INTELLIGENCE                             │
│  • Heatmaps (dwell time, footfall density)                   │
│  • Demographics (age/gender estimation)                      │
│  • Queue analytics (wait time, abandonment)                  │
│  • Conversion funnels (retail: entry → browse → checkout)    │
│  • Occupancy compliance (fire code, COVID limits)            │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: ADVANCED DETECTION                                │
│  • License Plate Recognition (LPR) + watchlists              │
│  • Vehicle analytics (counting, classification, speed)       │
│  • Traffic analytics (congestion, wrong-way, illegal turn)   │
│  • People counting + crowd density + social distancing       │
│  • PPE compliance (hardhat, vest, mask, gloves)              │
│  • Behavior analysis (loitering, fighting, person down, fall)│
│  • Abandoned object / object removal detection               │
│  • Smoke/fire detection                                      │
│  • Audio anomaly (gunshot, glass break, scream)              │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: CROSS-CAMERA INTELLIGENCE                         │
│  • Person re-identification (ReID) across cameras            │
│  • Vehicle re-identification (color, make, model)            │
│  • Cross-camera tracking with timeline visualization         │
│  • 3D facility mapping with camera positions                 │
│  • Multi-camera event correlation                            │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: FORENSIC & SEARCH                                 │
│  • Natural language search ("show me red trucks yesterday")  │
│  • Appearance search (find person by clothing color)         │
│  • Video synopsis (compress hours into minutes)              │
│  • Smart tags + hashtag metadata                             │
│  • Sub-2-second search across all cameras                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Target Use Cases

| Industry | Key Features |
|----------|-------------|
| **Smart Cities** | Traffic analytics, LPR, crowd density, accident detection, illegal parking |
| **Retail** | People counting, heatmaps, queue analytics, conversion funnels, demographics |
| **Manufacturing** | PPE compliance, safety zone intrusion, equipment monitoring, defect detection |
| **Healthcare** | Fall detection, patient wandering, queue management, occupancy limits |
| **Education** | Perimeter protection, unauthorized access, fight detection, crowd surge |
| **Critical Infrastructure** | Perimeter intrusion, abandoned object, smoke/fire, audio anomaly, ReID |

---

## 3. Phased Roadmap

### Phase 1: Foundation Hardening (Weeks 1–2)
> *Fix what's broken. Secure the platform. Complete stubbed features.*

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1.1 | **Fix bbox drawing bug** — live stream frames use `"bbox"` but tracker outputs `"box"` | 2h | 🔴 High |
| 1.2 | **Fix face similarity threshold** — read from config instead of hardcoded 0.45 | 1h | 🔴 High |
| 1.3 | **Enable GPU by default** — detect CUDA, set `ctx_id=0` if available | 2h | 🔴 High |
| 1.4 | **Remove dead code** — delete `advanced_ai.py`, `motion_detector.py` | 1h | 🟢 Low |
| 1.5 | **Use CameraManager** — replace raw dicts in `main.py` with `CameraManager` class | 4h | 🟡 Medium |
| 1.6 | **Secure AI Engine connection** — add shared API key or IP whitelist for Socket.IO | 4h | 🔴 High |
| 1.7 | **Fix PrivacyMaskController & RecordingController RBAC** — add `@Roles()` guards | 2h | 🔴 High |
| 1.8 | **Fix snapshot path traversal** — sanitize `filename` parameter | 2h | 🟡 Medium |
| 1.9 | **Wire analytics cache invalidation** — invalidate on detection/alert creation | 2h | 🟡 Medium |
| 1.10 | **Implement alert severity logic** — auto-assign based on object type + zone | 4h | 🟡 Medium |
| 1.11 | **Implement alert assignee API** — `PATCH /alerts/:id/assign` + `GET /alerts?assignee=` | 4h | 🟡 Medium |
| 1.12 | **Settings page backend** — persist AI toggles, thresholds, notifications per user | 8h | 🟡 Medium |
| 1.13 | **SMTP / Email service** — password reset, alert email notifications | 8h | 🟡 Medium |
| 1.14 | **MinIO/S3 integration** — migrate `StorageService` to S3-compatible storage | 8h | 🟡 Medium |
| 1.15 | **Recording service** — uncomment and wire FFmpeg for event-triggered clips | 12h | 🟡 Medium |
| 1.16 | **HLS streaming** — serve `.m3u8` via static middleware or dedicated endpoint | 8h | 🟡 Medium |

### Phase 2: Traffic & Vehicle Analytics (Weeks 3–4)
> *Your stated priority: car counting, congestion, foot density.*

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 2.1 | **Vehicle counting** — directional line-crossing counters (in/out per lane) | 8h | 🔴 High |
| 2.2 | **Vehicle classification** — car, truck, bus, motorcycle, bicycle with confidence | 4h | 🟡 Medium |
| 2.3 | **Speed estimation** — optical flow / frame-time delta per tracked vehicle | 12h | 🔴 High |
| 2.4 | **Traffic congestion detection** — queue length + average speed per zone | 8h | 🔴 High |
| 2.5 | **Wrong-way detection** — compare vehicle trajectory vs allowed direction vector | 8h | 🟡 Medium |
| 2.6 | **Illegal turn / red-light detection** — trajectory analysis at intersections | 12h | 🟡 Medium |
| 2.7 | **License Plate Recognition (LPR)** — integrate EasyOCR or PaddleOCR on vehicle ROIs | 16h | 🔴 High |
| 2.8 | **LPR watchlists** — alert on stolen vehicles, authorized/unauthorized plates | 8h | 🔴 High |
| 2.9 | **Parking occupancy** — count parked vehicles per zone, spot-level occupancy | 8h | 🟡 Medium |
| 2.10 | **Traffic dashboard** — peak hours, vehicle flow, congestion index, average speed | 12h | 🔴 High |
| 2.11 | **People counting** — directional counters at doors/corridors (in/out) | 8h | 🔴 High |
| 2.12 | **Crowd density estimation** — persons per m² with configurable thresholds | 8h | 🔴 High |
| 2.13 | **Social distancing compliance** — flag groups violating distance rules | 8h | 🟡 Medium |
| 2.14 | **Footfall heatmaps** — aggregate dwell time + visit frequency per camera zone | 12h | 🔴 High |
| 2.15 | **Queue analytics** — queue length, wait time, abandonment rate | 8h | 🔴 High |

### Phase 3: Advanced Detection & Safety (Weeks 5–6)
> *PPE, behavior analysis, safety compliance.*

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 3.1 | **PPE detection model** — fine-tune YOLOv8 on hardhat, safety vest, mask, gloves | 16h | 🔴 High |
| 3.2 | **PPE compliance rules per zone** — "hardhat required in construction zone" | 8h | 🔴 High |
| 3.3 | **Loitering detection** — person stationary > N seconds in restricted zone | 4h | 🟡 Medium |
| 3.4 | **Fall detection** — pose estimation (YOLO-pose or MediaPipe) + fall classifier | 16h | 🔴 High |
| 3.5 | **Fight detection** — velocity variance + proximity clustering of persons | 12h | 🟡 Medium |
| 3.6 | **Person down / medical emergency** — pose keypoint analysis (lying down + no motion) | 12h | 🔴 High |
| 3.7 | **Abandoned object detection** — object left unattended > N seconds | 8h | 🟡 Medium |
| 3.8 | **Object removal detection** — object disappears from fixed location | 8h | 🟡 Medium |
| 3.9 | **Smoke/fire detection** — fine-tune YOLOv8 or use color/motion anomaly | 12h | 🔴 High |
| 3.10 | **Audio anomaly detection** — gunshot, glass break, scream (audio stream + classifier) | 16h | 🟡 Medium |
| 3.11 | **Perimeter protection** — line crossing with direction enforcement | 4h | 🟡 Medium |
| 3.12 | **Tailgating detection** — two persons through access control within N seconds | 8h | 🟡 Medium |
| 3.13 | **Slip/trip detection** — sudden velocity change + body orientation | 12h | 🟡 Medium |

### Phase 4: Cross-Camera Intelligence (Weeks 7–8)
> *Track subjects across the entire facility.*

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 4.1 | **Person ReID model** — integrate OSNet or FastReID for cross-camera matching | 20h | 🔴 High |
| 4.2 | **Vehicle ReID** — color + make + model classification + LPR cross-reference | 16h | 🔴 High |
| 4.3 | **Cross-camera tracking API** — `GET /tracking/person/:id/timeline` | 8h | 🔴 High |
| 4.4 | **Cross-camera tracking UI** — timeline + map view of subject movement | 16h | 🔴 High |
| 4.5 | **3D facility mapping** — upload floor plan, place cameras, visualize tracks | 24h | 🟡 Medium |
| 4.6 | **Multi-camera event correlation** — same event detected on 2+ cameras = single alert | 8h | 🟡 Medium |
| 4.7 | **Camera handoff** — auto-switch live view to next camera tracking subject | 8h | 🟢 Low |

### Phase 5: Forensic Search & Video Intelligence (Weeks 9–10)
> *Turn hours of footage into seconds of insight.*

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 5.1 | **Object attribute indexing** — color, size, speed, direction per detection | 12h | 🔴 High |
| 5.2 | **Natural language search** — "show me red trucks entering zone A yesterday" | 24h | 🔴 High |
| 5.3 | **Appearance search** — upload image / describe clothing → find across cameras | 20h | 🔴 High |
| 5.4 | **Video synopsis** — compress 8 hours into 2 minutes (time-compressed playback) | 24h | 🔴 High |
| 5.5 | **Smart tags / hashtags** — auto-tag events: `#intrusion`, `#red-truck`, `#night` | 8h | 🟡 Medium |
| 5.6 | **Sub-2-second search** — Elasticsearch/OpenSearch backend for metadata | 16h | 🔴 High |
| 5.7 | **Case management** — create cases, add video clips, export reports (PDF) | 16h | 🟡 Medium |
| 5.8 | **Audit trail** — every operator action logged with video timestamp | 8h | 🟡 Medium |

### Phase 6: Predictive Analytics & AI (Weeks 11–12)
> *From reactive to proactive.*

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 6.1 | **Anomaly detection model** — LSTM autoencoder on detection time-series | 20h | 🔴 High |
| 6.2 | **Crowd surge forecasting** — predict crowd density 15-30 min ahead | 16h | 🔴 High |
| 6.3 | **Traffic congestion prediction** — predict bottleneck formation | 16h | 🔴 High |
| 6.4 | **Camera health monitoring** — predict failure from frame drops, CPU, temp | 12h | 🟡 Medium |
| 6.5 | **Predictive maintenance alerts** — "Camera 3 likely to fail in 48h" | 8h | 🟡 Medium |
| 6.6 | **Business intelligence dashboards** — retail conversion, dwell time trends | 16h | 🟡 Medium |
| 6.7 | **Automated reporting** — daily/weekly PDF reports with charts + key events | 12h | 🟡 Medium |

### Phase 7: Mobile App & Edge (Weeks 13–14)
> *Extend reach to field operators and edge devices.*

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 7.1 | **Scaffold mobile app** — Expo + React Native + Expo Router (referenced in docs) | 16h | 🔴 High |
| 7.2 | **Mobile live view** — Socket.IO frames, camera grid, alert notifications | 12h | 🔴 High |
| 7.3 | **Push notifications** — `expo-notifications` + Firebase Cloud Messaging | 12h | 🔴 High |
| 7.4 | **Mobile alert acknowledgment** — swipe-to-ack, photo evidence upload | 8h | 🟡 Medium |
| 7.5 | **Mobile patrol mode** — guard walking route with auto camera handoff | 12h | 🟢 Low |
| 7.6 | **Edge computing** — run AI inference on NVIDIA Jetson / Coral TPU | 24h | 🔴 High |
| 7.7 | **ONNX Runtime optimization** — convert YOLO to ONNX for faster edge inference | 16h | 🔴 High |
| 7.8 | **TensorRT acceleration** — NVIDIA GPU optimized inference pipeline | 16h | 🔴 High |

---

## 4. Immediate Priority Matrix

### Do This Week (Highest ROI)

```
1. Fix bbox drawing bug on live stream                    → 2h
2. Fix face similarity threshold config                   → 1h
3. Enable GPU auto-detection                              → 2h
4. Secure AI Engine Socket.IO (API key)                   → 4h
5. Fix RBAC on PrivacyMask & Recording controllers        → 2h
6. Implement vehicle counting + directional counters      → 8h
7. Implement people counting (in/out)                     → 8h
8. Crowd density estimation                               → 8h
9. Traffic congestion detection                           → 8h
10. Footfall heatmap backend (aggregate dwell time)       → 8h
─────────────────────────────────────────────────────────────
Total: ~57 hours (~1 week of focused work)
```

### Next Week

```
11. Speed estimation                                      → 12h
12. LPR (License Plate Recognition)                       → 16h
13. LPR watchlists + alerts                               → 8h
14. PPE detection model + rules                           → 16h
15. Fall detection (pose estimation)                      → 16h
16. Queue analytics                                       → 8h
─────────────────────────────────────────────────────────────
Total: ~76 hours (~1.5 weeks)
```

---

## 5. Technical Architecture Recommendations

### 5.1 AI Engine Enhancements

```python
# New module: apps/ai-engine/src/analytics/
# ├── vehicle_counter.py      # Directional line-crossing
# ├── people_counter.py       # Doorway counting
# ├── crowd_density.py        # Persons/m² estimation
# ├── speed_estimator.py      # Optical flow per track
# ├── lpr_engine.py           # EasyOCR / PaddleOCR wrapper
# ├── ppe_detector.py         # YOLOv8 fine-tuned for PPE
# ├── pose_estimator.py       # YOLO-pose for fall detection
# ├── reid_engine.py          # OSNet person ReID
# ├── audio_analyzer.py       # Audio stream + anomaly classifier
# └── heatmap_generator.py    # Aggregate dwell time per pixel
```

### 5.2 Backend Enhancements

```typescript
// New modules:
// ├── src/traffic/          # Traffic analytics aggregation
// ├── src/heatmap/          # Heatmap data aggregation
// ├── src/lpr/              # License plate records + watchlists
// ├── src/predictive/       # LSTM anomaly detection service
// ├── src/search/           # Elasticsearch/OpenSearch integration
// ├── src/cases/            # Case management
// ├── src/email/            # SMTP service
// └── src/notifications/    # Push notification service (FCM + Expo)
```

### 5.3 Database Schema Additions

```prisma
model VehicleCount {
  id          String   @id @default(uuid())
  camera_id   String
  camera      Camera   @relation(fields: [camera_id], references: [id])
  timestamp   DateTime
  direction   String   // "in" | "out" | "north" | "south" | "east" | "west"
  vehicle_type String  // "car" | "truck" | "bus" | "motorcycle"
  count       Int
  speed_kmh   Float?
  lane_id     String?
}

model CrowdDensity {
  id          String   @id @default(uuid())
  camera_id   String
  camera      Camera   @relation(fields: [camera_id], references: [id])
  timestamp   DateTime
  density     Float    // persons per m²
  person_count Int
  alert_triggered Boolean
}

model LicensePlate {
  id          String   @id @default(uuid())
  camera_id   String
  camera      Camera   @relation(fields: [camera_id], references: [id])
  plate_number String
  timestamp   DateTime
  confidence  Float
  image_url   String?
  watchlist_match String? // "stolen" | "authorized" | "unauthorized"
}

model HeatmapCell {
  id          String   @id @default(uuid())
  camera_id   String
  camera      Camera   @relation(fields: [camera_id], references: [id])
  date        DateTime @db.Date
  grid_x      Int
  grid_y      Int
  dwell_seconds Float
  visit_count Int
}

model QueueMetrics {
  id          String   @id @default(uuid())
  camera_id   String
  camera      Camera   @relation(fields: [camera_id], references: [id])
  timestamp   DateTime
  queue_id    String
  length      Int
  wait_time_sec Float
  abandonment_count Int
}

model PredictiveAlert {
  id          String   @id @default(uuid())
  camera_id   String
  alert_type  String   // "crowd_surge" | "congestion" | "camera_failure"
  predicted_at DateTime
  expected_at  DateTime
  confidence   Float
  resolved     Boolean  @default(false)
}
```

### 5.4 Web Frontend Additions

```
apps/web/src/
├── app/(dashboard)/
│   ├── traffic/           # Traffic analytics page
│   ├── heatmaps/          # Interactive heatmap viewer
│   ├── lpr/               # License plate records + watchlists
│   ├── queues/            # Queue analytics dashboard
│   ├── ppe/               # PPE compliance monitoring
│   ├── safety/            # Fall/fight/medical emergency alerts
│   └── search/            # Natural language + appearance search
├── components/
│   ├── VehicleCounter.tsx
│   ├── CrowdDensityGauge.tsx
│   ├── HeatmapOverlay.tsx
│   ├── LprWatchlist.tsx
│   ├── QueueMetrics.tsx
│   ├── PpeComplianceCard.tsx
│   └── PredictiveAlertBanner.tsx
└── hooks/
    ├── use-vehicle-counts.ts
    ├── use-crowd-density.ts
    ├── use-heatmaps.ts
    ├── use-lpr.ts
    └── use-predictive-alerts.ts
```

---

## 6. Competitive Differentiation Summary

| Capability | BriefCam | Vaidio | VOLT AI | Madad Vision AI (Planned) |
|------------|----------|--------|---------|---------------------------|
| Object Detection | ✅ | ✅ | ✅ | ✅ |
| Face Recognition | ✅ | ✅ | ✅ | ✅ |
| Zone Intrusion | ✅ | ✅ | ✅ | ✅ |
| Vehicle Counting | ✅ | ✅ | ✅ | ✅ **(Phase 2)** |
| LPR | ✅ | ✅ | ✅ | ✅ **(Phase 2)** |
| Crowd Density | ✅ | ✅ | ✅ | ✅ **(Phase 2)** |
| People Counting | ✅ | ✅ | ✅ | ✅ **(Phase 2)** |
| Heatmaps | ✅ | ✅ | ❌ | ✅ **(Phase 2)** |
| Queue Analytics | ❌ | ✅ | ❌ | ✅ **(Phase 2)** |
| PPE Detection | ❌ | ✅ | ❌ | ✅ **(Phase 3)** |
| Fall Detection | ❌ | ✅ | ✅ | ✅ **(Phase 3)** |
| Fight Detection | ❌ | ❌ | ✅ | ✅ **(Phase 3)** |
| ReID Cross-Camera | ✅ | ✅ | ❌ | ✅ **(Phase 4)** |
| Video Synopsis | ✅ | ❌ | ❌ | ✅ **(Phase 5)** |
| Natural Language Search | ❌ | ❌ | ❌ | ✅ **(Phase 5)** |
| Predictive Analytics | ❌ | ❌ | ❌ | ✅ **(Phase 6)** |
| Open Source | ❌ | ❌ | ❌ | ✅ **(You)** |
| Modern Web Stack | ❌ | ❌ | ❌ | ✅ **(Next.js 16, React 19)** |
| Mobile App | ✅ | ✅ | ✅ | ✅ **(Phase 7)** |

**Key Message:** Madad Vision AI will be the only open-source platform combining **real-time detection + traffic analytics + PPE safety + ReID + predictive intelligence + natural language search** in a modern, extensible full-stack architecture.

---

## 7. Success Metrics

| Metric | Baseline | Target (3 months) |
|--------|----------|-------------------|
| Detection types supported | 13 | 30+ |
| Analytics dashboards | 2 | 8+ |
| Alert types | 3 | 15+ |
| Search response time | N/A | < 2 seconds |
| Predictive accuracy | N/A | > 85% |
| Supported cameras per AI instance | ~10 (CPU) | 40+ (GPU) |
| Mobile app features | 0 | Live view + alerts + patrol |

---

*Last updated: 2026-05-08*
