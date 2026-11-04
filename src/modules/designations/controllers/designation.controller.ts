import type { Request, Response } from 'express';
import { sendSuccess } from '../../../shared/utils/response';
import { designationService } from '../services/designation.service';

export const designationController = {
  async list(req: Request, res: Response) {
    const result = await designationService.list(req.query as any);
    return sendSuccess(res, result.items, 200, result.meta);
  },

  async getById(req: Request, res: Response) {
    return sendSuccess(res, await designationService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    return sendSuccess(res, await designationService.create(req.body), 201);
  },

  async update(req: Request, res: Response) {
    return sendSuccess(res, await designationService.update(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    await designationService.delete(req.params.id);
    return sendSuccess(res, { id: req.params.id });
  },
};
