import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/require-admin-api'
import { logAdminAudit } from '@/lib/admin-audit'
import { clientIp } from '@/lib/admin'
import type { GradeLevel, OrgRole } from '@prisma/client'

type RowResult = { line: number; ok: boolean; message?: string; email?: string }

const ROLE_KO: Record<string, OrgRole> = {
  원장: 'PRESIDENT',
  부원장: 'VICE_PRESIDENT',
  본부장: 'HQ_HEAD',
  센터장: 'CENTER_HEAD',
  직원: 'STAFF',
  일반직원: 'STAFF',
}

const ROLE_EN: Record<string, OrgRole> = {
  PRESIDENT: 'PRESIDENT',
  VICE_PRESIDENT: 'VICE_PRESIDENT',
  HQ_HEAD: 'HQ_HEAD',
  CENTER_HEAD: 'CENTER_HEAD',
  STAFF: 'STAFF',
}

function parseGrade(s: string): GradeLevel | null {
  const t = s.trim().toUpperCase()
  if (t === 'LEVEL_1' || t === 'LEVEL_2' || t === 'LEVEL_3' || t === 'LEVEL_4')
    return t as GradeLevel
  const m = s.match(/[1-4]/)
  if (!m) return null
  return (`LEVEL_${m[0]}` as GradeLevel)
}

function parseRole(s: string): OrgRole | null {
  const t = s.trim()
  if (ROLE_KO[t]) return ROLE_KO[t]
  if (ROLE_EN[t]) return ROLE_EN[t]
  return null
}

/** CSV: employeeNo,email,name,dept,subDept,role,gradeLevel,hireDate(YYYY-MM-DD) */
export async function POST(request: NextRequest) {
  const gate = await requireAdminApi(request)
  if (!gate.ok) return gate.response

  const body = await request.json().catch(() => null)
  const csvText = String(body?.csv ?? '')
  const dryRun = Boolean(body?.dryRun)

  if (!csvText.trim()) {
    return NextResponse.json({ error: 'csv text required' }, { status: 400 })
  }

  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) {
    return NextResponse.json({ error: 'Need header + at least one row' }, { status: 400 })
  }

  const header = lines[0].split(',').map((c) => c.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name)

  const iEmp = idx('employeeno')
  const iEmail = idx('email')
  const iName = idx('name')
  const iDept = idx('dept')
  const iSub = idx('subdept')
  const iRole = idx('role')
  const iGrade = idx('gradelevel')
  const iHire = idx('hiredate')

  if (
    iEmp < 0 ||
    iEmail < 0 ||
    iName < 0 ||
    iDept < 0 ||
    iSub < 0 ||
    iRole < 0 ||
    iGrade < 0 ||
    iHire < 0
  ) {
    return NextResponse.json(
      {
        error:
          'Header must include: employeeNo,email,name,dept,subDept,role,gradeLevel,hireDate',
      },
      { status: 400 }
    )
  }

  const results: RowResult[] = []
  let created = 0
  let updated = 0

  for (let n = 1; n < lines.length; n++) {
    const line = n + 1
    const cols = splitCsvLine(lines[n])
    const pick = (i: number) => (cols[i] ?? '').trim()

    const employeeNo = pick(iEmp)
    const email = pick(iEmail).toLowerCase()
    const name = pick(iName)
    const dept = pick(iDept)
    const subDept = pick(iSub)
    const role = parseRole(pick(iRole))
    const gradeLevel = parseGrade(pick(iGrade))
    const hireRaw = pick(iHire)
    const hireDate = new Date(hireRaw)

    if (!employeeNo || !email || !name || !dept || !subDept) {
      results.push({ line, ok: false, message: 'missing required field', email })
      continue
    }
    if (!role || !gradeLevel || Number.isNaN(hireDate.getTime())) {
      results.push({ line, ok: false, message: 'invalid role, gradeLevel, or hireDate', email })
      continue
    }

    if (dryRun) {
      results.push({ line, ok: true, email })
      continue
    }

    try {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ employeeNo }, { email }] },
      })
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            name,
            dept,
            subDept,
            role,
            gradeLevel,
            hireDate,
          },
        })
        updated++
        results.push({ line, ok: true, email })
      } else {
        const passwordHash = bcrypt.hashSync(employeeNo, 10)
        await prisma.user.create({
          data: {
            employeeNo,
            email,
            name,
            dept,
            subDept,
            role,
            gradeLevel,
            hireDate,
            passwordHash,
            isSystemAdmin: false,
            mustChangePassword: true,
          },
        })
        created++
        results.push({ line, ok: true, email })
      }
    } catch (e) {
      results.push({
        line,
        ok: false,
        message: e instanceof Error ? e.message : 'error',
        email,
      })
    }
  }

  if (!dryRun) {
    await logAdminAudit(prisma, {
      actorId: gate.user.id,
      action: 'USER_IMPORT',
      targetType: 'User',
      targetId: null,
      detail: JSON.stringify({ created, updated, rows: results.length }),
      ip: clientIp(request),
    })
  }

  return NextResponse.json({ dryRun, created, updated, results })
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      q = !q
      continue
    }
    if (c === ',' && !q) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur)
  return out
}
