export type UserRole = 'admin' | 'agent' | 'manager' | 'user';

export interface AuthUser {
  id: string;
  role: UserRole;
  permissions?: string[];
}
