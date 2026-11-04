import type { Request, Response } from 'express';
import { chatbotService } from './chatbot.service';

export const chatbotController = {
  async message(req: Request, res: Response) {
    const actor = req.user!;
    const { message } = req.body;
    const response = await chatbotService.processMessage(message, actor as any);
    res.json({ success: true, data: response });
  },
};
