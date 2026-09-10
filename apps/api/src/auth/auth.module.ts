import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SensitiveFieldsInterceptor } from '../common/interceptors/sensitive-fields.interceptor';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseService, TokenVerifier } from './firebase.service';
import { PlanGuard } from './plan.guard';
import { AuthProvisioningService } from './provisioning.service';
import { RolesGuard } from './roles.guard';

/**
 * Autenticación, provisioning y autorización. Los guards globales se registran en este
 * orden: autenticación (resuelve usuario y tenant) → roles → plan.
 */
@Module({
  providers: [
    AuthProvisioningService,
    { provide: TokenVerifier, useClass: FirebaseService },
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PlanGuard },
    { provide: APP_INTERCEPTOR, useClass: SensitiveFieldsInterceptor },
  ],
  exports: [TokenVerifier, AuthProvisioningService],
})
export class AuthModule {}
