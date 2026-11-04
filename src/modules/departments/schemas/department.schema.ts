import { z } from 'zod';

export const departmentIdParamSchema = z.object({
  id: z.string().uuid('Invalid department id'),
});

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'Department name must be at least 2 characters').max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Department code must be at least 2 characters')
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Department code must only contain letters, numbers, dashes, and underscores'),
  description: z.string().trim().max(500).optional(),
});

export const updateDepartmentSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2)
      .max(20)
      .regex(/^[A-Z0-9_-]+$/)
      .optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
