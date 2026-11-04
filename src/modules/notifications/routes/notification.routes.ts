import { Router } from 'express';
import { authenticate } from '../../../shared/middleware';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { notificationController } from '../controllers/notification.controller';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(notificationController.list));
router.patch('/read-all', asyncHandler(notificationController.markAllAsRead));
router.patch('/:id/read', asyncHandler(notificationController.markAsRead));

router.delete('/clear-read', asyncHandler(notificationController.clearRead));
router.delete('/clear-all', asyncHandler(notificationController.clearAll));

export default router;
