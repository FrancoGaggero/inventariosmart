import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from '../generated/prisma/client';
import { TenantContext } from '../auth/tenant-context';
import type { Env } from '../config/env';
import { type ClienteTenant, crearClienteTenant } from './tenant.extension';

export type TransaccionRaw = Prisma.TransactionClient;

/**
 * Acceso a la base (Prisma 7 + adaptador pg).
 * - `tenant`: cliente para los módulos de negocio; inyecta `comercio_id` y activa RLS.
 * - `raw`: cliente sin contexto. Sólo lo usa `auth/` (provisioning) y los tests.
 * - `comoSistema`: transacción con `app.rol_sistema = 'provisioning'` (alta de comercio, jobs).
 * - `transaccionTenant`: transacción interactiva con `app.comercio_id` fijado (RLS activa).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly raw: PrismaClient;
  readonly tenant: ClienteTenant;

  constructor(config: ConfigService<Env, true>) {
    const adapter = new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) });
    this.raw = new PrismaClient({ adapter });
    this.tenant = crearClienteTenant(this.raw);
  }

  async onModuleInit(): Promise<void> {
    await this.raw.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.raw.$disconnect();
  }

  /** Verificación mínima de conectividad para /health. */
  async ping(): Promise<boolean> {
    try {
      await this.raw.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async comoSistema<T>(fn: (tx: TransaccionRaw) => Promise<T>): Promise<T> {
    return this.raw.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.rol_sistema', 'provisioning', true)`;
      return fn(tx);
    });
  }

  async transaccionTenant<T>(fn: (tx: TransaccionRaw) => Promise<T>): Promise<T> {
    const { comercioId } = TenantContext.requerido();
    return this.raw.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.comercio_id', ${comercioId}, true)`;
      return fn(tx);
    });
  }
}
