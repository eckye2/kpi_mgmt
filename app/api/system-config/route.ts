import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUserUnlocked } from '@/lib/auth/session-user'
import { isAdminIpAllowed, isAppAdmin } from '@/lib/admin'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response

    const config = await prisma.systemConfig.findFirst();

    if (!config) {
      // 기본 설정 반환
      return NextResponse.json({
        config: {
          checkCycle: "매월",
          midCheckEnabled: true,
          finalCheckEnabled: true,
          goalModificationApprovalRequired: true,
        },
      });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error fetching system config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response
    if (!isAppAdmin(auth.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!isAdminIpAllowed(request)) {
      return NextResponse.json(
        { error: 'Admin actions not allowed from this network' },
        { status: 403 }
      )
    }

    const body = await request.json();
    const {
      checkCycle,
      midCheckEnabled,
      finalCheckEnabled,
      goalModificationApprovalRequired,
    } = body;

    // 기존 설정이 있는지 확인
    const existingConfig = await prisma.systemConfig.findFirst();

    let config;
    if (existingConfig) {
      // 업데이트
      config = await prisma.systemConfig.update({
        where: { id: existingConfig.id },
        data: {
          checkCycle,
          midCheckEnabled,
          finalCheckEnabled,
          goalModificationApprovalRequired,
        },
      });
    } else {
      // 생성
      config = await prisma.systemConfig.create({
        data: {
          checkCycle,
          midCheckEnabled,
          finalCheckEnabled,
          goalModificationApprovalRequired,
        },
      });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error saving system config:', error);
    return NextResponse.json(
      { error: 'Failed to save system config' },
      { status: 500 }
    );
  }
}
