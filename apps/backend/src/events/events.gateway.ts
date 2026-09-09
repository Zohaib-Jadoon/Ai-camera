import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import { AiEventsService } from '../ai-events/ai-events.service';
import { AlertsService } from '../alerts/alerts.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Detection } from '@madad/types';
import { CameraService } from '../camera/camera.service';
import { FacesService } from '../faces/faces.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecordingService } from '../recording/recording.service';
import { ModuleRef } from '@nestjs/core';
import { installSocketAuthentication } from './socket-auth';
import { EngineHealthService } from './engine-health.service';

/** Shared interface used by CameraService and ZoneService to broadcast updates. */
export interface IBroadcastGateway {
  broadcastCameraSync(): Promise<void>;
  broadcastZoneSync(cameraId: string): Promise<void>;
  isAiEngineConnected(): boolean;
  /** Internal bus: resolves pending stream-test promises by request_id. */
  readonly streamTestBus: EventEmitter;
  extractFaceEmbedding(imageB64: string): Promise<number[]>;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : '*',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EventsGateway');

  /** Tracks socket IDs that belong to the AI Engine (no JWT). */
  private aiEngineSockets = new Set<string>();
  private sessionTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Internal EventEmitter used to resolve stream-test result Promises. */
  readonly streamTestBus = new EventEmitter();

  private cameraService: CameraService;
  private facesService: FacesService;

  constructor(
    private aiEventsService: AiEventsService,
    private alertsService: AlertsService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private recordingService: RecordingService,
    private moduleRef: ModuleRef,
    private engineHealth: EngineHealthService = new EngineHealthService(),
  ) {}

  onModuleInit() {
    this.cameraService = this.moduleRef.get(CameraService, { strict: false });
    this.facesService = this.moduleRef.get(FacesService, { strict: false });
  }

  afterInit(server: Server): void {
    installSocketAuthentication(server, this.configService, this.jwtService, this.prisma);
  }

