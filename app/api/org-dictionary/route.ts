import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUserUnlocked } from '@/lib/auth/session-user'

/** 로그인 사용자에게 조직 코드 사전(읽기 전용) 제공 — 콤보·표시용 */
export async function GET(request: NextRequest) {
  const auth = await requireSessionUserUnlocked(request)
  if (!auth.ok) return auth.response

  const [depts, subDepts, roles, grades] = await Promise.all([
    prisma.orgDeptCode.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, labelKo: true },
    }),
    prisma.orgSubDeptCode.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, labelKo: true, deptCode: true },
    }),
    prisma.orgRoleCode.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, labelKo: true, permissionKey: true },
    }),
    prisma.orgGradeCode.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, labelKo: true, mapsToGrade: true },
    }),
  ])

  return NextResponse.json({ depts, subDepts, roles, grades })
}
