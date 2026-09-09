import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';

describe('AI service data boundaries', () => {
  let gateway: EventsGateway;
  let cameraService: any;
  let facesService: any;
  let server: any;
  let targetedEmit: jest.Mock;
  const config = new ConfigService({
    AI_ENGINE_KEY: 'test-engine-key',
    JWT_SECRET: 'test-jwt-secret',
  });
  const socket = (id: string, key?: string): any => ({
    id,
    handshake: { headers: key ? { 'x-ai-engine-key': key } : {}, auth: {} },
    // Middleware authentication is covered separately with real socket connections.
    data: { authenticatedEngine: key === 'test-engine-key' },
    emit: jest.fn(),
    disconnect: jest.fn(),
  });

  beforeEach(() => {
    cameraService = {
      findAll: jest
        .fn()
        .mockResolvedValue([
          { id: 'camera', rtsp_url: 'rtsp://fake:secret@example.invalid/live' },
        ]),
    };
    facesService = {
      getAllEmbeddings: jest
        .fn()
        .mockResolvedValue([{ embedding_vector: [0.1] }]),
    };
    const moduleRef = {
      get: jest
        .fn()
        .mockReturnValueOnce(cameraService)
        .mockReturnValueOnce(facesService),
    };
    gateway = new EventsGateway(
      {} as any,
      {} as any,
      new JwtService(),
      config,
      { privacyMask: { findMany: jest.fn().mockResolvedValue([]) } } as any,
      {} as any,
      moduleRef as any,
    );
    targetedEmit = jest.fn();
    server = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: targetedEmit }),
    };
    gateway.server = server;
    gateway.onModuleInit();
  });

  it('rejects ordinary users requesting private camera configuration', async () => {
    const viewer = socket('viewer');
    viewer.user = { sub: 'user', role: 'VIEWER' };
    await gateway.handleRequestCameras(viewer);
    expect(viewer.disconnect).toHaveBeenCalledWith(true);
    expect(cameraService.findAll).not.toHaveBeenCalled();
    expect(viewer.emit).not.toHaveBeenCalled();
  });

  it('rejects ordinary users requesting face vectors', async () => {
    const viewer = socket('viewer');
    viewer.user = { sub: 'user', role: 'VIEWER' };
    await gateway.handleRequestEmbeddings(viewer);
    expect(facesService.getAllEmbeddings).not.toHaveBeenCalled();
    expect(viewer.disconnect).toHaveBeenCalledWith(true);
  });

  it('preserves configuration and embeddings for authenticated AI engines', async () => {
    const engine = socket('engine', 'test-engine-key');
    await gateway.handleConnection(engine);
    await gateway.handleRequestCameras(engine);
    await gateway.handleRequestEmbeddings(engine);
    expect(engine.emit).toHaveBeenCalledWith('sync_cameras', expect.any(Array));
    expect(engine.emit).toHaveBeenCalledWith(
      'sync_embeddings',
      expect.any(Array),
    );
  });

  it('never broadcasts camera secrets to browsers', async () => {
    await gateway.handleConnection(socket('engine', 'test-engine-key'));
    await gateway.broadcastCameraSync();
    expect(server.emit).not.toHaveBeenCalled();
    expect(server.to).toHaveBeenCalledWith('engine');
    expect(targetedEmit).toHaveBeenCalledWith(
      'sync_cameras',
      expect.any(Array),
    );
  });

  it('does not broadcast when no AI engine is connected', () => {
    gateway.emitToAiEngines('extract_face', { image_b64: 'private' });
    expect(server.emit).not.toHaveBeenCalled();
    expect(server.to).not.toHaveBeenCalled();
  });

  it('removes disconnected engine identities from private delivery', async () => {
    const engine = socket('engine', 'test-engine-key');
    await gateway.handleConnection(engine);
    gateway.handleDisconnect(engine);
    gateway.emitToAiEngines('test_stream', { rtsp_url: 'private' });
    expect(server.to).not.toHaveBeenCalled();
  });

  it('disconnects user sockets at token expiry and clears the timer', () => {
    jest.useFakeTimers();
    try {
      const viewer = socket('viewer');
      viewer.data = { user: { sub: 'user' }, expiresAt: Date.now() + 1000 };
      gateway.handleConnection(viewer);
      jest.advanceTimersByTime(1000);
      expect(viewer.emit).toHaveBeenCalledWith('session_expired');
      expect(viewer.disconnect).toHaveBeenCalledWith(true);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('cleans up expiry timers when a user disconnects early', () => {
    jest.useFakeTimers();
    try {
      const viewer = socket('viewer');
      viewer.data = { user: { sub: 'user' }, expiresAt: Date.now() + 60000 };
      gateway.handleConnection(viewer);
      gateway.handleDisconnect(viewer);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
