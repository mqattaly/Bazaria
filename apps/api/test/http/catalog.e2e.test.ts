import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type {
  Category,
  CategoryListItem,
  CreateCategoryInput,
  CreateProductInput,
  PaginatedData,
  Product,
  ProductListQuery,
  UpdateCategoryInput,
  UpdateProductInput,
} from '@bazariya/shared';
import type { CategoriesRepository as CategoriesRepositoryContract } from '../../src/catalog/categories/categories.repository.js';
import type { ProductsRepository as ProductsRepositoryContract } from '../../src/catalog/products/products.repository.js';
import { PG_POOL } from '../../src/database/database.constants.js';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://bazariya:bazariya_dev_only@localhost:5432/bazariya_test';

const [{ AppModule }, { configureApp }, { CategoriesRepository }, { ProductsRepository }] = await Promise.all([
  import('../../src/app.module.js'),
  import('../../src/configure-app.js'),
  import('../../src/catalog/categories/categories.repository.js'),
  import('../../src/catalog/products/products.repository.js'),
]);

function databaseError(code: string, constraint: string): Error & { code: string; constraint: string } {
  return Object.assign(new Error('private database details'), { code, constraint });
}

class MemoryCategoriesRepository implements Pick<CategoriesRepositoryContract, 'list' | 'findById' | 'exists' | 'create' | 'update' | 'delete'> {
  private readonly categories = new Map<string, Category>();

  constructor(private readonly getProducts: () => Product[]) {}

  reset(): void {
    this.categories.clear();
  }

  async list(): Promise<CategoryListItem[]> {
    return [...this.categories.values()]
      .sort((left, right) => left.name.localeCompare(right.name, 'fa'))
      .map((category) => ({
        ...category,
        productCount: this.getProducts().filter((product) => product.categoryId === category.id).length,
      }));
  }

  async findById(id: string): Promise<Category | null> {
    return this.categories.get(id) ?? null;
  }

  async exists(id: string): Promise<boolean> {
    return this.categories.has(id);
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    if ([...this.categories.values()].some((category) => category.name.toLocaleLowerCase() === input.name.toLocaleLowerCase())) {
      throw databaseError('23505', 'categories_name_unique');
    }
    const now = new Date().toISOString();
    const category: Category = {
      id: randomUUID(),
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.categories.set(category.id, category);
    return category;
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category | null> {
    const category = this.categories.get(id);
    if (!category) return null;
    const nextName = input.name ?? category.name;
    if ([...this.categories.values()].some((item) => item.id !== id && item.name.toLocaleLowerCase() === nextName.toLocaleLowerCase())) {
      throw databaseError('23505', 'categories_name_unique');
    }
    const updated: Category = {
      ...category,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.categories.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.categories.has(id)) return false;
    if (this.getProducts().some((product) => product.categoryId === id)) {
      throw databaseError('23503', 'products_category_id_fkey');
    }
    return this.categories.delete(id);
  }
}

class MemoryProductsRepository implements Pick<ProductsRepositoryContract, 'list' | 'findById' | 'create' | 'update' | 'delete'> {
  private readonly products = new Map<string, Product>();

  reset(): void {
    this.products.clear();
  }

  all(): Product[] {
    return [...this.products.values()];
  }

  async list(query: ProductListQuery): Promise<PaginatedData<Product>> {
    const search = query.search?.trim().toLocaleLowerCase();
    const filtered = this.all()
      .filter((product) => !search
        || product.name.toLocaleLowerCase().startsWith(search)
        || product.sku.startsWith(search.toUpperCase()))
      .filter((product) => !query.categoryId || product.categoryId === query.categoryId)
      .filter((product) => query.isActive === undefined || product.isActive === query.isActive)
      .sort((left, right) => left.name.localeCompare(right.name, 'fa') || left.sku.localeCompare(right.sku));
    const total = filtered.length;
    const offset = (query.page - 1) * query.pageSize;

    return {
      items: filtered.slice(offset, offset + query.pageSize),
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    };
  }

  async findById(id: string): Promise<Product | null> {
    return this.products.get(id) ?? null;
  }

  async create(input: CreateProductInput): Promise<Product> {
    if (this.all().some((product) => product.sku === input.sku)) throw databaseError('23505', 'products_sku_unique');
    const now = new Date().toISOString();
    const product: Product = {
      id: randomUUID(),
      name: input.name,
      sku: input.sku,
      categoryId: input.categoryId,
      unit: input.unit,
      description: input.description ?? null,
      salePrice: input.salePrice,
      purchasePrice: input.purchasePrice ?? null,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.products.set(product.id, product);
    return product;
  }

  async update(id: string, input: UpdateProductInput): Promise<Product | null> {
    const product = this.products.get(id);
    if (!product) return null;
    const nextSku = input.sku ?? product.sku;
    if (this.all().some((item) => item.id !== id && item.sku === nextSku)) throw databaseError('23505', 'products_sku_unique');
    const updated: Product = {
      ...product,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.salePrice !== undefined ? { salePrice: input.salePrice } : {}),
      ...(input.purchasePrice !== undefined ? { purchasePrice: input.purchasePrice } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.products.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.products.delete(id);
  }
}

describe('Products and categories API', () => {
  let app: INestApplication;
  let products: MemoryProductsRepository;
  let categories: MemoryCategoriesRepository;

  before(async () => {
    products = new MemoryProductsRepository();
    categories = new MemoryCategoriesRepository(() => products.all());
    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }),
      end: async () => undefined,
    };
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .overrideProvider(CategoriesRepository)
      .useValue(categories)
      .overrideProvider(ProductsRepository)
      .useValue(products)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, 'http://localhost:5173');
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => {
    products.reset();
    categories.reset();
  });

  async function createCategory(name = 'لوازم آشپزخانه'): Promise<Category> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({ name })
      .expect(201);
    return response.body.data as Category;
  }

  async function createProduct(categoryId: string, sku: string, name = 'لیوان شیشه‌ای', salePrice = 125_000): Promise<Product> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/products')
      .send({ name, sku, categoryId, unit: 'piece', salePrice })
      .expect(201);
    return response.body.data as Product;
  }

