import { Router } from 'express';
import { authenticate, requireRole, validate } from '../../../shared/middleware';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { masterController } from '../controllers/master.controller';
import {
  createMasterSchema,
  listMastersQuerySchema,
  masterIdParamSchema,
  updateMasterSchema,
} from '../schemas/master.schema';

const router = Router();

router.use(authenticate);

// Public to authenticated users for dropdown population
router.get('/', validate({ query: listMastersQuerySchema }), asyncHandler(masterController.list));
router.get('/:id', validate({ params: masterIdParamSchema }), asyncHandler(masterController.getById));

// Only Admin can create, update, delete master categories
router.post(
  '/',
  requireRole('admin'),
  validate({ body: createMasterSchema }),
  asyncHandler(masterController.create),
);

router.put(
  '/:id',
  requireRole('admin'),
  validate({ params: masterIdParamSchema, body: updateMasterSchema }),
  asyncHandler(masterController.update),
);

router.delete(
  '/:id',
  requireRole('admin'),
  validate({ params: masterIdParamSchema }),
  asyncHandler(masterController.remove),
);

export default router;
