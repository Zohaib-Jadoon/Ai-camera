import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';

export type Mask = { x: number; y: number; width: number; height: number };

export function recordingPrivacy(masks: Mask[]) {
  const normalized = masks.map(({ x, y, width, height }) => {
    if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 ||
        width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
      throw new BadRequestException('Invalid recording privacy policy');
    }
    return { x, y, width, height };
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    hash: createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),
    // Floor origin, round coverage outward. The extra pixel covers fractional
    // origin offsets. Encoding (not stream copy) is mandatory with masks.
    filters: normalized.map(m => `drawbox=x=floor(iw*${m.x}):y=floor(ih*${m.y}):w=ceil(iw*${m.width})+1:h=ceil(ih*${m.height})+1:color=black:t=fill`),
  };
}
