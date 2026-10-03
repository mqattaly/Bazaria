import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import type { CreateCategoryInput, UpdateCategoryInput } from '@bazariya/shared';

function trimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeDescription(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class CreateCategoryDto implements CreateCategoryInput {
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'نام دسته‌بندی باید متن باشد.' })
  @MinLength(2, { message: 'نام دسته‌بندی باید دست‌کم ۲ نویسه باشد.' })
  @MaxLength(80, { message: 'نام دسته‌بندی نمی‌تواند بیشتر از ۸۰ نویسه باشد.' })
  name!: string;

  @IsOptional()
  @Transform(({ value }) => normalizeDescription(value))
  @IsString({ message: 'توضیحات دسته‌بندی باید متن باشد.' })
  @MaxLength(1000, { message: 'توضیحات دسته‌بندی نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.' })
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'وضعیت دسته‌بندی معتبر نیست.' })
  isActive?: boolean;
}

export class UpdateCategoryDto implements UpdateCategoryInput {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'نام دسته‌بندی باید متن باشد.' })
  @MinLength(2, { message: 'نام دسته‌بندی باید دست‌کم ۲ نویسه باشد.' })
  @MaxLength(80, { message: 'نام دسته‌بندی نمی‌تواند بیشتر از ۸۰ نویسه باشد.' })
  name?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeDescription(value))
  @IsString({ message: 'توضیحات دسته‌بندی باید متن باشد.' })
  @MaxLength(1000, { message: 'توضیحات دسته‌بندی نمی‌تواند بیشتر از ۱۰۰۰ نویسه باشد.' })
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'وضعیت دسته‌بندی معتبر نیست.' })
  isActive?: boolean;
}
