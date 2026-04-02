import { NextRequest, NextResponse } from 'next/server'
import type { GradeLevel, OrgRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/require-admin-api'
import { logAdminAudit } from '@/lib/admin-audit'
import { clientIp } from '@/lib/admin'

const ORG_ROLES: OrgRole[] = [
  'PRESIDENT',
  'VICE_PRESIDENT',
  'HQ_HEAD',
  'CENTER_HEAD',
  'STAFF',
]
const GRADE_LEVELS: GradeLevel[] = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4']

export async function GET(request: NextRequest) {
  const gate = await requireAdminApi(request)
  if (!gate.ok) return gate.response

  const [depts, subDepts, roles, grades] = await Promise.all([
    prisma.orgDeptCode.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.orgSubDeptCode.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.orgRoleCode.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.orgGradeCode.findMany({ orderBy: { sortOrder: 'asc' } }),
  ])

  return NextResponse.json({ depts, subDepts, roles, grades })
}

export async function PUT(request: NextRequest) {
  const gate = await requireAdminApi(request)
  if (!gate.ok) return gate.response

  const body = await request.json().catch(() => null)
  const deptsIn = body?.depts
  const subDeptsIn = body?.subDepts
  const rolesIn = body?.roles
  const gradesIn = body?.grades

  if (!Array.isArray(deptsIn) || !Array.isArray(subDeptsIn) || !Array.isArray(rolesIn) || !Array.isArray(gradesIn)) {
    return NextResponse.json(
      { error: 'depts, subDepts, roles, grades 배열이 필요합니다.' },
      { status: 400 }
    )
  }

  const deptCodes = new Set<string>()
  for (const d of deptsIn) {
    const code = typeof d?.code === 'string' ? d.code.trim() : ''
    if (!code || code.length > 64) {
      return NextResponse.json({ error: '본부 code가 올바르지 않습니다.' }, { status: 400 })
    }
    deptCodes.add(code)
  }

  for (const s of subDeptsIn) {
    const code = typeof s?.code === 'string' ? s.code.trim() : ''
    const deptCode = typeof s?.deptCode === 'string' ? s.deptCode.trim() : ''
    if (!code || code.length > 64) {
      return NextResponse.json({ error: '센터 code가 올바르지 않습니다.' }, { status: 400 })
    }
    if (!deptCode || !deptCodes.has(deptCode)) {
      return NextResponse.json(
        { error: `센터 ${code}: deptCode가 본부 목록에 없습니다.` },
        { status: 400 }
      )
    }
  }

  for (const r of rolesIn) {
    const code = typeof r?.code === 'string' ? r.code.trim() : ''
    if (!code || code.length > 64) {
      return NextResponse.json({ error: '역할 code가 올바르지 않습니다.' }, { status: 400 })
    }
    const pk = r?.permissionKey
    if (pk != null && pk !== '' && !ORG_ROLES.includes(pk as OrgRole)) {
      return NextResponse.json({ error: `역할 ${code}: permissionKey가 유효하지 않습니다.` }, { status: 400 })
    }
  }

  for (const g of gradesIn) {
    const code = typeof g?.code === 'string' ? g.code.trim() : ''
    if (!code || code.length > 64) {
      return NextResponse.json({ error: '등급단 code가 올바르지 않습니다.' }, { status: 400 })
    }
    const mg = g?.mapsToGrade
    if (mg != null && mg !== '' && !GRADE_LEVELS.includes(mg as GradeLevel)) {
      return NextResponse.json({ error: `등급 ${code}: mapsToGrade가 유효하지 않습니다.` }, { status: 400 })
    }
  }

  for (const d of deptsIn) {
    const code = String(d.code).trim()
    if (!String(d.labelKo ?? '').trim()) {
      return NextResponse.json({ error: `본부 ${code}: 표시명(labelKo) 필수` }, { status: 400 })
    }
  }
  for (const s of subDeptsIn) {
    const code = String(s.code).trim()
    if (!String(s.labelKo ?? '').trim()) {
      return NextResponse.json({ error: `센터 ${code}: 표시명(labelKo) 필수` }, { status: 400 })
    }
  }
  for (const r of rolesIn) {
    const code = String(r.code).trim()
    if (!String(r.labelKo ?? '').trim()) {
      return NextResponse.json({ error: `역할 ${code}: 표시명(labelKo) 필수` }, { status: 400 })
    }
  }
  for (const g of gradesIn) {
    const code = String(g.code).trim()
    if (!String(g.labelKo ?? '').trim()) {
      return NextResponse.json({ error: `등급 ${code}: 표시명(labelKo) 필수` }, { status: 400 })
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const d of deptsIn) {
      const code = String(d.code).trim()
      const labelKo = String(d.labelKo ?? '').trim()
      await tx.orgDeptCode.upsert({
        where: { code },
        create: {
          code,
          labelKo,
          sortOrder: Number(d.sortOrder) || 0,
          active: d.active !== false,
        },
        update: {
          labelKo,
          sortOrder: Number(d.sortOrder) || 0,
          active: d.active !== false,
        },
      })
    }

    for (const s of subDeptsIn) {
      const code = String(s.code).trim()
      const labelKo = String(s.labelKo ?? '').trim()
      const deptCode = String(s.deptCode).trim()
      await tx.orgSubDeptCode.upsert({
        where: { code },
        create: {
          code,
          labelKo,
          deptCode,
          sortOrder: Number(s.sortOrder) || 0,
          active: s.active !== false,
        },
        update: {
          labelKo,
          deptCode,
          sortOrder: Number(s.sortOrder) || 0,
          active: s.active !== false,
        },
      })
    }

    for (const r of rolesIn) {
      const code = String(r.code).trim()
      const labelKo = String(r.labelKo ?? '').trim()
      const permissionKey =
        r.permissionKey === '' || r.permissionKey == null
          ? null
          : (r.permissionKey as OrgRole)
      await tx.orgRoleCode.upsert({
        where: { code },
        create: {
          code,
          labelKo,
          permissionKey,
          sortOrder: Number(r.sortOrder) || 0,
          active: r.active !== false,
          remark: typeof r.remark === 'string' ? r.remark : null,
        },
        update: {
          labelKo,
          permissionKey,
          sortOrder: Number(r.sortOrder) || 0,
          active: r.active !== false,
          remark: typeof r.remark === 'string' ? r.remark : null,
        },
      })
    }

    for (const g of gradesIn) {
      const code = String(g.code).trim()
      const labelKo = String(g.labelKo ?? '').trim()
      const mapsToGrade =
        g.mapsToGrade === '' || g.mapsToGrade == null
          ? null
          : (g.mapsToGrade as GradeLevel)
      await tx.orgGradeCode.upsert({
        where: { code },
        create: {
          code,
          labelKo,
          mapsToGrade,
          sortOrder: Number(g.sortOrder) || 0,
          active: g.active !== false,
          remark: typeof g.remark === 'string' ? g.remark : null,
        },
        update: {
          labelKo,
          mapsToGrade,
          sortOrder: Number(g.sortOrder) || 0,
          active: g.active !== false,
          remark: typeof g.remark === 'string' ? g.remark : null,
        },
      })
    }
  })

  await logAdminAudit(prisma, {
    actorId: gate.user.id,
    action: 'ORG_DICTIONARY_SAVE',
    targetType: 'OrgDictionary',
    detail: JSON.stringify({
      depts: deptsIn.length,
      subDepts: subDeptsIn.length,
      roles: rolesIn.length,
      grades: gradesIn.length,
    }),
    ip: clientIp(request),
  })

  return NextResponse.json({ ok: true })
}
