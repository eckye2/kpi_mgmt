import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 공유의 목표(ID: 5)를 PENDING으로 변경하고 박민호에게 알림 생성
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
  
  console.log('공유 ID:', gongyu.id)
  console.log('박민호 ID:', minho.id)
  
  // 공유의 목표 업데이트
  const goal = await prisma.goal.update({
    where: { id: 5 },
    data: {
      status: 'PENDING',
    },
  })
  
  console.log('\n목표 업데이트 완료:')
  console.log('  ID:', goal.id)
  console.log('  상태:', goal.status)
  
  // 박민호에게 알림 생성
  const notification = await prisma.notification.create({
    data: {
      userId: minho.id,
      type: 'APPROVAL_REQUEST',
      message: `${gongyu.name}님이 센터 목표 승인을 요청했습니다`,
      goalId: goal.id,
      fromUserId: gongyu.id,
    },
  })
  
  console.log('\n알림 생성 완료:')
  console.log('  ID:', notification.id)
  console.log('  메시지:', notification.message)
  console.log('  수신자 ID:', notification.userId)
  
  console.log('\n✅ 테스트 데이터 생성 완료!')
  console.log('박민호 본부장으로 로그인하여 알림을 확인해주세요.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
