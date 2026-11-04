import type { Request, Response } from 'express';
import { AppError } from '../../../shared/utils/app-error';
import { sendSuccess } from '../../../shared/utils/response';
import type { ListUsersQuery } from '../schemas/user.schema';
import { userService } from '../services/user.service';

export const userController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await userService.list(req.query as unknown as ListUsersQuery);
    return sendSuccess(res, items, 200, meta);
  },

  async getById(req: Request, res: Response) {
    return sendSuccess(res, await userService.getById(req.params.id));
  },

  async create(req: Request, res: Response) {
    return sendSuccess(res, await userService.create(req.body), 201);
  },

  async update(req: Request, res: Response) {
    if (!req.user) throw AppError.unauthorized();
    return sendSuccess(res, await userService.update(req.params.id, req.body, req.user));
  },

  async remove(req: Request, res: Response) {
    if (!req.user) throw AppError.unauthorized();
    await userService.remove(req.params.id, req.user);
    return sendSuccess(res, { id: req.params.id });
  },
};
