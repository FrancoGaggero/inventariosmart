import { randomBytes } from 'node:crypto';
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TokenVerifier } from '../src/auth/firebase.service';
import type { Identidad } from '../src/auth/provisioning.service';
import { configurarApp } from '../src/bootstrap';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Doble del verificador de Firebase. Un token `sim:<uid>:<email>[:<nombre>]`
 * se acepta con esa identidad; cualquier otro se rechaza.
 */
export class VerificadorSimulado extends TokenVerifier {
  async verificar(idToken: string): Promise<Identidad> {
    const [prefijo, uid, email, nombre] = idToken.split(':');
    if (prefijo !== 'sim' || !uid) throw new Error('token inválido');
    return { uid, email: email || null, nombre: nombre || null };
  }
}

/**
 * Identificador único por archivo de test (Jest evalúa los módulos por archivo y corre
 * varios en paralelo): así la limpieza de una suite nunca borra datos de otra.
 */
export const RUN = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
export const DOMINIO = `${RUN}.e2e.test`;

export interface Persona {
  uid: string;
  email: string;
  nombre: string;
  token: string;
}

export function persona(alias: string): Persona {
  const uid = `uid-${alias}-${RUN}`;
  const email = `${alias}@${DOMINIO}`;
  const nombre = `e2e-${alias}`;
  return { uid, email, nombre, token: `sim:${uid}:${email}:${nombre}` };
}

export interface AppDePrueba {
  app: INestApplication;
  prisma: PrismaService;
  http: () => request.Agent;
  limpiar: () => Promise<void>;
}

export async function crearAppDePrueba(controllers: Type[] = []): Promise<AppDePrueba> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers })
    .overrideProvider(TokenVerifier)
    .useClass(VerificadorSimulado)
    .compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  configurarApp(app);
  await app.init();
  const prisma = app.get(PrismaService);

  /**
   * Limpieza como propietaria de la base: `app_api` no puede borrar `movimiento`
   * (inmutabilidad, RN-07) y RLS no aplica a la propietaria.
   */
  const limpiar = async () => {
    await comoPropietaria(async (owner) => {
      const usuarios = await owner.usuario.findMany({
        where: { email: { endsWith: `@${DOMINIO}` } },
        select: { comercioId: true },
      });
      const comercios = [...new Set(usuarios.map((u) => u.comercioId))];
      // Tablas de negocio primero (FK a comercio), después usuarios y comercios.
      await owner.reporteSemanal.deleteMany({ where: { comercioId: { in: comercios } } });
      await owner.ordenCompraItem.deleteMany({ where: { comercioId: { in: comercios } } });
      await owner.ordenCompra.deleteMany({ where: { comercioId: { in: comercios } } });
      await owner.alerta.deleteMany({ where: { comercioId: { in: comercios } } });
      await owner.gasto.deleteMany({ where: { comercioId: { in: comercios } } });
      await owner.movimiento.deleteMany({ where: { comercioId: { in: comercios } } });
      await owner.precioProveedor.deleteMany({ where: { comercioId: { in: comercios } } });
      await owner.producto.deleteMany({ where: { comercioId: { in: comercios } } });
      await owner.proveedor.deleteMany({ where: { comercioId: { in: comercios } } });
      await owner.usuario.deleteMany({ where: { email: { endsWith: `@${DOMINIO}` } } });
      await owner.usuario.deleteMany({ where: { comercioId: { in: comercios } } });
      await owner.comercio.deleteMany({ where: { id: { in: comercios } } });
    });
    await app.close();
  };

  return { app, prisma, http: () => request(app.getHttpServer()), limpiar };
}

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Ejecuta `fn` con la conexión de la propietaria de la base (DIRECT_URL; en CI, el superusuario):
 * sin RLS y con todos los privilegios. Sólo para preparar y limpiar datos de prueba.
 */
export async function comoPropietaria<T>(fn: (owner: PrismaClient) => Promise<T>): Promise<T> {
  const url = process.env['DIRECT_URL']?.trim() || process.env['DATABASE_URL']?.trim() || '';
  const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    return await fn(owner);
  } finally {
    await owner.$disconnect();
  }
}

/**
 * Serializa las pruebas de carga entre suites (Jest las corre en paralelo): un advisory lock
 * global mientras dura `fn`, así dos cargas de 50.000 movimientos no compiten por el mismo
 * Postgres de CI y la medición de RNF-04 es fiel.
 */
export async function conCargaExclusiva<T>(fn: () => Promise<T>): Promise<T> {
  return comoPropietaria((owner) =>
    owner.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
        return fn();
      },
      { maxWait: 600_000, timeout: 600_000 },
    ),
  );
}
