export interface Designation {
  id: string;
  code: string;
  title: string;
  description: string | null;
  isActive: boolean;
  roleId?: string | null;
  roleName?: string | null;
  roleSlug?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListDesignationsQuery {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: string;
}

export interface CreateDesignationData {
  code: string;
  title: string;
  description?: string;
  isActive?: boolean;
  roleId?: string | null;
}

export interface UpdateDesignationData {
  code?: string;
  title?: string;
  description?: string;
  isActive?: boolean;
  roleId?: string | null;
}
