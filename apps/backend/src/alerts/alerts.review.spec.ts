import { AlertsService } from './alerts.service';

describe('Human alert review', () => {
  const alert = { updateMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() };
  const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const webhooks = { dispatch: jest.fn() };
  let service: AlertsService;
  beforeEach(() => {
    jest.resetAllMocks();
    webhooks.dispatch.mockResolvedValue(undefined);
    cache.del.mockResolvedValue(undefined);
    service = new AlertsService({ alert } as any, cache as any, webhooks as any);
  });
  it('does not dispatch a machine-created alert externally', async () => {
    alert.create.mockResolvedValue({ id: 'a', alert_type: 'WEAPON' });
    await service.create({ event_id: 'a', alert_type: 'WEAPON' });
    expect(webhooks.dispatch).not.toHaveBeenCalled();
  });
  it('records reviewer identity and only dispatches confirmed alerts', async () => {
    alert.updateMany.mockResolvedValue({ count: 1 });
    alert.findUniqueOrThrow.mockResolvedValue({ id: 'a' });
    await service.review('a', 'CONFIRMED', 'Reviewed original clip', 'operator');
    expect(alert.updateMany.mock.calls[0][0].data.reviewed_by).toBe('operator');
    expect(webhooks.dispatch).toHaveBeenCalledWith('alert.reviewed', expect.objectContaining({ review_status: 'CONFIRMED' }));
  });
  it('does not dispatch dismissed alerts', async () => {
    alert.updateMany.mockResolvedValue({ count: 1 });
    alert.findUniqueOrThrow.mockResolvedValue({ id: 'a' });
    await service.review('a', 'DISMISSED', 'Reflection, not a person', 'operator');
    expect(webhooks.dispatch).not.toHaveBeenCalled();
  });
  it('rejects competing/double reviews', async () => {
    alert.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.review('a', 'CONFIRMED', 'Reviewed clip', 'operator')).rejects.toThrow('already reviewed');
    expect(webhooks.dispatch).not.toHaveBeenCalled();
  });
  it('blocks unreviewed resolution', async () => {
    alert.findUniqueOrThrow.mockResolvedValue({ review_status: 'PENDING' });
    await expect(service.updateStatus('a', 'RESOLVED')).rejects.toThrow('Human review');
    expect(alert.update).not.toHaveBeenCalled();
  });
});
