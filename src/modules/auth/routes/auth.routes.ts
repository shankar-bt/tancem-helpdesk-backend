import { Router } from 'express';
import { authenticate, authLimiter, validate } from '../../../shared/middleware';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { authController } from '../controllers/auth.controller';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from '../schemas/auth.schema';

const router = Router();

// Apply authLimiter to protect authentication endpoints from brute-force & credential stuffing
router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(authController.register));
router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(authController.login));
router.get('/me', authenticate, asyncHandler(authController.me));
router.post('/refresh', authLimiter, validate({ body: refreshSchema }), asyncHandler(authController.refresh));
router.post('/logout', validate({ body: logoutSchema }), asyncHandler(authController.logout));

export default router;
