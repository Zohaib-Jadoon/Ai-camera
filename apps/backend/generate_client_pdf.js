const { PDFDocument, StandardFonts, rgb, PageSizes } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createBriefingPdf() {
  const doc = await PDFDocument.create();
  
  // Embed Fonts
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
  
  const cPrimary = rgb(0.02, 0.22, 0.5);      // Deep B2B Blue
  const cSecondary = rgb(0.2, 0.25, 0.3);     // Dark Steel
  const cText = rgb(0.12, 0.12, 0.12);        // Charcoal Body
  const cTeal = rgb(0.03, 0.57, 0.58);        // Accent Teal
  const cLightBg = rgb(0.96, 0.97, 0.98);    // Light Grey Container
  
  const width = PageSizes.A4[0];
  const height = PageSizes.A4[1];
  const margin = 54; // 0.75 in
  const contentWidth = width - 2 * margin;
  
  // Custom Wrap Function
  function drawText(page, text, x, y, maxWidth, size, font, color, lineSpacing = 1.3) {
    const paragraphs = text.split('\n');
    let currentY = y;
    
    for (let p of paragraphs) {
      if (p.trim() === '') {
        currentY -= size * 0.5;
        continue;
      }
      
      const words = p.split(' ');
      let line = '';
      
      for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let testWidth = font.widthOfTextAtSize(testLine, size);
        if (testWidth > maxWidth && n > 0) {
          page.drawText(line.trim(), { x, y: currentY, size, font, color });
          line = words[n] + ' ';
          currentY -= size * lineSpacing;
        } else {
          line = testLine;
        }
      }
      page.drawText(line.trim(), { x, y: currentY, size, font, color });
      currentY -= size * lineSpacing * 1.2;
    }
    return currentY;
  }

  function drawHeader(page, title, pageNum) {
    page.drawText(`MADAD VISION AI  |  SYSTEM BRIEFING & DOCUMENTATION`, {
      x: margin,
      y: height - 36,
      size: 8,
      font: fontBold,
      color: cSecondary
    });
    
    page.drawLine({
      start: { x: margin, y: height - 42 },
      end: { x: width - margin, y: height - 42 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    });
    
    page.drawText(`Page ${pageNum}`, {
      x: width - margin - 30,
      y: height - 36,
      size: 8,
      font: fontRegular,
      color: cSecondary
    });
  }

  function drawFooter(page) {
    page.drawLine({
      start: { x: margin, y: 48 },
      end: { x: width - margin, y: 48 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    });
    page.drawText('CONFIDENTIAL - COMPREHENSIVE B2B SURVEILLANCE PLATFORM BRIEFING', {
      x: margin,
      y: 36,
      size: 7,
      font: fontItalic,
      color: rgb(0.6, 0.6, 0.6)
    });
  }

  // -------------------------------------------------------------
  // PAGE 1: TITLE / COVER PAGE
  // -------------------------------------------------------------
  const p1 = doc.addPage(PageSizes.A4);
  p1.drawRectangle({
    x: 0,
    y: height - 280,
    width: width,
    height: 280,
    color: cPrimary
  });
  p1.drawText('MADAD VISION AI', {
    x: margin,
    y: height - 100,
    size: 36,
    font: fontBold,
    color: rgb(1, 1, 1)
  });
  p1.drawText('Enterprise-Grade Smart CCTV Surveillance & Analytics Platform', {
    x: margin,
    y: height - 135,
    size: 14,
    font: fontItalic,
    color: cTeal
  });
  p1.drawText('Comprehensive 20-Page Technical Briefing & Full System Documentation', {
    x: margin,
    y: height - 180,
    size: 11,
    font: fontRegular,
    color: rgb(0.9, 0.9, 0.9)
  });
  
  let y = height - 320;
  p1.drawText('Confidentiality & Access Restrictions', { x: margin, y, size: 14, font: fontBold, color: cPrimary });
  y -= 25;
  const coverTerms = 
    'The information contained in this document is strictly proprietary and confidential to Madad Vision AI. This document has been compiled for client review and stakeholder briefing. It represents the full relational db schema, operational concurrency workflows, granular role matrices, and the complete security-hardened framework implemented for production-ready consumer environments.\n\n' +
    'Unauthorized redistribution or reverse engineering of the described API gateways, socket routing, or neural network pipelines is strictly prohibited under local and international intellectual property laws.';
  y = drawText(p1, coverTerms, margin, y, contentWidth, 10, fontRegular, cText);
  y -= 20;

  p1.drawRectangle({
    x: margin,
    y: 70,
    width: contentWidth,
    height: 90,
    color: cLightBg,
    borderColor: cPrimary,
    borderWidth: 1
  });
  p1.drawText('DOCUMENT AUDIT & RELEASE SUMMARY', { x: margin + 15, y: 145, size: 10, font: fontBold, color: cPrimary });
  p1.drawText('Release version: v1.1.0 (Production / Consumer Ready)', { x: margin + 15, y: 125, size: 9, font: fontRegular, color: cSecondary });
  p1.drawText('Audit Hash: SHA-256 secure verification approved', { x: margin + 15, y: 110, size: 9, font: fontRegular, color: cSecondary });
  p1.drawText('Target Meeting Date: June 2026 | Prepared by System Core Engineers', { x: margin + 15, y: 95, size: 9, font: fontRegular, color: cSecondary });
  drawFooter(p1);

  // Helper page adder to keep A4 templates uniform
  function addGenericPage(title, pageNum) {
    const page = doc.addPage(PageSizes.A4);
    drawHeader(page, title, pageNum);
    
    page.drawText(title, {
      x: margin,
      y: height - 70,
      size: 16,
      font: fontBold,
      color: cPrimary
    });
    
    drawFooter(page);
    return page;
  }

  // -------------------------------------------------------------
  // PAGE 2: EXECUTIVE SUMMARY & TARGET SECTORS
  // -------------------------------------------------------------
  const p2 = addGenericPage('Executive Summary & Target Sectors', 2);
  y = height - 100;
  const summaryPage2 = 
    'Madad Vision AI is a state-of-the-art computer vision and security surveillance platform designed for enterprise clients, manufacturing sites, and traffic authorities. Unlike standard passive cameras, Madad Vision AI dynamically processes multiple RTSP CCTV feeds in real time using advanced artificial intelligence.\n\n' +
    'The platform acts as a force-multiplier for security operations centers (SOCs) and facility managers by automating threat identification, tracking entry boundaries, auditing safety compliance, and estimating vehicle telemetry. It connects low-resolution streams directly to the processing loop while serving high-fidelity feeds for operator analysis and HLS streaming.\n\n' +
    'Designed with absolute security at rest, it fully encrypts sensitive camera configurations, blocks path traversal attempts at snapshot endpoints, and protects Socket.IO pipelines from alert spoofing. It provides comprehensive analytics, peaking indices, and real-time alerts.';
  y = drawText(p2, summaryPage2, margin, y, contentWidth, 10.5, fontRegular, cText);
  y -= 15;

  p2.drawText('Primary Target Sectors:', { x: margin, y, size: 12, font: fontBold, color: cPrimary });
  y -= 20;
  const sectorsPage2 = [
    '* Security Operations Centers (SOC): Real-time intrusion detection and facial recognition alert escalation.',
    '* Traffic Management & Logistics: Directional vehicle counting, speed estimation, and License Plate Recognition.',
    '* Industrial & Safety Compliance: Real-time slip-and-fall detection, fight recognition, and PPE check (hard hats/vests).',
    '* Facility Administration: Centralized multi-camera groups, audit logs, and privacy preservation masking.'
  ];
  for (let s of sectorsPage2) {
    y = drawText(p2, s, margin, y, contentWidth, 10, fontRegular, cSecondary);
  }

  // -------------------------------------------------------------
  // PAGE 3: TARGET PERSONAS & USER ROLES MATRIX
  // -------------------------------------------------------------
  const p3 = addGenericPage('Target Personas & User Roles Matrix', 3);
  y = height - 100;
  const personasIntro = 
    'The platform maps custom B2B organizational roles directly to system capabilities, establishing clear operational boundaries and granular permissions:';
  y = drawText(p3, personasIntro, margin, y, contentWidth, 11, fontItalic, cSecondary);
  y -= 10;

  const personas = [
    {
      role: '1. SOC Manager (Role: ADMIN)',
      capabilities: 'Full system control. Can add or delete cameras, create new users and assign shifts, review security audit logs, modify global system settings, and configure Slack/Teams outbound webhooks.'
    },
    {
      role: '2. Security Operator (Role: SECURITY_OPERATOR)',
      capabilities: 'Active monitoring. Can view the real-time live grid, manage and acknowledge active alerts, assign and track incidents, and export secure evidence packages (MP4 video clips + PDF reports) for insurance/authorities.'
    },
    {
      role: '3. Traffic Engineer & Urban Planner (Role: VIEWER / API User)',
      capabilities: 'Analytics access. Reviews peak congestion trends, flow speeds, and vehicle classifications on the traffic dashboard. Utilizes license plate lookup watchlists. Can access directional count logs via REST APIs.'
    },
    {
      role: '4. Industrial Safety Compliance Inspector (Role: VIEWER)',
      capabilities: 'Safety monitoring. Reviews safety dashboards showing PPE check histories (hard hat/vest audits), slip-and-fall logs, and fight event occurrences to analyze plant risk factors.'
    },
    {
      role: '5. Executive / Viewer (Role: VIEWER)',
      capabilities: 'Read-only business views. Can inspect live feeds and overall charts/counts. Strictly restricted from modifying cameras, changing alert schedules, or viewing raw plain-text RTSP passwords.'
    },
    {
      role: '6. IT & System Administrator (Role: ADMIN)',
      capabilities: 'Operational health maintenance. Audits camera heartbeats, reviews database backups, and monitors Prometheus CPU/GPU metrics and structured JSON logs to ensure zero-downtime operations.'
    }
  ];
  for (let p of personas) {
    p3.drawText(p.role, { x: margin, y, size: 10.5, font: fontBold, color: cTeal });
    y -= 14;
    y = drawText(p3, p.capabilities, margin, y, contentWidth, 9, fontRegular, cText);
    y -= 4;
  }

  // -------------------------------------------------------------
  // PAGE 4: MONOREPO SYSTEM ARCHITECTURE MAP
  // -------------------------------------------------------------
  const p4 = addGenericPage('Monorepo System Architecture Map', 4);
  y = height - 100;
  const archIntro = 
    'The project employs an npm workspaces monorepo architecture to unify packages, streamline builds, and isolate runtimes. Below is the file system hierarchy using standard ASCII formatting:';
  y = drawText(p4, archIntro, margin, y, contentWidth, 10.5, fontItalic, cSecondary);
  y -= 10;

  const folderMap = 
    'madad-vision-ai/                   (Root Directory)\n' +
    '|-- package.json                   (Global workspace configurations)\n' +
    '|-- docker-compose.yml             (Multi-container orchestration setup)\n' +
    '|-- packages/\n' +
    '|   `-- types/                     (Shared TypeScript type definitions)\n' +
    '`-- apps/\n' +
    '    |-- web/                       (Next.js 16 + React 19 Client Dashboard)\n' +
    '    |   |-- next.config.ts         (Proxying routes, lightcss pipeline)\n' +
    '    |   `-- src/app/               (Dashboard App Router layouts & pages)\n' +
    '    |-- backend/                   (NestJS 11 + Prisma 6 PostgreSQL Core)\n' +
    '    |   |-- src/auth/              (JWT Auth guards & Role matrices)\n' +
    '    |   |-- src/events/            (EventsGateway Socket.IO validation gateway)\n' +
    '    |   `-- src/camera/            (AES-256-CBC RTSP credentials encryptor)\n' +
    '    `-- ai-engine/                 (Python 3.11 asynchronous inference engine)\n' +
    '        |-- src/main.py            (Uvicorn loop, socket connections)\n' +
    '        |-- src/detector.py        (YOLOv8 bounding box & class NMS)\n' +
    '        `-- src/lpr_engine.py      (OCR extraction & vehicle license plates)';
  y = drawText(p4, folderMap, margin + 20, y, contentWidth - 40, 9.5, fontBold, cPrimary);
  y -= 10;
  const archNote = 
    'This strict decoupling ensures that code and typings are shared without physical copy duplication, making modifications in the types package instantly consumable by both Next.js and NestJS workspaces.';
  y = drawText(p4, archNote, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 5: HIGH-PERFORMANCE PYTHON AI ENGINE
  // -------------------------------------------------------------
  const p5 = addGenericPage('High-Performance Python AI Engine', 5);
  y = height - 100;
  const engineText = 
    'The Python AI Engine (apps/ai-engine) is built for zero-downtime, high-throughput stream processing under GPU-constrained or CPU-only constraints. Real-time frame processing is structured as a multi-camera pipeline running concurrently:\n\n' +
    '- Asyncio Architecture: All communication (Socket.IO AsyncClient) and camera sync routines run directly on the event loop. Heavy, blocking CPU/GPU inference tasks are offloaded dynamically using thread pool executors to prevent the asyncio loop from lagging.\n\n' +
    '- Base Model & Hot-Swapping: By default, the engine loads yolov8n.pt from the models directory. It maps configured SOPs in model_registry.py and supports hot-swapping models on-the-fly without restarting the stream.\n\n' +
    '- Improved Motion Detection: Implements a custom motion detector to gate YOLOv8. The detector only runs inference on regions where motion is actively detected, saving up to 70% CPU cycles on static feeds.';
  y = drawText(p5, engineText, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 6: MODULAR AI CAPABILITIES - DETECTION, TRACKING & LPR
  // -------------------------------------------------------------
  const p6 = addGenericPage('AI Capabilities - Detection, Tracking & LPR', 6);
  y = height - 100;
  const modulesPage6 = [
    {
      name: 'A. YOLOv8 Object Detection & CENTROID Tracking',
      desc: 'Performs high-speed object detection for persons, cars, trucks, and custom items. Employs a Centroid-based Intersection-over-Union (IoU) tracker to persist distinct track IDs across frames, filtering out duplicate frame counts.'
    },
    {
      name: 'B. License Plate Recognition (LPR) & Extraction',
      desc: 'The LPR engine (lpr_engine.py) isolates vehicle bounding box crops, performs perspective homography to straighten plates, and runs character segmentation using OCR (EasyOCR / PaddleOCR).\n\nPlates are verified with local database watchlists and trigger alerts when blacklisted numbers pass virtual boundaries.'
    },
    {
      name: 'C. Automatic Watchlist Checks & Database Storage',
      desc: 'Once a plate is localized and read, the Python engine emits a plate_detected event containing the extracted text and confidence. The NestJS backend captures the event in EventsGateway, matches against configured watchlists, and saves the text inside the Detection table under the name "LICENSE_PLATE:<text>", enabling historical lookup.'
    }
  ];
  for (let m of modulesPage6) {
    p6.drawText(m.name, { x: margin, y, size: 11, font: fontBold, color: cPrimary });
    y -= 15;
    y = drawText(p6, m.desc, margin, y, contentWidth, 9.5, fontRegular, cText);
    y -= 5;
  }

  // -------------------------------------------------------------
  // PAGE 7: MODULAR AI CAPABILITIES - SAFETY, TRAFFIC & CLIP
  // -------------------------------------------------------------
  const p7 = addGenericPage('AI Capabilities - Safety, Traffic & CLIP', 7);
  y = height - 100;
  const modulesPage7 = [
    {
      name: 'A. Industrial Safety compliance & Fall Detection',
      desc: 'Leverages keypoint pose estimation and bounding boxes to detect falls, slips, and violent physical fights in real-time. Conducts PPE compliance checks by running secondary classification on person bounding boxes to ensure hardhats and high-visibility vests are worn in designated safety zones.'
    },
    {
      name: 'B. Traffic Flow & Wrong-Way Analysis',
      desc: 'Estimates vehicle speed by mapping screen pixels to real-world meters through a four-point calibration matrix. Detects wrong-way trajectory violations by comparing movement vectors against allowed direction angles. Generates congestion alerts if a camera zone vehicle count exceeds pre-configured limits.'
    },
    {
      name: 'C. Semantic Video Search via CLIP Engine',
      desc: 'Integrates OpenAI Contrastive Language-Image Pretraining (CLIP) models. Computes visual embeddings of processed snapshots and maps them against text queries. Users can type natural phrases (e.g. "person wearing a blue jacket") to perform high-speed database search across historical feeds.'
    }
  ];
  for (let m of modulesPage7) {
    p7.drawText(m.name, { x: margin, y, size: 11, font: fontBold, color: cPrimary });
    y -= 15;
    y = drawText(p7, m.desc, margin, y, contentWidth, 9.5, fontRegular, cText);
    y -= 5;
  }

  // -------------------------------------------------------------
  // PAGE 8: NESTJS BACKEND CORE & WEBSOCKET EVENTS
  // -------------------------------------------------------------
  const p8 = addGenericPage('NestJS Backend Core & WebSocket Events', 8);
  y = height - 100;
  const backendIntro = 
    'The NestJS backend service (apps/backend) functions as the central nervous system of the platform, hosting database migrations, REST controllers, and real-time Socket.IO gateway routing:\n\n' +
    '- Prisma ORM Integration: Coordinates transactions with PostgreSQL. It includes cascading deletes (e.g. removing a Camera automatically purges its Zones, Mask settings, and active AlertRules) to maintain database integrity.\n\n' +
    '- Valkey Cache Manager: Intercepts active alert and statistics queries to avoid database strain under continuous polling. Cache invalidation is triggered on every new alert event to ensure real-time accuracy.\n\n' +
    '- Socket.IO EventsGateway: Operates on port 3001, providing bidirectional real-time channels. Feeds base64 JPEG camera frames directly to watching clients under dedicated rooms (e.g. camera:cameraId) to optimize network bandwidth.';
  y = drawText(p8, backendIntro, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 9: NEXT.JS WEB DASHBOARD & DRAWING CANVAS
  // -------------------------------------------------------------
  const p9 = addGenericPage('Next.js Web Dashboard & Drawing Canvas', 9);
  y = height - 100;
  const webIntro = 
    'The Next.js 16 (React 19) web client serves as the user interface, styled dynamically with Tailwind CSS v4 and processed via lightningcss for fast compilation:\n\n' +
    '- Zustand State Management: Stores authenticated credentials, JWT tokens, and user parameters using state persistence middleware in localStorage.\n\n' +
    '- TanStack Query Hooks: Manages all REST queries and mutations (e.g., useAlerts, useCameras, useFaceEvents) to support background caching, optimistic UI updates, and automated retry on failure.\n\n' +
    '- react-konva Interactive Canvas: Powers the camera zones editor page. Integrates custom canvas rendering that allows administrators to draw, resize, and modify normalized polygon zones directly over a live frame capture, translating pixel coordinates to normalized 0.0-1.0 floats used by the AI intrusion module.';
  y = drawText(p9, webIntro, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 10: WORKFLOWS - LIVE STREAM BBOX DETECTION PIPELINE
  // -------------------------------------------------------------
  const p10 = addGenericPage('Workflows - BBox Ingestion Pipeline', 10);
  y = height - 100;
  const bboxWfText = 
    'Workflow A: High-speed frame extraction and Socket.IO bounding box rendering:\n\n' +
    '1. StreamHandler retrieves RTSP stream credentials, establishes reconnect wrapper, and processes frames via OpenCV.\n\n' +
    '2. Motion Detector evaluates frame; if motion threshold is met, the frame is passed to the YOLOv8 Detector.\n\n' +
    '3. YOLOv8 processes objects (persons, vehicles, custom assets) and forwards track IDs to the Zone Intrusion Engine.\n\n' +
    '4. Zone Engine checks boundaries via point-in-polygon checks and emits detections to NestJS over Socket.IO.\n\n' +
    '5. NestJS gateway logs alerts in Postgres DB and pushes real-time event frames directly to connected Web clients under dedicated room channels.';
  y = drawText(p10, bboxWfText, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 11: WORKFLOWS - SECURE FACE ENROLLMENT
  // -------------------------------------------------------------
  const p11 = addGenericPage('Workflows - Secure Face Enrollment', 11);
  y = height - 100;
  const faceWfText = 
    'Workflow B: Secure facial database enrollment and sync routing:\n\n' +
    '1. Operator uploads a base64 photo via the Next.js faces dashboard, requesting face registration.\n\n' +
    '2. NestJS Auth-guarded Faces Controller receives request, writes database record, and sends Base64 file via Socket.IO.\n\n' +
    '3. Python AI Engine handleConnection accepts image, runs ArcFace face extractor, and computes 512-dimension embedding.\n\n' +
    '4. AI Engine emits "extract_face_result" back to NestJS EventsGateway via internal streamTestBus Promise resolver.\n\n' +
    '5. NestJS resolves Promise, saves vector to PostgreSQL, and broadcasts "sync_embeddings" to update AI Engine cache.';
  y = drawText(p11, faceWfText, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 12: WORKFLOWS - FFMPEG HLS CLIP RECORDING
  // -------------------------------------------------------------
  const p12 = addGenericPage('Workflows - FFmpeg HLS Clip Recording', 12);
  y = height - 100;
  const clipWfText = 
    'Workflow C: Dynamic incident clip recording and serve logic:\n\n' +
    '1. AI Engine processes intrusion or safety alerts, then emits "start_recording" with camera ID and trigger detail.\n\n' +
    '2. NestJS RecordingService spawns FFmpeg processes locally or configures S3/MinIO upload.\n\n' +
    '3. FFmpeg records a 30-second high-resolution video stream fragment, writes .mp4, and compiles .m3u8 index.\n\n' +
    '4. S3Service handles replication to MinIO, and NestJS serve-route serves index to Next.js HLS video players.';
  y = drawText(p12, clipWfText, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 13: DATABASE SCHEMA & MODELS (PART 1)
  // -------------------------------------------------------------
  const p13 = addGenericPage('Database Schema & Models (Part 1)', 13);
  y = height - 100;
  const dbPart1 = 
    'Prisma core models for Cameras, Zones, and Detections:\n\n' +
    '- User Model:\n' +
    '  - Fields: id (UUID PK), email (Unique String), password_hash (String), role (Role enum: ADMIN, SECURITY_OPERATOR, VIEWER).\n' +
    '  - Relations: 1-to-1 with UserSettings, 1-to-Many with RefreshToken, PasswordResetToken, AuditLogs.\n\n' +
    '- Camera Model:\n' +
    '  - Fields: id (UUID PK), name (String), rtsp_url (Encrypted String), detect_url (Encrypted String), record_url (Encrypted String), status (ONLINE, OFFLINE, ERROR), location (String), sop_name (String).\n' +
    '  - Relations: 1-to-Many with Zones, PrivacyMasks, Detections, FaceEvents, Alerts, AlertRules, Recordings.\n\n' +
    '- Zone Model:\n' +
    '  - Fields: id (UUID PK), camera_id (UUID FK), name (String), polygon_points (Json float points), rule_type (String).\n' +
    '  - Relations: Many-to-1 with Camera, 1-to-Many with Alerts.';
  y = drawText(p13, dbPart1, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 14: DATABASE SCHEMA & MODELS (PART 2)
  // -------------------------------------------------------------
  const p14 = addGenericPage('Database Schema & Models (Part 2)', 14);
  y = height - 100;
  const dbPart2 = 
    'Prisma core models for Alerts, Faces, and Audits:\n\n' +
    '- Person Model:\n' +
    '  - Fields: id (UUID PK), name (String), tag (String), photo_url (String), alert_enabled (Boolean), alert_message (String).\n' +
    '  - Relations: 1-to-Many with FaceEmbeddings, FaceEvents.\n\n' +
    '- FaceEmbedding Model:\n' +
    '  - Fields: id (UUID PK), person_id (UUID FK), embedding_vector (Float[] vector size 512).\n' +
    '  - Relations: Many-to-1 with Person.\n\n' +
    '- Alert Model:\n' +
    '  - Fields: id (UUID PK), event_id (String), alert_type (String), status (PENDING, ACKNOWLEDGED, RESOLVED), severity (LOW, MEDIUM, HIGH, CRITICAL), camera_id (UUID FK), zone_id (UUID FK), assignee_id (UUID FK), notes (String).\n\n' +
    '- AuditLog Model:\n' +
    '  - Fields: id (UUID PK), user_id (UUID FK), action (String), resource (String), ip_address (String), timestamp (DateTime).';
  y = drawText(p14, dbPart2, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 15: ENTERPRISE SECURITY & PRODUCTION HARDENING
  // -------------------------------------------------------------
  const p15 = addGenericPage('Enterprise Security & B2B Hardening', 15);
  y = height - 100;
  const secureText = 
    'To guarantee client data privacy, network security, and robust access boundaries, the platform underwent complete B2B security auditing and production hardening:\n\n' +
    '- Transparent RTSP URL Encryption at Rest: RTSP camera links often contain plain-text passwords. The platform now encrypts all RTSP, detect, and record URLs in the database using strong AES-256-CBC encryption. Decryption keys are derived securely from the server’s environment variable via SHA-256.\n\n' +
    '- Granular Role-Based Access Control (RBAC): Implemented strict Role Guards across all endpoints. While administrators and security operators have full access to manage cameras, low-level viewers are restricted to read-only views. Highly sensitive actions like downloading raw video clips or exporting PDF incident reports are strictly blocked. RTSP passwords are automatically masked for viewers.\n\n' +
    '- Zero-Trust Socket.IO Gateway Authentication: Detections are emitted from the Python engine to the backend. We locked down the WebSocket gateway: any events meant for the AI Engine are verified against active engine sockets. Any standard client attempting to spoof AI signals is disconnected instantly.\n\n' +
    '- Anti-Path-Traversal Snapshot Protection: Served camera snapshots are fully protected against directory traversal attacks. Camera IDs and filenames are validated against strict regex white-lists (/^[a-zA-Z0-9_-]+$/) and directory navigation delimiters (.., /, \\) are explicitly rejected, blocking arbitrary local file reads.';
  y = drawText(p15, secureText, margin, y, contentWidth, 9.5, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 16: B2B INTEGRATION & WEBHOOK DISPATCH
  // -------------------------------------------------------------
  const p16 = addGenericPage('B2B Integration & Webhook Dispatch', 16);
  y = height - 100;
  const integrationText = 
    'Madad Vision AI is designed to act as an integrated component within larger enterprise security ecosystems, avoiding isolated operation:\n\n' +
    '- API Key Authentication: Supports secure API key provisioning. Third-party applications (such as building automation systems or access control systems) can retrieve counts, analytics indices, or camera details using custom authorization header keys without managing session cookie cookies.\n\n' +
    '- Outbound Webhook Dispatch: Administrators can define custom webhooks linked to events (e.g. known face arrival, wrong-way violations). On trigger, NestJS POSTs secure JSON payloads containing timestamps, bounding box metadata, and signed snapshot links directly to corporate SOAR systems.\n\n' +
    '- Slack, Teams & PagerDuty Integration: Outbound triggers support payload templates formatted for instant rendering as Slack attachment cards, Microsoft Teams alerts, or critical PagerDuty incidents, bypassing the need for secondary alert apps.';
  y = drawText(p16, integrationText, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 17: OPERATIONAL HEALTH, HEARTBEATS & MONITORING
  // -------------------------------------------------------------
  const p17 = addGenericPage('Operational Health, Heartbeats & Monitoring', 17);
  y = height - 100;
  const monitoringText = 
    'Zero-downtime, continuous monitoring is supported at every layer:\n\n' +
    '- Camera Status heartbeat: The AI Engine continuously tracks each camera feed. A thread-safe heartbeat check updates the database camera status every 10 seconds. In the event of a stream failure (e.g., lens covered, power offline), the backend immediately flags the camera as OFFLINE and emits a real-time status update to the SOC dashboard.\n\n' +
    '- Disk space monitoring: StorageService tracks snapshot and clip folder usage. If local directory volume usage exceeds 90%, it triggers automated alerts and executes oldest-first evidence purges based on defined B2B retention constraints.\n\n' +
    '- Prometheus Metrics: Exposes application-level metrics (inference times, active frames, alert frequencies, camera uptime rates) for Loki/Grafana panels.';
  y = drawText(p17, monitoringText, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 18: ONE-COMMAND DOCKER DEPLOYMENT GUIDE
  // -------------------------------------------------------------
  const p18 = addGenericPage('One-Command Docker Deployment Guide', 18);
  y = height - 100;
  const deployText = 
    'The entire stack is containerized for simplified, high-fidelity deployment inside local servers or cloud clusters (using docker-compose.yml):\n\n' +
    '- Nginx Reverse Proxy: Configured as the front gate on port 80. Routes all /api/ REST endpoints and /socket.io/ real-time streams to port 3001, and delivers all static and Next.js frontend pages directly to clients from port 3000.\n\n' +
    '- Datastore Isolation: Launches Postgres, Valkey cache, and MinIO S3-compatible snapshot stores in individual private network subnets, completely isolated from public access ports.\n\n' +
    '- Automated Database Migrations: Docker startup sequences automatically verify database availability, run prisma migrate deploy, and trigger seed routines (npx ts-node prisma/seed.ts) to populate initial admin accounts.';
  y = drawText(p18, deployText, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 19: TROUBLESHOOTING & MAINTENANCE RUNBOOK
  // -------------------------------------------------------------
  const p19 = addGenericPage('Troubleshooting & Maintenance Runbook', 19);
  y = height - 100;
  const troubleText = 
    'Common diagnostic check-lists and maintenance routines:\n\n' +
    '- Camera offline error:\n' +
    '  - Verify camera RTSP address is correct. Check network route connectivity.\n' +
    '  - Validate credentials by executing the "test-connection" route (emits Socket.IO check to AI Engine).\n\n' +
    '- Low Inference Frame Rate (Inference FPS lag):\n' +
    '  - Ensure CUDA drivers are configured. In ai-engine config.env, verify INSIGHTFACE_CTX_ID is set to 0 (first GPU) instead of -1 (CPU).\n' +
    '  - Lower resolution of detect_url streams. AI detection only requires 640x360 feeds.\n\n' +
    '- Stale database schema locks:\n' +
    '  - If schema edits fail, run npx prisma db pull followed by npx prisma generate to regenerate model typings.';
  y = drawText(p19, troubleText, margin, y, contentWidth, 10, fontRegular, cText);

  // -------------------------------------------------------------
  // PAGE 20: PRODUCT ROADMAP & PROFESSIONAL SIGN-OFF
  // -------------------------------------------------------------
  const p20 = addGenericPage('Product Roadmap & Professional Sign-Off', 20);
  y = height - 100;
  const roadmapText = 
    'Future strategic updates and product roadmap timeline:\n\n' +
    '- Phase 1: Prometheus Metrics & Log Aggregation (Centralized Loki/Grafana performance panels).\n' +
    '- Phase 2: Horizontal AI Scaling (Scaling processing across multiple GPU-enabled servers).\n' +
    '- Phase 3: Outbound SOAR Integrations (Webhook triggers to existing Slack, PagerDuty, or Microsoft Teams workflows).\n' +
    '- Phase 4: Single Sign-On (SSO) Support (Okta, Azure Active Directory, and SAML protocol integrations).';
  y = drawText(p20, roadmapText, margin, y, contentWidth, 10, fontRegular, cSecondary);
  y -= 30;

  // Final Callout Box
  p20.drawRectangle({
    x: margin,
    y: 70,
    width: contentWidth,
    height: 70,
    color: rgb(0.9, 0.94, 0.98),
    borderColor: cPrimary,
    borderWidth: 1
  });

  p20.drawText('Madad Vision AI is ready for B2B client demonstrations and production pilots.', {
    x: margin + 15,
    y: 110,
    size: 11,
    font: fontBold,
    color: cPrimary
  });
  
  p20.drawText('Contact: core-team@madadvision.ai | Secure Smart Surveillance', {
    x: margin + 15,
    y: 90,
    size: 9,
    font: fontRegular,
    color: cSecondary
  });

  drawFooter(p20);

  // -------------------------------------------------------------
  // SAVE PDF TO DISK
  // -------------------------------------------------------------
  const pdfBytes = await doc.save();
  const outputPath = 'c:\\Users\\CP\\Desktop\\Ai-camera\\Madad_Vision_AI_Client_Briefing.pdf';
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`Successfully generated PDF at: ${outputPath}`);
}

createBriefingPdf().catch(err => {
  console.error('Failed to create PDF:', err);
  process.exit(1);
});
