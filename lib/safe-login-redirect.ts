const ALLOWED_PREFIXES = ["/dashboard", "/admin"] as const

/**
 * 미들웨어가 붙이는 `?next=` 등, 로그인 후 이동 경로.
 * 오픈 리다이렉트 방지: 같은 앱의 대시보드·관리자 경로만 허용.
 */
export function getSafeLoginNextPath(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  let decoded = String(raw).trim()
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    return null
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null
  if (decoded.includes("://")) return null
  const path = (decoded.split("?")[0] ?? "").split("#")[0] ?? ""
  if (!path) return null
  return ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
    ? path
    : null
}
