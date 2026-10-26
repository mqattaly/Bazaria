import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ROLE_CODES, type RoleCode } from '@bazaria/shared';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString({ message: 'نام شرکت باید متن باشد.' })
  @Length(2, 160, { message: 'نام شرکت باید بین ۲ تا ۱۶۰ نویسه باشد.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'واحد پول باید متن باشد.' })
  @Matches(/^[A-Z]{3}$/, { message: 'واحد پول باید کد سه‌حرفی مانند IRR باشد.' })
  currency?: string;
}

export class AddMembershipDto {
  @IsString({ message: 'شماره موبایل الزامی است.' })
  @Length(1, 32, { message: 'شماره موبایل معتبر نیست.' })
  mobile!: string;

  @IsString({ message: 'نام کاربر الزامی است.' })
  @Length(2, 120, { message: 'نام کاربر باید بین ۲ تا ۱۲۰ نویسه باشد.' })
  fullName!: string;

  @IsIn([...ROLE_CODES], { message: 'نقش انتخاب‌شده معتبر نیست.' })
  role!: RoleCode;
}

export class UpdateMembershipDto {
  @IsOptional()
  @IsIn([...ROLE_CODES], { message: 'نقش انتخاب‌شده معتبر نیست.' })
  role?: RoleCode;

  @IsOptional()
  @IsIn(['active', 'inactive'], { message: 'وضعیت عضویت معتبر نیست.' })
  status?: 'active' | 'inactive';
}

export class CreateCompanyDto {
  @IsString({ message: 'نام شرکت الزامی است.' })
  @Length(2, 160, { message: 'نام شرکت باید بین ۲ تا ۱۶۰ نویسه باشد.' })
  name!: string;

  @IsString({ message: 'کد شرکت الزامی است.' })
  @Matches(/^[A-Z0-9][A-Z0-9-]{1,31}$/, {
    message: 'کد شرکت باید ۲ تا ۳۲ نویسه انگلیسی بزرگ، رقم یا خط تیره باشد.',
  })
  code!: string;

  @IsString({ message: 'واحد پول الزامی است.' })
  @Matches(/^[A-Z]{3}$/, { message: 'واحد پول باید کد سه‌حرفی مانند IRR باشد.' })
  currency!: string;

  @IsInt({ message: 'سقف فروشگاه باید عدد صحیح باشد.' })
  @Min(1, { message: 'سقف فروشگاه باید حداقل ۱ باشد.' })
  @Max(10000, { message: 'سقف فروشگاه بیش از حد بزرگ است.' })
  maxStores!: number;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'تاریخ اعتبار معتبر نیست.' })
  validUntil?: string | null;

  @IsString({ message: 'شماره موبایل مدیر الزامی است.' })
  @Length(1, 32, { message: 'شماره موبایل مدیر معتبر نیست.' })
  managerMobile!: string;

  @IsString({ message: 'نام مدیر الزامی است.' })
  @Length(2, 120, { message: 'نام مدیر باید بین ۲ تا ۱۲۰ نویسه باشد.' })
  managerFullName!: string;
}

export class UpdateLicenseDto {
  @IsOptional()
  @IsIn(['active', 'suspended'], { message: 'وضعیت مجوز معتبر نیست.' })
  status?: 'active' | 'suspended';

  @IsOptional()
  @IsInt({ message: 'سقف فروشگاه باید عدد صحیح باشد.' })
  @Min(1, { message: 'سقف فروشگاه باید حداقل ۱ باشد.' })
  @Max(10000, { message: 'سقف فروشگاه بیش از حد بزرگ است.' })
  maxStores?: number;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'تاریخ اعتبار معتبر نیست.' })
  validUntil?: string | null;
}

export class RenewLicenseDto {
  @IsInt({ message: 'مدت تمدید باید عدد صحیح باشد.' })
  @Min(1, { message: 'مدت تمدید باید حداقل ۱ روز باشد.' })
  @Max(3650, { message: 'مدت تمدید نباید بیش از ۳۶۵۰ روز باشد.' })
  days!: number;
}
