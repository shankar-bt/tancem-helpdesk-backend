import { createHash, randomUUID } from 'crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { authConfig } from '../../config/auth';
import type { AuthUser, UserRole } from '../types';

interface AccessPayload extends JwtPayload {
  sub: string;
  role: UserRole;
}

interface RefreshPayload extends JwtPayload {
  sub: string;
}

export const tokenService = {
  signAccessToken(user: AuthUser): string {
    return jwt.sign({ role: user.role }, authConfig.accessSecret, {
      subject: user.id,
      expiresIn: authConfig.accessExpiresIn as SignOptions['expiresIn'],
    });
  },

  signRefreshToken(userId: string): string {
    return jwt.sign({}, authConfig.refreshSecret, {
      subject: userId,
      jwtid: randomUUID(),
      expiresIn: authConfig.refreshExpiresIn as SignOptions['expiresIn'],
    });
  },

  verifyAccessToken(token: string): AuthUser {
    const payload = jwt.verify(token, authConfig.accessSecret) as AccessPayload;
    return { id: payload.sub, role: payload.role };
  },

  verifyRefreshToken(token: string): { userId: string; expiresAt: Date } {
    const payload = jwt.verify(token, authConfig.refreshSecret) as RefreshPayload;
    return { userId: payload.sub, expiresAt: new Date((payload.exp as number) * 1000) };
  },

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  },
};
