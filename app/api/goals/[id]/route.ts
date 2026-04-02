import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canViewGoalLevel } from '@/lib/permissions'
import { requireSessionUserUnlocked } from '@/lib/auth/session-user'

/** 단일 목표 조회 — 세션 사용자 기준 권한 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response

    const resolvedParams = await params
    const goalId = parseInt(resolvedParams.id)
    const user = auth.user

    if (!goalId || isNaN(goalId)) {
      return NextResponse.json(
        { error: 'Valid goal id is required' },
        { status: 400 }
      )
    }

    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            dept: true,
            subDept: true,
            role: true,
            employeeNo: true,
          },
        },
        firstApprover: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        secondApprover: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        metrics: true,
      },
    })

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    if (!goal.owner) {
      return NextResponse.json({ error: 'Goal owner not found' }, { status: 404 })
    }

    const canView = canViewGoalLevel(
      user,
      goal.level,
      goal.owner.dept,
      goal.owner.subDept
    )
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ goal })
  } catch (error) {
    console.error('Error fetching goal by id:', error)
    return NextResponse.json(
      { error: 'Failed to fetch goal' },
      { status: 500 }
    )
  }
}
