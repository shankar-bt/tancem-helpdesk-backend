import { Router } from 'express';
import { authenticate, requireRole, validate } from '../../../shared/middleware';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { roleController } from '../controllers/role.controller';
import {
  assignPermissionsSchema,
  createRoleSchema,
  roleIdParamSchema,
  updateRoleSchema,
} from '../schemas/role.schema';

const router = Router();

// Access permission restricted only for Admin and Super Admin
router.use(authenticate, requireRole('admin'));

router.get('/permissions', asyncHandler(roleController.listPermissions));
router.get('/', asyncHandler(roleController.list));
router.get('/:id', validate({ params: roleIdParamSchema }), asyncHandler(roleController.getById));
router.post('/', validate({ body: createRoleSchema }), asyncHandler(roleController.create));
router.put('/:id', validate({ params: roleIdParamSchema, body: updateRoleSchema }), asyncHandler(roleController.update));
router.delete('/:id', validate({ params: roleIdParamSchema }), asyncHandler(roleController.remove));
router.post(
  '/:id/permissions',
  validate({ params: roleIdParamSchema, body: assignPermissionsSchema }),
  asyncHandler(roleController.assignPermissions),
);

export default router;
