import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('⚠️  전 직원의 목표와 실적 데이터를 초기화합니다...\n')

  // 1. 모든 알림 삭제
  const deletedNotifications = await prisma.notification.deleteMany({})
  console.log(`✅ 알림 ${deletedNotifications.count}개 삭제 완료`)

  // 2. 모든 KPI 지표 삭제
  const deletedMetrics = await prisma.kpiMetric.deleteMany({})
  console.log(`✅ KPI 지표 ${deletedMetrics.count}개 삭제 완료`)

  // 3. 모든 목표 삭제
  const deletedGoals = await prisma.goal.deleteMany({})
  console.log(`✅ 목표 ${deletedGoals.count}개 삭제 완료`)

  console.log('\n🎉 모든 데이터가 초기화되었습니다!')
  console.log('이제 각 직원이 새로운 목표를 수립할 수 있습니다.')
}

main()
  .catch((error) => {
    console.error('❌ 초기화 중 오류 발생:', error)
  })
  .finally(() => prisma.$disconnect())
