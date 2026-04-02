import { prisma } from '../lib/prisma'

async function main() {
  console.log('최근 알림 확인...\n')
  
  const notifications = await prisma.notification.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    take: 10,
    include: {
      user: {
        select: {
          name: true,
          dept: true,
        }
      },
      fromUser: {
        select: {
          name: true
        }
      },
      goal: {
        select: {
          id: true,
          level: true,
          status: true,
        }
      }
    }
  })

  console.table(notifications.map(n => ({
    id: n.id,
    to: n.user.name,
    from: n.fromUser?.name || 'N/A',
    type: n.type,
    message: n.message.substring(0, 40),
    goalId: n.goalId,
    goalStatus: n.goal?.status,
    isRead: n.isRead,
    createdAt: n.createdAt,
  })))

  // 박민호에게 온 알림만 확인
  const parkMinhoNotifications = notifications.filter(n => n.user.name === '박민호')
  console.log('\n박민호 본부장에게 온 알림:')
  console.table(parkMinhoNotifications.map(n => ({
    id: n.id,
    from: n.fromUser?.name || 'N/A',
    message: n.message,
    isRead: n.isRead,
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
