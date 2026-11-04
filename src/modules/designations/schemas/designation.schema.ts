import { z } from 'zod';

export const createDesignationSchema = z.object({
  code: z.string().trim().min(1, 'Code is required'),
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  roleId: z.string().uuid('Invalid role ID format').nullable().optional(),
});

export const updateDesignationSchema = z.object({
  code: z.string().trim().min(1, 'Code cannot be empty').optional(),
  title: z.string().trim().min(1, 'Title cannot be empty').optional(),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  roleId: z.string().uuid('Invalid role ID format').nullable().optional(),
});

export const listDesignationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  roleId: z.string().uuid().optional(),
});

export const designationIdParamSchema = z.object({
  id: z.string().uuid('Invalid designation ID format'),
});

export type CreateDesignationInput = z.infer<typeof createDesignationSchema>;
export type UpdateDesignationInput = z.infer<typeof updateDesignationSchema>;
export type ListDesignationsQueryInput = z.infer<typeof listDesignationsQuerySchema>;
