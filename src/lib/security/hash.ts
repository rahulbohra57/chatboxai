import 'server-only'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/**
 * Hashes a plain-text secret code for storage.
 * Never store plain-text codes.
 */
export async function hashCode(plainCode: string): Promise<string> {
  return bcrypt.hash(plainCode, SALT_ROUNDS)
}

/**
 * Compares a plain-text code against a stored bcrypt hash.
 * Returns true if they match.
 */
export async function compareCode(
  plainCode: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plainCode, hash)
}
