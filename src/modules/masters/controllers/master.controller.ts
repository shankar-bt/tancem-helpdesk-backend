import type { Request, Response } from 'express';
import { sendSuccess } from '../../../shared/utils/response';
import type { ListMastersQuery } from '../schemas/master.schema';
import { masterService } from '../services/master.service';

export const masterController = {
  async list(req: Request, res: Response) {
    return sendSuccess(res, await masterService.list(req.query as unknown as ListMastersQuery));
  },

  async getById(req: Request, res: Response) {
    return sendSuccess(res, await masterService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    return sendSuccess(res, await masterService.create(req.body), 201);
  },

  async update(req: Request, res: Response) {
    return sendSuccess(res, await masterService.update(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    await masterService.delete(req.params.id);
    return sendSuccess(res, { id: req.params.id });
  },
};
