import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySessionToken } from './session-token'
import { SESSION_COOKIE } from './constants'
import type { OrgRole } from '@prisma/client'

export const sessionUserSelect = {
  id: true,
  publicId: true,
  employeeNo: true,
  email: true,
  name: true,
  dept: true,
  subDept: true,
  role: true,
  gradeLevel: true,
  hireDate: true,
  isSystemAdmin: true,
  mustChangePassword: true,
} as const

export type SessionUser = {
  id: number
  publicId: string
  employeeNo: string
  email: string
  name: string
  dept: string
  subDept: string
  role: OrgRole
  gradeLevel: string
  hireDate: Date
  isSystemAdmin: boolean
  mustChangePassword: boolean
}

export async function getSessionUserId(request: NextRequest): Promise<number | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  const v = await verifySessionToken(token)
  return v?.userId ?? null
}

export async function getSessionUser(
  request: NextRequest
): Promise<SessionUser | null> {
  const id = await getSessionUserId(request)
  if (!id) return null
  const user = await prisma.user.findUnique({
    where: { id },
    select: sessionUserSelect,
  })
  return user as SessionUser | null
}

export async function requireSessionUser(
  request: NextRequest
): Promise<
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse }
> {
  const user = await getSessionUser(request)
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true, user }
}

/** `mustChangePassword` 인 경우 업무/조회 API 차단용 */
export function rejectIfMustChangePassword(user: SessionUser): NextResponse | null {
  if (!user.mustChangePassword) return null
  return NextResponse.json(
    {
      error: '비밀번호를 변경한 뒤 이용할 수 있습니다.',
      code: 'MUST_CHANGE_PASSWORD',
    },
    { status: 403 }
  )
}

/**
 * 로그인 + 비밀번호 정책 통과(강제 변경 완료).
 * 예외: GET /api/auth/me, POST /api/auth/logout, POST /api/auth/change-password 는 requireSessionUser만 사용.
 */
export async function requireSessionUserUnlocked(
  request: NextRequest
): Promise<
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireSessionUser(request)
  if (!auth.ok) return auth
  const denied = rejectIfMustChangePassword(auth.user)
  if (denied) return { ok: false, response: denied }
  return auth
}
