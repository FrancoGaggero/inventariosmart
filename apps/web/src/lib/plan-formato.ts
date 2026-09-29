import {
  LIMITES_PLAN,
  NOMBRE_PLAN,
  PLANES,
  diferenciaDePlanes,
  funcionalidadesPropias,
  planCumple,
  type Plan,
  type RecursoPlan,
  type RegistroCambioPlan,
} from '@inventariosmart/shared';

// Textos de la gestión de plan (HU-14): funciones puras, sin red ni sesión. La portada y la
// página "Plan" arman sus tarjetas con `tarjetasDePlanes`, así muestran siempre lo mismo.

export const RUTA_PLAN = '/configuracion/plan';

export const AVISO_SIN_COBRO =
  'El cambio es inmediato y no tiene cobro: este proyecto no integra un medio de pago.';

const entero = new Intl.NumberFormat('es-AR');

const DETALLE_PLAN: Record<Plan, string> = {
  FREE: 'Para empezar',
  PRO: 'Para el día a día',
  PREMIUM: 'Para decidir mejor',
};

export interface TarjetaPlan {
  plan: Plan;
  nombre: string;
  detalle: string;
  /** Lo que incluye, en renglones. */
  incluye: string[];
}

function limitesEnRenglones(plan: Plan): string[] {
  const { productos, usuarios } = LIMITES_PLAN[plan];
  if (productos === null && usuarios === null) return ['Productos y usuarios sin límite'];
  return [
    productos === null ? 'Productos sin límite' : `Hasta ${entero.format(productos)} productos`,
    usuarios === null
      ? 'Usuarios sin límite'
      : usuarios === 1
        ? '1 usuario'
        : `${usuarios} usuarios`,
  ];
}

/** Los tres planes con lo que suma cada uno sobre el anterior. */
export function tarjetasDePlanes(): TarjetaPlan[] {
  return PLANES.map((plan, i) => {
    const anterior = i > 0 ? PLANES[i - 1] : undefined;
    const cambianLosLimites =
      anterior === undefined ||
      JSON.stringify(LIMITES_PLAN[anterior]) !== JSON.stringify(LIMITES_PLAN[plan]);
    return {
      plan,
      nombre: NOMBRE_PLAN[plan],
      detalle: DETALLE_PLAN[plan],
      incluye: [
        ...(anterior ? [`Todo lo de ${NOMBRE_PLAN[anterior]}`] : []),
        ...(cambianLosLimites ? limitesEnRenglones(plan) : []),
        ...funcionalidadesPropias(plan).map((f) => f.nombre),
      ],
    };
  });
}

const RECURSO: Record<RecursoPlan, [string, string]> = {
  productos: ['producto activo', 'productos activos'],
  usuarios: ['usuario activo', 'usuarios activos'],
};

/** "50 de 50 productos activos" o "12 productos activos, sin límite". */
export function fraseUso(recurso: RecursoPlan, cantidad: number, limite: number | null): string {
  const [uno, varios] = RECURSO[recurso];
  if (limite === null) {
    return `${entero.format(cantidad)} ${cantidad === 1 ? uno : varios}, sin límite`;
  }
  return `${entero.format(cantidad)} de ${entero.format(limite)} ${limite === 1 ? uno : varios}`;
}

export const esSubida = (actual: Plan, nuevo: Plan) =>
  actual !== nuevo && planCumple(nuevo, actual);

/** Texto del botón de cada plan, visto desde el plan vigente. */
export function textoBoton(actual: Plan, plan: Plan): string {
  if (actual === plan) return 'Tu plan actual';
  return `${esSubida(actual, plan) ? 'Subir' : 'Bajar'} a ${NOMBRE_PLAN[plan]}`;
}

const enumerar = (nombres: string[]): string => {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
};

export interface ConfirmacionCambio {
  titulo: string;
  textoConfirmar: string;
  /** true al bajar: el botón se muestra como acción delicada. */
  baja: boolean;
  parrafos: string[];
}

/** Qué se le dice al dueño antes de cambiar de plan (CP-14.6). */
export function confirmacionDeCambio(actual: Plan, nuevo: Plan): ConfirmacionCambio {
  const { seHabilitan, dejanDeEstar } = diferenciaDePlanes(actual, nuevo);
  const baja = !esSubida(actual, nuevo);
  const parrafos: string[] = [];
  if (seHabilitan.length > 0) {
    parrafos.push(`Se habilita: ${enumerar(seHabilitan.map((f) => f.nombre))}.`);
  }
  if (dejanDeEstar.length > 0) {
    parrafos.push(
      `Deja de estar disponible: ${enumerar(dejanDeEstar.map((f) => f.nombre))}.`,
      'No se borra nada: tus datos quedan guardados y vuelven cuando subas de plan.',
    );
  }
  const limites = LIMITES_PLAN[nuevo];
  if (baja && limites.productos !== null && limites.usuarios !== null) {
    parrafos.push(
      `El plan ${NOMBRE_PLAN[nuevo]} admite hasta ${entero.format(limites.productos)} productos activos y ${limites.usuarios === 1 ? '1 usuario' : `${limites.usuarios} usuarios`}.`,
    );
  }
  parrafos.push(AVISO_SIN_COBRO);
  return {
    titulo: `¿Pasar al plan ${NOMBRE_PLAN[nuevo]}?`,
    textoConfirmar: textoBoton(actual, nuevo),
    baja,
    parrafos,
  };
}

/** "De Free a Pro" */
export function fraseCambio(c: Pick<RegistroCambioPlan, 'planAnterior' | 'planNuevo'>): string {
  return `De ${NOMBRE_PLAN[c.planAnterior]} a ${NOMBRE_PLAN[c.planNuevo]}`;
}

/** Aviso tras cambiar de plan. */
export function fraseCambioHecho(nuevo: Plan): string {
  return `Listo: tu comercio está en el plan ${NOMBRE_PLAN[nuevo]}.`;
}
