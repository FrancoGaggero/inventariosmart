import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { ComercioModule } from './comercio/comercio.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { type Env, validateEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
              : undefined,
        },
      }),
    }),
    ThrottlerModule.forRoot({ throttlers: [{ name: 'global', ttl: 60_000, limit: 120 }] }),
    PrismaModule,
    AuthModule,
    HealthModule,
    MeModule,
    ComercioModule,
    UsersModule,
    ProductsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
