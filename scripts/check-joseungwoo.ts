import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== 조승우 직원 정보 확인 ===\n')
  
  const joseungwoo = await prisma.user.findFirst({
    where: { name: '조승우' },
    include: {
      goals: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          metrics: true,
        },
      },
    },
  })
  
  if (joseungwoo) {
    console.log('이름:', joseungwoo.name)
    console.log('역할:', joseungwoo.role)
    console.log('본부:', joseungwoo.dept)
    console.log('센터:', joseungwoo.subDept)
    console.log('이메일:', joseungwoo.email)
    
    if (joseungwoo.goals.length > 0) {
      const goal = joseungwoo.goals[0]
      console.log('\n최근 목표:')
      console.log('  ID:', goal.id)
      console.log('  레벨:', goal.level)
      console.log('  상태:', goal.status)
      console.log('  생성:', goal.createdAt)
      console.log('  메트릭 수:', goal.metrics.length)
    } else {
      console.log('\n목표 없음')
    }
    
    // 센터장 찾기
    console.log('\n=== 센터장 확인 ===')
    const centerHead = await prisma.user.findFirst({
      where: {
        role: 'CENTER_HEAD',
        subDept: joseungwoo.subDept,
      },
    })
    
    if (centerHead) {
      console.log('센터장:', centerHead.name, '(', centerHead.subDept, ')')
      
      // 센터장의 알림 확인
      const notifications = await prisma.notification.findMany({
        where: {
          userId: centerHead.id,
          isRead: false,
        },
        include: {
          fromUser: {
            select: { name: true },
          },
        },
      })
      
      console.log('\n센터장의 읽지 않은 알림:', notifications.length, '개')
      notifications.forEach((notif, idx) => {
        console.log(`  ${idx + 1}. ${notif.message} (from: ${notif.fromUser?.name})`)
      })
    } else {
      console.log('센터장을 찾을 수 없습니다.')
    }
  } else {
    console.log('조승우를 찾을 수 없습니다.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
