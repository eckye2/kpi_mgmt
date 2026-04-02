import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUserUnlocked } from '@/lib/auth/session-user'

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

    // 목표 조회
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

    // 승인 권한 확인 및 승인 단계 결정
    let updateData: any = {}
    
    // 일반직원 목표 → 센터장 승인
    if (goal.owner.role === 'STAFF' && approver.role === 'CENTER_HEAD') {
      if (goal.firstApproverId) {
        return NextResponse.json(
          { error: '이미 승인된 목표입니다.' },
          { status: 400 }
        )
      }
      updateData = {
        firstApproverId: approver.id,
        firstApprovedAt: new Date(),
        status: 'APPROVED',
      }
    }
    // 센터장 목표 → 본부장 승인
    else if (goal.owner.role === 'CENTER_HEAD' && approver.role === 'HQ_HEAD') {
      if (goal.firstApproverId) {
        return NextResponse.json(
          { error: '이미 승인된 목표입니다.' },
          { status: 400 }
        )
      }
      updateData = {
        firstApproverId: approver.id,
        firstApprovedAt: new Date(),
        status: 'APPROVED',
      }
    }
    // 본부장 목표 → 부원장 1차 승인
    else if (goal.owner.role === 'HQ_HEAD' && approver.role === 'VICE_PRESIDENT') {
      if (goal.firstApproverId) {
        return NextResponse.json(
          { error: '이미 1차 승인되었습니다.' },
          { status: 400 }
        )
      }
      updateData = {
        firstApproverId: approver.id,
        firstApprovedAt: new Date(),
        status: 'PENDING', // 원장 승인 대기
      }
    }
    // 본부장 목표 → 원장 2차 승인 (최종 승인)
    else if (goal.owner.role === 'HQ_HEAD' && approver.role === 'PRESIDENT') {
      if (!goal.firstApproverId) {
        return NextResponse.json(
          { error: '부원장 승인이 먼저 필요합니다.' },
          { status: 400 }
        )
      }
      if (goal.secondApproverId) {
        return NextResponse.json(
          { error: '이미 최종 승인되었습니다.' },
          { status: 400 }
        )
      }
      updateData = {
        secondApproverId: approver.id,
        secondApprovedAt: new Date(),
        status: 'APPROVED',
      }
    }
    else {
      return NextResponse.json(
        { error: '승인 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 목표 업데이트
    const updatedGoal = await prisma.goal.update({
      where: { id: goalId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        firstApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        secondApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    // 목표 소유자에게 승인 알림 생성
    if (goal.owner) {
      const levelNames: Record<string, string> = {
        CORPORATE: '전사',
        HQ: '본부',
        CENTER: '센터',
        PERSONAL: '개인',
      }
      const levelName = levelNames[goal.level] || goal.level
      
      let message = ''
      if (updateData.status === 'APPROVED') {
        message = `${approver.name}님이 ${levelName} 목표를 승인했습니다`
      } else if (updateData.status === 'PENDING') {
        message = `${approver.name}님이 ${levelName} 목표를 1차 승인했습니다 (원장 승인 대기)`
      }

      if (message) {
        await prisma.notification.create({
          data: {
            userId: goal.owner.id,
            type: 'APPROVED',
            message,
            goalId: goal.id,
            fromUserId: approver.id,
          },
        })
      }
    }

    // 부원장이 승인하면 원장에게 알림 (2차 승인 요청)
    if (goal.owner?.role === 'HQ_HEAD' && approver.role === 'VICE_PRESIDENT') {
      const president = await prisma.user.findFirst({
        where: { role: 'PRESIDENT' },
        select: { id: true },
      })

      if (president) {
        await prisma.notification.create({
          data: {
            userId: president.id,
            type: 'APPROVAL_REQUEST',
            message: `${goal.owner.name}님의 본부 목표가 최종 승인을 기다리고 있습니다`,
            goalId: goal.id,
            fromUserId: goal.owner.id,
          },
        })
      }
    }

    return NextResponse.json({ goal: updatedGoal }, { status: 200 })
  } catch (error) {
    console.error('Error approving goal:', error)
    return NextResponse.json(
      { error: 'Failed to approve goal' },
      { status: 500 }
    )
  }
}

// 승인 해제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response

    const resolvedParams = await params
    const goalId = parseInt(resolvedParams.id)
    const approver = auth.user

    if (!goalId) {
      return NextResponse.json({ error: 'goalId is required' }, { status: 400 })
    }

    // 목표 조회
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    })

    if (!goal || !goal.owner) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    // 승인 해제 권한 확인
    let updateData: any = {}
    
    // 원장이 2차 승인 해제
    if (approver.id === goal.secondApproverId && approver.role === 'PRESIDENT') {
      updateData = {
        secondApproverId: null,
        secondApprovedAt: null,
        status: 'PENDING', // 부원장 승인 상태로 복귀
      }
    }
    // 부원장 또는 센터장/본부장의 승인자가 1차 승인 해제
    else if (approver.id === goal.firstApproverId) {
      // 2차 승인이 있으면 해제 불가
      if (goal.secondApproverId) {
        return NextResponse.json(
          { error: '상위 승인을 먼저 해제해야 합니다.' },
          { status: 400 }
        )
      }
      updateData = {
        firstApproverId: null,
        firstApprovedAt: null,
        status: 'DRAFT',
      }
    }
    else {
      return NextResponse.json(
        { error: '승인 해제 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 목표 업데이트
    const updatedGoal = await prisma.goal.update({
      where: { id: goalId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        firstApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        secondApprover: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    // 목표 소유자에게 승인 해제 알림 생성
    if (goal.owner) {
      const levelNames: Record<string, string> = {
        CORPORATE: '전사',
        HQ: '본부',
        CENTER: '센터',
        PERSONAL: '개인',
      }
      const levelName = levelNames[goal.level] || goal.level

      await prisma.notification.create({
        data: {
          userId: goal.owner.id,
          type: 'REVOKED',
          message: `${approver.name}님이 ${levelName} 목표의 승인을 해제했습니다`,
          goalId: goal.id,
          fromUserId: approver.id,
        },
      })
    }

    return NextResponse.json({ goal: updatedGoal }, { status: 200 })
  } catch (error) {
    console.error('Error revoking approval:', error)
    return NextResponse.json(
      { error: 'Failed to revoke approval' },
      { status: 500 }
    )
  }
}

// 거절
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
    const rejecter = auth.user

    if (!goalId) {
      return NextResponse.json({ error: 'goalId is required' }, { status: 400 })
    }

    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // 목표 조회
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

    // 거절 권한 확인
    const canReject =
      (goal.owner.role === 'STAFF' && rejecter.role === 'CENTER_HEAD') ||
      (goal.owner.role === 'CENTER_HEAD' && rejecter.role === 'HQ_HEAD') ||
      (goal.owner.role === 'HQ_HEAD' && (rejecter.role === 'VICE_PRESIDENT' || rejecter.role === 'PRESIDENT'))

    if (!canReject) {
      return NextResponse.json(
        { error: '거절 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 목표를 DRAFT 상태로 변경하고 거절 사유 저장
    const updatedGoal = await prisma.goal.update({
      where: { id: goalId },
      data: {
        status: 'DRAFT',
        rejectedReason: reason,
        firstApproverId: null,
        firstApprovedAt: null,
        secondApproverId: null,
        secondApprovedAt: null,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    })

    // 목표 소유자에게 거절 알림 생성
    if (goal.owner) {
      const levelNames: Record<string, string> = {
        CORPORATE: '전사',
        HQ: '본부',
        CENTER: '센터',
        PERSONAL: '개인',
      }
      const levelName = levelNames[goal.level] || goal.level

      await prisma.notification.create({
        data: {
          userId: goal.owner.id,
          type: 'REJECTED',
          message: `${rejecter.name}님이 ${levelName} 목표를 거절했습니다: ${reason}`,
          goalId: goal.id,
          fromUserId: rejecter.id,
        },
      })
    }

    return NextResponse.json({ goal: updatedGoal }, { status: 200 })
  } catch (error) {
    console.error('Error rejecting goal:', error)
    return NextResponse.json(
      { error: 'Failed to reject goal' },
      { status: 500 }
    )
  }
}
