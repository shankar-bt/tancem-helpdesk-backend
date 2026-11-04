import type { Request, Response } from 'express';
import { sendSuccess } from '../../../shared/utils/response';
import { roleService } from '../services/role.service';

export const roleController = {
  async list(_req: Request, res: Response) {
    return sendSuccess(res, await roleService.listRoles());
  },

  async getById(req: Request, res: Response) {
    return sendSuccess(res, await roleService.getRoleById(req.params.id));
  },

  async create(req: Request, res: Response) {
    return sendSuccess(res, await roleService.createRole(req.body), 201);
  },

  async update(req: Request, res: Response) {
    return sendSuccess(res, await roleService.updateRole(req.params.id, req.body));
  },

  async remove(req: Request, res: Response) {
    await roleService.deleteRole(req.params.id);
    return sendSuccess(res, { id: req.params.id });
  },

  async assignPermissions(req: Request, res: Response) {
    return sendSuccess(res, await roleService.assignPermissions(req.params.id, req.body));
  },

  async listPermissions(_req: Request, res: Response) {
    return sendSuccess(res, await roleService.listPermissions());
  },
};
