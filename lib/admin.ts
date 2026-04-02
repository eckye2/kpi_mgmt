import { NextRequest } from 'next/server'
import type { OrgRole } from '@prisma/client'

export function clientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  return '127.0.0.1'
}

/**
 * ALLOWED_ADMIN_IPS: 쉼표로 구분한 IP 또는 a.b.c.0/24(간단 /24만).
 * 비우면 모든 네트워크에서 관리자 API 허용. 값이 있으면 목록에 있는 클라이언트만 허용.
 */
export function isAdminIpAllowed(request: NextRequest): boolean {
  const raw = process.env.ALLOWED_ADMIN_IPS?.trim()
  if (!raw) {
    return true
  }
  const ip = clientIp(request)
  const parts = ip.split('.')
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return list.some((allow) => {
    if (allow.includes('/')) {
      const [base, bits] = allow.split('/')
      if (bits === '24' && base.split('.').length === 4) {
        const p = base.split('.').slice(0, 3).join('.')
        return parts.length === 4 && ip.startsWith(p + '.')
      }
      return ip === base
    }
    return ip === allow
  })
}

export function isAppAdmin(user: {
  isSystemAdmin: boolean
  role: OrgRole
}): boolean {
  return (
    user.isSystemAdmin ||
    user.role === 'PRESIDENT' ||
    user.role === 'VICE_PRESIDENT'
  )
}
