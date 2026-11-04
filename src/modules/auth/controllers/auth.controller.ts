import type { Request, Response } from 'express';
import { sendSuccess } from '../../../shared/utils/response';
import { authService } from '../services/auth.service';

function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', tokens.accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookies(res: Response) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('accessToken', { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' });
  res.clearCookie('refreshToken', { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' });
}

export const authController = {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    setAuthCookies(res, result.tokens);
    return sendSuccess(res, result, 201);
  },

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    setAuthCookies(res, result.tokens);
    return sendSuccess(res, result);
  },

  async me(req: Request, res: Response) {
    return sendSuccess(res, await authService.me(req.user!.id));
  },

  async refresh(req: Request, res: Response) {
    const refreshToken = req.body?.refreshToken || (req as any).cookies?.refreshToken;
    const tokens = await authService.refresh(refreshToken);
    setAuthCookies(res, tokens);
    return sendSuccess(res, tokens);
  },

  async logout(req: Request, res: Response) {
    const refreshToken = req.body?.refreshToken || (req as any).cookies?.refreshToken;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    clearAuthCookies(res);
    return sendSuccess(res, { message: 'Logged out' });
  },
};
