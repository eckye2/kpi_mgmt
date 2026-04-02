import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canViewGoalLevel, canManageGoal, getAccessibleOrgs } from '@/lib/permissions'
import { requireSessionUserUnlocked } from '@/lib/auth/session-user'
import { GoalLevel, RecordStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response

    const user = auth.user
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level') as GoalLevel | null
    const year = searchParams.get('year')
    const dept = searchParams.get('dept') // 조회할 부서
    const subDept = searchParams.get('subDept') // 조회할 센터
    const targetName = searchParams.get('targetName') // 조회할 직원 이름

    // 접근 가능한 조직 정보
    const accessibleOrgs = getAccessibleOrgs(user)

    // 목표 조회 쿼리 구성
    const whereClause: any = {}

    if (level) {
      whereClause.level = level
    }
    
    // 특정 부서/센터/직원의 목표 조회
    if (dept || subDept || targetName) {
      whereClause.owner = {}
      if (dept) whereClause.owner.dept = dept
      if (subDept) whereClause.owner.subDept = subDept
      if (targetName) whereClause.owner.name = targetName
    }

    // 권한에 따른 필터링
    if (accessibleOrgs.depts !== '*') {
      const goals = await prisma.goal.findMany({
        where: whereClause,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              dept: true,
              subDept: true,
              role: true,
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
        orderBy: {
          createdAt: 'desc',
        },
      })

      // 권한 기반 필터링
      const filteredGoals = goals.filter((goal) => {
        if (!goal.owner) return false
        return canViewGoalLevel(
          user,
          goal.level,
          goal.owner.dept,
          goal.owner.subDept
        )
      })

      return NextResponse.json({ goals: filteredGoals })
    }

    // 원장/부원장은 모든 목표 조회
    const goals = await prisma.goal.findMany({
      where: whereClause,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            dept: true,
            subDept: true,
            role: true,
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
        thirdApprover: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        metrics: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ goals })
  } catch (error) {
    console.error('Error fetching goals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch goals' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { level, title, detail, metrics, year } = body
    const user = auth.user

    if (!level) {
      return NextResponse.json({ error: 'Level is required' }, { status: 400 })
    }

    // 권한 확인
    if (!canManageGoal(user, level as GoalLevel)) {
      return NextResponse.json(
        { error: 'You do not have permission to create this goal' },
        { status: 403 }
      )
    }

    // 목표 생성
    const goal = await prisma.goal.create({
      data: {
        title: title || `${level} Goals ${year || new Date().getFullYear()}`,
        detail: detail || '',
        level: level as GoalLevel,
        status: RecordStatus.DRAFT,
        ownerId: user.id,
      },
    })

    // KPI 메트릭 생성 (grade 필드는 Prisma 클라이언트에 있을 때만 포함)
    if (metrics && Array.isArray(metrics)) {
      const baseData = metrics.map((metric: any) => ({
        goalId: goal.id,
        ownerId: user.id,
        category: metric.category || null,
        title: metric.category ? `[${metric.category}] ${metric.title}` : metric.title,
        name: metric.name || '',
        targetValue: parseFloat(metric.target) || 0,
        targetUnit: metric.unit || '',
        detail: metric.detail || '',
        weight: metric.weight ? parseFloat(metric.weight) : null,
        status: RecordStatus.DRAFT,
      }))
      const withGrades = baseData.map((row: any, i: number) => {
        const m = metrics[i]
        return {
          ...row,
          gradeS: (m?.gradeS != null && String(m.gradeS).trim() !== '') ? String(m.gradeS) : null,
          gradeB: (m?.gradeB != null && String(m.gradeB).trim() !== '') ? String(m.gradeB) : null,
          gradeC: (m?.gradeC != null && String(m.gradeC).trim() !== '') ? String(m.gradeC) : null,
          gradeD: (m?.gradeD != null && String(m.gradeD).trim() !== '') ? String(m.gradeD) : null,
        }
      })
      try {
        await prisma.kpiMetric.createMany({ data: withGrades })
      } catch (createError) {
        const isUnknownArg = createError instanceof Error && /Unknown arg|Unknown field/i.test(createError.message)
        if (isUnknownArg) {
          await prisma.kpiMetric.createMany({ data: baseData })
        } else {
          throw createError
        }
      }
    }

    // 생성된 목표와 메트릭 조회
    const createdGoal = await prisma.goal.findUnique({
      where: { id: goal.id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            dept: true,
            subDept: true,
            role: true,
          },
        },
        metrics: true,
      },
    })

    return NextResponse.json({ goal: createdGoal }, { status: 201 })
  } catch (error) {
    console.error('Error creating goal:', error)
    const message = error instanceof Error ? error.message : 'Failed to create goal'
    const safeMessage = String(message || 'Failed to create goal')
    return NextResponse.json(
      { error: safeMessage },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { goalId, metrics } = body
    const user = auth.user

    if (!goalId) {
      return NextResponse.json({ error: 'goalId is required' }, { status: 400 })
    }

    // 목표 조회
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: { metrics: true },
    })

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    // 권한 확인 (목표 소유자만 수정 가능)
    if (goal.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to update this goal' },
        { status: 403 }
      )
    }

    // 목표 수정 시 승인 정보 초기화 (다시 승인받아야 함)
    await prisma.goal.update({
      where: { id: goal.id },
      data: {
        status: RecordStatus.DRAFT,
        firstApproverId: null,
        firstApprovedAt: null,
        secondApproverId: null,
        secondApprovedAt: null,
        thirdApproverId: null,
        thirdApprovedAt: null,
        rejectedReason: null,
      },
    })

    // 기존 메트릭 삭제
    await prisma.kpiMetric.deleteMany({
      where: { goalId: goal.id },
    })

    // 새 메트릭 생성 (grade 필드 미지원 시 폴백)
    if (metrics && Array.isArray(metrics)) {
      const baseData = metrics.map((metric: any) => ({
        goalId: goal.id,
        ownerId: user.id,
        category: metric.category || null,
        title: metric.category ? `[${metric.category}] ${metric.title}` : metric.title,
        name: metric.name || '',
        targetValue: parseFloat(metric.target) || 0,
        targetUnit: metric.unit || '',
        detail: metric.detail || '',
        weight: metric.weight ? parseFloat(metric.weight) : null,
        actualValue: metric.actual ? parseFloat(metric.actual) : null,
        status: RecordStatus.DRAFT,
      }))
      const withGrades = baseData.map((row: any, i: number) => {
        const m = metrics[i]
        return {
          ...row,
          gradeS: (m?.gradeS != null && String(m.gradeS).trim() !== '') ? String(m.gradeS) : null,
          gradeB: (m?.gradeB != null && String(m.gradeB).trim() !== '') ? String(m.gradeB) : null,
          gradeC: (m?.gradeC != null && String(m.gradeC).trim() !== '') ? String(m.gradeC) : null,
          gradeD: (m?.gradeD != null && String(m.gradeD).trim() !== '') ? String(m.gradeD) : null,
        }
      })
      try {
        await prisma.kpiMetric.createMany({ data: withGrades })
      } catch (createError) {
        const isUnknownArg = createError instanceof Error && /Unknown arg|Unknown field/i.test(createError.message)
        if (isUnknownArg) {
          await prisma.kpiMetric.createMany({ data: baseData })
        } else {
          throw createError
        }
      }
    }

    // 업데이트된 목표 조회
    const updatedGoal = await prisma.goal.findUnique({
      where: { id: goal.id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            dept: true,
            subDept: true,
            role: true,
          },
        },
        metrics: true,
      },
    })

    return NextResponse.json({ goal: updatedGoal })
  } catch (error) {
    console.error('Error updating goal:', error)
    const message = error instanceof Error ? error.message : 'Failed to update goal'
    const safeMessage = String(message || 'Failed to update goal')
    return NextResponse.json(
      { error: safeMessage },
      { status: 500 }
    )
  }
}
