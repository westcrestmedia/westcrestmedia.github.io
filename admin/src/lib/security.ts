import { headers } from 'next/headers'

/**
 * Login / brute-force protection ke liye simple in-memory sliding-window
 * rate limiter.
 *
 * NOTE (production): single VM/Vercel function pe theek hai. Multi-node
 * deploy pe in-memory shared nahi hai — Supabase Rate Limits ya ek Redis
 * backed limiter use karo.
 */

type Bucket = { count: number; windowStart: number }

const buckets = new Map<string, Bucket>()
const MAX_WINDOW_MS = 15 * 60 * 1000 // 15 min

export async function getClientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}

/** true = block (limit hit), false = allowed. */
export function rateLimit(key: string, limit: number, windowMs = MAX_WINDOW_MS): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return false
  }

  bucket.count++
  if (bucket.count > limit) {
    // reset window jab blocked ho
    bucket.windowStart = now
    return true
  }
  return false
}

const RE_ADMIN_EMAILS = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

/** Startup me .env se admin emails string → list. */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => RE_ADMIN_EMAILS.test(e))
}

/** User email is bootstrap admin (ADMIN_EMAILS me) to true. */
export function isBootstrapAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.toLowerCase())
}

/** XSS se bachne ke liye user input sanitize. strip/replace dangerous chars. */
export function sanitizeText(input: unknown, maxLen = 20000): string {
  const str = String(input ?? '')
  const sliced = str.slice(0, maxLen)
  return sliced
    .replace(/</g, '\uFF1C')   // < → fullwidth
    .replace(/>/g, '\uFF1E')   // > → fullwidth
    .replace(/javascript:/gi, '')
}

/** Basic email validate. */
export function isValidEmail(email: unknown): boolean {
  return typeof email === 'string' && RE_ADMIN_EMAILS.test(email.trim())
}

/** Origin-check CSRF guard for Server Actions (defence-in-depth). */
export async function assertSameSiteOrigin(): Promise<void> {
  const h = await headers()
  const origin = h.get('origin')
  const host = h.get('host')
  // origin missing (curl / cross-site form) → reject
  if (!origin || !host) {
    throw new Error('Invalid request origin')
  }
  try {
    const u = new URL(origin)
    if (u.host !== host) throw new Error('Origin mismatch')
  } catch {
    throw new Error('Invalid request origin')
  }
}