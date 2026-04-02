import { prisma } from '../lib/prisma'

async function main() {
  console.log('테스트용 알림 생성...\n')
  
  // 손예진 센터장
  const sonyejin = await prisma.user.findFirst({
    where: { name: '손예진' },
    select: { id: true, name: true, dept: true, subDept: true },
  })

  // 박민호 본부장  
  const parkminho = await prisma.user.findFirst({
    where: { name: '박민호' },
    select: { id: true, name: true },
  })

  if (!sonyejin || !parkminho) {
    console.log('사용자를 찾을 수 없습니다.')
    return
  }

  // 손예진의 목표를 PENDING 상태로 변경
  const goal = await prisma.goal.update({
    where: { id: 4 },
    data: {
      status: 'PENDING',
    },
  })

  console.log('목표 상태 업데이트:')
  console.table([{
    id: goal.id,
    owner: sonyejin.name,
    level: goal.level,
    status: goal.status,
  }])

  // 박민호에게 알림 생성
  const notification = await prisma.notification.create({
    data: {
      userId: parkminho.id,
      type: 'APPROVAL_REQUEST',
      message: `${sonyejin.name}님이 센터 목표 승인을 요청했습니다`,
      goalId: goal.id,
      fromUserId: sonyejin.id,
    },
    include: {
      user: { select: { name: true } },
      fromUser: { select: { name: true } },
    },
  })

  console.log('\n알림 생성 완료:')
  console.table([{
    id: notification.id,
    to: notification.user.name,
    from: notification.fromUser?.name,
    message: notification.message,
  }])
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
