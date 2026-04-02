import type { PrismaClient } from '@prisma/client'

export async function logAdminAudit(
  prisma: PrismaClient,
  input: {
    actorId: number
    action: string
    targetType?: string | null
    targetId?: string | null
    detail?: string | null
    ip?: string | null
  }
) {
  await prisma.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      detail: input.detail ?? null,
      ip: input.ip ?? null,
    },
  })
}
