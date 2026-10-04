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

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export interface CustomerListQuery {
  search?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

export const ORDER_STATUSES = ['draft', 'confirmed', 'cancelled'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  unit: ProductUnit;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface OrderCustomerSummary {
  id: string;
  name: string;
  phone: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string | null;
  status: OrderStatus;
  note: string | null;
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
}

export interface OrderListItem extends Order {
  customerName: string | null;
  customerPhone: string | null;
  itemCount: number;
}

export interface OrderDetails extends Order {
  customer: OrderCustomerSummary | null;
  items: OrderItem[];
}

export interface CreateOrderInput {
  customerId?: string | null;
  items: OrderItemInput[];
  discount?: number;
  note?: string | null;
}

export interface UpdateOrderInput {
  customerId?: string | null;
  items?: OrderItemInput[];
  discount?: number;
  note?: string | null;
}

export interface UpdateOrderStatusInput {
  status: 'confirmed' | 'cancelled';
}

export interface OrderListQuery {
  search?: string;
  customerId?: string;
  status?: OrderStatus;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierSummary {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

export interface CreateSupplierInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  isActive?: boolean;
}

export interface UpdateSupplierInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  note?: string | null;
}

export interface UpdateSupplierStatusInput {
  isActive: boolean;
}

export interface SupplierListQuery {
  search?: string;
  status?: 'active' | 'inactive';
  page: number;
  pageSize: number;
}

export const PURCHASE_STATUSES = ['draft', 'confirmed', 'cancelled'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  productNameSnapshot: string;
  productSkuSnapshot: string;
  unitSnapshot: ProductUnit;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  status: PurchaseStatus;
  subtotal: number;
  discount: number;
  total: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseListItem extends Purchase {
  supplierName: string;
  itemCount: number;
}

export interface PurchaseDetails extends Purchase {
  supplier: SupplierSummary;
  items: PurchaseItem[];
}

export interface CreatePurchaseInput {
  supplierId: string;
  items: PurchaseItemInput[];
  discount?: number;
  note?: string | null;
}

export interface UpdatePurchaseInput {
  supplierId?: string;
  items?: PurchaseItemInput[];
  discount?: number;
  note?: string | null;
}

export interface UpdatePurchaseStatusInput {
  status: 'confirmed' | 'cancelled';
}

export interface PurchaseListQuery {
  search?: string;
  supplierId?: string;
  status?: PurchaseStatus;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export const STOCK_MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUSTMENT'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const INVENTORY_STATUSES = ['in-stock', 'low-stock', 'out-of-stock'] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export interface InventoryProductSummary {
  id: string;
  name: string;
  sku: string;
  unit: ProductUnit;
  isActive: boolean;
}

export interface InventoryItem {
  product: InventoryProductSummary;
  quantity: number;
  minimumQuantity: number;
  isLowStock: boolean;
  status: InventoryStatus;
  updatedAt: string;
}

export interface InventoryListQuery {
  search?: string;
  status?: InventoryStatus;
  lowStock?: boolean;
  page: number;
  pageSize: number;
}

export interface UpdateInventoryMinimumInput {
  minimumQuantity: number;
}

export interface CreateStockMovementInput {
  type: StockMovementType;
  /** Positive units for IN/OUT; the final on-hand quantity for ADJUSTMENT. */
  quantity: number;
  note?: string | null;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  /** Movement delta for IN/OUT and the absolute delta for ADJUSTMENT. */
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  note: string | null;
  createdAt: string;
}

export interface CreateStockMovementResult {
  inventory: InventoryItem;
  movement: StockMovement;
}

export interface StockMovementListQuery {
  type?: StockMovementType;
  from?: string;
  to?: string;
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
