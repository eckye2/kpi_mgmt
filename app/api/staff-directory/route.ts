import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUserUnlocked } from '@/lib/auth/session-user'
import { userToStaffMember } from '@/lib/staff-serialize'
import { filterStaffForViewer } from '@/lib/staff-filter'

export async function GET(request: NextRequest) {
  const auth = await requireSessionUserUnlocked(request)
  if (!auth.ok) return auth.response

  const [users, roleRows, gradeRows] = await Promise.all([
    prisma.user.findMany({
      orderBy: { id: 'asc' },
      include: {
        reviews: {
          select: {
            year: true,
            performance: true,
            competency: true,
            grade: true,
          },
          orderBy: { year: 'asc' },
        },
      },
    }),
    prisma.orgRoleCode.findMany({
      where: { active: true },
      select: { labelKo: true, permissionKey: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.orgGradeCode.findMany({
      where: { active: true },
      select: { labelKo: true, mapsToGrade: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const labels = { roles: roleRows, grades: gradeRows }

  const all = users.map((u) =>
    userToStaffMember(
      {
        id: u.id,
        name: u.name,
        dept: u.dept,
        subDept: u.subDept,
        role: u.role,
        gradeLevel: u.gradeLevel,
        employeeNo: u.employeeNo,
        email: u.email,
        hireDate: u.hireDate,
      },
      u.reviews,
      labels
    )
  )

  const staff = filterStaffForViewer(
    {
      id: auth.user.id,
      dept: auth.user.dept,
      subDept: auth.user.subDept,
      role: auth.user.role,
    },
    all
  )

  return NextResponse.json({ staff, fullCount: all.length })
}