  it('supports category create, list, get, update, case-insensitive uniqueness, and delete', async () => {
    const created = await createCategory('  لوازم آشپزخانه  ');
    assert.equal(created.name, 'لوازم آشپزخانه');
    assert.equal(created.isActive, true);

    const listed = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].productCount, 0);

    const fetched = await request(app.getHttpServer()).get(`/api/v1/categories/${created.id}`).expect(200);
    assert.equal(fetched.body.data.id, created.id);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({ name: 'لوازم آشپزخانه' })
      .expect(409);
    assert.equal(duplicate.body.error.code, 'CATEGORY_NAME_EXISTS');

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${created.id}`)
      .send({ name: 'آشپزخانه', isActive: false })
      .expect(200);
    assert.equal(updated.body.data.name, 'آشپزخانه');
    assert.equal(updated.body.data.isActive, false);

    const latinCategory = await createCategory('Kitchen');
    const caseInsensitiveDuplicate = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({ name: 'kitchen' })
      .expect(409);
    assert.equal(caseInsensitiveDuplicate.body.error.code, 'CATEGORY_NAME_EXISTS');
    await request(app.getHttpServer()).delete(`/api/v1/categories/${latinCategory.id}`).expect(200);

    const emptyPatch = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${created.id}`)
      .send({})
      .expect(400);
    assert.equal(emptyPatch.body.error.code, 'EMPTY_PATCH');

    await request(app.getHttpServer()).delete(`/api/v1/categories/${created.id}`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/categories/${created.id}`).expect(404);
  });

  it('prevents deletion of categories that still contain products', async () => {
    const category = await createCategory();
    await createProduct(category.id, 'cup-01');

    const response = await request(app.getHttpServer()).delete(`/api/v1/categories/${category.id}`).expect(409);
    assert.equal(response.body.error.code, 'CATEGORY_HAS_PRODUCTS');
    assert.equal(response.body.error.message, 'این دسته‌بندی دارای محصول است و نمی‌توان آن را حذف کرد.');
    assert.equal(await categories.exists(category.id), true);
  });

  it('supports product create, get, update, and delete with normalized SKU and integer prices', async () => {
    const category = await createCategory();
    const created = await request(app.getHttpServer())
      .post('/api/v1/products')
      .send({
        name: '  لیوان شیشه‌ای  ',
        sku: ' cup-01 ',
        categoryId: category.id,
        unit: 'piece',
        salePrice: 125_000,
        purchasePrice: 75_000,
        description: '  شفاف  ',
      })
      .expect(201);
    const product = created.body.data as Product;
    assert.equal(product.name, 'لیوان شیشه‌ای');
    assert.equal(product.sku, 'CUP-01');
    assert.equal(product.salePrice, 125_000);
    assert.equal(product.purchasePrice, 75_000);
    assert.equal(product.description, 'شفاف');

    const fetched = await request(app.getHttpServer()).get(`/api/v1/products/${product.id}`).expect(200);
    assert.equal(fetched.body.data.id, product.id);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/products/${product.id}`)
      .send({ name: 'لیوان شیشه‌ای بزرگ', salePrice: 150_000, isActive: false })
      .expect(200);
    assert.equal(updated.body.data.salePrice, 150_000);
    assert.equal(updated.body.data.isActive, false);

    const emptyPatch = await request(app.getHttpServer()).patch(`/api/v1/products/${product.id}`).send({}).expect(400);
    assert.equal(emptyPatch.body.error.code, 'EMPTY_PATCH');

    await request(app.getHttpServer()).delete(`/api/v1/products/${product.id}`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/products/${product.id}`).expect(404);
  });

  it('rejects duplicate SKUs and invalid categories with safe error envelopes', async () => {
    const category = await createCategory();
    await createProduct(category.id, 'cup-01');

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/products')
      .send({ name: 'لیوان دوم', sku: 'CUP-01', categoryId: category.id, unit: 'piece', salePrice: 50_000 })
      .expect(409);
    assert.equal(duplicate.body.error.code, 'PRODUCT_SKU_EXISTS');
    assert.equal(duplicate.body.error.message, 'این کد کالا قبلاً ثبت شده است.');

    const invalidCategory = await request(app.getHttpServer())
      .post('/api/v1/products')
      .send({ name: 'محصول', sku: 'SKU-02', categoryId: randomUUID(), unit: 'piece', salePrice: 0 })
      .expect(400);
    assert.equal(invalidCategory.body.error.code, 'CATEGORY_NOT_FOUND');
  });

  it('validates units, prices, unknown fields, and category identifiers', async () => {
    const category = await createCategory();
    const negativePrice = await request(app.getHttpServer())
      .post('/api/v1/products')
      .send({ name: 'محصول', sku: 'SKU-10', categoryId: category.id, unit: 'piece', salePrice: -1 })
      .expect(400);
    assert.equal(negativePrice.body.error.code, 'VALIDATION_ERROR');
    assert.equal(negativePrice.body.error.details[0].field, 'salePrice');

    const invalidUnit = await request(app.getHttpServer())
      .post('/api/v1/products')
      .send({ name: 'محصول', sku: 'SKU-11', categoryId: category.id, unit: 'unknown', salePrice: 1 })
      .expect(400);
    assert.equal(invalidUnit.body.error.details[0].field, 'unit');

    const product = await createProduct(category.id, 'SKU-12');
    const nullableSalePrice = await request(app.getHttpServer())
      .patch(`/api/v1/products/${product.id}`)
      .send({ salePrice: null })
      .expect(400);
    assert.equal(nullableSalePrice.body.error.details[0].field, 'salePrice');
    const nullableActiveStatus = await request(app.getHttpServer())
      .patch(`/api/v1/products/${product.id}`)
      .send({ isActive: null })
      .expect(400);
    assert.equal(nullableActiveStatus.body.error.details[0].field, 'isActive');
    const nullableCategoryName = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${category.id}`)
      .send({ name: null })
      .expect(400);
    assert.equal(nullableCategoryName.body.error.details[0].field, 'name');

    const massAssignment = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .send({ name: 'جدید', parentId: randomUUID() })
      .expect(400);
    assert.equal(massAssignment.body.error.code, 'VALIDATION_ERROR');

    const invalidId = await request(app.getHttpServer()).get('/api/v1/categories/not-a-uuid').expect(400);
    assert.equal(invalidId.body.error.code, 'VALIDATION_ERROR');
  });

  it('searches by product name and SKU, filters, and paginates', async () => {
    const kitchen = await createCategory('آشپزخانه');
    const cleaning = await createCategory('نظافت');
    const first = await createProduct(kitchen.id, 'cup-01', 'لیوان شیشه‌ای', 10_000);
    await createProduct(kitchen.id, 'cup-02', 'لیوان کاغذی', 20_000);
    await createProduct(cleaning.id, 'brush-01', 'برس ظرفشویی', 30_000);
    await request(app.getHttpServer()).patch(`/api/v1/products/${first.id}`).send({ isActive: false }).expect(200);

    const searched = await request(app.getHttpServer())
      .get('/api/v1/products')
      .query({ search: ' لیوان ', categoryId: kitchen.id, isActive: 'true', page: 1, pageSize: 1 })
      .expect(200);
    assert.equal(searched.body.data.items.length, 1);
    assert.equal(searched.body.data.items[0].sku, 'CUP-02');
    assert.deepEqual(searched.body.data.pagination, { page: 1, pageSize: 1, total: 1, totalPages: 1 });

    const skuSearch = await request(app.getHttpServer()).get('/api/v1/products?search=brush').expect(200);
    assert.equal(skuSearch.body.data.items[0].sku, 'BRUSH-01');

    const inactive = await request(app.getHttpServer())
      .get('/api/v1/products')
      .query({ isActive: false })
      .expect(200);
    assert.deepEqual(inactive.body.data.items.map((item: Product) => item.id), [first.id]);
  });

  it('validates product list pagination and status filters', async () => {
    const tooLargePageSize = await request(app.getHttpServer()).get('/api/v1/products?pageSize=101').expect(400);
    assert.equal(tooLargePageSize.body.error.code, 'VALIDATION_ERROR');
    const tooLargePage = await request(app.getHttpServer()).get('/api/v1/products?page=2147483648').expect(400);
    assert.equal(tooLargePage.body.error.code, 'VALIDATION_ERROR');
    const badFilter = await request(app.getHttpServer()).get('/api/v1/products?isActive=yes').expect(400);
    assert.equal(badFilter.body.error.code, 'VALIDATION_ERROR');
  });
});
