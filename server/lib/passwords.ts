import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const HASH_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${HASH_PREFIX}$${salt}$${derivedKey}`;
}

function isHashedPassword(value: string): boolean {
  return value.startsWith(`${HASH_PREFIX}$`);
}

export function verifyPassword(password: string, storedValue: string): boolean {
  if (!isHashedPassword(storedValue)) {
    return storedValue === password;
  }

  const [, salt, expectedKey] = storedValue.split('$');

  if (!salt || !expectedKey) {
    return false;
  }

  const actualKey = scryptSync(password, salt, KEY_LENGTH);
  const expectedBuffer = Buffer.from(expectedKey, 'hex');

  if (actualKey.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualKey, expectedBuffer);
}

export function needsPasswordRehash(storedValue: string): boolean {
  return !isHashedPassword(storedValue);
}
