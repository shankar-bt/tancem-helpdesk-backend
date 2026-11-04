import type { PublicUserWithPermissions } from '../../users/types/user.types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: PublicUserWithPermissions;
  tokens: AuthTokens;
}
