import { notificationRepository } from '../repositories/notification.repository';
import type { CreateNotificationInput } from '../types/notification.types';

export const notificationService = {
  async getUserNotifications(userId: string) {
    const items = await notificationRepository.listByUser(userId, 30);
    const unreadCount = await notificationRepository.getUnreadCount(userId);
    return { items, unreadCount };
  },

  async markAsRead(id: string, userId: string) {
    return notificationRepository.markAsRead(id, userId);
  },

  async markAllAsRead(userId: string) {
    return notificationRepository.markAllAsRead(userId);
  },

  async clearRead(userId: string) {
    return notificationRepository.clearRead(userId);
  },

  async clearAll(userId: string) {
    return notificationRepository.clearAll(userId);
  },

  async create(data: CreateNotificationInput) {
    return notificationRepository.create(data);
  },
};
