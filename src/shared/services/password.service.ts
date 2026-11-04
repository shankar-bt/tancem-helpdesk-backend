import bcrypt from 'bcrypt';
import { authConfig } from '../../config/auth';

export const passwordService = {
  hash: (plain: string): Promise<string> => bcrypt.hash(plain, authConfig.saltRounds),
  compare: (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash),
};
