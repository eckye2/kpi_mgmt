import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUserUnlocked } from '@/lib/auth/session-user'

// 목표수정 승인
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response

    await request.json().catch(() => ({}))
    const resolvedParams = await params
    const goalId = parseInt(resolvedParams.id)
    const approver = auth.user

    if (!goalId) {
      return NextResponse.json({ error: 'goalId is required' }, { status: 400 })
    }

    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            role: true,
            dept: true,
            subDept: true,
          },
        },
      },
    })

    if (!goal || !goal.owner) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    // 승인 권한 확인
    let hasPermission = false
    if (goal.owner.role === 'STAFF' && approver.role === 'CENTER_HEAD' && goal.owner.subDept === approver.subDept) {
      hasPermission = true
    } else if (goal.owner.role === 'CENTER_HEAD' && approver.role === 'HQ_HEAD' && goal.owner.dept === approver.dept) {
      hasPermission = true
    } else if (goal.owner.role === 'HQ_HEAD' && approver.role === 'VICE_PRESIDENT') {
      hasPermission = true
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: '목표 수정 승인 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 목표수정 승인 처리
    const updatedGoal = await prisma.goal.update({
      where: { id: goalId },
      data: {
        modificationStatus: 'APPROVED',
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // 요청자에게 알림
    if (goal.owner) {
      await prisma.notification.create({
        data: {
          userId: goal.owner.id,
          type: 'MODIFICATION_APPROVED',
          message: `${approver.name}님이 목표 수정 요청을 승인했습니다. 이제 목표를 수정할 수 있습니다.`,
          goalId: goal.id,
          fromUserId: approver.id,
        },
      })
    }

    return NextResponse.json({ goal: updatedGoal }, { status: 200 })
  } catch (error) {
    console.error('Error approving modification:', error)
    return NextResponse.json(
      { error: 'Failed to approve modification' },
      { status: 500 }
    )
  }
}

// 목표수정 거절
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { reason } = body
    const resolvedParams = await params
    const goalId = parseInt(resolvedParams.id)
    const approver = auth.user

    if (!goalId || !reason) {
      return NextResponse.json(
        { error: 'goalId and reason are required' },
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
            role: true,
            dept: true,
            subDept: true,
          },
        },
      },
    })

    if (!goal || !goal.owner) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    // 승인 권한 확인
    let hasPermission = false
    if (goal.owner.role === 'STAFF' && approver.role === 'CENTER_HEAD' && goal.owner.subDept === approver.subDept) {
      hasPermission = true
    } else if (goal.owner.role === 'CENTER_HEAD' && approver.role === 'HQ_HEAD' && goal.owner.dept === approver.dept) {
      hasPermission = true
    } else if (goal.owner.role === 'HQ_HEAD' && approver.role === 'VICE_PRESIDENT') {
      hasPermission = true
    }

    if (!hasPermission) {
      return NextResponse.json(
        { error: '목표 수정 거절 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 목표수정 거절 처리
    const updatedGoal = await prisma.goal.update({
      where: { id: goalId },
      data: {
        modificationStatus: 'REJECTED',
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // 요청자에게 알림
    if (goal.owner) {
      await prisma.notification.create({
        data: {
          userId: goal.owner.id,
          type: 'MODIFICATION_REJECTED',
          message: `${approver.name}님이 목표 수정 요청을 거절했습니다.\n\n거절 사유: ${reason}`,
          goalId: goal.id,
          fromUserId: approver.id,
        },
      })
    }

    return NextResponse.json({ goal: updatedGoal }, { status: 200 })
  } catch (error) {
    console.error('Error rejecting modification:', error)
    return NextResponse.json(
      { error: 'Failed to reject modification' },
      { status: 500 }
    )
  }
}
