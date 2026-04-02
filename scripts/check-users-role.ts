import { prisma } from '../lib/prisma'

async function main() {
  console.log('📊 사용자 역할 확인\n');

  // 박민호 확인
  const parkMinho = await prisma.user.findFirst({
    where: { name: '박민호' },
    select: {
      id: true,
      name: true,
      employeeNo: true,
      email: true,
      role: true,
      dept: true,
      subDept: true,
    },
  });

  console.log('👤 박민호 (본부장):', parkMinho);

  // 이서윤 확인
  const leeSeoyoon = await prisma.user.findFirst({
    where: { name: '이서윤' },
    select: {
      id: true,
      name: true,
      employeeNo: true,
      email: true,
      role: true,
      dept: true,
      subDept: true,
    },
  });

  console.log('👤 이서윤 (부원장):', leeSeoyoon);

  // Goal 18 확인
  const goal = await prisma.goal.findUnique({
    where: { id: 18 },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          role: true,
          dept: true,
        },
      },
      metrics: true,
    },
  });

  console.log('\n🎯 Goal 18 정보:', {
    id: goal?.id,
    title: goal?.title,
    level: goal?.level,
    status: goal?.status,
    owner: goal?.owner,
    firstApproverId: goal?.firstApproverId,
    metricsCount: goal?.metrics.length,
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ 에러:', e);
  process.exit(1);
});
