import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io, Socket } from 'socket.io-client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { installSocketAuthentication } from './socket-auth';

describe('Socket.IO admission with real connections', () => {
  const config = new ConfigService({
    JWT_SECRET: 'test-only-socket-secret',
    AI_ENGINE_KEY: 'test-only-engine-key',
  });
  const jwt = new JwtService({ secret: 'test-only-socket-secret' });
  let http: HttpServer;
  let server: Server;
  let clients: Socket[];
  let url: string;
  let db: any;
  let admitted: jest.Mock;

  beforeEach(async () => {
    http = createServer();
    server = new Server(http);
    clients = [];
    db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 'operator',
            email: 'op@example.invalid',
            role: 'VIEWER',
            isActive: true,
          }),
      },
    };
    installSocketAuthentication(server, config, jwt, db);
    admitted = jest.fn();
    server.on('connection', admitted);
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    clients.forEach((client) => client.disconnect());
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function connect(auth: Record<string, unknown> = {}) {
    const client = io(url, {
      auth,
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
    });
    clients.push(client);
    const outcome = new Promise<string>((resolve) => {
      client.once('connect', () => resolve('connected'));
      client.once('connect_error', (error) => resolve(error.message));
    });
    client.connect();
    return { client, outcome };
  }

  it.each([
    {},
    { token: 'invalid' },
    { token: { sub: 'operator' } },
    { 'x-ai-engine-key': 'wrong-key' },
    { token: 'invalid', 'x-ai-engine-key': 'test-only-engine-key' },
  ])('rejects invalid credentials before admission: %j', async (auth) => {
    expect(await connect(auth).outcome).toBe('Unauthorized');
    expect(admitted).not.toHaveBeenCalled();
    expect(server.sockets.sockets.size).toBe(0);
  });

  it('uses current account role instead of the stale token role', async () => {
    const token = jwt.sign(
      { sub: 'operator', role: 'ADMIN' },
      { expiresIn: '15m' },
    );
    expect(await connect({ token: `Bearer ${token}` }).outcome).toBe(
      'connected',
    );
    expect(admitted.mock.calls[0][0].data.user.role).toBe('VIEWER');
  });

  it('admits valid engine keys without querying user accounts', async () => {
    expect(
      await connect({ 'x-ai-engine-key': 'test-only-engine-key' }).outcome,
    ).toBe('connected');
    expect(admitted.mock.calls[0][0].data.authenticatedEngine).toBe(true);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it.each(['missing', 'inactive', 'unavailable'])(
    'rejects %s accounts',
    async (state) => {
      if (state === 'unavailable')
        db.user.findUnique.mockRejectedValue(new Error('Database unavailable'));
      else
        db.user.findUnique.mockResolvedValue(
          state === 'missing' ? null : { isActive: false },
        );
      expect(
        await connect({
          token: jwt.sign({ sub: 'operator' }, { expiresIn: '15m' }),
        }).outcome,
      ).toBe('Unauthorized');
      expect(admitted).not.toHaveBeenCalled();
    },
  );

  it.each([{}, { expiresIn: -1 }])(
    'rejects tokens without a future expiry: %j',
    async (options) => {
      expect(
        await connect({ token: jwt.sign({ sub: 'operator' }, options) })
          .outcome,
      ).toBe('Unauthorized');
      expect(db.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it('excludes pending authentication from live broadcasts', async () => {
    let finishLookup!: (user: unknown) => void;
    let lookupStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      lookupStarted = resolve;
    });
    db.user.findUnique.mockImplementation(() => {
      lookupStarted();
      return new Promise((resolve) => {
        finishLookup = resolve;
      });
    });
    const { client, outcome } = connect({
      token: jwt.sign({ sub: 'operator' }, { expiresIn: '15m' }),
    });
    const received = jest.fn();
    client.on('alert', received);
    await started;
    expect(server.sockets.sockets.size).toBe(0);
    server.emit('alert', { sensitive: true });
    finishLookup({ id: 'operator', role: 'VIEWER', isActive: true });
    expect(await outcome).toBe('connected');
    expect(received).not.toHaveBeenCalled();
  });
});
