import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/require-admin-api'
import { logAdminAudit } from '@/lib/admin-audit'
import { clientIp } from '@/lib/admin'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminApi(request)
  if (!gate.ok) return gate.response

  const { id: idStr } = await params
  const userId = parseInt(idStr, 10)
  if (!userId || Number.isNaN(userId)) {
    return NextResponse.json({ error: '잘못된 사용자 ID입니다.' }, { status: 400 })
  }

  if (gate.user.id === userId) {
    return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다.' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, employeeNo: true, name: true },
  })
  if (!target) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { userId } })
      await tx.notification.updateMany({
        where: { fromUserId: userId },
        data: { fromUserId: null },
      })
      await tx.competencyEval.deleteMany({ where: { ownerId: userId } })
      await tx.competencyEval.updateMany({
        where: { reviewerId: userId },
        data: { reviewerId: null },
      })
      await tx.performanceReview.deleteMany({ where: { userId } })
      await tx.goal.updateMany({
        where: { ownerId: userId },
        data: { ownerId: null },
      })
      await tx.goal.updateMany({
        where: { firstApproverId: userId },
        data: { firstApproverId: null },
      })
      await tx.goal.updateMany({
        where: { secondApproverId: userId },
        data: { secondApproverId: null },
      })
      await tx.goal.updateMany({
        where: { thirdApproverId: userId },
        data: { thirdApproverId: null },
      })
      await tx.kpiMetric.updateMany({
        where: { ownerId: userId },
        data: { ownerId: null },
      })
      await tx.user.delete({ where: { id: userId } })
    })

    await logAdminAudit(prisma, {
      actorId: gate.user.id,
      action: 'USER_DELETE',
      targetType: 'User',
      targetId: String(userId),
      detail: JSON.stringify({
        email: target.email,
        employeeNo: target.employeeNo,
        name: target.name,
      }),
      ip: clientIp(request),
    })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : ''
    console.error(e)
    if (code === 'P2003' || code === 'P2014') {
      return NextResponse.json(
        {
          error:
            '연결된 데이터 때문에 삭제할 수 없습니다. 관련 목표·알림 등을 정리한 뒤 다시 시도하세요.',
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: '사용자 삭제에 실패했습니다.' }, { status: 500 })
  }
}
