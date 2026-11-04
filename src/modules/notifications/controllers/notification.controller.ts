import type { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';

export const notificationController = {
  async list(req: Request, res: Response) {
    const result = await notificationService.getUserNotifications(req.user!.id);
    res.json({ success: true, data: result });
  },

  async markAsRead(req: Request, res: Response) {
    const updated = await notificationService.markAsRead(req.params.id, req.user!.id);
    res.json({ success: true, data: updated });
  },

  async markAllAsRead(req: Request, res: Response) {
    await notificationService.markAllAsRead(req.user!.id);
    res.json({ success: true, data: { message: 'All notifications marked as read' } });
  },
  async clearRead(req: Request, res: Response) {
    await notificationService.clearRead(req.user!.id);
    res.json({ success: true, data: { message: 'Read notifications cleared' } });
  },

  async clearAll(req: Request, res: Response) {
    await notificationService.clearAll(req.user!.id);
    res.json({ success: true, data: { message: 'All notifications cleared' } });
  },
};
