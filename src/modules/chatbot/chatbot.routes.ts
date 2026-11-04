import { Router } from 'express';
import { authenticate } from '../../shared/middleware';
import { asyncHandler } from '../../shared/utils/async-handler';
import { chatbotController } from './chatbot.controller';

const router = Router();
router.use(authenticate);

router.post('/message', asyncHandler(chatbotController.message));

export default router;
