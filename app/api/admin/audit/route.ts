import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/require-admin-api'

export async function GET(request: NextRequest) {
  const gate = await requireAdminApi(request)
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(request.url)
  const take = Math.min(200, Math.max(1, Number(searchParams.get('take')) || 100))

  const logs = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ logs })
}
