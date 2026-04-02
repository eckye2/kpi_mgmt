import type { OrgRole, GradeLevel, PerformanceReview } from '@prisma/client'

/** `OrgRoleCode`에서 permissionKey 일치 행의 표시명 */
export type OrgRoleLabelRow = {
  labelKo: string
  permissionKey: OrgRole | null
  sortOrder: number
}

/** `OrgGradeCode`에서 mapsToGrade 일치 행 — 동일 단 여러 라벨 시 sortOrder 우선 */
export type OrgGradeLabelRow = {
  labelKo: string
  mapsToGrade: GradeLevel | null
  sortOrder: number
}

export type StaffDisplayLabels = {
  roles: OrgRoleLabelRow[]
  grades: OrgGradeLabelRow[]
}

const roleFallback: Record<OrgRole, string> = {
  PRESIDENT: '원장',
  VICE_PRESIDENT: '부원장',
  HQ_HEAD: '본부장',
  CENTER_HEAD: '센터장',
  STAFF: '직원',
}

const gradeFallback: Record<GradeLevel, string> = {
  LEVEL_1: '1급갑',
  LEVEL_2: '2급갑',
  LEVEL_3: '3급갑',
  LEVEL_4: '4급갑',
}

const gradeLevelNum: Record<GradeLevel, 1 | 2 | 3 | 4> = {
  LEVEL_1: 1,
  LEVEL_2: 2,
  LEVEL_3: 3,
  LEVEL_4: 4,
}

function resolveRoleLabel(
  role: OrgRole,
  rows: OrgRoleLabelRow[] | undefined
): string {
  if (rows?.length) {
    const hit = rows
      .filter((r) => r.permissionKey === role)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]
    if (hit) return hit.labelKo
  }
  return roleFallback[role]
}

function resolveGradeLabel(
  gradeLevel: GradeLevel,
  rows: OrgGradeLabelRow[] | undefined
): string {
  if (rows?.length) {
    const hit = rows
      .filter((r) => r.mapsToGrade === gradeLevel)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]
    if (hit) return hit.labelKo
  }
  return gradeFallback[gradeLevel]
}

export type StaffMemberJson = {
  id: number
  name: string
  dept: string
  subDept: string
  role: string
  grade: string
  gradeLevel: 1 | 2 | 3 | 4
  employeeNo: string
  email: string
  hireDate: string
  evaluations: {
    year: number
    performance: string
    competency: string
    grade: string
  }[]
}

export function userToStaffMember(
  u: {
    id: number
    name: string
    dept: string
    subDept: string
    role: OrgRole
    gradeLevel: GradeLevel
    employeeNo: string
    email: string
    hireDate: Date
  },
  reviews: Pick<
    PerformanceReview,
    'year' | 'performance' | 'competency' | 'grade'
  >[],
  labels?: StaffDisplayLabels
): StaffMemberJson {
  return {
    id: u.id,
    name: u.name,
    dept: u.dept,
    subDept: u.subDept,
    role: resolveRoleLabel(u.role, labels?.roles),
    grade: resolveGradeLabel(u.gradeLevel, labels?.grades),
    gradeLevel: gradeLevelNum[u.gradeLevel],
    employeeNo: u.employeeNo,
    email: u.email,
    hireDate: u.hireDate.toISOString().slice(0, 10),
    evaluations: reviews.map((r) => ({
      year: r.year,
      performance: r.performance,
      competency: r.competency,
      grade: r.grade,
    })),
  }
}
