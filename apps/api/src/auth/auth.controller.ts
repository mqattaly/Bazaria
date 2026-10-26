import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { LoginDto, ChangePasswordDto, SetPasswordDto } from './dto/auth.dto';
import { Public } from '../common/decorators';
import {
  clearUserSessionCookie,
  setUserSessionCookie,
} from './auth-cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const result = await this.auth.login(
      body.mobile,
      body.password,
      request.ip,
      request.header('user-agent') ?? undefined,
    );
    setUserSessionCookie(response, result.token, result.expiresAt);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) response: Response): Promise<unknown> {
    await this.auth.revokeCurrentSession();
    clearUserSessionCookie(response);
    return { ok: true };
  }

  @Post('password/change')
  @HttpCode(200)
  async changePassword(@Body() body: ChangePasswordDto): Promise<unknown> {
    await this.auth.changePassword(body.currentPassword, body.newPassword);
    return { ok: true };
  }

  @Public()
  @Post('password/set')
  @HttpCode(200)
  async setPassword(@Body() body: SetPasswordDto): Promise<unknown> {
    await this.passwordReset.setPasswordWithToken(body.token, body.newPassword);
    return { ok: true };
  }
}
