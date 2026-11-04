import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';
import type { UserRole } from '../types';

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    const r = (req.user.role || '').toLowerCase();
    if (r === 'admin' || r === 'super_admin' || r === 'superadmin' || r === 'administrator' || r.includes('admin')) {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
