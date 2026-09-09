import { ReadinessController } from './readiness.controller';
describe('Database readiness', () => {
  it('reports database outages as unavailable, not healthy', async () => {
    const controller = new ReadinessController({ $queryRaw: jest.fn().mockRejectedValue(new Error('offline')) } as any);
    await expect(controller.ready()).rejects.toThrow('Not ready');
  });
  it('reports readiness after database recovery', async () => {
    const controller = new ReadinessController({ $queryRaw: jest.fn().mockResolvedValue([1]) } as any);
    await expect(controller.ready()).resolves.toEqual({ status: 'ready' });
  });
});
