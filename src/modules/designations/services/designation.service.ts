import { AppError } from '../../../shared/utils/app-error';
import { designationRepository } from '../repositories/designation.repository';
import type {
  CreateDesignationInput,
  ListDesignationsQueryInput,
  UpdateDesignationInput,
} from '../schemas/designation.schema';
import type { Designation } from '../types/designation.types';

export const designationService = {
  async list(query: ListDesignationsQueryInput) {
    const { items, total } = await designationRepository.list(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  async getById(id: string): Promise<Designation> {
    const designation = await designationRepository.findById(id);
    if (!designation) throw AppError.notFound('Designation not found');
    return designation;
  },

  async create(input: CreateDesignationInput): Promise<Designation> {
    if (await designationRepository.findByCode(input.code)) {
      throw AppError.conflict(`Designation code '${input.code}' already exists`);
    }
    return designationRepository.create(input);
  },

  async update(id: string, input: UpdateDesignationInput): Promise<Designation> {
    const existing = await designationRepository.findById(id);
    if (!existing) throw AppError.notFound('Designation not found');

    if (input.code && input.code !== existing.code) {
      if (await designationRepository.findByCode(input.code)) {
        throw AppError.conflict(`Designation code '${input.code}' already exists`);
      }
    }

    const updated = await designationRepository.update(id, input);
    if (!updated) throw AppError.notFound('Designation not found');
    return updated;
  },

  async delete(id: string): Promise<void> {
    const existing = await designationRepository.findById(id);
    if (!existing) throw AppError.notFound('Designation not found');
    await designationRepository.delete(id);
  },
};
