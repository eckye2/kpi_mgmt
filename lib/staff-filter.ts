import type { OrgRole } from '@prisma/client'
import type { StaffMemberJson } from '@/lib/staff-serialize'

/** 대시보드 canViewMember / availableEmployees 규칙에 맞춰 목록 축소 */
export function filterStaffForViewer(
  viewer: {
    id: number
    dept: string
    subDept: string
    role: OrgRole
  },
  all: StaffMemberJson[]
): StaffMemberJson[] {
  const vr = viewer.role
  if (vr === 'PRESIDENT' || vr === 'VICE_PRESIDENT') {
    const rest = all.filter((t) => t.id !== viewer.id)
    const self = all.find((t) => t.id === viewer.id)
    // UI에서 currentUser 매칭을 위해 본인 행은 항상 포함
    return self ? [self, ...rest] : rest
  }
  if (vr === 'HQ_HEAD') {
    const matchesHqView = (t: StaffMemberJson) =>
      (t.dept === viewer.dept &&
        t.subDept !== '본부직할' &&
        t.role !== '본부장') ||
      t.role === '부원장' ||
      t.role === '원장'
    const rest = all.filter((t) => t.id !== viewer.id && matchesHqView(t))
    const self = all.find((t) => t.id === viewer.id)
    // 본부장 본인은 t.role !== '본부장' 조건에 걸려 빠지므로, currentUser 매칭을 위해 항상 포함
    return self ? [self, ...rest] : rest
  }
  if (vr === 'CENTER_HEAD') {
    return all.filter(
      (t) =>
        (t.dept === viewer.dept && t.subDept === viewer.subDept) ||
        (t.dept === viewer.dept && t.role === '본부장')
    )
  }
  if (vr === 'STAFF') {
    return all.filter(
      (t) =>
        t.id === viewer.id ||
        (t.dept === viewer.dept &&
          t.subDept === viewer.subDept &&
          t.role === '센터장')
    )
  }
  return all.filter((t) => t.id === viewer.id)
}
