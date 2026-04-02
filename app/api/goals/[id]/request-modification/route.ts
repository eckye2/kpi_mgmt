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

    const body = await request.json()
    const { modificationReason } = body
    const resolvedParams = await params
    const goalId = parseInt(resolvedParams.id)
    const requester = auth.user

    if (!goalId || !modificationReason) {
      return NextResponse.json(
        { error: 'goalId and modificationReason are required' },
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

    // 본인 목표인지 확인
    if (goal.ownerId !== requester.id) {
      return NextResponse.json(
        { error: '본인의 목표만 수정 요청할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 이미 목표수정 승인 요청 중인 경우
    if (goal.modificationStatus === 'PENDING') {
      return NextResponse.json(
        { error: '이미 목표 수정 승인 요청 중입니다.' },
        { status: 400 }
      )
    }

    // 목표 수정 요청 상태로 변경
    const updatedGoal = await prisma.goal.update({
      where: { id: goalId },
      data: {
        modificationStatus: 'PENDING',
        modificationReason: modificationReason,
      },
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

    // 상급자 찾기
    let approverRole: any = null
    let approverWhere: any = {}

    if (requester.role === 'STAFF') {
      // 직원 → 센터장
      approverRole = 'CENTER_HEAD'
      approverWhere = {
        role: approverRole,
        subDept: requester.subDept,
      }
    } else if (requester.role === 'CENTER_HEAD') {
      // 센터장 → 본부장
      approverRole = 'HQ_HEAD'
      approverWhere = {
        role: approverRole,
        dept: requester.dept,
      }
    } else if (requester.role === 'HQ_HEAD') {
      // 본부장 → 부원장 (1차)
      approverRole = 'VICE_PRESIDENT'
      approverWhere = {
        role: approverRole,
      }
    }

    // 상급자 조회 및 알림 생성
    if (approverRole) {
      const approver = await prisma.user.findFirst({
        where: approverWhere,
        select: { id: true, name: true },
      })

      if (approver) {
        // 알림 생성
        const levelNames: Record<string, string> = {
          CORPORATE: '전사',
          HQ: '본부',
          CENTER: '센터',
          PERSONAL: '개인',
        }
        const levelName = levelNames[goal.level] || goal.level

        await prisma.notification.create({
          data: {
            userId: approver.id,
            type: 'MODIFICATION_REQUEST',
            message: `${requester.name}님이 ${levelName} 목표 수정 승인을 요청했습니다\n\n수정 사유: ${modificationReason}`,
            goalId: goal.id,
            fromUserId: requester.id,
          },
        })
      }
    }

    return NextResponse.json({ goal: updatedGoal }, { status: 200 })
  } catch (error) {
    console.error('Error requesting modification:', error)
    return NextResponse.json(
      { error: 'Failed to request modification approval' },
      { status: 500 }
    )
  }
}
