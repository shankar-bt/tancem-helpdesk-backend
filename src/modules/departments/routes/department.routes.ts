import { Router } from 'express';
import { authenticate, requirePermission, validate } from '../../../shared/middleware';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { departmentController } from '../controllers/department.controller';
import {
  createDepartmentSchema,
  departmentIdParamSchema,
  updateDepartmentSchema,
} from '../schemas/department.schema';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(departmentController.list));

router.get('/:id', validate({ params: departmentIdParamSchema }), asyncHandler(departmentController.getById));

router.post(
  '/',
  requirePermission('departments:manage'),
  validate({ body: createDepartmentSchema }),
  asyncHandler(departmentController.create),
);

router.put(
  '/:id',
  requirePermission('departments:manage'),
  validate({ params: departmentIdParamSchema, body: updateDepartmentSchema }),
  asyncHandler(departmentController.update),
);

router.delete(
  '/:id',
  requirePermission('departments:manage'),
  validate({ params: departmentIdParamSchema }),
  asyncHandler(departmentController.remove),
);

export default router;
