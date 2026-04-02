import { OrgRole, GoalLevel } from '@prisma/client'

export interface UserPermission {
  id: number
  employeeNo: string
  email: string
  name: string
  dept: string
  subDept: string
  role: OrgRole
}

export function canViewGoalLevel(
  user: UserPermission,
  level: GoalLevel,
  targetDept?: string,
  targetSubDept?: string
): boolean {
  if (level === 'CORPORATE') {
    return user.role === 'PRESIDENT' || user.role === 'VICE_PRESIDENT'
  }

  if (level === 'HQ') {
    if (user.role === 'PRESIDENT' || user.role === 'VICE_PRESIDENT') {
      return true
    }
    if (user.role === 'HQ_HEAD') {
      return user.dept === targetDept
    }
    if (user.role === 'CENTER_HEAD') {
      return user.dept === targetDept
    }
    return false
  }

  if (level === 'CENTER') {
    if (user.role === 'PRESIDENT' || user.role === 'VICE_PRESIDENT') {
      return true
    }
    if (user.role === 'HQ_HEAD') {
      return user.dept === targetDept
    }
    if (user.role === 'CENTER_HEAD') {
      return user.dept === targetDept && user.subDept === targetSubDept
    }
    if (user.role === 'STAFF') {
      return user.dept === targetDept && user.subDept === targetSubDept
    }
    return false
  }

  if (level === 'PERSONAL') {
    if (user.role === 'PRESIDENT' || user.role === 'VICE_PRESIDENT') {
      return true
    }
    if (user.role === 'HQ_HEAD') {
      return user.dept === targetDept
    }
    if (user.role === 'CENTER_HEAD') {
      return user.dept === targetDept && user.subDept === targetSubDept
    }
    return false
  }

  return false
}

export function canManageGoal(user: UserPermission, level: GoalLevel): boolean {
  if (level === 'CORPORATE') {
    return user.role === 'PRESIDENT' || user.role === 'VICE_PRESIDENT'
  }
  if (level === 'HQ') {
    return user.role === 'HQ_HEAD'
  }
  if (level === 'CENTER') {
    return user.role === 'CENTER_HEAD'
  }
  if (level === 'PERSONAL') {
    return true
  }
  return false
}

export function getAccessibleOrgs(user: UserPermission) {
  if (user.role === 'PRESIDENT' || user.role === 'VICE_PRESIDENT') {
    return { depts: '*', subDepts: '*' }
  }
  if (user.role === 'HQ_HEAD') {
    return { depts: [user.dept], subDepts: '*' }
  }
  if (user.role === 'CENTER_HEAD' || user.role === 'STAFF') {
    return { depts: [user.dept], subDepts: [user.subDept] }
  }
  return { depts: [], subDepts: [] }
}
