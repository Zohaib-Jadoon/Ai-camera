import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async exportAlertPdf(alertId: string): Promise<Buffer> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      include: { camera: true },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    const detections = await this.prisma.detection.findMany({
      where: { camera_id: alert.camera_id || undefined },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });

    // ── Build PDF ─────────────────────────────────────────────────────────────
    const doc = await PDFDocument.create();
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
      page.drawText(text, {
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
    write(`Generated: ${new Date().toISOString()}`, MARGIN, y, { size: 9, color: rgb(0.5, 0.5, 0.5) });
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
      ['Sent At', alert.sent_at.toISOString()],
      ['Camera', alert.camera ? `${alert.camera.name} (${alert.camera.location ?? 'N/A'})` : 'N/A'],
      ['Camera RTSP', alert.camera?.rtsp_url ?? 'N/A'],
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
    write('Recent Detections', MARGIN, y, { size: 13, font: bold });
    y -= LINE_H * 1.2;

    const cols = [MARGIN, MARGIN + 100, MARGIN + 180, MARGIN + 260];
    const headers = ['Object', 'Confidence', 'Timestamp', 'Snapshot'];
    for (let i = 0; i < headers.length; i++) {
      write(headers[i], cols[i], y, { font: bold, size: 10 });
    }
    y -= LINE_H * 0.8;
    hLine(y);
    y -= LINE_H;

    for (const d of detections) {
      write(d.object_type, cols[0], y, { size: 9 });
      write(`${(d.confidence * 100).toFixed(1)}%`, cols[1], y, { size: 9 });
      write(d.timestamp.toISOString().replace('T', ' ').slice(0, 19), cols[2], y, { size: 9 });
      write(d.snapshot_url ? 'Available' : 'N/A', cols[3], y, { size: 9 });
      y -= LINE_H;
      if (y < MARGIN + LINE_H) break; // don't overflow page
    }

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
