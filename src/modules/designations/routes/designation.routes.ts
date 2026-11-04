import { Router } from 'express';
import { authenticate, requirePermission, validate } from '../../../shared/middleware';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { designationController } from '../controllers/designation.controller';
import {
  createDesignationSchema,
  designationIdParamSchema,
  listDesignationsQuerySchema,
  updateDesignationSchema,
} from '../schemas/designation.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listDesignationsQuerySchema }), asyncHandler(designationController.list));

router.get('/:id', validate({ params: designationIdParamSchema }), asyncHandler(designationController.getById));

router.post(
  '/',
  requirePermission('designations:manage'),
  validate({ body: createDesignationSchema }),
  asyncHandler(designationController.create),
);

router.put(
  '/:id',
  requirePermission('designations:manage'),
  validate({ params: designationIdParamSchema, body: updateDesignationSchema }),
  asyncHandler(designationController.update),
);

router.delete(
  '/:id',
  requirePermission('designations:manage'),
  validate({ params: designationIdParamSchema }),
  asyncHandler(designationController.remove),
);

export default router;
