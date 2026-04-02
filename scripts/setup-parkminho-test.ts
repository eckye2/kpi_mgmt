import { GoalLevel, PrismaClient, RecordStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 박민호 찾기
  const parkMinho = await prisma.user.findUnique({
    where: { email: 'user003@kpcqa.or.kr' },
  })

  if (!parkMinho) {
    console.error('박민호를 찾을 수 없습니다.')
    return
  }

  console.log('✅ 박민호 정보:', parkMinho.name, parkMinho.role, parkMinho.dept)

  // 박민호의 기존 본부 목표 찾기
  const existingGoals = await prisma.goal.findMany({
    where: {
      owner: {
        id: parkMinho.id,
      },
      level: GoalLevel.HQ,
    },
    select: { id: true },
  })

  // 기존 목표가 있으면 삭제
  if (existingGoals.length > 0) {
    const goalIds = existingGoals.map((g) => g.id)
    
    await prisma.kpiMetric.deleteMany({
      where: {
        goalId: { in: goalIds },
      },
    })

    await prisma.goal.deleteMany({
      where: {
        id: { in: goalIds },
      },
    })
  }

  // 새로운 본부 목표 생성
  const goal = await prisma.goal.create({
    data: {
      title: '2026년 미래성장전략본부 목표',
      owner: {
        connect: { id: parkMinho.id },
      },
      level: GoalLevel.HQ,
      status: RecordStatus.DRAFT,
      metrics: {
        create: [
          {
            category: 'PERFORMANCE',
            title: '[재무] 본부 매출 목표',
            targetValue: 100,
            targetUnit: '억원',
            actualValue: 0,
          },
          {
            category: 'PERFORMANCE',
            title: '[비재무] 신규 프로젝트 확보',
            targetValue: 10,
            targetUnit: '건',
            actualValue: 0,
          },
        ],
      },
    },
    include: {
      metrics: true,
    },
  })

  console.log('✅ 박민호의 본부 목표가 생성되었습니다.')
  console.log('   Goal ID:', goal.id)
  console.log('   Status:', goal.status)
  console.log('   Metrics:', goal.metrics.length, '개')
  console.log('\n이제 박민호로 로그인하여 본부 탭에서 승인요청을 테스트할 수 있습니다.')
  console.log('박민호 로그인: user003@kpcqa.or.kr / 1234')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
