import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type {
  CreateSupplierInput,
  SupplierListQuery,
  UpdateSupplierInput,
  UpdateSupplierStatusInput,
} from '@bazariya/shared';

function trimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeOptional(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  return value.trim() || null;
}

function normalizeEmail(value: unknown): unknown {
  const normalized = normalizeOptional(value);
  return typeof normalized === 'string' ? normalized.toLocaleLowerCase('en-US') : normalized;
}

export class CreateSupplierDto implements CreateSupplierInput {
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'نام تأمین‌کننده باید متن باشد.' })
  @MinLength(2, { message: 'نام تأمین‌کننده باید دست‌کم ۲ نویسه باشد.' })
  @MaxLength(120, { message: 'نام تأمین‌کننده نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  name!: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptional(value))
  @IsString({ message: 'شماره تماس باید متن باشد.' })
  @MaxLength(32, { message: 'شماره تماس نمی‌تواند بیشتر از ۳۲ نویسه باشد.' })
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'یک نشانی ایمیل معتبر وارد کنید.' })
  @MaxLength(254, { message: 'ایمیل نمی‌تواند بیشتر از ۲۵۴ نویسه باشد.' })
  email?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptional(value))
  @IsString({ message: 'آدرس باید متن باشد.' })
  @MaxLength(500, { message: 'آدرس نمی‌تواند بیشتر از ۵۰۰ نویسه باشد.' })
  address?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptional(value))
  @IsString({ message: 'یادداشت باید متن باشد.' })
  @MaxLength(1000, { message: 'یادداشت نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.' })
  note?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'وضعیت تأمین‌کننده معتبر نیست.' })
  isActive?: boolean;
}

export class UpdateSupplierDto implements UpdateSupplierInput {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'نام تأمین‌کننده باید متن باشد.' })
  @MinLength(2, { message: 'نام تأمین‌کننده باید دست‌کم ۲ نویسه باشد.' })
  @MaxLength(120, { message: 'نام تأمین‌کننده نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  name?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptional(value))
  @IsString({ message: 'شماره تماس باید متن باشد.' })
  @MaxLength(32, { message: 'شماره تماس نمی‌تواند بیشتر از ۳۲ نویسه باشد.' })
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'یک نشانی ایمیل معتبر وارد کنید.' })
  @MaxLength(254, { message: 'ایمیل نمی‌تواند بیشتر از ۲۵۴ نویسه باشد.' })
  email?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptional(value))
  @IsString({ message: 'آدرس باید متن باشد.' })
  @MaxLength(500, { message: 'آدرس نمی‌تواند بیشتر از ۵۰۰ نویسه باشد.' })
  address?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeOptional(value))
  @IsString({ message: 'یادداشت باید متن باشد.' })
  @MaxLength(1000, { message: 'یادداشت نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.' })
  note?: string | null;
}

export class UpdateSupplierStatusDto implements UpdateSupplierStatusInput {
  @IsBoolean({ message: 'وضعیت تأمین‌کننده معتبر نیست.' })
  isActive!: boolean;
}

export class SuppliersQueryDto implements SupplierListQuery {
  @IsOptional()
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'عبارت جستجو باید متن باشد.' })
  @MaxLength(120, { message: 'عبارت جستجو نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsIn(['active', 'inactive'], { message: 'فیلتر وضعیت معتبر نیست.' })
  status?: 'active' | 'inactive';

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
