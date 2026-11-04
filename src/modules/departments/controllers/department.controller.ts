import type { Request, Response } from 'express';
import { sendSuccess } from '../../../shared/utils/response';
import { departmentService } from '../services/department.service';

export const departmentController = {
  async list(_req: Request, res: Response) {
    return sendSuccess(res, await departmentService.list());
  },

  async getById(req: Request, res: Response) {
    return sendSuccess(res, await departmentService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    return sendSuccess(res, await departmentService.create(req.body), 201);
  },

  async update(req: Request, res: Response) {
    return sendSuccess(res, await departmentService.update(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    await departmentService.delete(req.params.id);
    return sendSuccess(res, { id: req.params.id });
  },
};
