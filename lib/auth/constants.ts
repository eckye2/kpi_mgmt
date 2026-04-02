export const SESSION_COOKIE = 'kpi_session'
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7

/** HTTP로 프로덕션 빌드를 띄울 때 브라우저가 Secure 쿠키를 버립니다. 이때 .env에 SESSION_COOKIE_SECURE=false */
export function sessionCookieSecure(): boolean {
  const v = process.env.SESSION_COOKIE_SECURE
  if (v === 'false' || v === '0') return false
  if (v === 'true' || v === '1') return true
  return process.env.NODE_ENV === 'production'
}
