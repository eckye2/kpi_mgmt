import { prisma } from '../lib/prisma'

async function main() {
  console.log('🎯 전 직원 목표수립 데이터 생성 시작...\n');

  // 먼저 기존 데이터 삭제
  await prisma.notification.deleteMany({});
  await prisma.kpiMetric.deleteMany({});
  await prisma.goal.deleteMany({});
  console.log('✅ 기존 데이터 삭제 완료\n');

  // 모든 사용자 조회
  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
  });

  console.log(`📊 총 ${users.length}명의 직원 목표 생성 중...\n`);

  for (const user of users) {
    console.log(`👤 ${user.name} (${user.role}) - 목표 생성 중...`);

    // 전사 목표 (원장, 부원장만)
    if (user.role === 'PRESIDENT' || user.role === 'VICE_PRESIDENT') {
      const corporateGoal = await prisma.goal.create({
        data: {
          title: `${user.name} 전사 목표 2026`,
          level: 'CORPORATE',
          status: 'APPROVED',
          ownerId: user.id,
          firstApproverId: user.id,
          firstApprovedAt: new Date(),
        },
      });

      await prisma.kpiMetric.createMany({
        data: [
          {
            goalId: corporateGoal.id,
            ownerId: user.id,
            category: '재무',
            title: '[재무] 전사 매출 목표',
            targetValue: 50000,
            targetUnit: '백만원',
            detail: '2026년 전사 매출 500억원 달성',
            weight: 40,
            actualValue: 0,
            status: 'APPROVED',
          },
          {
            goalId: corporateGoal.id,
            ownerId: user.id,
            category: '비재무',
            title: '[비재무] 고객 만족도',
            targetValue: 90,
            targetUnit: '점',
            detail: '고객 만족도 조사 90점 이상',
            weight: 30,
            actualValue: 0,
            status: 'APPROVED',
          },
          {
            goalId: corporateGoal.id,
            ownerId: user.id,
            category: '비재무',
            title: '[비재무] 신규 인증 건수',
            targetValue: 500,
            targetUnit: '건',
            detail: '신규 인증 건수 500건 달성',
            weight: 30,
            actualValue: 0,
            status: 'APPROVED',
          },
        ],
      });
      console.log(`  ✓ 전사 목표 생성 완료`);
    }

    // 본부 목표 (본부장, 부원장, 원장)
    if (user.role === 'HQ_HEAD' || user.role === 'VICE_PRESIDENT' || user.role === 'PRESIDENT') {
      const hqGoal = await prisma.goal.create({
        data: {
          title: `${user.name} 본부 목표 2026`,
          level: 'HQ',
          status: 'APPROVED',
          ownerId: user.id,
          firstApproverId: user.id,
          firstApprovedAt: new Date(),
        },
      });

      const targetValue = user.dept === '미래성장전략본부' ? 15000 :
                         user.dept === '경영기획본부' ? 12000 :
                         user.dept === '녹색건축본부' ? 13000 :
                         user.dept === '환경에너지본부' ? 10000 : 10000;

      await prisma.kpiMetric.createMany({
        data: [
          {
            goalId: hqGoal.id,
            ownerId: user.id,
            category: '재무',
            title: '[재무] 본부 매출 목표',
            targetValue: targetValue,
            targetUnit: '백만원',
            detail: `${user.dept} 매출 목표 달성`,
            weight: 50,
            actualValue: 0,
            status: 'APPROVED',
          },
          {
            goalId: hqGoal.id,
            ownerId: user.id,
            category: '비재무',
            title: '[비재무] 신규 고객 확보',
            targetValue: 50,
            targetUnit: '개사',
            detail: '신규 고객사 50개 확보',
            weight: 30,
            actualValue: 0,
            status: 'APPROVED',
          },
          {
            goalId: hqGoal.id,
            ownerId: user.id,
            category: '비재무',
            title: '[비재무] 직원 역량 강화',
            targetValue: 80,
            targetUnit: '시간',
            detail: '1인당 연간 교육 시간 80시간 이상',
            weight: 20,
            actualValue: 0,
            status: 'APPROVED',
          },
        ],
      });
      console.log(`  ✓ 본부 목표 생성 완료`);
    }

    // 센터 목표 (센터장, 본부장, 부원장, 원장)
    if (user.role === 'CENTER_HEAD' || user.role === 'HQ_HEAD' || user.role === 'VICE_PRESIDENT' || user.role === 'PRESIDENT') {
      const centerGoal = await prisma.goal.create({
        data: {
          title: `${user.name} 센터 목표 2026`,
          level: 'CENTER',
          status: 'APPROVED',
          ownerId: user.id,
          firstApproverId: user.id,
          firstApprovedAt: new Date(),
        },
      });

      await prisma.kpiMetric.createMany({
        data: [
          {
            goalId: centerGoal.id,
            ownerId: user.id,
            category: '재무',
            title: '[재무] 센터 매출 목표',
            targetValue: 3000,
            targetUnit: '백만원',
            detail: `${user.subDept} 매출 목표 달성`,
            weight: 50,
            actualValue: 0,
            status: 'APPROVED',
          },
          {
            goalId: centerGoal.id,
            ownerId: user.id,
            category: '비재무',
            title: '[비재무] 인증 건수',
            targetValue: 100,
            targetUnit: '건',
            detail: '센터 인증 건수 100건 달성',
            weight: 30,
            actualValue: 0,
            status: 'APPROVED',
          },
          {
            goalId: centerGoal.id,
            ownerId: user.id,
            category: '비재무',
            title: '[비재무] 품질 관리',
            targetValue: 95,
            targetUnit: '점',
            detail: '품질 관리 점수 95점 이상',
            weight: 20,
            actualValue: 0,
            status: 'APPROVED',
          },
        ],
      });
      console.log(`  ✓ 센터 목표 생성 완료`);
    }

    // 개인 목표 (모든 직원)
    const personalGoal = await prisma.goal.create({
      data: {
        title: `${user.name} 개인 목표 2026`,
        level: 'PERSONAL',
        status: 'APPROVED',
        ownerId: user.id,
        firstApproverId: user.id,
        firstApprovedAt: new Date(),
      },
    });

    await prisma.kpiMetric.createMany({
      data: [
        {
          goalId: personalGoal.id,
          ownerId: user.id,
          category: '재무',
          title: '[재무] 개인 매출 기여',
          targetValue: user.role === 'STAFF' ? 500 : user.role === 'CENTER_HEAD' ? 1000 : user.role === 'HQ_HEAD' ? 2000 : 3000,
          targetUnit: '백만원',
          detail: '개인 담당 업무 매출 목표',
          weight: 40,
          actualValue: 0,
          status: 'APPROVED',
        },
        {
          goalId: personalGoal.id,
          ownerId: user.id,
          category: '비재무',
          title: '[비재무] 업무 효율성',
          targetValue: 90,
          targetUnit: '점',
          detail: '업무 효율성 평가 90점 이상',
          weight: 30,
          actualValue: 0,
          status: 'APPROVED',
        },
        {
          goalId: personalGoal.id,
          ownerId: user.id,
          category: '비재무',
          title: '[비재무] 자기계발',
          targetValue: 50,
          targetUnit: '시간',
          detail: '연간 자기계발 시간 50시간 이상',
          weight: 30,
          actualValue: 0,
          status: 'APPROVED',
        },
      ],
    });
    console.log(`  ✓ 개인 목표 생성 완료`);
    console.log('');
  }

  // 최종 확인
  const goalCount = await prisma.goal.count();
  const metricCount = await prisma.kpiMetric.count();

  console.log('\n🎉 목표수립 데이터 생성 완료!');
  console.log(`📊 생성된 목표: ${goalCount}개`);
  console.log(`📊 생성된 지표: ${metricCount}개`);
  console.log('\n모든 직원의 목표가 승인 완료(APPROVED) 상태로 생성되었습니다.');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ 에러:', e);
  process.exit(1);
});
