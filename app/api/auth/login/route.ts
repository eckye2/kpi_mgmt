import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signSessionToken } from '@/lib/auth/session-token'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  sessionCookieSecure,
} from '@/lib/auth/constants'
import { isEmailDomainAllowed } from '@/lib/email-domain'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '').trim()

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!isEmailDomainAllowed(email)) {
      return NextResponse.json(
        { error: '허용되지 않은 이메일 도메인입니다.' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        passwordHash: true,
        email: true,
        name: true,
        mustChangePassword: true,
      },
    })

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    const token = await signSessionToken(user.id)
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
      mustChangePassword: user.mustChangePassword,
    })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: sessionCookieSecure(),
      path: '/',
      maxAge: SESSION_MAX_AGE_SEC,
    })
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
