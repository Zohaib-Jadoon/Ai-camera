import { spawnSync } from 'child_process';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { recordingPrivacy } from './privacy-policy';

describe('Native FFmpeg privacy filter', () => {
  it('blacks out configured pixels without masking the entire scene', () => {
    const policy = recordingPrivacy([{ x: 0, y: 0, width: 0.5, height: 1 }]);
    const result = spawnSync(ffmpegPath, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=100x100:d=1',
      '-vf', policy.filters.join(','), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
      { timeout: 10000, maxBuffer: 100000 });
    expect(result.status).toBe(0);
    expect(result.stdout.length).toBe(30000);
    for (const x of [0, 20, 49]) expect(result.stdout[(50 * 100 + x) * 3]).toBeLessThan(5);
    expect(result.stdout[(50 * 100 + 80) * 3]).toBeGreaterThan(245);
  });
});
