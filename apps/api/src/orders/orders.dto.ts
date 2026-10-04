import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ORDER_STATUSES,
  type CreateOrderInput,
  type OrderItemInput,
  type OrderListQuery,
  type OrderStatus,
  type UpdateOrderInput,
  type UpdateOrderStatusInput,
} from '@bazariya/shared';

function trimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeNote(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class OrderItemInputDto implements OrderItemInput {
  @IsUUID('4', { message: 'محصول انتخاب‌شده معتبر نیست.' })
  productId!: string;

  @IsInt({ message: 'تعداد باید عدد صحیح باشد.' })
  @Min(1, { message: 'تعداد باید دست‌کم ۱ باشد.' })
  @Max(2_147_483_647, { message: 'تعداد از حد مجاز بیشتر است.' })
  quantity!: number;
}

export class CreateOrderDto implements CreateOrderInput {
  @IsOptional()
  @IsUUID('4', { message: 'مشتری انتخاب‌شده معتبر نیست.' })
  customerId?: string | null;

  @IsArray({ message: 'اقلام سفارش باید به‌صورت فهرست ارسال شوند.' })
  @ArrayNotEmpty({ message: 'سفارش باید دست‌کم یک قلم داشته باشد.' })
  @ArrayMaxSize(100, { message: 'هر سفارش حداکثر می‌تواند ۱۰۰ قلم متفاوت داشته باشد.' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt({ message: 'تخفیف باید عدد صحیح باشد.' })
  @Min(0, { message: 'تخفیف نمی‌تواند منفی باشد.' })
  @Max(Number.MAX_SAFE_INTEGER, { message: 'تخفیف بیش از حد بزرگ است.' })
  discount?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeNote(value))
  @IsString({ message: 'یادداشت سفارش باید متن باشد.' })
  @MaxLength(2000, { message: 'یادداشت سفارش نمی‌تواند بیشتر از ۲۰۰۰ نویسه باشد.' })
  note?: string | null;
}

export class UpdateOrderDto implements UpdateOrderInput {
  @IsOptional()
  @IsUUID('4', { message: 'مشتری انتخاب‌شده معتبر نیست.' })
  customerId?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray({ message: 'اقلام سفارش باید به‌صورت فهرست ارسال شوند.' })
  @ArrayNotEmpty({ message: 'سفارش باید دست‌کم یک قلم داشته باشد.' })
  @ArrayMaxSize(100, { message: 'هر سفارش حداکثر می‌تواند ۱۰۰ قلم متفاوت داشته باشد.' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items?: OrderItemInputDto[];

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt({ message: 'تخفیف باید عدد صحیح باشد.' })
  @Min(0, { message: 'تخفیف نمی‌تواند منفی باشد.' })
  @Max(Number.MAX_SAFE_INTEGER, { message: 'تخفیف بیش از حد بزرگ است.' })
  discount?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeNote(value))
  @IsString({ message: 'یادداشت سفارش باید متن باشد.' })
  @MaxLength(2000, { message: 'یادداشت سفارش نمی‌تواند بیشتر از ۲۰۰۰ نویسه باشد.' })
  note?: string | null;
}

export class UpdateOrderStatusDto implements UpdateOrderStatusInput {
  @IsIn(['confirmed', 'cancelled'], { message: 'وضعیت نهایی سفارش معتبر نیست.' })
  status!: 'confirmed' | 'cancelled';
}

export class OrdersQueryDto implements OrderListQuery {
  @IsOptional()
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'عبارت جستجو باید متن باشد.' })
  @MaxLength(120, { message: 'عبارت جستجو نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID('4', { message: 'مشتری انتخاب‌شده معتبر نیست.' })
  customerId?: string;

  @IsOptional()
  @IsIn([...ORDER_STATUSES], { message: 'فیلتر وضعیت سفارش معتبر نیست.' })
  status?: OrderStatus;

  @IsOptional()
  @Transform(({ value }) => trimValue(value))
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'زمان آغاز باید تاریخ معتبر همراه با منطقهٔ زمانی باشد.' })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/i, { message: 'زمان آغاز باید منطقهٔ زمانی صریح داشته باشد؛ برای نمونه از Z یا ‎+03:30 استفاده کنید.' })
  from?: string;

  @IsOptional()
  @Transform(({ value }) => trimValue(value))
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'زمان پایان باید تاریخ معتبر همراه با منطقهٔ زمانی باشد.' })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/i, { message: 'زمان پایان باید منطقهٔ زمانی صریح داشته باشد؛ برای نمونه از Z یا ‎+03:30 استفاده کنید.' })
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
