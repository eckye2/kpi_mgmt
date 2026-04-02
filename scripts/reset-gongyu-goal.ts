import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 공유의 목표를 다시 PENDING으로 변경
  const goal = await prisma.goal.update({
    where: { id: 5 },
    data: {
      status: 'PENDING',
      rejectedReason: null,
      firstApproverId: null,
      firstApprovedAt: null,
      secondApproverId: null,
      secondApprovedAt: null,
      thirdApproverId: null,
      thirdApprovedAt: null,
    },
  })
  
  console.log('✅ 공유의 목표(ID: 5)를 PENDING 상태로 초기화했습니다.')
  console.log('상태:', goal.status)
  
  // 박민호의 읽지 않은 알림 확인
  const minho = await prisma.user.findFirst({
    where: { name: '박민호' },
  })
  
  if (minho) {
    const unreadNotifications = await prisma.notification.findMany({
      where: {
        userId: minho.id,
        isRead: false,
      },
      include: {
        fromUser: {
          select: { name: true },
        },
      },
    })
    
    console.log('\n박민호의 읽지 않은 알림:', unreadNotifications.length, '개')
    unreadNotifications.forEach((notif, idx) => {
      console.log(`  ${idx + 1}. ${notif.message} (from: ${notif.fromUser?.name})`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
