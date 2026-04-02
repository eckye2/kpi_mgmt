import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/lib/auth/session-user'

const MIN_LEN = 8

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUser(request)
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => null)
    const currentPassword = String(body?.currentPassword ?? '').trim()
    const newPassword = String(body?.newPassword ?? '').trim()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '현재 비밀번호와 새 비밀번호를 입력하세요.' },
        { status: 400 }
      )
    }
    if (newPassword.length < MIN_LEN) {
      return NextResponse.json(
        { error: `새 비밀번호는 ${MIN_LEN}자 이상이어야 합니다.` },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { passwordHash: true },
    })
    if (!user?.passwordHash) {
      return NextResponse.json({ error: '비밀번호가 설정되지 않았습니다.' }, { status: 400 })
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!ok) {
      return NextResponse.json(
        { error: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    const same = await bcrypt.compare(newPassword, user.passwordHash)
    if (same) {
      return NextResponse.json(
        { error: '새 비밀번호는 기존과 달라야 합니다.' },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { passwordHash, mustChangePassword: false },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
