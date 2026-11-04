import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';
import { tokenService } from '../services/token.service';

/**
 * Authentication middleware verifying identity from:
 * 1. Authorization: Bearer <accessToken> header
 * 2. httpOnly accessToken cookie
 * 3. URL query parameter (?token=...)
 * 4. httpOnly refreshToken cookie fallback (for browser tabs and attachment links)
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const tokenFromCookie = (req as any).cookies?.accessToken;
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;
  const token =
    tokenFromCookie ||
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    queryToken;

  if (token) {
    try {
      req.user = tokenService.verifyAccessToken(token);
      return next();
    } catch {
      // Access token expired or invalid; fall through to check refresh cookie
    }
  }

  // Fallback for media & attachment requests: check valid refreshToken cookie
  const refreshToken = (req as any).cookies?.refreshToken;
  if (refreshToken) {
    try {
      const { userId } = tokenService.verifyRefreshToken(refreshToken);
      req.user = { id: userId, role: 'user' };
      return next();
    } catch {
      // Invalid refresh token
    }
  }

  return next(AppError.unauthorized('Missing, invalid, or expired authentication session'));
}
