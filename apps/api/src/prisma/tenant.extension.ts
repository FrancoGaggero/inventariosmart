import { TenantContext } from '../auth/tenant-context';
import type { PrismaClient } from '../generated/prisma/client';

/**
 * Modelos con columna `comercio_id`. Toda tabla de negocio nueva se agrega acá
 * (y lleva su política RLS: ver docs/runbooks/rls.md).
 */
export const TENANT_MODELS = new Set<string>(['Usuario']);

/** Operaciones que aceptan `where`. */
const CON_WHERE = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
  'upsert',
]);

const PROHIBIDAS_EN_COMERCIO = new Set(['create', 'createMany', 'delete', 'deleteMany', 'upsert']);

type Args = Record<string, unknown>;

function conWhere(args: Args, campo: string, valor: string): void {
  args['where'] = { ...((args['where'] as Args | undefined) ?? {}), [campo]: valor };
}

function conData(args: Args, campo: string, valor: string): void {
  const data = args['data'];
  if (Array.isArray(data)) {
    args['data'] = data.map((d: Args) => ({ ...d, [campo]: valor }));
  } else {
    args['data'] = { ...((data as Args | undefined) ?? {}), [campo]: valor };
  }
}

/**
 * Inyecta el comercio en los argumentos de una operación Prisma (función pura, testeable):
 * - modelos de negocio: `comercioId` en `where`, `data` y `create`;
 * - `Comercio`: sólo su propia fila (`where.id`); no se crea ni se borra desde el tenant.
 */
export function prepararArgs(
  model: string,
  operation: string,
  args: unknown,
  comercioId: string,
): Args {
  const a = { ...((args as Args | undefined) ?? {}) };

  if (TENANT_MODELS.has(model)) {
    if (CON_WHERE.has(operation)) conWhere(a, 'comercioId', comercioId);
    if (operation === 'create' || operation === 'createMany') conData(a, 'comercioId', comercioId);
    if (operation === 'upsert') {
      a['create'] = { ...((a['create'] as Args | undefined) ?? {}), comercioId };
    }
  } else if (model === 'Comercio') {
    if (PROHIBIDAS_EN_COMERCIO.has(operation)) {
      throw new Error(`Operación ${operation} no permitida sobre Comercio desde el tenant.`);
    }
    if (CON_WHERE.has(operation)) conWhere(a, 'id', comercioId);
  }
  return a;
}

/**
 * Cliente Prisma "de tenant": toda operación sobre un modelo de negocio
 * (1) recibe `comercio_id` del contexto del request (ver `prepararArgs`) y
 * (2) corre en una transacción que fija `app.comercio_id` para que RLS la respalde.
 */
export function crearClienteTenant(base: PrismaClient) {
  return base.$extends({
    name: 'tenant',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const { comercioId } = TenantContext.requerido();
          const preparados = prepararArgs(model, operation, args, comercioId);
          const [, resultado] = await base.$transaction([
            base.$executeRaw`SELECT set_config('app.comercio_id', ${comercioId}, true)`,
            query(preparados as typeof args),
          ]);
          return resultado;
        },
      },
    },
  });
}

export type ClienteTenant = ReturnType<typeof crearClienteTenant>;
