import { BadRequestException } from '@nestjs/common';
import { PrivacyMaskService } from './privacy-mask.service';

describe('privacy mask updates', () => {
  let service: PrivacyMaskService;
  let db: any;
  let gateway: any;
  const mask = { camera_id: 'camera', x: .1, y: .1, width: .2, height: .2 };
  beforeEach(() => {
    db = { privacyMask: { create: jest.fn().mockResolvedValue(mask), update: jest.fn().mockResolvedValue(mask), delete: jest.fn().mockResolvedValue(mask), findUnique: jest.fn().mockResolvedValue(mask) } };
    gateway = { broadcastCameraSync: jest.fn().mockResolvedValue(undefined) };
    service = new PrivacyMaskService(db, gateway);
  });
  it('synchronizes every successful mutation to active engines', async () => {
    await service.create(mask);
    await service.update('mask', { x: .2 });
    await service.remove('mask');
    expect(gateway.broadcastCameraSync).toHaveBeenCalledTimes(3);
  });
  it('rejects out-of-frame masks before writing', async () => {
    await expect(service.create({ ...mask, x: .9 })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.privacyMask.create).not.toHaveBeenCalled();
    expect(gateway.broadcastCameraSync).not.toHaveBeenCalled();
  });
  it('validates partial updates against persisted bounds', async () => {
    await expect(service.update('mask', { width: 1 })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.privacyMask.update).not.toHaveBeenCalled();
  });
});
