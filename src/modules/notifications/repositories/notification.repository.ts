import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import { notifications } from '../../../shared/db/schema';
import type { CreateNotificationInput } from '../types/notification.types';

export const notificationRepository = {
  async create(data: CreateNotificationInput) {
    // Deduplication check: if an identical notification was sent to this user with same title & message recently or is unread, skip duplicate
    const existing = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, data.userId),
          eq(notifications.title, data.title),
          eq(notifications.message, data.message)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(1);

    if (existing.length > 0) {
      const diffMs = Date.now() - new Date(existing[0].createdAt).getTime();
      // Prevent duplicate if sent within 10 minutes or currently unread
      if (diffMs < 10 * 60 * 1000 || !existing[0].isRead) {
        return existing[0];
      }
    }

    const [record] = await db
      .insert(notifications)
      .values({
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link || null,
        isRead: false,
      })
      .returning();
    return record;
  },

  async listByUser(userId: string, limit = 30) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  },

  async getUnreadCount(userId: string): Promise<number> {
    const result = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result.length;
  },

  async markAsRead(id: string, userId: string) {
    const [record] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return record;
  },

  async clearRead(userId: string) {
    await db
      .delete(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, true)));
    return true;
  },

  async clearAll(userId: string) {
    await db
      .delete(notifications)
      .where(eq(notifications.userId, userId));
    return true;
  },

  async markAllAsRead(userId: string) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return true;
  },
};
