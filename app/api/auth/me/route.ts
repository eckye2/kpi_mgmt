import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session-user'

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  return NextResponse.json({
    user: {
      id: user.id,
      publicId: user.publicId,
      employeeNo: user.employeeNo,
      email: user.email,
      name: user.name,
      dept: user.dept,
      subDept: user.subDept,
      role: user.role,
      gradeLevel: user.gradeLevel,
      isSystemAdmin: user.isSystemAdmin,
      mustChangePassword: user.mustChangePassword,
    },
  })
}
