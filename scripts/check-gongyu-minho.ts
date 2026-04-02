import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n=== 공유 센터장 정보 ===')
  const gongyu = await prisma.user.findFirst({
    where: { name: '공유' },
    include: {
      goals: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
  
  if (gongyu) {
    console.log('ID:', gongyu.id)
    console.log('이름:', gongyu.name)
    console.log('역할:', gongyu.role)
    console.log('본부:', gongyu.dept)
    console.log('센터:', gongyu.subDept)
    console.log('이메일:', gongyu.email)
    
    if (gongyu.goals.length > 0) {
      console.log('\n최근 목표:')
      console.log('  ID:', gongyu.goals[0].id)
      console.log('  레벨:', gongyu.goals[0].level)
      console.log('  상태:', gongyu.goals[0].status)
      console.log('  생성:', gongyu.goals[0].createdAt)
    }
  } else {
    console.log('공유를 찾을 수 없습니다.')
  }

  console.log('\n=== 박민호 본부장 정보 ===')
  const minho = await prisma.user.findFirst({
    where: { name: '박민호' },
  })
  
  if (minho) {
    console.log('ID:', minho.id)
    console.log('이름:', minho.name)
    console.log('역할:', minho.role)
    console.log('본부:', minho.dept)
    console.log('센터:', minho.subDept)
    console.log('이메일:', minho.email)
    
    // 박민호에게 온 최근 알림
    const notifications = await prisma.notification.findMany({
      where: { userId: minho.id },
      include: {
        fromUser: {
          select: { name: true },
        },
        goal: {
          select: { level: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    
    console.log('\n최근 알림:', notifications.length, '개')
    notifications.forEach((notif, idx) => {
      console.log(`\n알림 ${idx + 1}:`)
      console.log('  타입:', notif.type)
      console.log('  메시지:', notif.message)
      console.log('  읽음:', notif.isRead)
      console.log('  보낸 사람:', notif.fromUser?.name || 'N/A')
      console.log('  생성:', notif.createdAt)
    })
  } else {
    console.log('박민호를 찾을 수 없습니다.')
  }
  
  // 공유의 본부와 일치하는 본부장 찾기
  if (gongyu) {
    console.log('\n=== 공유의 본부장 찾기 ===')
    const hqHead = await prisma.user.findFirst({
      where: {
        role: 'HQ_HEAD',
        dept: gongyu.dept,
      },
    })
    
    if (hqHead) {
      console.log('발견:', hqHead.name, '(', hqHead.dept, ')')
    } else {
      console.log('공유의 본부(', gongyu.dept, ')와 일치하는 본부장을 찾을 수 없습니다.')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
