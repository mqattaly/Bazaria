import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { CreateCustomerInput, CustomerListQuery, UpdateCustomerInput } from '@bazariya/shared';
import { normalizeEmail, normalizeOptionalText, normalizePhone } from './customers.validation.js';

function trimName(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimSearch(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeText(value: unknown): unknown {
  return typeof value === 'string' || value === null
    ? normalizeOptionalText(value)
    : value;
}

function normalizeCustomerEmail(value: unknown): unknown {
  return typeof value === 'string' || value === null
    ? normalizeEmail(value)
    : value;
}

export class CreateCustomerDto implements CreateCustomerInput {
  @Transform(({ value }) => trimName(value))
  @IsString({ message: 'نام مشتری باید متن باشد.' })
  @MinLength(2, { message: 'نام مشتری باید دست‌کم ۲ نویسه باشد.' })
  @MaxLength(120, { message: 'نام مشتری نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  name!: string;

  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @IsString({ message: 'شماره تماس باید متن باشد.' })
  @MaxLength(16, { message: 'شماره تماس معتبر نیست.' })
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeCustomerEmail(value))
  @IsString({ message: 'ایمیل باید متن باشد.' })
  @MaxLength(254, { message: 'ایمیل نمی‌تواند بیشتر از ۲۵۴ نویسه باشد.' })
  email?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsString({ message: 'آدرس باید متن باشد.' })
  @MaxLength(500, { message: 'آدرس نمی‌تواند بیشتر از ۵۰۰ نویسه باشد.' })
  address?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsString({ message: 'توضیحات باید متن باشد.' })
  @MaxLength(1000, { message: 'توضیحات نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.' })
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'وضعیت مشتری معتبر نیست.' })
  isActive?: boolean;
}

export class UpdateCustomerDto implements UpdateCustomerInput {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => trimName(value))
  @IsString({ message: 'نام مشتری باید متن باشد.' })
  @MinLength(2, { message: 'نام مشتری باید دست‌کم ۲ نویسه باشد.' })
  @MaxLength(120, { message: 'نام مشتری نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  name?: string;

  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @IsString({ message: 'شماره تماس باید متن باشد.' })
  @MaxLength(16, { message: 'شماره تماس معتبر نیست.' })
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeCustomerEmail(value))
  @IsString({ message: 'ایمیل باید متن باشد.' })
  @MaxLength(254, { message: 'ایمیل نمی‌تواند بیشتر از ۲۵۴ نویسه باشد.' })
  email?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsString({ message: 'آدرس باید متن باشد.' })
  @MaxLength(500, { message: 'آدرس نمی‌تواند بیشتر از ۵۰۰ نویسه باشد.' })
  address?: string | null;

  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsString({ message: 'توضیحات باید متن باشد.' })
  @MaxLength(1000, { message: 'توضیحات نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.' })
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'وضعیت مشتری معتبر نیست.' })
  isActive?: boolean;
}

export class CustomersQueryDto implements CustomerListQuery {
  @IsOptional()
  @Transform(({ value }) => trimSearch(value))
  @IsString({ message: 'عبارت جستجو باید متن باشد.' })
  @MaxLength(120, { message: 'عبارت جستجو نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  search?: string;

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
