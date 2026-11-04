import { AppError } from '../../../shared/utils/app-error';
import { departmentRepository } from '../repositories/department.repository';
import type { CreateDepartmentInput, UpdateDepartmentInput } from '../schemas/department.schema';
import type { Department } from '../types/department.types';

export const departmentService = {
  async list(): Promise<Department[]> {
    return departmentRepository.list();
  },

  async getById(id: string): Promise<Department> {
    const department = await departmentRepository.findById(id);
    if (!department) throw AppError.notFound('Department not found');
    return department;
  },

  async create(input: CreateDepartmentInput): Promise<Department> {
    if (await departmentRepository.findByCode(input.code)) {
      throw AppError.conflict(`Department code '${input.code}' already exists`);
    }
    if (await departmentRepository.findByName(input.name)) {
      throw AppError.conflict(`Department with name '${input.name}' already exists`);
    }
    return departmentRepository.create(input);
  },

  async update(id: string, input: UpdateDepartmentInput): Promise<Department> {
    const existing = await departmentRepository.findById(id);
    if (!existing) throw AppError.notFound('Department not found');

    if (input.code && input.code !== existing.code) {
      if (await departmentRepository.findByCode(input.code)) {
        throw AppError.conflict(`Department code '${input.code}' already exists`);
      }
    }
    if (input.name && input.name !== existing.name) {
      if (await departmentRepository.findByName(input.name)) {
        throw AppError.conflict(`Department with name '${input.name}' already exists`);
      }
    }

    const updated = await departmentRepository.update(id, input);
    if (!updated) throw AppError.notFound('Department not found');
    return updated;
  },

  async delete(id: string): Promise<void> {
    const existing = await departmentRepository.findById(id);
    if (!existing) throw AppError.notFound('Department not found');
    await departmentRepository.delete(id);
  },
};
