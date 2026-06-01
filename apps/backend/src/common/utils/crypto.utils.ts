import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt plain text using AES-256-CBC.
 * Returns string formatted as "iv_hex:encrypted_hex".
 */
export function encrypt(text: string, secret: string): string {
  if (!text) return '';
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt cipher text using AES-256-CBC.
 * Supports transparent fallback: returns original string if not encrypted or decryption fails.
 */
export function decrypt(encryptedText: string, secret: string): string {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText; // Fallback if plain
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    if (iv.length !== 16) return encryptedText; // Fallback if not valid hex IV
    
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedText; // Transparent fallback
  }
}

/**
 * Mask RTSP user credentials inside a URL string with "***:***".
 * Matches "rtsp://username:password@host" and "rtsps://username:password@host".
 */
export function redactRtsp(url: string): string {
  if (!url) return '';
  try {
    const match = url.match(/^(rtsps?:\/\/)([^@]+)@(.*)$/);
    if (match) {
      const protocol = match[1];
      const hostPath = match[3];
      return `${protocol}***:***@${hostPath}`;
    }
    return url;
  } catch {
    return 'rtsp://***:***@hidden';
  }
}
