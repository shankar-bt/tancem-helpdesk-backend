import { AppError } from '../../../shared/utils/app-error';
import { masterRepository } from '../repositories/master.repository';
import type { CreateMasterInput, ListMastersQuery, UpdateMasterInput } from '../schemas/master.schema';
import type { TicketMaster } from '../types/master.types';

export const masterService = {
  async list(query: ListMastersQuery): Promise<TicketMaster[]> {
    return masterRepository.list(query.type, query.isActive, query.parentId);
  },

  async getById(id: string): Promise<TicketMaster> {
    const item = await masterRepository.findById(id);
    if (!item) throw AppError.notFound('Master category not found');
    return item;
  },

  async create(input: CreateMasterInput): Promise<TicketMaster> {
    return masterRepository.create(input);
  },

  async update(id: string, input: UpdateMasterInput): Promise<TicketMaster> {
    const existing = await masterRepository.findById(id);
    if (!existing) throw AppError.notFound('Master category not found');

    const updated = await masterRepository.update(id, input);
    if (!updated) throw AppError.notFound('Master category not found');
    return updated;
  },

  async delete(id: string): Promise<void> {
    const existing = await masterRepository.findById(id);
    if (!existing) throw AppError.notFound('Master category not found');
    await masterRepository.delete(id);
  },
};
