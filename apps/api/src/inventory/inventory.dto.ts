import { Transform, Type } from 'class-transformer';
import { Allow, IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  INVENTORY_STATUSES,
  STOCK_MOVEMENT_TYPES,
  type CreateStockMovementInput,
  type InventoryListQuery,
  type InventoryStatus,
  type StockMovementListQuery,
  type StockMovementType,
  type UpdateInventoryMinimumInput,
} from '@bazariya/shared';

function trimValue(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function parseBoolean(value: unknown): unknown {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

export class InventoryQueryDto implements InventoryListQuery {
  @IsOptional()
  @Transform(({ value }) => trimValue(value))
  @IsString({ message: 'عبارت جستجو باید متن باشد.' })
  @MaxLength(120, { message: 'عبارت جستجو نمی‌تواند بیشتر از ۱۲۰ نویسه باشد.' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsIn([...INVENTORY_STATUSES], { message: 'وضعیت موجودی معتبر نیست.' })
  status?: InventoryStatus;

  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean({ message: 'فیلتر موجودی کم باید درست یا نادرست باشد.' })
  lowStock?: boolean;

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

export class StockMovementQueryDto implements StockMovementListQuery {
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsIn([...STOCK_MOVEMENT_TYPES], { message: 'نوع گردش موجودی معتبر نیست.' })
  type?: StockMovementType;

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

// Values are validated by InventoryService so the API can return stable,
// domain-specific errors while the global ValidationPipe still rejects unknown keys.
export class CreateStockMovementDto implements CreateStockMovementInput {
  @Allow()
  type!: StockMovementType;

  @Allow()
  quantity!: number;

  @Allow()
  note?: string | null;
}

export class UpdateInventoryMinimumDto implements UpdateInventoryMinimumInput {
  @Allow()
  minimumQuantity!: number;
}
