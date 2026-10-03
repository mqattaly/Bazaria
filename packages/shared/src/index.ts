export interface ApiSuccess<T> {
  data: T;
  meta?: {
    requestId?: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{
      field?: string;
      message: string;
    }>;
  };
  meta?: {
    requestId?: string;
  };
}

export interface HealthData {
  status: 'ok';
  service: 'bazariya-api';
  database: 'connected';
}

export const PRODUCT_UNITS = [
  'piece',
  'pack',
  'carton',
  'kilogram',
  'gram',
  'liter',
  'meter',
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export interface Category {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryListItem extends Category {
  productCount: number;
}

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  unit: ProductUnit;
  description: string | null;
  salePrice: number;
  purchasePrice: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  name: string;
  sku: string;
  categoryId: string;
  unit: ProductUnit;
  description?: string | null;
  salePrice: number;
  purchasePrice?: number | null;
  isActive?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  sku?: string;
  categoryId?: string;
  unit?: ProductUnit;
  description?: string | null;
  salePrice?: number;
  purchasePrice?: number | null;
  isActive?: boolean;
}

export interface ProductListQuery {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationInfo;
}
