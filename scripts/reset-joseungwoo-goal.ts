import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 조승우의 목표를 DRAFT 상태로 변경
  const goal = await prisma.goal.update({
    where: { id: 7 },
    data: {
      status: 'DRAFT',
      firstApproverId: null,
      firstApprovedAt: null,
      secondApproverId: null,
      secondApprovedAt: null,
      thirdApproverId: null,
      thirdApprovedAt: null,
      rejectedReason: null,
    },
  })
  
  console.log('✅ 조승우의 목표(ID: 7)를 DRAFT 상태로 초기화했습니다.')
  console.log('상태:', goal.status)
  console.log('\n이제 조승우로 로그인하여 승인요청을 다시 테스트할 수 있습니다.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
