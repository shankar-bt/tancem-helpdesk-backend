import { z } from 'zod';

export const roleIdParamSchema = z.object({
  id: z.string().uuid('Invalid role id'),
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'Slug must only contain lowercase alphanumeric characters, dashes and underscores'),
  description: z.string().trim().max(255).optional(),
  permissionIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(255).optional(),
    permissionIds: z.array(z.string().uuid()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const assignPermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()).min(1, 'At least one permission ID is required'),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>;
