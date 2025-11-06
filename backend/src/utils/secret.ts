import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended 12 bytes

function getKey(): Buffer {
  const secret = process.env.API_KEY_SECRET || 'dev-insecure-default';
  // Derive 32-byte key via SHA-256
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptSecret(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

export function isEncryptedSecret(text: string | null | undefined): boolean {
  return typeof text === 'string' && text.startsWith('enc:v1:');
}

export function decryptSecret(payload: string): string {
  if (!isEncryptedSecret(payload)) {
    // Backward compatibility: stored as plaintext
    return payload;
  }
  const parts = payload.split(':');
  if (parts.length !== 5) {
    throw new Error('Invalid encrypted secret format');
  }
  const iv = Buffer.from(parts[2], 'base64');
  const data = Buffer.from(parts[3], 'base64');
  const tag = Buffer.from(parts[4], 'base64');

  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}


