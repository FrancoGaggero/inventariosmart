import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseService, TokenVerifier } from './firebase.service';

@Module({
  providers: [
    { provide: TokenVerifier, useClass: FirebaseService },
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
  ],
  exports: [TokenVerifier],
})
export class AuthModule {}
