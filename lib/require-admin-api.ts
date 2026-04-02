import { NextRequest, NextResponse } from 'next/server'
import { rejectIfMustChangePassword, requireSessionUser } from '@/lib/auth/session-user'
import { isAdminIpAllowed, isAppAdmin } from '@/lib/admin'

export async function requireAdminApi(request: NextRequest) {
  const auth = await requireSessionUser(request)
  if (!auth.ok) return auth
  const pwd = rejectIfMustChangePassword(auth.user)
  if (pwd) return { ok: false as const, response: pwd }
  if (!isAppAdmin(auth.user)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  if (!isAdminIpAllowed(request)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Admin actions not allowed from this network' },
        { status: 403 }
      ),
    }
  }
  return { ok: true as const, user: auth.user }
}
