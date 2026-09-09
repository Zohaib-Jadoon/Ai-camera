import { EvidenceService } from './evidence.service';
import { PDFDocument } from 'pdf-lib';

describe('Evidence context boundaries', () => {
  it('attaches full Unicode data and review status without internal URLs', async () => {
    const attach = jest.spyOn(PDFDocument.prototype, 'attach');
    try {
      const name = 'محفوظ ' + 'x'.repeat(200);
      const prisma = { alert: { findUnique: jest.fn().mockResolvedValue({
        id: 'a', alert_type: 'WEAPON_DETECTED', severity: 'HIGH', status: 'PENDING',
        review_status: 'PENDING', sent_at: new Date(), camera_id: 'cam',
        camera: { name, location: 'location', rtsp_url: 'rtsp://secret' },
      }) }, detection: { findMany: jest.fn().mockResolvedValue([{ id: 'd', object_type: 'person',
        confidence: .8, timestamp: new Date(), snapshot_url: 'https://private-object' }]) } };
      const bytes = await new EvidenceService(prisma as any).exportAlertPdf('a');
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
      const text = Buffer.from(attach.mock.calls[0][0] as Uint8Array).toString('utf8');
      const manifest = JSON.parse(text);
      expect(manifest.alert.camera.name).toBe(name);
      expect(manifest.alert.review_status).toBe('PENDING');
      expect(manifest.context.detections[0].id).toBe('d');
      expect(text).not.toContain('rtsp://secret');
      expect(text).not.toContain('https://private-object');
    } finally { attach.mockRestore(); }
  });
  it('never queries unrelated cameras when an alert has no camera', async () => {
    const detection = { findMany: jest.fn() };
    const prisma = { alert: { findUnique: jest.fn().mockResolvedValue({
      id: 'a', alert_type: 'UNKNOWN', severity: 'LOW', status: 'PENDING', sent_at: new Date(), camera_id: null,
    }) }, detection };
    const pdf = await new EvidenceService(prisma as any).exportAlertPdf('a');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(detection.findMany).not.toHaveBeenCalled();
    expect(prisma.alert.findUnique.mock.calls[0][0].include.camera.select).not.toHaveProperty('rtsp_url');
  });
});
