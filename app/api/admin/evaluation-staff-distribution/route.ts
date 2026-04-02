import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/require-admin-api'
import { logAdminAudit } from '@/lib/admin-audit'
import { clientIp } from '@/lib/admin'
import { listDepartmentLabels } from '@/lib/evaluation-grade-rules'
import {
  defaultPercentagesRecord,
  parsePercentagesJson,
  STAFF_DIST_GRADES,
  validateStaffPercentages,
} from '@/lib/evaluation-staff-distribution'

export async function PUT(request: NextRequest) {
  const gate = await requireAdminApi(request)
  if (!gate.ok) return gate.response

  const body = await request.json().catch(() => null)
  const year = Number(body?.year)
  const rowsIn = body?.rows

  if (!year || Number.isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }
  if (!Array.isArray(rowsIn)) {
    return NextResponse.json({ error: 'rows must be an array' }, { status: 400 })
  }

  const allowedDepts = new Set(await listDepartmentLabels(prisma))

  const normalized: { dept: string; percentages: Record<string, number> }[] = []

  for (const r of rowsIn) {
    const dept = typeof r?.dept === 'string' ? r.dept.trim() : ''
    if (!dept || !allowedDepts.has(dept)) {
      return NextResponse.json(
        { error: `Unknown dept: ${dept || '(empty)'}` },
        { status: 400 }
      )
    }
    const base = defaultPercentagesRecord()
    const raw = r?.percentages
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const g of STAFF_DIST_GRADES) {
        const v = (raw as Record<string, unknown>)[g]
        if (typeof v === 'number' && Number.isFinite(v)) {
          base[g] = v
        }
      }
    }
    const v = validateStaffPercentages(base)
    if (!v.ok) {
      return NextResponse.json({ error: v.error, dept, sum: v.sum }, { status: 400 })
    }
    normalized.push({ dept, percentages: base })
  }

  const seen = new Set<string>()
  for (const row of normalized) {
    if (seen.has(row.dept)) {
      return NextResponse.json({ error: `Duplicate dept: ${row.dept}` }, { status: 400 })
    }
    seen.add(row.dept)
  }

  await prisma.$transaction(async (tx) => {
    await tx.evaluationStaffGradeDistribution.deleteMany({ where: { year } })
    if (normalized.length > 0) {
      await tx.evaluationStaffGradeDistribution.createMany({
        data: normalized.map((row) => ({
          year,
          dept: row.dept,
          percentages: row.percentages,
        })),
      })
    }
  })

  await logAdminAudit(prisma, {
    actorId: gate.user.id,
    action: 'EVAL_STAFF_DIST_SAVE',
    targetType: 'EvaluationStaffGradeDistribution',
    targetId: String(year),
    detail: JSON.stringify({ rowCount: normalized.length }),
    ip: clientIp(request),
  })

  return NextResponse.json({ ok: true, year, saved: normalized.length })
}
