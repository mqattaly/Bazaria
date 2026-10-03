import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PRODUCT_UNITS, type CreateProductInput, type ProductListQuery, type ProductUnit, type UpdateProductInput } from '@bazariya/shared';

function trimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeSku(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function normalizeDescription(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class CreateProductDto implements CreateProductInput {
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'نام محصول باید متن باشد.' })
  @MinLength(2, { message: 'نام محصول باید دست‌کم ۲ نویسه باشد.' })
  @MaxLength(120, { message: 'نام محصول نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  name!: string;

  @Transform(({ value }) => normalizeSku(value))
  @IsString({ message: 'کد کالا باید متن باشد.' })
  @MinLength(1, { message: 'کد کالا الزامی است.' })
  @MaxLength(64, { message: 'کد کالا نمی‌تواند بیشتر از ۶۴ نویسه باشد.' })
  @Matches(/^[\p{L}\p{N}][\p{L}\p{N}._/-]*$/u, {
    message: 'کد کالا فقط می‌تواند شامل حروف، عدد، نقطه، خط تیره و ممیز باشد.',
  })
  sku!: string;

  @IsUUID('4', { message: 'دسته‌بندی انتخاب‌شده معتبر نیست.' })
  categoryId!: string;

  @IsIn([...PRODUCT_UNITS], { message: 'واحد انتخاب‌شده معتبر نیست.' })
  unit!: ProductUnit;

  @IsInt({ message: 'قیمت فروش باید عدد صحیح باشد.' })
  @Min(0, { message: 'قیمت فروش نمی‌تواند منفی باشد.' })
  @Max(Number.MAX_SAFE_INTEGER, { message: 'قیمت فروش بیش از حد بزرگ است.' })
  salePrice!: number;

  @IsOptional()
  @IsInt({ message: 'قیمت خرید باید عدد صحیح باشد.' })
  @Min(0, { message: 'قیمت خرید نمی‌تواند منفی باشد.' })
  @Max(Number.MAX_SAFE_INTEGER, { message: 'قیمت خرید بیش از حد بزرگ است.' })
  purchasePrice?: number | null;

  @IsOptional()
  @Transform(({ value }) => normalizeDescription(value))
  @IsString({ message: 'توضیحات محصول باید متن باشد.' })
  @MaxLength(1000, { message: 'توضیحات محصول نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.' })
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'وضعیت محصول معتبر نیست.' })
  isActive?: boolean;
}

export class UpdateProductDto implements UpdateProductInput {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'نام محصول باید متن باشد.' })
  @MinLength(2, { message: 'نام محصول باید دست‌کم ۲ نویسه باشد.' })
  @MaxLength(120, { message: 'نام محصول نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => normalizeSku(value))
  @IsString({ message: 'کد کالا باید متن باشد.' })
  @MinLength(1, { message: 'کد کالا الزامی است.' })
  @MaxLength(64, { message: 'کد کالا نمی‌تواند بیشتر از ۶۴ نویسه باشد.' })
  @Matches(/^[\p{L}\p{N}][\p{L}\p{N}._/-]*$/u, {
    message: 'کد کالا فقط می‌تواند شامل حروف، عدد، نقطه، خط تیره و ممیز باشد.',
  })
  sku?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID('4', { message: 'دسته‌بندی انتخاب‌شده معتبر نیست.' })
  categoryId?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn([...PRODUCT_UNITS], { message: 'واحد انتخاب‌شده معتبر نیست.' })
  unit?: ProductUnit;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt({ message: 'قیمت فروش باید عدد صحیح باشد.' })
  @Min(0, { message: 'قیمت فروش نمی‌تواند منفی باشد.' })
  @Max(Number.MAX_SAFE_INTEGER, { message: 'قیمت فروش بیش از حد بزرگ است.' })
  salePrice?: number;

  @IsOptional()
  @IsInt({ message: 'قیمت خرید باید عدد صحیح باشد.' })
  @Min(0, { message: 'قیمت خرید نمی‌تواند منفی باشد.' })
  @Max(Number.MAX_SAFE_INTEGER, { message: 'قیمت خرید بیش از حد بزرگ است.' })
  purchasePrice?: number | null;

  @IsOptional()
  @Transform(({ value }) => normalizeDescription(value))
  @IsString({ message: 'توضیحات محصول باید متن باشد.' })
  @MaxLength(1000, { message: 'توضیحات محصول نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.' })
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'وضعیت محصول معتبر نیست.' })
  isActive?: boolean;
}

export class ProductsQueryDto implements ProductListQuery {
  @IsOptional()
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'عبارت جستجو باید متن باشد.' })
  @MaxLength(120, { message: 'عبارت جستجو نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID('4', { message: 'دسته‌بندی انتخاب‌شده معتبر نیست.' })
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean({ message: 'فیلتر وضعیت باید true یا false باشد.' })
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'شماره صفحه باید عدد صحیح باشد.' })
  @Min(1, { message: 'شماره صفحه باید دست‌کم ۱ باشد.' })
  @Max(2_147_483_647, { message: 'شماره صفحه معتبر نیست.' })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'اندازه صفحه باید عدد صحیح باشد.' })
  @Min(1, { message: 'اندازه صفحه باید دست‌کم ۱ باشد.' })
  @Max(100, { message: 'اندازه صفحه نمی‌تواند بیشتر از ۱۰۰ باشد.' })
  pageSize = 20;
}
