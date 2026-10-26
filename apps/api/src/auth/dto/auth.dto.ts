import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'شماره موبایل الزامی است.' })
  @Length(1, 32, { message: 'شماره موبایل معتبر نیست.' })
  mobile!: string;

  @IsString({ message: 'رمز عبور الزامی است.' })
  @Length(1, 128, { message: 'رمز عبور معتبر نیست.' })
  password!: string;
}

export class ChangePasswordDto {
  @IsString({ message: 'رمز عبور فعلی الزامی است.' })
  @Length(1, 128, { message: 'رمز عبور فعلی معتبر نیست.' })
  currentPassword!: string;

  @IsString({ message: 'رمز عبور جدید الزامی است.' })
  @MinLength(10, { message: 'رمز عبور جدید باید حداقل ۱۰ نویسه باشد.' })
  @MaxLength(128, { message: 'رمز عبور جدید نباید بیش از ۱۲۸ نویسه باشد.' })
  newPassword!: string;
}

export class SetPasswordDto {
  @IsString({ message: 'کد فعال‌سازی الزامی است.' })
  @Length(20, 200, { message: 'کد فعال‌سازی معتبر نیست.' })
  token!: string;

  @IsString({ message: 'رمز عبور جدید الزامی است.' })
  @MinLength(10, { message: 'رمز عبور جدید باید حداقل ۱۰ نویسه باشد.' })
  @MaxLength(128, { message: 'رمز عبور جدید نباید بیش از ۱۲۸ نویسه باشد.' })
  newPassword!: string;
}

export class PlatformLoginDto {
  @IsString({ message: 'نام کاربری الزامی است.' })
  @Length(3, 64, { message: 'نام کاربری معتبر نیست.' })
  username!: string;

  @IsString({ message: 'رمز عبور الزامی است.' })
  @Length(1, 128, { message: 'رمز عبور معتبر نیست.' })
  password!: string;
}
