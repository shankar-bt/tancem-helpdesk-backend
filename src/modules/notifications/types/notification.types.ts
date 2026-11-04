export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  isRead: boolean;
  createdAt: Date | string;
}

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
}
