import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/require-admin-api'
import { logAdminAudit } from '@/lib/admin-audit'
import { clientIp } from '@/lib/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminApi(request)
  if (!gate.ok) return gate.response

  const { id: idStr } = await params
  const userId = parseInt(idStr, 10)
  if (!userId || Number.isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const newPassword = String(body?.newPassword || '')
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400 }
    )
  }

  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!exists) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
  })

  await logAdminAudit(prisma, {
    actorId: gate.user.id,
    action: 'USER_PASSWORD_RESET',
    targetType: 'User',
    targetId: String(userId),
    detail: JSON.stringify({ targetEmail: exists.email }),
    ip: clientIp(request),
  })

  return NextResponse.json({ ok: true })
}
