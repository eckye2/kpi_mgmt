import { prisma } from '../lib/prisma'

async function main() {
  console.log('손예진 센터장의 목표 상태 초기화...\n')
  
  const goal = await prisma.goal.update({
    where: { id: 4 },
    data: {
      status: 'DRAFT',
      firstApproverId: null,
      firstApprovedAt: null,
      secondApproverId: null,
      secondApprovedAt: null,
      thirdApproverId: null,
      thirdApprovedAt: null,
    },
    include: {
      owner: {
        select: { name: true }
      }
    }
  })

  console.log('목표 상태가 DRAFT로 초기화되었습니다:')
  console.table([{
    id: goal.id,
    owner: goal.owner?.name,
    level: goal.level,
    status: goal.status,
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
