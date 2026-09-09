import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { StreamingService } from './streaming.service';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

describe('truthful stream probing', () => {
  let child: EventEmitter & { stderr: EventEmitter; kill: jest.Mock };
  beforeEach(() => {
    child = Object.assign(new EventEmitter(), {
      stderr: Object.assign(new EventEmitter(), { resume: jest.fn() }),
      kill: jest.fn(),
    });
    (spawn as jest.Mock).mockReturnValue(child);
  });

  it('reports missing ffprobe as failure without exposing credentials', async () => {
    const result = new StreamingService().testRtspConnection(
      'rtsp://fake:private@example.invalid/live',
    );
    child.emit(
      'error',
      new Error('ENOENT: rtsp://fake:private@example.invalid/live'),
    );
    await expect(result).resolves.toEqual({
      success: false,
      message: 'Stream verification unavailable: ffprobe could not start.',
    });
  });

  it('does not return raw FFmpeg diagnostics to the caller', async () => {
    const result = new StreamingService().testRtspConnection(
      'rtsp://fake:private@example.invalid/live',
    );
    child.stderr.emit(
      'data',
      Buffer.from('Failed opening rtsp://fake:private@example.invalid/live'),
    );
    child.emit('close', 1);
    await expect(result).resolves.toEqual({
      success: false,
      message: 'Stream probe failed (exit code 1).',
    });
  });

  it('reports successful probe completion', async () => {
    const result = new StreamingService().testRtspConnection(
      'rtsp://example.invalid/live',
    );
    child.emit('close', 0);
    await expect(result).resolves.toMatchObject({ success: true });
  });
});
