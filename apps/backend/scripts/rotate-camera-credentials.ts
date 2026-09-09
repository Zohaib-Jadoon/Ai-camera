/** Dry-run by default. Never print URLs, ciphertext or environment secrets. */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { CameraCredentials } from '../src/common/utils/camera-credentials';

loadEnv({ path: resolve(__dirname, '../.env') });
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--apply', '--backup-confirmed'].includes(arg))) throw new Error('Invalid arguments');
  const apply = args.includes('--apply');
  if (apply && !args.includes('--backup-confirmed')) throw new Error('A verified backup is required before applying');
  const config = new ConfigService();
  const cipher = new CameraCredentials(config);
  const prefix = `v2:${config.get<string>('CAMERA_ENCRYPTION_KEY_ID', 'primary')}:`;
  let cursor: string | undefined;
  let scanned = 0;
  let candidates = 0;
  let changed = 0;
  let conflicts = 0;
  while (true) {
    const batch = await prisma.camera.findMany({
      orderBy: { id: 'asc' }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, rtsp_url: true, detect_url: true, record_url: true },
    });
    if (!batch.length) break;
    for (const camera of batch) {
      scanned++;
      const data: Partial<Record<'rtsp_url' | 'detect_url' | 'record_url', string>> = {};
      for (const field of ['rtsp_url', 'detect_url', 'record_url'] as const) {
        const value = camera[field];
        if (!value) continue;
        const plain = cipher.decrypt(value);
        if (!value.startsWith(prefix)) data[field] = cipher.encrypt(plain);
      }
      if (!Object.keys(data).length) continue;
      candidates++;
      if (apply) {
        // Optimistic comparison protects edits made during migration.
        const result = await prisma.camera.updateMany({ where: { ...camera }, data });
        if (result.count === 1) changed++;
        else conflicts++;
      }
    }
    cursor = batch[batch.length - 1].id;
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', scanned, candidates, changed, conflicts }));
  if (conflicts) process.exitCode = 1;
}

main().catch(() => {
  console.error('Credential migration stopped. Verify arguments, key configuration, database access and record integrity. No credential values are logged.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
