import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUserUnlocked } from '@/lib/auth/session-user'
import { loadStaffDistributionPayload } from '@/lib/evaluation-staff-distribution'

export async function GET(request: NextRequest) {
  const auth = await requireSessionUserUnlocked(request)
  if (!auth.ok) return auth.response

  const yearParam = request.nextUrl.searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()
  if (!year || Number.isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  const rows = await loadStaffDistributionPayload(prisma, year)
  return NextResponse.json({ year, rows })
}
