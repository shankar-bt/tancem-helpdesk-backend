import { z } from 'zod';

export const masterIdParamSchema = z.object({
  id: z.string().uuid('Invalid master id'),
});

export const listMastersQuerySchema = z.object({
  type: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  parentId: z.string().uuid().optional(),
});

export const createMasterSchema = z.object({
  type: z.string().trim().min(2, 'Type must be at least 2 characters').max(50),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  code: z.string().trim().max(50).optional(),
  description: z.string().trim().max(500).optional(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateMasterSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    code: z.string().trim().max(50).optional(),
    description: z.string().trim().max(500).optional(),
    parentId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export type ListMastersQuery = z.infer<typeof listMastersQuerySchema>;
export type CreateMasterInput = z.infer<typeof createMasterSchema>;
export type UpdateMasterInput = z.infer<typeof updateMasterSchema>;
