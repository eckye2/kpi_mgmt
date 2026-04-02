export type OrgDeptRow = { code: string; labelKo: string }
export type OrgSubDeptRow = { code: string; labelKo: string; deptCode: string }

/** 코드 사전에 나온 순서로 라벨 배열 정렬 (없는 라벨은 뒤로, localeCompare 보조) */
export function sortLabelsByDeptOrder(
  labels: string[],
  depts: OrgDeptRow[]
): string[] {
  const order = new Map(depts.map((d, i) => [d.labelKo, i]))
  return [...new Set(labels)].sort((a, b) => {
    const ia = order.get(a)
    const ib = order.get(b)
    if (ia !== undefined && ib !== undefined) return ia - ib
    if (ia !== undefined) return -1
    if (ib !== undefined) return 1
    return a.localeCompare(b, "ko")
  })
}

export function sortLabelsBySubDeptOrder(
  labels: string[],
  subDepts: OrgSubDeptRow[]
): string[] {
  const order = new Map(subDepts.map((s, i) => [s.labelKo, i]))
  return [...new Set(labels)].sort((a, b) => {
    const ia = order.get(a)
    const ib = order.get(b)
    if (ia !== undefined && ib !== undefined) return ia - ib
    if (ia !== undefined) return -1
    if (ib !== undefined) return 1
    return a.localeCompare(b, "ko")
  })
}

export type OrgDictionaryPayload = {
  depts: OrgDeptRow[]
  subDepts: OrgSubDeptRow[]
  roles: { code: string; labelKo: string; permissionKey: string | null }[]
  grades: { code: string; labelKo: string; mapsToGrade: string | null }[]
}
