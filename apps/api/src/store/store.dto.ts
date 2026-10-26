import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  STORE_SORT_FIELDS,
  STORE_STATUSES,
  type StoreSort,
  type StoreStatus,
} from '@bazaria/shared';

export class CreateStoreDto {
  @IsString({ message: 'نام فروشگاه الزامی است.' })
  @Length(2, 160, { message: 'نام فروشگاه باید بین ۲ تا ۱۶۰ نویسه باشد.' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'نام مسئول باید متن باشد.' })
  @Length(2, 120, { message: 'نام مسئول باید بین ۲ تا ۱۲۰ نویسه باشد.' })
  contactName?: string | null;

  @IsOptional()
  @IsString({ message: 'شماره تماس باید متن باشد.' })
  @Length(1, 32, { message: 'شماره تماس معتبر نیست.' })
  contactMobile?: string | null;

  @IsOptional()
  @IsString({ message: 'نشانی باید متن باشد.' })
  @Length(1, 500, { message: 'نشانی نباید بیش از ۵۰۰ نویسه باشد.' })
  address?: string | null;

  @IsOptional()
  @IsString({ message: 'یادداشت باید متن باشد.' })
  @MaxLength(1000, { message: 'یادداشت نباید بیش از ۱۰۰۰ نویسه باشد.' })
  note?: string | null;
}

export class UpdateStoreDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString({ message: 'نام فروشگاه باید متن باشد.' })
  @Length(2, 160, { message: 'نام فروشگاه باید بین ۲ تا ۱۶۰ نویسه باشد.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'نام مسئول باید متن باشد.' })
  @Length(2, 120, { message: 'نام مسئول باید بین ۲ تا ۱۲۰ نویسه باشد.' })
  contactName?: string | null;

  @IsOptional()
  @IsString({ message: 'شماره تماس باید متن باشد.' })
  @Length(1, 32, { message: 'شماره تماس معتبر نیست.' })
  contactMobile?: string | null;

  @IsOptional()
  @IsString({ message: 'نشانی باید متن باشد.' })
  @Length(1, 500, { message: 'نشانی نباید بیش از ۵۰۰ نویسه باشد.' })
  address?: string | null;

  @IsOptional()
  @IsString({ message: 'یادداشت باید متن باشد.' })
  @MaxLength(1000, { message: 'یادداشت نباید بیش از ۱۰۰۰ نویسه باشد.' })
  note?: string | null;
}

export class UpdateStoreStatusDto {
  @IsIn([...STORE_STATUSES], { message: 'وضعیت فروشگاه معتبر نیست.' })
  status!: StoreStatus;
}

export class ListStoresQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'شماره صفحه باید عدد صحیح باشد.' })
  @Min(1, { message: 'شماره صفحه باید حداقل ۱ باشد.' })
  @Max(100000, { message: 'شماره صفحه بیش از حد بزرگ است.' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'تعداد هر صفحه باید عدد صحیح باشد.' })
  @Min(1, { message: 'تعداد هر صفحه باید حداقل ۱ باشد.' })
  @Max(100, { message: 'تعداد هر صفحه نباید بیش از ۱۰۰ باشد.' })
  pageSize?: number;

  @IsOptional()
  @IsString({ message: 'عبارت جست‌وجو باید متن باشد.' })
  @Length(1, 80, { message: 'عبارت جست‌وجو باید بین ۱ تا ۸۰ نویسه باشد.' })
  q?: string;

  @IsOptional()
  @IsIn([...STORE_STATUSES], { message: 'فیلتر وضعیت معتبر نیست.' })
  status?: StoreStatus;

  @IsOptional()
  @IsIn([...STORE_SORT_FIELDS], { message: 'مرتب‌سازی درخواستی معتبر نیست.' })
  sort?: StoreSort;
}
