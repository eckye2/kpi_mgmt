import { NextRequest, NextResponse } from 'next/server'
import type { EvaluationTargetRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/require-admin-api'
import { logAdminAudit } from '@/lib/admin-audit'
import { clientIp } from '@/lib/admin'
import {
  listDepartmentLabels,
  normalizeGradeList,
  ruleKey,
} from '@/lib/evaluation-grade-rules'

const TARGETS: EvaluationTargetRole[] = ['HQ_HEAD', 'CENTER_HEAD', 'STAFF']

export async function PUT(request: NextRequest) {
  const gate = await requireAdminApi(request)
  if (!gate.ok) return gate.response

  const body = await request.json().catch(() => null)
  const year = Number(body?.year)
  const rulesIn = body?.rules

  if (!year || Number.isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }
  if (!Array.isArray(rulesIn)) {
    return NextResponse.json({ error: 'rules must be an array' }, { status: 400 })
  }

  const allowedDepts = new Set(await listDepartmentLabels(prisma))

  const rows: { dept: string; targetRole: EvaluationTargetRole; grades: string[] }[] = []
  for (const r of rulesIn) {
    const dept = typeof r?.dept === 'string' ? r.dept.trim() : ''
    const targetRole = r?.targetRole as EvaluationTargetRole
    if (!dept || !allowedDepts.has(dept)) {
      return NextResponse.json({ error: `Unknown dept: ${dept || '(empty)'}` }, { status: 400 })
    }
    if (!TARGETS.includes(targetRole)) {
      return NextResponse.json({ error: 'Invalid targetRole' }, { status: 400 })
    }
    const grades = normalizeGradeList(r?.grades)
    rows.push({ dept, targetRole, grades })
  }

  const seen = new Set<string>()
  for (const row of rows) {
    const k = ruleKey(row.dept, row.targetRole)
    if (seen.has(k)) {
      return NextResponse.json({ error: `Duplicate rule: ${k}` }, { status: 400 })
    }
    seen.add(k)
  }

  await prisma.$transaction(async (tx) => {
    await tx.evaluationGradeRule.deleteMany({ where: { year } })
    if (rows.length > 0) {
      await tx.evaluationGradeRule.createMany({
        data: rows.map((row) => ({
          year,
          dept: row.dept,
          targetRole: row.targetRole,
          grades: row.grades,
        })),
      })
    }
  })

  await logAdminAudit(prisma, {
    actorId: gate.user.id,
    action: 'EVAL_GRADE_RULES_SAVE',
    targetType: 'EvaluationGradeRule',
    targetId: String(year),
    detail: JSON.stringify({ ruleCount: rows.length }),
    ip: clientIp(request),
  })

  return NextResponse.json({ ok: true, year, saved: rows.length })
}
