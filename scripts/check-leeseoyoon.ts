import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 이서윤 부원장 찾기
  const leeSeoyoon = await prisma.user.findUnique({
    where: { email: 'user002@kpcqa.or.kr' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      dept: true,
      subDept: true,
    },
  })

  if (!leeSeoyoon) {
    console.error('이서윤을 찾을 수 없습니다.')
    return
  }

  console.log('===== 이서윤 부원장 정보 =====')
  console.log('이름:', leeSeoyoon.name)
  console.log('이메일:', leeSeoyoon.email)
  console.log('역할:', leeSeoyoon.role)
  console.log('부서:', leeSeoyoon.dept)
  console.log('하위부서:', leeSeoyoon.subDept)
  console.log('')

  // 이서윤의 알림 확인
  const notifications = await prisma.notification.findMany({
    where: { userId: leeSeoyoon.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      fromUser: {
        select: {
          name: true,
          role: true,
        },
      },
    },
  })

  console.log('===== 최근 알림 (최대 5개) =====')
  if (notifications.length === 0) {
    console.log('알림이 없습니다.')
  } else {
    notifications.forEach((notif, index) => {
      console.log(`${index + 1}. [${notif.type}] ${notif.message}`)
      console.log(`   from: ${notif.fromUser?.name} (${notif.fromUser?.role})`)
      console.log(`   읽음: ${notif.isRead ? 'O' : 'X'}`)
      console.log(`   생성일: ${notif.createdAt.toLocaleString('ko-KR')}`)
      console.log('')
    })
  }

  // 박민호가 승인요청한 본부 목표 확인
  const parkMinho = await prisma.user.findUnique({
    where: { email: 'user003@kpcqa.or.kr' },
  })

  if (parkMinho) {
    const parkMinhoGoals = await prisma.goal.findMany({
      where: {
        ownerId: parkMinho.id,
        level: 'HQ',
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        metrics: true,
      },
    })

    console.log('===== 박민호 본부장의 최근 본부 목표 =====')
    if (parkMinhoGoals.length === 0) {
      console.log('목표가 없습니다.')
    } else {
      parkMinhoGoals.forEach((goal) => {
        console.log('Goal ID:', goal.id)
        console.log('상태:', goal.status)
        console.log('연도(추정):', goal.createdAt.getFullYear())
        console.log('메트릭 수:', goal.metrics.length)
        console.log('생성일:', goal.createdAt.toLocaleString('ko-KR'))
      })
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
