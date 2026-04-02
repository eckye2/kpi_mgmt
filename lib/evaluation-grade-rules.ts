import type { EvaluationTargetRole, Prisma, PrismaClient } from '@prisma/client'

export const EVAL_GRADE_TOKENS = ['A', 'B', 'C', 'D', 'S', 'E'] as const
export type EvalGradeToken = (typeof EVAL_GRADE_TOKENS)[number]

export const DEFAULT_EVAL_GRADES: EvalGradeToken[] = [
  'A',
  'B',
  'C',
  'D',
  'S',
  'E',
]

export function ruleKey(dept: string, target: EvaluationTargetRole): string {
  return `${dept}|${target}`
}

export function parseGradesJson(raw: Prisma.JsonValue): EvalGradeToken[] {
  if (!Array.isArray(raw)) return [...DEFAULT_EVAL_GRADES]
  const out: EvalGradeToken[] = []
  const set = new Set(EVAL_GRADE_TOKENS)
  for (const x of raw) {
    if (typeof x === 'string' && set.has(x as EvalGradeToken)) {
      out.push(x as EvalGradeToken)
    }
  }
  return out.length > 0 ? out : [...DEFAULT_EVAL_GRADES]
}

export function normalizeGradeList(input: unknown): EvalGradeToken[] {
  if (!Array.isArray(input)) return [...DEFAULT_EVAL_GRADES]
  const set = new Set<string>(EVAL_GRADE_TOKENS)
  const out: EvalGradeToken[] = []
  for (const x of input) {
    if (typeof x === 'string' && set.has(x)) {
      const t = x as EvalGradeToken
      if (!out.includes(t)) out.push(t)
    }
  }
  return out.length > 0 ? out : [...DEFAULT_EVAL_GRADES]
}

export async function listDepartmentLabels(prisma: PrismaClient): Promise<string[]> {
  const org = await prisma.orgDeptCode.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { labelKo: true },
  })
  if (org.length > 0) {
    return org.map((o) => o.labelKo)
  }
  const users = await prisma.user.findMany({
    distinct: ['dept'],
    select: { dept: true },
    orderBy: { dept: 'asc' },
  })
  return users.map((u) => u.dept)
}

export async function countTargetsByDept(
  prisma: PrismaClient,
  depts: string[]
): Promise<Record<string, Record<EvaluationTargetRole, number>>> {
  const out: Record<string, Record<EvaluationTargetRole, number>> = {}
  for (const d of depts) {
    const [hq, ch, st] = await Promise.all([
      prisma.user.count({ where: { dept: d, role: 'HQ_HEAD' } }),
      prisma.user.count({ where: { dept: d, role: 'CENTER_HEAD' } }),
      prisma.user.count({ where: { dept: d, role: 'STAFF' } }),
    ])
    out[d] = {
      HQ_HEAD: hq,
      CENTER_HEAD: ch,
      STAFF: st,
    }
  }
  return out
}

export async function loadRulesMap(
  prisma: PrismaClient,
  year: number,
  depts: string[]
): Promise<Map<string, EvalGradeToken[]>> {
  const rows = await prisma.evaluationGradeRule.findMany({
    where: { year, dept: { in: depts } },
  })
  const map = new Map<string, EvalGradeToken[]>()
  for (const r of rows) {
    map.set(ruleKey(r.dept, r.targetRole), parseGradesJson(r.grades))
  }
  return map
}

export function buildRulesPayload(
  depts: string[],
  map: Map<string, EvalGradeToken[]>
): {
  dept: string
  targetRole: EvaluationTargetRole
  grades: EvalGradeToken[]
}[] {
  const targets: EvaluationTargetRole[] = ['HQ_HEAD', 'CENTER_HEAD', 'STAFF']
  const list: { dept: string; targetRole: EvaluationTargetRole; grades: EvalGradeToken[] }[] = []
  for (const dept of depts) {
    for (const targetRole of targets) {
      const g = map.get(ruleKey(dept, targetRole)) ?? [...DEFAULT_EVAL_GRADES]
      list.push({ dept, targetRole, grades: g })
    }
  }
  return list
}
