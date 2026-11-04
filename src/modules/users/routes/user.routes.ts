import { Router } from 'express';
import { authenticate, requireRole, validate } from '../../../shared/middleware';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { userController } from '../controllers/user.controller';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
} from '../schemas/user.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listUsersQuerySchema }), asyncHandler(userController.list));
router.post(
  '/',
  requireRole('admin'),
  validate({ body: createUserSchema }),
  asyncHandler(userController.create),
);
router.get('/:id', validate({ params: userIdParamSchema }), asyncHandler(userController.getById));
router.put(
  '/:id',
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  asyncHandler(userController.update),
);
router.patch(
  '/:id',
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  asyncHandler(userController.update),
);
router.delete(
  '/:id',
  requireRole('admin'),
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.remove),
);

export default router;
