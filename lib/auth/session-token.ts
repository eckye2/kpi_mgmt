import { SignJWT, jwtVerify } from 'jose'
import { SESSION_MAX_AGE_SEC } from './constants'

function getSecret() {
  const s = process.env.AUTH_SECRET
  if (!s && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required in production')
  }
  return new TextEncoder().encode(s || 'dev-only-insecure-secret-change-me')
}

export async function signSessionToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSecret())
}

export async function verifySessionToken(
  token: string
): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const sub = payload.sub
    if (!sub) return null
    const userId = parseInt(String(sub), 10)
    if (!Number.isFinite(userId)) return null
    return { userId }
  } catch {
    return null
  }
}
