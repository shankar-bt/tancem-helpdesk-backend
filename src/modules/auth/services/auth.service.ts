import { passwordService } from '../../../shared/services/password.service';
import { tokenService } from '../../../shared/services/token.service';
import { AppError } from '../../../shared/utils/app-error';
import { roleRepository } from '../../roles/repositories/role.repository';
import { roleService } from '../../roles/services/role.service';
import { userRepository } from '../../users/repositories/user.repository';
import type { PublicUser, PublicUserWithPermissions } from '../../users/types/user.types';
import { refreshTokenRepository } from '../repositories/refresh-token.repository';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema';
import type { AuthResult, AuthTokens } from '../types/auth.types';

async function issueTokens(user: PublicUser): Promise<AuthTokens> {
  const accessToken = tokenService.signAccessToken({ id: user.id, role: user.role });
  const refreshToken = tokenService.signRefreshToken(user.id);
  const { expiresAt } = tokenService.verifyRefreshToken(refreshToken);

  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: tokenService.hashToken(refreshToken),
    expiresAt,
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    if (await userRepository.findByEmail(input.email)) {
      throw AppError.conflict('A user with this email already exists');
    }

    // The very first account becomes the admin so the user CRUD can be managed immediately.
    const isFirstUser = (await userRepository.count()) === 0;

    if (!isFirstUser) {
      throw AppError.forbidden(
        'Public registration is closed. Please contact your IT administrator to request an account.'
      );
    }

    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      role: isFirstUser ? 'admin' : 'user',
      passwordHash: await passwordService.hash(input.password),
    });

    const permissions = await roleService.getUserPermissions(user.id, user.role);
    return { user: { ...user, permissions }, tokens: await issueTokens(user) };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const record = await userRepository.findByEmailWithPassword(input.email);
    const valid = record ? await passwordService.compare(input.password, record.passwordHash) : false;
    if (!record || !valid) throw AppError.unauthorized('Invalid email or password');

    const { passwordHash: _omit, ...user } = record;

    if (user.roleId) {
      const roleRecord = await roleRepository.findById(user.roleId);
      if (roleRecord) {
        let expectedRole = user.role;
        const slug = (roleRecord.slug || '').toLowerCase();
        const name = (roleRecord.name || '').toLowerCase();
        if (slug === 'admin' || slug === 'super_admin' || slug === 'superadmin' || slug === 'administrator' || slug.includes('admin') || name.includes('admin')) expectedRole = 'admin';
        else if (roleRecord.slug === 'manager' || roleRecord.name?.toLowerCase().includes('manager')) expectedRole = 'manager';
        else if (roleRecord.slug === 'agent') expectedRole = 'agent';

        if (expectedRole !== user.role) {
          user.role = expectedRole;
          await userRepository.update(user.id, { role: expectedRole });
        }
      }
    }

    const permissions = await roleService.getUserPermissions(user.id, user.role);
    return { user: { ...user, permissions }, tokens: await issueTokens(user) };
  },

  async me(userId: string): Promise<PublicUserWithPermissions> {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.unauthorized('User not found');

    if (user.roleId) {
      const roleRecord = await roleRepository.findById(user.roleId);
      if (roleRecord) {
        let expectedRole = user.role;
        const slug = (roleRecord.slug || '').toLowerCase();
        const name = (roleRecord.name || '').toLowerCase();
        if (slug === 'admin' || slug === 'super_admin' || slug === 'superadmin' || slug === 'administrator' || slug.includes('admin') || name.includes('admin')) expectedRole = 'admin';
        else if (roleRecord.slug === 'manager' || roleRecord.name?.toLowerCase().includes('manager')) expectedRole = 'manager';
        else if (roleRecord.slug === 'agent') expectedRole = 'agent';

        if (expectedRole !== user.role) {
          user.role = expectedRole;
          await userRepository.update(user.id, { role: expectedRole });
        }
      }
    }

    const permissions = await roleService.getUserPermissions(user.id, user.role);
    return { ...user, permissions };
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let userId: string;
    try {
      ({ userId } = tokenService.verifyRefreshToken(refreshToken));
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const hash = tokenService.hashToken(refreshToken);
    const stored = await refreshTokenRepository.findActiveByHash(hash);
    if (!stored) {
      // Token reuse or unknown token: revoke every session of this user as a precaution.
      await refreshTokenRepository.revokeAllForUser(userId);
      throw AppError.unauthorized('Refresh token is no longer valid');
    }

    const user = await userRepository.findById(userId);
    if (!user) throw AppError.unauthorized('User no longer exists');

    // Rotation: the old token can only be used once.
    await refreshTokenRepository.revokeByHash(hash);
    return issueTokens(user);
  },

  async logout(refreshToken: string): Promise<void> {
    await refreshTokenRepository.revokeByHash(tokenService.hashToken(refreshToken));
  },
};
