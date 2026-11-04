import { Router } from 'express';
import { authenticate, requireRole } from '../../../shared/middleware';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { slaController } from '../controllers/sla.controller';

const router = Router();

router.use(authenticate);

// List policies (authenticated users can view policies)
router.get('/', asyncHandler(slaController.list));

// Update policy (restricted to admin)
router.put('/:id', requireRole('admin'), asyncHandler(slaController.update));

export default router;