  handleConnection(client: Socket): void {
    if (client.data.authenticatedEngine === true) {
      this.aiEngineSockets.add(client.id);
      this.engineHealth.connect(client.id);
      this.logger.log(`AI Engine connected: ${client.id}`);
      return;
    }
    const expiresAt = client.data.expiresAt;
    if (!client.data.user || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
      client.disconnect(true);
      return;
    }
    // Recheck long lifetimes in bounded intervals to avoid Node timer overflow.
    const expire = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        this.sessionTimers.delete(client.id);
        client.emit('session_expired');
        client.disconnect(true);
        return;
      }
      const timer = setTimeout(expire, Math.min(remaining, 2_147_483_647));
      timer.unref();
      this.sessionTimers.set(client.id, timer);
    };
    expire();
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    clearTimeout(this.sessionTimers.get(client.id));
    this.sessionTimers.delete(client.id);
    this.aiEngineSockets.delete(client.id);
    this.engineHealth.disconnect(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private verifyAiEngine(client: Socket): boolean {
    if (!this.aiEngineSockets.has(client.id)) {
      this.logger.warn(`Rejected unauthorized AI Engine event from client ${client.id}`);
      client.disconnect(true);
      return false;
    }
    return true;
  }

  /** True when at least one AI Engine socket is connected. */
  isAiEngineConnected(): boolean {
    return this.aiEngineSockets.size > 0;
  }

  /** Socket IDs are private rooms; only authenticated engine IDs receive secrets. */
  emitToAiEngines(event: string, payload: unknown): void {
    for (const socketId of this.aiEngineSockets) {
      this.server.to(socketId).emit(event, payload);
    }
  }

  @SubscribeMessage('detection')
  async handleDetection(client: Socket, payload: Detection): Promise<void> {
    if (!this.verifyAiEngine(client)) return;
    this.logger.log(`Detection: ${payload.object_type} cam=${payload.camera_id}`);

    try {
      const detection = await this.aiEventsService.createDetection({
        camera_id: payload.camera_id,
        object_type: payload.object_type,
        confidence: payload.confidence,
        timestamp: new Date(payload.timestamp),
        snapshot_url: payload.snapshot_url,
      });

      // Create an Alert row so the alerts dashboard shows it
      await this.alertsService.createFromDetection(detection).catch((err) =>
        this.logger.error(`Failed to create alert for detection: ${err.message}`),
      );

      this.server.emit('alert', { ...payload, detection_id: detection.id });
    } catch (err) {
      this.logger.error(`Failed to persist detection: ${err.message}`);
    }
  }

  @SubscribeMessage('engine_health')
  handleEngineHealth(client: Socket, payload: unknown): void {
    if (!this.verifyAiEngine(client)) return;
    this.engineHealth.report(client.id, payload);
  }

  @SubscribeMessage('face_event')
  async handleFaceEvent(client: Socket, payload: any): Promise<void> {
    if (!this.verifyAiEngine(client)) return;
    this.logger.log(`Received face event: ${JSON.stringify(payload)}`);

    try {
      await this.aiEventsService.createFaceEvent({
        camera_id: payload.camera_id,
        person_id: payload.person_id,
        confidence: payload.confidence,
        timestamp: new Date(payload.timestamp),
      });

      // Custom alert for known persons
      if (payload.is_known && payload.person_name) {
        const alertMessage = payload.alert_message || `Person Identified: ${payload.person_name}`;
        try {
          await this.alertsService.create({
            event_id: `face-${payload.person_id || payload.person_name}-${Date.now()}`,
            alert_type: 'KNOWN_FACE_ARRIVAL',
            camera_id: payload.camera_id,
            object_type: 'KNOWN_FACE',
            rule_type: payload.person_name,
          });
          // Emit specific notification for real-time UI toast
          this.server.emit('person_alert', {
            person_id: payload.person_id,
            person_name: payload.person_name,
            message: alertMessage,
            camera_id: payload.camera_id,
            confidence: payload.confidence,
            timestamp: payload.timestamp,
          });
        } catch (err) {
          this.logger.error(`Failed to create person alert: ${err.message}`);
        }
      }

      this.server.emit('alert', {
        ...payload,
        object_type: payload.is_known ? 'KNOWN_FACE' : 'UNKNOWN_FACE',
      });
    } catch (err) {
      this.logger.error(`Failed to persist face event: ${err.message}`);
    }
  }

  @SubscribeMessage('intrusion')
  async handleIntrusion(client: Socket, payload: any): Promise<void> {
    if (!this.verifyAiEngine(client)) return;
    this.logger.log(`Intrusion: cam=${payload.camera_id} zone=${payload.zone_id}`);

    // Persist to Alert table so it appears in the dashboard
    try {
      await this.alertsService.create({
        event_id: `intrusion-${payload.camera_id}-${Date.now()}`,
        alert_type: 'INTRUSION',
        camera_id: payload.camera_id,
        zone_id: payload.zone_id,
      });
    } catch (err) {
      this.logger.error(`Failed to persist intrusion alert: ${err.message}`);
    }

    this.server.emit('alert', {
      ...payload,
      object_type: 'INTRUSION',
    });
  }

  @SubscribeMessage('join-camera')
  handleJoinCamera(client: Socket, cameraId: string) {
    client.join(`camera:${cameraId}`);
    this.logger.log(`Client ${client.id} joined room camera:${cameraId}`);
  }

  @SubscribeMessage('leave-camera')
  handleLeaveCamera(client: Socket, cameraId: string) {
    client.leave(`camera:${cameraId}`);
    this.logger.log(`Client ${client.id} left room camera:${cameraId}`);
  }

  @SubscribeMessage('request_cameras')
  async handleRequestCameras(client: Socket) {
    // Camera configuration contains credentials and is only for authenticated engines.
    if (!this.verifyAiEngine(client)) return;
    try {
      const cameras = await this.cameraService.findAll();
      // Include privacy masks in each camera payload so the AI Engine can
      // black-out sensitive regions before running YOLO / FaceEngine (🐦 Frigate)
      const camerasWithMasks = await Promise.all(
        cameras.map(async (cam) => {
          const masks = await this.prisma.privacyMask.findMany({
            where: { camera_id: cam.id },
            select: { x: true, y: true, width: true, height: true, label: true },
          });
          return { ...cam, privacy_masks: masks };
        }),
      );
      client.emit('sync_cameras', camerasWithMasks);
      this.logger.log(`Sent ${camerasWithMasks.length} cameras (with privacy masks) to client ${client.id}`);
    } catch (err) {
      this.logger.error(`Failed to fetch cameras: ${err.message}`);
    }
  }

  @SubscribeMessage('request_embeddings')
  async handleRequestEmbeddings(client: Socket) {
    if (!this.verifyAiEngine(client)) return;
    try {
      const embeddings = await this.facesService.getAllEmbeddings();
      client.emit('sync_embeddings', embeddings);
      this.logger.log(`Sent ${embeddings.length} face embeddings to AI Engine via socket`);
    } catch (err) {
      this.logger.error(`Failed to fetch embeddings for AI Engine: ${err.message}`);
    }
  }

  /**
   * Broadcast the full camera list to all connected AI Engine sockets.
   * Called after any camera create / update / delete mutation.
   */
  async broadcastCameraSync(): Promise<void> {
    try {
      const cameras = await this.cameraService.findAll();
      const camerasWithMasks = await Promise.all(
        cameras.map(async (cam) => {
          const masks = await this.prisma.privacyMask.findMany({
            where: { camera_id: cam.id },
            select: { x: true, y: true, width: true, height: true, label: true },
          });
          return { ...cam, privacy_masks: masks };
        }),
      );
      this.emitToAiEngines('sync_cameras', camerasWithMasks);
      this.logger.log(`Sent sync_cameras (${camerasWithMasks.length} cameras) to authenticated engines`);
    } catch (err) {
      this.logger.error(`broadcastCameraSync failed: ${err.message}`);
    }
  }

  /**
   * Broadcast a zone update for a specific camera to all clients.
   * Called after zone create / update / delete.
   */
  async broadcastZoneSync(cameraId: string): Promise<void> {
    try {
      // Use findOne which includes { zones: true } — cast needed because
      // the base Camera type doesn't declare the relation field.
      const camera = (await this.cameraService.findOne(cameraId)) as any;
      if (!camera) return;
      this.server.emit('sync_zones', { camera_id: cameraId, zones: camera.zones ?? [] });
      this.logger.log(`Broadcast sync_zones for camera ${cameraId}`);
    } catch (err) {
      this.logger.error(`broadcastZoneSync failed: ${err.message}`);
    }
  }

  /**
   * Relay stream test results from the AI Engine back to HTTP callers.
   * Emits on the internal streamTestBus so CameraService's awaiting Promise resolves.
   */
  @SubscribeMessage('stream_test_result')
  handleStreamTestResult(_client: Socket, payload: any): void {
    if (!this.verifyAiEngine(_client)) return;
    this.logger.debug('Received stream test result from authenticated engine');
    // Emit on internal bus so CameraService.testConnection() resolves the right promise
    this.streamTestBus.emit(payload?.request_id, payload);
  }

  /**
   * Relay face embedding extraction results from the AI Engine back to
   * the awaiting extractFaceEmbedding() Promise via streamTestBus.
   * Without this handler the Promise just times out after 15 s.
   */
  @SubscribeMessage('extract_face_result')
  handleExtractFaceResult(_client: Socket, payload: any): void {
    if (!this.verifyAiEngine(_client)) return;
    this.logger.log(
      `Face extraction result: request_id=${payload?.request_id} ` +
        `embedding_length=${payload?.embedding?.length ?? 0} error=${payload?.error ?? 'none'}`,
    );
    this.streamTestBus.emit(payload?.request_id, payload);
  }


  async extractFaceEmbedding(imageB64: string): Promise<number[]> {
    if (!this.isAiEngineConnected()) {
      throw new Error('AI Engine is not connected');
    }
    
    const requestId = `extract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      // Setup listener on the internal bus
      const onResult = (result: any) => {
        if (result.error) {
          reject(new Error(result.error));
        } else if (!result.embedding) {
          reject(new Error('No embedding returned'));
        } else {
          resolve(result.embedding);
        }
      };
      
      this.streamTestBus.once(requestId, onResult);
      
      // Emit to AI Engine
      this.emitToAiEngines('extract_face', { request_id: requestId, image_b64: imageB64 });
      
      // Timeout after 15 seconds
      setTimeout(() => {
        this.streamTestBus.removeListener(requestId, onResult);
        reject(new Error('Face extraction timed out'));
      }, 15000);
    });
  }

  /**
   * AI Engine heartbeat — updates camera ONLINE/OFFLINE status in DB and
   * broadcasts the change to all web dashboard clients in real-time.
   *
   * Payload: { camera_id: string, status: 'ONLINE' | 'OFFLINE' }
   *
   * Uses updateMany so it is a no-op when the camera_id doesn't exist
   * (e.g. stale ID cached by the AI Engine after a camera was deleted).
   * This replaces update() which throws Prisma P2025 in that case.
   */
  @SubscribeMessage('camera_status')
  async handleCameraStatus(_client: Socket, payload: any): Promise<void> {
    if (!this.verifyAiEngine(_client)) return;
    const { camera_id, status } = payload ?? {};
    if (!camera_id || !status) return;

    try {
      const result = await this.prisma.camera.updateMany({
        where: { id: camera_id },
        data: { status },
      });

      if (result.count === 0) {
        // Camera was deleted from DB but AI Engine still has its ID cached —
        // log once at debug level instead of ERROR-spamming every heartbeat.
        this.logger.debug(
          `camera_status ignored: camera ${camera_id} not found in DB (stale AI Engine cache)`,
        );
        return;
      }

      // Push real-time status update to all connected web clients
      this.server.emit('camera_status', { camera_id, status });
      this.logger.log(`Camera ${camera_id} status → ${status}`);
    } catch (err) {
      this.logger.error(`Failed to update camera status: ${err.message}`);
    }
  }

  /**
   * Relay live JPEG frames from the AI Engine to web clients watching the camera.
   * AI Engine emits: { camera_id: string, data: string (base64 JPEG) }
   * Backend forwards to room `camera:{camera_id}` only (not broadcast to all).
   */
  @SubscribeMessage('frame')
  handleFrame(_client: Socket, payload: any): void {
    if (!this.verifyAiEngine(_client)) return;
    const { camera_id, data } = payload ?? {};
    if (!camera_id || !data) return;
    // Only deliver to clients that have joined this camera's room
    this.server.to(`camera:${camera_id}`).emit('frame', { camera_id, data });
  }

  /**
   * 🐦 Frigate recording: AI Engine emits `start_recording` when detections fire.
   * Persists a Recording row; FFmpeg clip is stubbed in RecordingService.
   *
   * Payload: { camera_id, duration_sec, trigger, record_url }
   */
  @SubscribeMessage('start_recording')
  async handleStartRecording(_client: Socket, payload: any): Promise<void> {
    if (!this.verifyAiEngine(_client)) return;
    const { camera_id, trigger, duration_sec, record_url } = payload ?? {};
    if (!camera_id || !trigger) return;
    try {
      await this.recordingService.startClip(camera_id, trigger, duration_sec ?? 30, record_url);
      this.logger.log(`Recording started for camera ${camera_id} trigger=${trigger}`);
    } catch (err) {
      this.logger.error('Failed to start recording');
    }
  }


  // ── Advanced AI Event Handlers ──────────────────────────────────────────

  /**
   * Traffic congestion alert from AI Engine.
   * Payload: { camera_id, zone_id, zone_name, vehicle_count, level, timestamp }
   */
  @SubscribeMessage('congestion')
  async handleCongestion(_client: Socket, payload: any): Promise<void> {
    if (!this.verifyAiEngine(_client)) return;
    this.logger.warn(`Congestion ${payload?.level}: cam=${payload?.camera_id} zone=${payload?.zone_name} vehicles=${payload?.vehicle_count}`);
    try {
      await this.alertsService.create({
        event_id: `congestion-${payload.camera_id}-${Date.now()}`,
        alert_type: `CONGESTION_${payload.level}`,
        camera_id: payload.camera_id,
        zone_id: payload.zone_id,
      });
    } catch (err) {
      this.logger.error(`Failed to persist congestion alert: ${err.message}`);
    }
    this.server.emit('alert', { ...payload, object_type: `CONGESTION_${payload.level}` });
  }

  /**
   * Speed violation from AI Engine.
   * Payload: { camera_id, track_id, object_type, speed_kmh, speed_mph, timestamp }
   */
  @SubscribeMessage('speed_violation')
  async handleSpeedViolation(_client: Socket, payload: any): Promise<void> {
    if (!this.verifyAiEngine(_client)) return;
    this.logger.warn(`Speed violation: cam=${payload?.camera_id} track=${payload?.track_id} ${payload?.speed_kmh} km/h`);
    try {
      await this.alertsService.create({
        event_id: `speed-${payload.camera_id}-${payload.track_id}-${Date.now()}`,
        alert_type: 'SPEED_VIOLATION',
        camera_id: payload.camera_id,
      });
    } catch (err) {
      this.logger.error(`Failed to persist speed alert: ${err.message}`);
    }
    this.server.emit('alert', { ...payload, object_type: 'SPEED_VIOLATION' });
  }

  /**
   * Wrong-way detection from AI Engine.
   * Payload: { camera_id, track_id, object_type, line_id, line_name, timestamp }
   */
  @SubscribeMessage('wrong_way')
  async handleWrongWay(_client: Socket, payload: any): Promise<void> {
    if (!this.verifyAiEngine(_client)) return;
    this.logger.warn(`Wrong-way: cam=${payload?.camera_id} track=${payload?.track_id} line=${payload?.line_name}`);
    try {
      await this.alertsService.create({
        event_id: `wrongway-${payload.camera_id}-${payload.track_id}-${Date.now()}`,
        alert_type: 'WRONG_WAY',
        camera_id: payload.camera_id,
      });
    } catch (err) {
      this.logger.error(`Failed to persist wrong-way alert: ${err.message}`);
    }
    this.server.emit('alert', { ...payload, object_type: 'WRONG_WAY' });
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * THREAT ALERT — highest-priority path.
   * Emitted by AI Engine when knife / weapon / fight / fall is detected.
   * Broadcast to ALL connected web clients IMMEDIATELY (no DB wait on hot path).
   * Payload: { camera_id, object_type, alert_type, confidence, severity, message, timestamp }
   * ─────────────────────────────────────────────────────────────────────────
   */
  @SubscribeMessage('threat_alert')
  async handleThreatAlert(_client: Socket, payload: any): Promise<void> {
    if (!this.verifyAiEngine(_client)) return;
    const objType = payload?.object_type || 'UNKNOWN_THREAT';
    const camId = payload?.camera_id;
    this.logger.warn(`🚨 THREAT ALERT: ${objType} cam=${camId} severity=${payload?.severity}`);

    // Broadcast immediately to all web clients so UI can flash red + sound siren
    this.server.emit('threat_alert', {
      ...payload,
      object_type: objType,
      alert_type: payload?.alert_type || 'WEAPON_DETECTED',
      severity: payload?.severity || 'CRITICAL',
    });

    // Persist alert to DB asynchronously (don't await — don't block the hot path)
    this.alertsService.create({
      event_id: `threat-${camId}-${Date.now()}`,
      alert_type: payload?.alert_type || 'WEAPON_DETECTED',
      camera_id: camId,
      object_type: objType,
    }).catch((err) => this.logger.error(`Failed to persist threat alert: ${err.message}`));
  }

  /**
   * Safety events from AI Engine (fall, fight, PPE violations).
   * Payload: { camera_id, event_type, track_id?, track_ids?, violations?, confidence, timestamp }
   */
  @SubscribeMessage('safety_event')
  async handleSafetyEvent(_client: Socket, payload: any): Promise<void> {
    if (!this.verifyAiEngine(_client)) return;
    const eventType = payload?.event_type || 'SAFETY_EVENT';
    this.logger.warn(`Safety event ${eventType}: cam=${payload?.camera_id}`);
    try {
      await this.alertsService.create({
        event_id: `safety-${payload.camera_id}-${Date.now()}`,
        alert_type: eventType,
        camera_id: payload.camera_id,
      });
    } catch (err) {
      this.logger.error(`Failed to persist safety alert: ${err.message}`);
    }
    this.server.emit('alert', { ...payload, object_type: eventType });
  }

  /**
   * License plate detection from AI Engine.
   * Payload: { camera_id, track_id, object_type, plate_text, plate_confidence, timestamp }
   */
  @SubscribeMessage('plate_detected')
  async handlePlateDetected(_client: Socket, payload: any): Promise<void> {
    if (!this.verifyAiEngine(_client)) return;
    this.logger.log(`Plate detected: cam=${payload?.camera_id} plate=${payload?.plate_text}`);
    // Persist as a detection event, not necessarily an alert (informational)
    try {
      await this.aiEventsService.createDetection({
        camera_id: payload.camera_id,
        object_type: `LICENSE_PLATE:${payload.plate_text}`,
        confidence: payload.plate_confidence,
        timestamp: new Date(payload.timestamp),
      });
    } catch (err) {
      this.logger.error(`Failed to persist plate detection: ${err.message}`);
    }
    this.server.emit('plate_detected', payload);
  }

  /**
   * Cross-camera re-identification match from AI Engine.
   * Payload: { camera_id, track_id, global_id, matched_camera, similarity, sighting_count, timestamp }
   */
  @SubscribeMessage('reid_match')
  handleReIDMatch(_client: Socket, payload: any): void {
    if (!this.verifyAiEngine(_client)) return;
    this.logger.log(`ReID match: global=${payload?.global_id} cam=${payload?.camera_id} ↔ ${payload?.matched_camera} sim=${payload?.similarity}`);
    this.server.emit('reid_match', payload);
  }

  /**
   * CLIP search results from AI Engine.
   * Payload: { request_id, results, stats }
   */
  @SubscribeMessage('clip_search_result')
  handleCLIPSearchResult(_client: Socket, payload: any): void {
    if (!this.verifyAiEngine(_client)) return;
    this.logger.log(`CLIP search result: ${payload?.results?.length ?? 0} matches`);
    this.streamTestBus.emit(payload?.request_id, payload);
  }

  /**
   * Forward CLIP search requests from web clients to AI Engine.
   * Web client sends: { query: string }
   * Backend forwards to AI Engine and relays back the results.
   */
  @SubscribeMessage('search_video')
  async handleSearchVideo(client: Socket, payload: any): Promise<void> {
    const query = payload?.query;
    if (!query) {
      client.emit('search_video_result', { results: [], error: 'No query provided' });
      return;
    }

    const requestId = `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Forward to AI Engine
    this.emitToAiEngines('clip_search', { request_id: requestId, query });

    // Wait for result via internal bus
    const result = await new Promise<any>((resolve) => {
      const timeout = setTimeout(() => {
        this.streamTestBus.removeAllListeners(requestId);
        resolve({ results: [], error: 'Search timed out' });
      }, 15000);

      this.streamTestBus.once(requestId, (data: any) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    client.emit('search_video_result', result);
  }

  /**
   * Forward forecast requests from web clients to AI Engine.
   * Web client sends: { camera_id?: string }
   */
  @SubscribeMessage('request_forecast')
  async handleRequestForecast(client: Socket, payload: any): Promise<void> {
    const requestId = `forecast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Forward to AI Engine
    this.emitToAiEngines('request_forecast', {
      request_id: requestId,
      camera_id: payload?.camera_id,
    });

    // Wait for result
    const result = await new Promise<any>((resolve) => {
      const timeout = setTimeout(() => {
        this.streamTestBus.removeAllListeners(requestId);
        resolve({ forecast: [], anomalies: [], error: 'Forecast timed out' });
      }, 15000);

      this.streamTestBus.once(requestId, (data: any) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    client.emit('forecast_result', result);
  }

  /**
   * Relay forecast results from AI Engine back to requesting client.
   */
  @SubscribeMessage('forecast_result')
  handleForecastResult(_client: Socket, payload: any): void {
    if (!this.verifyAiEngine(_client)) return;
    this.logger.log(`Forecast result: ${payload?.forecast?.length ?? 0} predictions`);
    this.streamTestBus.emit(payload?.request_id, payload);
  }
}
