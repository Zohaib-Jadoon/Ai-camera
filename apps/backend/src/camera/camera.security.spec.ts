import { CameraController } from './camera.controller';

describe('camera API credential redaction', () => {
  const camera = { id: 'camera', rtsp_url: 'rtsp://user:private@camera.invalid/live?token=private', detect_url: 'rtsp://user:private@camera.invalid/sub', record_url: null };
  const service: any = {
    findAll: jest.fn().mockResolvedValue([camera]), findUnhealthy: jest.fn().mockResolvedValue([camera]),
    findOne: jest.fn().mockResolvedValue(camera), create: jest.fn().mockResolvedValue(camera),
    update: jest.fn().mockResolvedValue(camera), remove: jest.fn().mockResolvedValue(camera),
  };
  const controller = new CameraController(service);
  it.each(['ADMIN', 'SECURITY_OPERATOR', 'VIEWER'])('does not expose stored credentials to %s', async (role) => {
    const responses = await Promise.all([controller.findAll({ user: { role } }), controller.getHealth({ user: { role } }), controller.findOne('camera', { user: { role } })]);
    expect(JSON.stringify(responses)).not.toContain('private');
  });
  it('also redacts mutation responses', async () => {
    const responses = await Promise.all([controller.create({} as any), controller.update('camera', {}), controller.remove('camera')]);
    expect(JSON.stringify(responses)).not.toContain('private');
    expect(camera.rtsp_url).toContain('private');
  });
});
