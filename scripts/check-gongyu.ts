import { prisma } from '../lib/prisma'

async function main() {
  console.log('Checking 공유 센터장...\n')
  
  const user = await prisma.user.findFirst({
    where: {
      name: {
        contains: '공유'
      }
    },
    select: {
      id: true,
      employeeNo: true,
      email: true,
      name: true,
      dept: true,
      subDept: true,
      role: true,
    },
  })

  if (user) {
    console.log('Found user:')
    console.table([user])
  } else {
    console.log('User not found!')
  }

  // 박민호 본부장도 확인
  const parkMinHo = await prisma.user.findFirst({
    where: {
      name: '박민호'
    },
    select: {
      id: true,
      employeeNo: true,
      email: true,
      name: true,
      dept: true,
      subDept: true,
      role: true,
    },
  })

  if (parkMinHo) {
    console.log('\n박민호 본부장:')
    console.table([parkMinHo])
  }

  // 최근 목표 확인
  console.log('\n최근 생성된 목표:')
  const goals = await prisma.goal.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    take: 3,
    include: {
      owner: {
        select: {
          name: true,
          dept: true,
          subDept: true,
        }
      }
    }
  })
  console.table(goals.map(g => ({
    id: g.id,
    level: g.level,
    status: g.status,
    owner: g.owner?.name,
    dept: g.owner?.dept,
    subDept: g.owner?.subDept,
    createdAt: g.createdAt
  })))

  // 알림 확인
  console.log('\n최근 알림:')
  const notifications = await prisma.notification.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    take: 5,
    include: {
      user: {
        select: {
          name: true
        }
      },
      fromUser: {
        select: {
          name: true
        }
      }
    }
  })
  
  console.table(notifications.map(n => ({
    id: n.id,
    to: n.user.name,
    from: n.fromUser?.name || 'N/A',
    type: n.type,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt
  })))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
