import type { Request, Response } from 'express';
import { slaService } from '../services/sla.service';

export const slaController = {
  async list(_req: Request, res: Response) {
    const policies = await slaService.listPolicies();
    res.json({
      success: true,
      data: policies,
    });
  },

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const policy = await slaService.updatePolicy(id, req.body);
    res.json({
      success: true,
      data: policy,
    });
  },
};
