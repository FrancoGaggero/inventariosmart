import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { conflicto } from '../common/errors';
import { PrismaService, type TransaccionRaw } from '../prisma/prisma.service';

/** Identidad verificada por Firebase. */
export interface Identidad {
  uid: string;
  email: string | null;
  nombre: string | null;
}

const incluirComercio = { comercio: true } as const;
type UsuarioConComercio = Prisma.UsuarioGetPayload<{ include: typeof incluirComercio }>;

/**
 * Resuelve la identidad de Firebase contra la base (D1 del diseño):
 * 1. usuario existente por `firebase_uid`;
 * 2. invitación pendiente por email (`firebase_uid` nulo) → se vincula;
 * 3. nadie → comercio FREE nuevo con esta persona como DUENIO.
 * Corre bajo `app.rol_sistema = 'provisioning'` porque todavía no hay tenant.
 */
@Injectable()
export class AuthProvisioningService {
  private readonly logger = new Logger(AuthProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolver(identidad: Identidad): Promise<AuthUser> {
    try {
      const usuario = await this.prisma.comoSistema((tx) => this.resolverEn(tx, identidad));
      return this.aAuthUser(usuario, identidad.uid);
    } catch (err) {
      // Dos requests simultáneos de una identidad nueva: el segundo choca con el índice
      // único de firebase_uid (o email); basta con volver a leer.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const usuario = await this.prisma.comoSistema((tx) =>
          tx.usuario.findUnique({ where: { firebaseUid: identidad.uid }, include: incluirComercio }),
        );
        if (usuario) return this.aAuthUser(usuario, identidad.uid);
      }
      throw err;
    }
  }

  private async resolverEn(tx: TransaccionRaw, identidad: Identidad): Promise<UsuarioConComercio> {
    const porUid = await tx.usuario.findUnique({
      where: { firebaseUid: identidad.uid },
      include: incluirComercio,
    });
    if (porUid) return porUid;

    const email = identidad.email?.trim().toLowerCase() ?? null;
    if (!email) {
      throw conflicto('Tu cuenta no tiene un email verificado; no podemos crear el comercio.');
    }

    const porEmail = await tx.usuario.findUnique({ where: { email } });
    if (porEmail) {
      if (porEmail.firebaseUid && porEmail.firebaseUid !== identidad.uid) {
        throw conflicto('Ese email ya está asociado a otra cuenta de InventarioSmart.');
      }
      // Invitación pendiente: vinculamos la identidad (CP-11.3b).
      const vinculado = await tx.usuario.update({
        where: { id: porEmail.id },
        data: { firebaseUid: identidad.uid, nombre: porEmail.nombre ?? identidad.nombre },
        include: incluirComercio,
      });
      this.logger.log(`Invitación vinculada: ${email} → comercio ${vinculado.comercioId}`);
      return vinculado;
    }

    // Primer ingreso: comercio nuevo con plan FREE y esta persona como DUENIO (CP-11.2).
    const nombreProvisorio = `Comercio de ${identidad.nombre ?? email.split('@')[0]}`.slice(0, 120);
    const comercio = await tx.comercio.create({
      data: {
        nombre: nombreProvisorio,
        usuarios: {
          create: { firebaseUid: identidad.uid, email, nombre: identidad.nombre, rol: 'DUENIO' },
        },
      },
      include: { usuarios: true },
    });
    const duenio = comercio.usuarios[0]!;
    this.logger.log(`Comercio creado: ${comercio.id} (${email})`);
    const { usuarios: _u, ...comercioSolo } = comercio;
    return { ...duenio, comercio: comercioSolo };
  }

  private aAuthUser(u: UsuarioConComercio, uid: string): AuthUser {
    return {
      uid,
      email: u.email,
      usuarioId: u.id,
      nombre: u.nombre,
      rol: u.rol,
      activo: u.activo,
      creadoEn: u.creadoEn,
      comercio: {
        id: u.comercio.id,
        nombre: u.comercio.nombre,
        cuit: u.comercio.cuit,
        plan: u.comercio.plan,
        ivaDefault: u.comercio.ivaDefault.toString(),
        moneda: u.comercio.moneda,
        onboardingPendiente: u.comercio.onboardingPendiente,
      },
    };
  }
}
