// Email + password identity (UC-22). Pure functions plus the two record shapes;
// routing and storage live in app.ts and the Store, as everywhere else here.
//
// **No dependency was added.** `node:crypto` ships scrypt and a constant-time
// comparator, which is what a password hash needs; pulling in bcrypt/argon2
// would be the only native dependency in a project whose ARCHITECTURE names
// `node:http` and no framework.
//
// A token is random, and only its SHA-256 is stored. A store snapshot on disk
// therefore cannot be replayed as a live session — the same reason the password
// itself is never stored.

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/** scrypt cost. N=2^14 with r=8 is ~60 ms here — slow enough to matter to an
 *  attacker, fast enough that the suite does not crawl. Encoded into every hash
 *  so raising it later leaves old hashes verifiable. */
const N = 16384
const R = 8
const P = 1
const KEYLEN = 64
const MAXMEM = 64 * 1024 * 1024

export const TOKEN_TTL_DAYS = 30
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 200

/**
 * `scrypt$N$r$p$salt$hash`, all base64url. The parameters travel with the hash
 * so a cost change does not invalidate every existing account.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const key = scryptSync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM })
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$')
}

/** Constant-time. Returns false on any malformed stored value rather than throwing. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const n = Number(parts[1]); const r = Number(parts[2]); const p = Number(parts[3])
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  let salt: Buffer; let expected: Buffer
  try {
    salt = Buffer.from(parts[4]!, 'base64url')
    expected = Buffer.from(parts[5]!, 'base64url')
  } catch { return false }
  if (expected.length === 0) return false
  let actual: Buffer
  try {
    actual = scryptSync(password, salt, expected.length, { N: n, r, p, maxmem: MAXMEM })
  } catch { return false }
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** The raw token is returned once, to the caller who authenticated; only `hash` is stored. */
export function mintToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('base64url')

/**
 * Addresses are compared case-insensitively and stored folded, so `A@b.com` and
 * `a@b.com` are one account rather than two an owner cannot tell apart.
 * The shape check is deliberately loose — one `@`, something either side, no
 * whitespace. A stricter regex rejects addresses that are legal and deliverable.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isPlausibleEmail(email: string): boolean {
  if (email.length === 0 || email.length > 254) return false
  if (/\s/.test(email)) return false
  const at = email.indexOf('@')
  if (at <= 0 || at !== email.lastIndexOf('@')) return false
  const domain = email.slice(at + 1)
  return domain.length > 0 && domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.')
}

export function passwordComplaint(password: string): string | null {
  if (typeof password !== 'string' || password.length === 0) return 'password is required'
  if (password.length < MIN_PASSWORD_LENGTH) return `password must be at least ${MIN_PASSWORD_LENGTH} characters`
  if (password.length > MAX_PASSWORD_LENGTH) return `password must be at most ${MAX_PASSWORD_LENGTH} characters`
  return null
}

export const tokenExpiryIso = (nowMs: number): string =>
  new Date(nowMs + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
