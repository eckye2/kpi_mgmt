import { prisma } from '../lib/prisma'

async function main() {
  const user = await prisma.user.findFirst({
    where: { name: '손예진' },
    select: {
      id: true,
      email: true,
      name: true,
      dept: true,
      subDept: true,
      role: true,
    },
  })

  if (!user) {
    console.log('손예진 센터장을 찾을 수 없습니다.')
    return
  }

  console.log('손예진 센터장:')
  console.table([user])

  const goals = await prisma.goal.findMany({
    where: { ownerId: user.id },
    include: {
      owner: { select: { name: true } },
      firstApprover: { select: { name: true } },
      secondApprover: { select: { name: true } },
    },
  })

  console.log('\n목표 상태:')
  console.table(goals.map(g => ({
    id: g.id,
    level: g.level,
    status: g.status,
    firstApprover: g.firstApprover?.name || null,
    secondApprover: g.secondApprover?.name || null,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
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
