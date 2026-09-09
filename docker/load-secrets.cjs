'use strict';
// Loaded before Nest imports/validates configuration. Never log secret contents.
const fs = require('node:fs');
const filename = process.env.APP_SECRETS_FILE;
if (filename) {
  const values = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const allowed = new Set(['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET',
    'AI_ENGINE_KEY', 'CAMERA_ENCRYPTION_KEY', 'CAMERA_ENCRYPTION_KEY_ID',
    'CAMERA_ENCRYPTION_PREVIOUS_KEYS', 'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET',
    'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'SMTP_USER', 'SMTP_PASS']);
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key) || typeof value !== 'string' || !value) throw new Error('Invalid application secret configuration');
    process.env[key] = value;
  }
}
