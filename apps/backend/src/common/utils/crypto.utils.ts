/** Display a stream endpoint without credentials, path tokens or query secrets. */
export function redactRtsp(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['rtsp:', 'rtsps:'].includes(parsed.protocol)) return '[stream configured]';
    // Credentials may also be embedded in paths or query parameters.
    return `${parsed.protocol}//${parsed.host}/[hidden]`;
  } catch {
    return '[stream configured]';
  }
}
