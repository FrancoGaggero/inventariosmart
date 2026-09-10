import { Injectable } from '@nestjs/common';
import {
  type Invitacion,
  LIMITES_PLAN,
  type Usuario,
  type UsuarioPatch,
} from '@inventariosmart/shared';
import { TenantContext } from '../auth/tenant-context';
import { conflicto, noEncontrado, planRequerido, validacion } from '../common/errors';
import { Prisma, type Usuario as UsuarioRow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export function aUsuario(u: UsuarioRow): Usuario {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    activo: u.activo,
    estado: !u.firebaseUid ? 'INVITADO' : u.activo ? 'ACTIVO' : 'INACTIVO',
    creadoEn: u.creadoEn.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<Usuario[]> {
    const filas = await this.prisma.tenant.usuario.findMany({ orderBy: { creadoEn: 'asc' } });
    return filas.map(aUsuario);
  }

  /** Invitación por email (CP-11.3). Cuenta contra el límite de usuarios del plan (CP-11.7). */
  async invitar(inv: Invitacion): Promise<Usuario> {
    const { plan, comercioId } = TenantContext.requerido();
    const limite = LIMITES_PLAN[plan].usuarios;
    if (limite !== null) {
      const actuales = await this.prisma.tenant.usuario.count();
      if (actuales >= limite) {
        throw planRequerido(
          'PRO',
          `El plan ${plan} admite ${limite} usuario. Pasá al plan PRO para invitar a tu equipo.`,
        );
      }
    }
    try {
      // comercioId explícito para el tipado; la extensión de tenant lo fija igual.
      const creado = await this.prisma.tenant.usuario.create({
        data: { email: inv.email, rol: inv.rol, comercioId },
      });
      return aUsuario(creado);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw conflicto('Ese email ya está en uso en InventarioSmart.', { email: inv.email });
      }
      throw err;
    }
  }

  /** Cambio de rol o de estado (CP-11.3c), sin dejar al comercio sin dueño (CP-11.3d). */
  async actualizar(id: string, patch: UsuarioPatch): Promise<Usuario> {
    const { comercioId } = TenantContext.requerido();
    return this.prisma.transaccionTenant(async (tx) => {
      const objetivo = await tx.usuario.findFirst({ where: { id, comercioId } });
      if (!objetivo) throw noEncontrado('No encontramos ese usuario en tu comercio.');

      const dejaDeSerDuenioActivo =
        objetivo.rol === 'DUENIO' &&
        objetivo.activo &&
        ((patch.rol !== undefined && patch.rol !== 'DUENIO') || patch.activo === false);

      if (dejaDeSerDuenioActivo) {
        // Bloqueamos las filas de los dueños para que dos cambios simultáneos no dejen cero.
        const duenios = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM usuario
          WHERE comercio_id = ${comercioId}::uuid AND rol = 'DUENIO' AND activo
          FOR UPDATE`;
        if (duenios.filter((d) => d.id !== id).length === 0) {
          throw validacion('El comercio necesita al menos un dueño activo.', {
            _: 'Asigná el rol DUENIO a otra persona antes de cambiar este usuario.',
          });
        }
      }

      const data: Prisma.UsuarioUpdateInput = {};
      if (patch.rol !== undefined) data.rol = patch.rol;
      if (patch.activo !== undefined) data.activo = patch.activo;
      const actualizado = await tx.usuario.update({ where: { id }, data });
      return aUsuario(actualizado);
    });
  }
}
