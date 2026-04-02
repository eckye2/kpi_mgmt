import type { Prisma, PrismaClient } from '@prisma/client'
import { listDepartmentLabels } from '@/lib/evaluation-grade-rules'

export const STAFF_DIST_GRADES = ['A', 'B', 'C', 'D', 'S', 'E'] as const
export type StaffDistGrade = (typeof STAFF_DIST_GRADES)[number]

/** 기본 배분율(%) — 합계 100 */
export const DEFAULT_STAFF_DISTRIBUTION_PCT: Record<StaffDistGrade, number> = {
  A: 20,
  B: 50,
  C: 20,
  D: 10,
  S: 0,
  E: 0,
}

export function defaultPercentagesRecord(): Record<string, number> {
  return { ...DEFAULT_STAFF_DISTRIBUTION_PCT }
}

export function parsePercentagesJson(raw: Prisma.JsonValue): Record<string, number> {
  const out = defaultPercentagesRecord()
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const g of STAFF_DIST_GRADES) {
      const v = (raw as Record<string, unknown>)[g]
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100) {
        out[g] = Math.round(v * 100) / 100
      }
    }
  }
  return out
}

export function sumPercentages(p: Record<string, number>): number {
  return STAFF_DIST_GRADES.reduce((s, g) => s + (Number(p[g]) || 0), 0)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 합계가 100 초과이면 실패 */
export function validateStaffPercentages(p: Record<string, number>): {
  ok: boolean
  sum: number
  error?: string
} {
  for (const g of STAFF_DIST_GRADES) {
    const v = Number(p[g]) || 0
    if (v < 0 || v > 100) {
      return { ok: false, sum: sumPercentages(p), error: `${g}는 0~100% 사이여야 합니다.` }
    }
  }
  const sum = round2(sumPercentages(p))
  if (sum > 100.0001) {
    return {
      ok: false,
      sum,
      error: `등급별 배분율 합계는 100%를 넘을 수 없습니다. (현재 ${sum}%)`,
    }
  }
  return { ok: true, sum }
}

export function recommendedHeadcount(
  staffCount: number,
  pct: number
): number {
  if (staffCount <= 0 || pct <= 0) return 0
  return Math.floor((staffCount * pct) / 100)
}

export async function countStaffByDept(
  prisma: PrismaClient,
  depts: string[]
): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const d of depts) {
    const n = await prisma.user.count({
      where: { dept: d, role: 'STAFF' },
    })
    out[d] = n
  }
  return out
}

export type StaffDistributionRow = {
  dept: string
  percentages: Record<string, number>
  staffCount: number
  sumPct: number
}

export async function loadStaffDistributionPayload(
  prisma: PrismaClient,
  year: number
): Promise<StaffDistributionRow[]> {
  const depts = await listDepartmentLabels(prisma)
  const [rows, counts] = await Promise.all([
    prisma.evaluationStaffGradeDistribution.findMany({ where: { year } }),
    countStaffByDept(prisma, depts),
  ])
  const byDept = new Map(rows.map((r) => [r.dept, parsePercentagesJson(r.percentages)]))
  return depts.map((dept) => {
    const percentages = byDept.get(dept) ?? defaultPercentagesRecord()
    const sumPct = round2(sumPercentages(percentages))
    return {
      dept,
      percentages,
      staffCount: counts[dept] ?? 0,
      sumPct,
    }
  })
}
