import { EngineHealthService } from './engine-health.service';

describe('engine readiness', () => {
  let health: EngineHealthService;
  const ready = { object_detection: { loaded: true, error: null }, face_recognition: { loaded: true, error: null } };
  beforeEach(() => { health = new EngineHealthService(); });

  it('distinguishes disconnected engines from connected but unreported engines', () => {
    expect(health.snapshot().status).toBe('OFFLINE');
    health.connect('engine');
    expect(health.snapshot().status).toBe('UNKNOWN');
  });

  it('accepts health only for connected engines', () => {
    expect(health.report('unknown', ready)).toBe(false);
    health.connect('engine');
    expect(health.report('engine', ready)).toBe(true);
    expect(health.snapshot().status).toBe('READY');
    health.disconnect('engine');
    expect(health.snapshot().status).toBe('OFFLINE');
  });

  it('reports model failure and expires old readiness', () => {
    jest.useFakeTimers();
    try {
      health.connect('engine');
      health.report('engine', { ...ready, object_detection: { loaded: false, error: 'MODEL_UNAVAILABLE' } });
      expect(health.snapshot().status).toBe('DEGRADED');
      jest.advanceTimersByTime(65001);
      expect(health.snapshot().status).toBe('UNKNOWN');
      expect(health.snapshot().engines[0].objectDetection).toBe('UNKNOWN');
    } finally { jest.useRealTimers(); }
  });

  it('rejects malformed reports without reflecting arbitrary diagnostic text', () => {
    health.connect('engine');
    expect(health.report('engine', { ...ready, object_detection: { loaded: true, error: 'secret URL' } })).toBe(false);
    expect(JSON.stringify(health.snapshot())).not.toContain('secret URL');
  });
});
