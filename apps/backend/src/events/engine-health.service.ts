import { Injectable } from '@nestjs/common';

type ModelState = 'READY' | 'UNAVAILABLE' | 'ERROR' | 'UNKNOWN';
interface EngineReport {
  lastSeen: number | null;
  objectDetection: ModelState;
  faceRecognition: ModelState;
}

@Injectable()
export class EngineHealthService {
  private readonly engines = new Map<string, EngineReport>();

  connect(id: string): void {
    this.engines.set(id, { lastSeen: null, objectDetection: 'UNKNOWN', faceRecognition: 'UNKNOWN' });
  }

  disconnect(id: string): void {
    this.engines.delete(id);
  }

  report(id: string, payload: unknown): boolean {
    if (!this.engines.has(id) || !payload || typeof payload !== 'object') return false;
    const input = payload as Record<string, unknown>;
    const parse = (value: unknown): ModelState | null => {
      if (!value || typeof value !== 'object') return null;
      const model = value as Record<string, unknown>;
      if (typeof model.loaded !== 'boolean' || ![null, 'MODEL_UNAVAILABLE', 'INFERENCE_FAILED'].includes(model.error as any)) return null;
      return !model.loaded ? 'UNAVAILABLE' : model.error ? 'ERROR' : 'READY';
    };
    const objectDetection = parse(input.object_detection);
    const faceRecognition = parse(input.face_recognition);
    if (!objectDetection || !faceRecognition) return false;
    this.engines.set(id, { lastSeen: Date.now(), objectDetection, faceRecognition });
    return true;
  }

  snapshot() {
    const engines = [...this.engines].map(([id, report]) => {
      const stale = report.lastSeen === null || Date.now() - report.lastSeen > 65_000;
      return { id, lastSeen: report.lastSeen, stale,
        objectDetection: stale ? 'UNKNOWN' : report.objectDetection,
        faceRecognition: stale ? 'UNKNOWN' : report.faceRecognition };
    });
    const status = engines.length === 0 ? 'OFFLINE' : engines.some((engine) => engine.stale) ? 'UNKNOWN' :
      engines.every((engine) => engine.objectDetection === 'READY' && engine.faceRecognition === 'READY') ? 'READY' : 'DEGRADED';
    return { status, engines };
  }
}
