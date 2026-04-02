import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const gongyu = await prisma.user.findFirst({
    where: { name: '공유' },
  })
  
  const minho = await prisma.user.findFirst({
    where: { name: '박민호' },
  })
  
  if (!gongyu || !minho) {
    console.log('사용자를 찾을 수 없습니다.')
    return
  }
  
  // 박민호에게 승인요청 알림 생성
  const notification = await prisma.notification.create({
    data: {
      userId: minho.id,
      type: 'APPROVAL_REQUEST',
      message: `${gongyu.name}님이 센터 목표 승인을 요청했습니다`,
      goalId: 5,
      fromUserId: gongyu.id,
      isRead: false,
    },
  })
  
  console.log('✅ 박민호에게 승인요청 알림 생성 완료')
  console.log('알림 ID:', notification.id)
  console.log('메시지:', notification.message)
  console.log('\n이제 박민호로 로그인하여 승인/거절을 테스트할 수 있습니다.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
