import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/require-admin-api'
import { logAdminAudit } from '@/lib/admin-audit'
import { clientIp } from '@/lib/admin'
import { isEmailDomainAllowed } from '@/lib/email-domain'
import type { GradeLevel, OrgRole } from '@prisma/client'

const userPublicSelect = {
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
  createdAt: true,
  updatedAt: true,
} as const

export async function GET(request: NextRequest) {
  const gate = await requireAdminApi(request)
  if (!gate.ok) return gate.response

  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    select: userPublicSelect,
  })

  return NextResponse.json({ users })
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminApi(request)
  if (!gate.ok) return gate.response

  const body = await request.json().catch(() => null)
  const employeeNo = String(body?.employeeNo ?? '').trim().slice(0, 10)
  const email = String(body?.email ?? '').trim().toLowerCase()
  const name = String(body?.name ?? '').trim()
  const dept = String(body?.dept ?? '').trim()
  const subDept = String(body?.subDept ?? '').trim()
  const roleStr = String(body?.role ?? '').trim()
  const gradeStr = String(body?.gradeLevel ?? '').trim()
  const hireRaw = String(body?.hireDate ?? '').trim()
  const initialPassword = String(body?.initialPassword ?? '').trim()
  const isSystemAdmin = Boolean(body?.isSystemAdmin)

  if (!employeeNo || !email || !name || !dept || !subDept) {
    return NextResponse.json(
      { error: '사번, 이메일, 이름, 본부, 센터는 필수입니다.' },
      { status: 400 }
    )
  }

  if (!isEmailDomainAllowed(email)) {
    return NextResponse.json(
      { error: '허용되지 않은 이메일 도메인입니다.' },
      { status: 400 }
    )
  }

  const role = isOrgRole(roleStr) ? roleStr : null
  const gradeLevel = isGradeLevel(gradeStr) ? gradeStr : null
  const hireDate = new Date(hireRaw)
  if (!role || !gradeLevel || Number.isNaN(hireDate.getTime())) {
    return NextResponse.json(
      { error: '역할, 등급단, 입사일(YYYY-MM-DD)이 올바른지 확인하세요.' },
      { status: 400 }
    )
  }

  let passwordRaw: string
  let mustChangePassword: boolean
  if (initialPassword.length === 0) {
    passwordRaw = employeeNo
    mustChangePassword = true
  } else if (initialPassword.length >= 6) {
    passwordRaw = initialPassword
    mustChangePassword = false
  } else {
    return NextResponse.json(
      {
        error:
          '초기 비밀번호는 8자 이상이거나, 비워 두면 사번이 임시 비밀번호로 설정됩니다.',
      },
      { status: 400 }
    )
  }

  try {
    const passwordHash = await bcrypt.hash(passwordRaw, 10)
    const created = await prisma.user.create({
      data: {
        employeeNo,
        email,
        name,
        dept,
        subDept,
        role,
        gradeLevel,
        hireDate,
        passwordHash,
        isSystemAdmin,
        mustChangePassword,
      },
      select: userPublicSelect,
    })

    await logAdminAudit(prisma, {
      actorId: gate.user.id,
      action: 'USER_CREATE',
      targetType: 'User',
      targetId: String(created.id),
      detail: JSON.stringify({ email: created.email, employeeNo: created.employeeNo }),
      ip: clientIp(request),
    })

    return NextResponse.json({ user: created })
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
    if (code === 'P2002') {
      return NextResponse.json(
        { error: '이미 사용 중인 사번 또는 이메일입니다.' },
        { status: 409 }
      )
    }
    console.error(e)
    return NextResponse.json({ error: '사용자 생성에 실패했습니다.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireAdminApi(request)
  if (!gate.ok) return gate.response

  const body = await request.json().catch(() => null)
  const userId = Number(body?.userId)
  if (!userId || Number.isNaN(userId)) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: userPublicSelect,
  })
  if (!before) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const data: {
    name?: string
    dept?: string
    subDept?: string
    role?: OrgRole
    gradeLevel?: GradeLevel
    isSystemAdmin?: boolean
  } = {}

  if (typeof body.name === 'string') data.name = body.name.trim()
  if (typeof body.dept === 'string') data.dept = body.dept.trim()
  if (typeof body.subDept === 'string') data.subDept = body.subDept.trim()
  if (typeof body.role === 'string' && isOrgRole(body.role)) data.role = body.role
  if (typeof body.gradeLevel === 'string' && isGradeLevel(body.gradeLevel))
    data.gradeLevel = body.gradeLevel
  if (typeof body.isSystemAdmin === 'boolean') data.isSystemAdmin = body.isSystemAdmin

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: userPublicSelect,
  })

  await logAdminAudit(prisma, {
    actorId: gate.user.id,
    action: 'USER_UPDATE',
    targetType: 'User',
    targetId: String(userId),
    detail: JSON.stringify({ before, after: updated }),
    ip: clientIp(request),
  })

  return NextResponse.json({ user: updated })
}

function isOrgRole(v: string): v is OrgRole {
  return (
    v === 'PRESIDENT' ||
    v === 'VICE_PRESIDENT' ||
    v === 'HQ_HEAD' ||
    v === 'CENTER_HEAD' ||
    v === 'STAFF'
  )
}

function isGradeLevel(v: string): v is GradeLevel {
  return (
    v === 'LEVEL_1' ||
    v === 'LEVEL_2' ||
    v === 'LEVEL_3' ||
    v === 'LEVEL_4'
  )
}
