import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUserUnlocked } from '@/lib/auth/session-user'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const user = auth.user

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        goal: {
          select: {
            id: true,
            title: true,
            level: true,
            owner: {
              select: {
                name: true,
                dept: true,
                subDept: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    })

    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSessionUserUnlocked(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { notificationId, markAllAsRead } = body
    const user = auth.user

    if (markAllAsRead) {
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      })

      return NextResponse.json({ message: 'All notifications marked as read' })
    } else if (notificationId) {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      })

      if (!notification || notification.userId !== user.id) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        )
      }

      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      })

      return NextResponse.json({ message: 'Notification marked as read' })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}
