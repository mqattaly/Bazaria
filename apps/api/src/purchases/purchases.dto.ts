import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  IsInt,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  PURCHASE_STATUSES,
  type CreatePurchaseInput,
  type PurchaseItemInput,
  type PurchaseListQuery,
  type PurchaseStatus,
  type UpdatePurchaseInput,
  type UpdatePurchaseStatusInput,
} from '@bazariya/shared';

function trimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeNote(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  return value.trim() || null;
}

export class PurchaseItemInputDto implements PurchaseItemInput {
  @IsUUID('4', { message: 'محصول انتخاب‌شده معتبر نیست.' })
  productId!: string;

  @Allow()
  quantity!: number;

  @Allow()
  unitPrice!: number;
}

export class CreatePurchaseDto implements CreatePurchaseInput {
  @IsUUID('4', { message: 'تأمین‌کنندهٔ انتخاب‌شده معتبر نیست.' })
  supplierId!: string;

  @IsArray({ message: 'اقلام خرید باید به‌صورت فهرست ارسال شوند.' })
  @ArrayNotEmpty({ message: 'خرید باید دست‌کم یک قلم داشته باشد.' })
  @ArrayMaxSize(100, { message: 'هر خرید حداکثر می‌تواند ۱۰۰ محصول متفاوت داشته باشد.' })
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemInputDto)
  items!: PurchaseItemInputDto[];

  @Allow()
  discount?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeNote(value))
  @IsString({ message: 'یادداشت خرید باید متن باشد.' })
  @MaxLength(2000, { message: 'یادداشت خرید نمی‌تواند بیشتر از ۲۰۰۰ نویسه باشد.' })
  note?: string | null;
}

export class UpdatePurchaseDto implements UpdatePurchaseInput {
  @ValidateIf((_object, value) => value !== undefined)
  @IsUUID('4', { message: 'تأمین‌کنندهٔ انتخاب‌شده معتبر نیست.' })
  supplierId?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray({ message: 'اقلام خرید باید به‌صورت فهرست ارسال شوند.' })
  @ArrayNotEmpty({ message: 'خرید باید دست‌کم یک قلم داشته باشد.' })
  @ArrayMaxSize(100, { message: 'هر خرید حداکثر می‌تواند ۱۰۰ محصول متفاوت داشته باشد.' })
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemInputDto)
  items?: PurchaseItemInputDto[];

  @ValidateIf((_object, value) => value !== undefined)
  @Allow()
  discount?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeNote(value))
  @IsString({ message: 'یادداشت خرید باید متن باشد.' })
  @MaxLength(2000, { message: 'یادداشت خرید نمی‌تواند بیشتر از ۲۰۰۰ نویسه باشد.' })
  note?: string | null;
}

export class UpdatePurchaseStatusDto implements UpdatePurchaseStatusInput {
  @IsIn(['confirmed', 'cancelled'], { message: 'وضعیت نهایی خرید معتبر نیست.' })
  status!: 'confirmed' | 'cancelled';
}

export class PurchasesQueryDto implements PurchaseListQuery {
  @IsOptional()
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'عبارت جستجو باید متن باشد.' })
  @MaxLength(120, { message: 'عبارت جستجو نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID('4', { message: 'تأمین‌کنندهٔ انتخاب‌شده معتبر نیست.' })
  supplierId?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsIn([...PURCHASE_STATUSES], { message: 'فیلتر وضعیت خرید معتبر نیست.' })
  status?: PurchaseStatus;

  @IsOptional()
  @Transform(({ value }) => trimValue(value))
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'زمان آغاز باید تاریخ معتبر همراه با منطقهٔ زمانی باشد.' })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/i, { message: 'زمان آغاز باید منطقهٔ زمانی صریح داشته باشد.' })
  from?: string;

  @IsOptional()
  @Transform(({ value }) => trimValue(value))
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'زمان پایان باید تاریخ معتبر همراه با منطقهٔ زمانی باشد.' })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/i, { message: 'زمان پایان باید منطقهٔ زمانی صریح داشته باشد.' })
  to?: string;

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
