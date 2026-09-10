import { randomBytes } from 'node:crypto';
import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TokenVerifier } from '../src/auth/firebase.service';
import type { Identidad } from '../src/auth/provisioning.service';
import { configurarApp } from '../src/bootstrap';
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

  const limpiar = async () => {
    await prisma.comoSistema(async (tx) => {
      const usuarios = await tx.usuario.findMany({
        where: { email: { endsWith: `@${DOMINIO}` } },
        select: { comercioId: true },
      });
      const comercios = [...new Set(usuarios.map((u) => u.comercioId))];
      await tx.usuario.deleteMany({ where: { email: { endsWith: `@${DOMINIO}` } } });
      await tx.usuario.deleteMany({ where: { comercioId: { in: comercios } } });
      await tx.comercio.deleteMany({ where: { id: { in: comercios } } });
    });
    await app.close();
  };

  return { app, prisma, http: () => request(app.getHttpServer()), limpiar };
}

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
