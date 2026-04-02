import { NextRequest, NextResponse } from 'next/server'
import { requireSessionUserUnlocked } from '@/lib/auth/session-user'

/** 현재 세션 사용자 (쿼리 email 신뢰 제거) */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response

    const u = auth.user
    return NextResponse.json({
      user: {
        id: u.id,
        publicId: u.publicId,
        employeeNo: u.employeeNo,
        email: u.email,
        name: u.name,
        dept: u.dept,
        subDept: u.subDept,
        role: u.role,
        gradeLevel: u.gradeLevel,
        hireDate: u.hireDate,
        isSystemAdmin: u.isSystemAdmin,
      },
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}
