import { Router } from 'express';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
  upload,
  uploadLimiter,
  validate,
} from '../../../shared/middleware';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { ticketController } from '../controllers/ticket.controller';
import {
  addCommentSchema,
  assignTicketSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
  updateTicketStatusSchema,
} from '../schemas/ticket.schema';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireAnyPermission('tickets:read', 'tickets:read_all', 'tickets:read_dept'),
  validate({ query: listTicketsQuerySchema }),
  asyncHandler(ticketController.list),
);

router.post(
  '/',
  requirePermission('tickets:create'),
  validate({ body: createTicketSchema }),
  asyncHandler(ticketController.create),
);

router.get('/stats', asyncHandler(ticketController.getStats));

router.get('/attachments/:filename', ticketController.serveAttachment);

router.get(
  '/:id',
  requireAnyPermission('tickets:read', 'tickets:read_all', 'tickets:read_dept'),
  validate({ params: ticketIdParamSchema }),
  asyncHandler(ticketController.getById),
);

router.patch(
  '/:id/status',
  validate({ params: ticketIdParamSchema, body: updateTicketStatusSchema }),
  asyncHandler(ticketController.updateStatus),
);

router.patch(
  '/:id/assign',
  requireAnyPermission('tickets:assign', 'tickets:edit'),
  validate({ params: ticketIdParamSchema, body: assignTicketSchema }),
  asyncHandler(ticketController.assign),
);

router.post(
  '/upload',
  uploadLimiter,
  upload.array('files', 10),
  ticketController.uploadAttachments,
);

router.post(
  '/:id/comments',
  validate({ params: ticketIdParamSchema, body: addCommentSchema }),
  asyncHandler(ticketController.addComment),
);

router.get(
  '/:id/comments',
  validate({ params: ticketIdParamSchema }),
  asyncHandler(ticketController.listComments),
);

router.get(
  '/:id/history',
  validate({ params: ticketIdParamSchema }),
  asyncHandler(ticketController.getHistory),
);

export default router;

router.post('/:id/rate', asyncHandler(ticketController.rate));
