import { z } from 'zod';

export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user id'),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
});

const optionalUuid = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().uuid('Invalid UUID format').optional().nullable(),
);

const optionalString = z.preprocess(
  (v) => (v === '' ? null : v),
  z.string().trim().max(120).optional().nullable(),
);

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().trim().toLowerCase().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  role: z.enum(['admin', 'agent', 'manager', 'user']).default('user'),
  roleId: optionalUuid,
  departmentId: optionalUuid,
  officeCategory: optionalString,
  designationId: optionalUuid,
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    password: z.string().min(8).max(72).optional(),
    role: z.enum(['admin', 'agent', 'manager', 'user']).optional(),
    roleId: optionalUuid,
    departmentId: optionalUuid,
    officeCategory: optionalString,
  designationId: optionalUuid,
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
