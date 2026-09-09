import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import { createHash } from 'crypto';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async exportAlertPdf(alertId: string): Promise<Buffer> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      include: { camera: { select: { name: true, location: true } } },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    const detections = alert.camera_id ? await this.prisma.detection.findMany({
      where: { camera_id: alert.camera_id, timestamp: {
        gte: new Date(alert.sent_at.getTime() - 60_000),
        lte: new Date(alert.sent_at.getTime() + 60_000),
      } },
      orderBy: { timestamp: 'desc' },
      take: 5,
    }) : [];

    // ── Build PDF ─────────────────────────────────────────────────────────────
    const doc = await PDFDocument.create();
    const generatedAt = new Date().toISOString();
    // A bounded, explicit allowlist prevents credentials/internal URLs leaking.
    // JSON preserves Unicode and full values even when the visual summary is shortened.
    const manifest = Buffer.from(JSON.stringify({
      schema_version: 1, generated_at: generatedAt,
      limitations: ['Automatically generated; requires human review',
        'Nearby detections are context, not proof of causation',
        'Snapshot and recording bytes are not included'],
      alert: { id: alert.id, type: alert.alert_type, severity: alert.severity,
        status: alert.status, review_status: alert.review_status ?? 'UNKNOWN',
        sent_at: alert.sent_at.toISOString(), camera_id: alert.camera_id,
        camera: alert.camera ? { name: alert.camera.name, location: alert.camera.location } : null },
      context: { window_seconds_before: 60, window_seconds_after: 60, limit: 5,
        detections: detections.map(d => ({ id: d.id, object_type: d.object_type,
          confidence: d.confidence, timestamp: d.timestamp.toISOString() })) },
    }, null, 2), 'utf8');
    const manifestHash = createHash('sha256').update(manifest).digest('hex');
    await doc.attach(manifest, 'evidence-manifest.json', {
      mimeType: 'application/json', description: 'Full structured report data; no media included',
    });
    const page = doc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();

    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const regular = await doc.embedFont(StandardFonts.Helvetica);

    const MARGIN = 50;
    const LINE_H = 18;
    let y = height - MARGIN;

    const write = (
      text: string,
      x: number,
      yPos: number,
      opts: { size?: number; font?: typeof bold; color?: ReturnType<typeof rgb> } = {},
    ) => {
      page.drawText(text.replace(/[^\x20-\x7e]/g, '?').slice(0, 95), {
        x,
        y: yPos,
        size: opts.size ?? 11,
        font: opts.font ?? regular,
        color: opts.color ?? rgb(0.1, 0.1, 0.1),
      });
    };

    const hLine = (yPos: number) =>
      page.drawLine({
        start: { x: MARGIN, y: yPos },
        end: { x: width - MARGIN, y: yPos },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });

    // Title
    write('Evidence Report', MARGIN, y, { size: 22, font: bold, color: rgb(0.05, 0.3, 0.7) });
    y -= LINE_H * 1.5;
    write(`Generated: ${generatedAt}`, MARGIN, y, { size: 9, color: rgb(0.5, 0.5, 0.5) });
    y -= LINE_H;
    hLine(y);
    y -= LINE_H;

    // Alert details
    write('Alert Details', MARGIN, y, { size: 13, font: bold });
    y -= LINE_H * 1.2;

    const details: [string, string][] = [
      ['Alert ID', alert.id],
      ['Type', alert.alert_type],
      ['Severity', alert.severity],
      ['Status', alert.status],
      ['Human Review', alert.review_status ?? 'UNKNOWN'],
      ['Sent At', alert.sent_at.toISOString()],
      ['Camera', alert.camera ? `${alert.camera.name} (${alert.camera.location ?? 'N/A'})` : 'N/A'],
    ];

    for (const [label, value] of details) {
      write(label, MARGIN, y, { font: bold, size: 10 });
      write(value, MARGIN + 110, y, { size: 10 });
      y -= LINE_H;
    }

    y -= LINE_H * 0.5;
    hLine(y);
    y -= LINE_H;

    // Recent detections
    write('Context within 60 seconds (not proof of causation)', MARGIN, y, { size: 13, font: bold });
    y -= LINE_H * 1.2;

    const cols = [MARGIN, MARGIN + 150, MARGIN + 240];
    const headers = ['Object', 'Confidence', 'Timestamp (UTC)'];
    for (let i = 0; i < headers.length; i++) {
      write(headers[i], cols[i], y, { font: bold, size: 10 });
    }
    y -= LINE_H * 0.8;
    hLine(y);
    y -= LINE_H;

    for (const d of detections) {
      write(d.object_type.slice(0, 25), cols[0], y, { size: 9 });
      write(`${(d.confidence * 100).toFixed(1)}%`, cols[1], y, { size: 9 });
      write(d.timestamp.toISOString().replace('T', ' ').slice(0, 19), cols[2], y, { size: 9 });
      y -= LINE_H;
      if (y < MARGIN + LINE_H) break; // don't overflow page
    }

    y -= LINE_H;
    write('Media is not included. Full text is in the attached JSON manifest.', MARGIN, y, { size: 9 });
    y -= LINE_H;
    write('Manifest SHA-256 (integrity checksum, not a digital signature):', MARGIN, y, { size: 9 });
    y -= LINE_H;
    write(manifestHash, MARGIN, y, { size: 8 });

    // Footer
    y = MARGIN;
    hLine(y + LINE_H);
    write(
      'This report was generated automatically by Madad Vision AI Surveillance System.',
      MARGIN,
      y,
      { size: 8, color: rgb(0.5, 0.5, 0.5) },
    );

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }
}
