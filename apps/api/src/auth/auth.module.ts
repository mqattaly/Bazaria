import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { PasswordHasher } from './password-hasher.service';
import { PasswordResetService } from './password-reset.service';
import { SessionService } from './session.service';
import { LoginThrottleService } from './login-throttle.service';

@Global()
@Module({
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    PasswordHasher,
    PasswordResetService,
    SessionService,
    LoginThrottleService,
  ],
  exports: [AuthService, PasswordHasher, PasswordResetService, SessionService, LoginThrottleService],
})
export class AuthModule {}
