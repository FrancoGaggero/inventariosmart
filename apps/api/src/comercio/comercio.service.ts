import { Injectable } from '@nestjs/common';
import type { Comercio, ComercioPatch } from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import type { Prisma, Comercio as ComercioRow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export function aComercio(c: ComercioRow): Comercio {
  return {
    id: c.id,
    nombre: c.nombre,
    cuit: c.cuit,
    plan: c.plan,
    ivaDefault: c.ivaDefault.toString(),
    moneda: c.moneda,
    onboardingPendiente: c.onboardingPendiente,
  };
}

@Injectable()
export class ComercioService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(): Promise<Comercio> {
    const { comercioId } = TenantContext.requerido();
    const c = await this.prisma.tenant.comercio.findUniqueOrThrow({ where: { id: comercioId } });
    return aComercio(c);
  }

  async actualizar(patch: ComercioPatch): Promise<Comercio> {
    const { comercioId } = TenantContext.requerido();
    const data: Prisma.ComercioUpdateInput = {};
    if (patch.nombre !== undefined) data.nombre = patch.nombre;
    if (patch.cuit !== undefined) data.cuit = patch.cuit;
    if (patch.ivaDefault !== undefined) data.ivaDefault = patch.ivaDefault;
    const c = await this.prisma.tenant.comercio.update({ where: { id: comercioId }, data });
    return aComercio(c);
  }

  /** Confirma el nombre del comercio elegido en el registro (CP-11.2c). Idempotente. */
  async onboarding(nombreComercio: string): Promise<Comercio> {
    const { comercioId } = TenantContext.requerido();
    const c = await this.prisma.tenant.comercio.update({
      where: { id: comercioId },
      data: { nombre: nombreComercio, onboardingPendiente: false },
    });
    return aComercio(c);
  }
}
