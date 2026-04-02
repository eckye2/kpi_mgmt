import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const joseungwoo = await prisma.user.findFirst({
    where: { name: '조승우' },
  })
  
  const leejeongjae = await prisma.user.findFirst({
    where: { name: '이정재' },
  })
  
  if (!joseungwoo || !leejeongjae) {
    console.log('사용자를 찾을 수 없습니다.')
    return
  }
  
  console.log('조승우 ID:', joseungwoo.id)
  console.log('이정재(센터장) ID:', leejeongjae.id)
  
  // 조승우의 목표를 PENDING으로 변경
  const goal = await prisma.goal.update({
    where: { id: 7 },
    data: {
      status: 'PENDING',
    },
  })
  
  console.log('\n✅ 목표 상태 업데이트 완료:')
  console.log('  ID:', goal.id)
  console.log('  상태:', goal.status)
  
  // 이정재 센터장에게 알림 생성
  const notification = await prisma.notification.create({
    data: {
      userId: leejeongjae.id,
      type: 'APPROVAL_REQUEST',
      message: `${joseungwoo.name}님이 개인 목표 승인을 요청했습니다`,
      goalId: goal.id,
      fromUserId: joseungwoo.id,
      isRead: false,
    },
  })
  
  console.log('\n✅ 알림 생성 완료:')
  console.log('  ID:', notification.id)
  console.log('  메시지:', notification.message)
  
  console.log('\n🎉 테스트 데이터 준비 완료!')
  console.log('조승우로 로그인하여 승인요청 버튼이 흐릿하게 표시되는지 확인하세요.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
