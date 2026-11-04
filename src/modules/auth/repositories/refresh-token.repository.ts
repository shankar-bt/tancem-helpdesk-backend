import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../../shared/db';
import { refreshTokens } from '../../../shared/db/schema';

export const refreshTokenRepository = {
  async create(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    const [row] = await db.insert(refreshTokens).values(data).returning();
    return row;
  },

  async findActiveByHash(tokenHash: string) {
    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
      .limit(1);
    return row;
  },

  async revokeByHash(tokenHash: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  },
};
