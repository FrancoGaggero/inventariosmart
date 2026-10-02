import { planCumple, type Plan, type Rol } from '@inventariosmart/shared';
import { RUTA_PLAN } from './plan-formato';
import { RUTA_QUIEBRES } from './quiebres-formato';
import { RUTA_STOCK_PARADO } from './stock-parado-formato';

// Navegación de la app como datos (web-redesign, design D3): qué ve cada rol en cada plan.
// Puro, sin React ni sesión, para probarlo como en CI.

/** Clave del ícono; la vista la traduce a lucide-react. */
export type IconoNav =
  | 'inicio'
  | 'movimientos'
  | 'inventario'
  | 'rentabilidad'
  | 'gastos'
  | 'alertas'
  | 'quiebres'
  | 'stockParado'
  | 'inflacion'
  | 'reportes'
  | 'ordenes'
  | 'proveedores'
  | 'remarcaciones'
  | 'asistente'
  | 'usuarios'
  | 'comercio'
  | 'plan';

export interface ItemNav {
  to: string;
  etiqueta: string;
  icono: IconoNav;
  /** Sólo activo en la ruta exacta (Inicio). */
  fin?: boolean;
  /** Lleva el conteo de alertas activas. */
  alerta?: boolean;
}

export interface SeccionNav {
  clave: 'general' | 'analisis' | 'compras' | 'asistente' | 'cuenta';
  titulo: string;
  items: ItemNav[];
}

const ITEM = {
  inicio: { to: '/', etiqueta: 'Inicio', icono: 'inicio', fin: true },
  movimientos: { to: '/movimientos', etiqueta: 'Movimientos', icono: 'movimientos' },
  inventario: { to: '/productos', etiqueta: 'Inventario', icono: 'inventario' },
  rentabilidad: { to: '/rentabilidad', etiqueta: 'Rentabilidad', icono: 'rentabilidad' },
  gastos: { to: '/gastos', etiqueta: 'Gastos', icono: 'gastos' },
  alertas: { to: '/alertas', etiqueta: 'Alertas', icono: 'alertas', alerta: true },
  quiebres: { to: RUTA_QUIEBRES, etiqueta: 'Falta de stock', icono: 'quiebres' },
  stockParado: { to: RUTA_STOCK_PARADO, etiqueta: 'Stock parado', icono: 'stockParado' },
  inflacion: { to: '/inflacion', etiqueta: 'Inflación', icono: 'inflacion' },
  reportes: { to: '/reportes', etiqueta: 'Reportes', icono: 'reportes' },
  ordenes: { to: '/ordenes', etiqueta: 'Órdenes', icono: 'ordenes' },
  proveedores: { to: '/proveedores', etiqueta: 'Proveedores', icono: 'proveedores' },
  remarcaciones: { to: '/remarcaciones', etiqueta: 'Remarcaciones', icono: 'remarcaciones' },
  asistente: { to: '/asistente', etiqueta: 'Asistente', icono: 'asistente' },
  usuarios: { to: '/configuracion/usuarios', etiqueta: 'Usuarios', icono: 'usuarios' },
  comercio: { to: '/configuracion/comercio', etiqueta: 'Comercio', icono: 'comercio' },
  plan: { to: RUTA_PLAN, etiqueta: 'Plan', icono: 'plan' },
} as const satisfies Record<IconoNav, ItemNav>;

/** Secciones de la barra lateral; las vacías no se devuelven (D3). */
export function seccionesDeNavegacion({ rol, plan }: { rol: Rol; plan: Plan }): SeccionNav[] {
  const duenio = rol === 'DUENIO';
  const inventario = rol === 'DUENIO' || rol === 'EMPLEADO';
  const analisis = rol === 'DUENIO' || rol === 'CONTADOR';
  const pro = analisis && planCumple(plan, 'PRO');
  const si = <T>(condicion: boolean, item: T): T[] => (condicion ? [item] : []);

  const secciones: SeccionNav[] = [
    {
      clave: 'general',
      titulo: 'General',
      items: [ITEM.inicio, ITEM.movimientos, ...si(inventario, ITEM.inventario)],
    },
    {
      clave: 'analisis',
      titulo: 'Análisis',
      items: [
        ...si(analisis, ITEM.rentabilidad),
        ...si(analisis, ITEM.gastos),
        ...si(analisis, ITEM.alertas),
        ...si(pro, ITEM.quiebres),
        ...si(pro, ITEM.stockParado),
        ...si(pro, ITEM.inflacion),
        ...si(pro, ITEM.reportes),
      ],
    },
    {
      clave: 'compras',
      titulo: 'Compras',
      items: [
        ...si(pro, ITEM.ordenes),
        ...si(duenio, ITEM.proveedores),
        ...si(pro, ITEM.remarcaciones),
      ],
    },
    { clave: 'asistente', titulo: 'Asistente', items: si(duenio, ITEM.asistente) },
    {
      clave: 'cuenta',
      titulo: 'Cuenta',
      items: [...si(duenio, ITEM.usuarios), ...si(duenio, ITEM.comercio), ITEM.plan],
    },
  ];
  return secciones.filter((s) => s.items.length > 0);
}

/** Los cuatro destinos de la barra inferior en el celular; "Más" lo agrega la vista (D3). */
export function accesosInferiores({ rol }: { rol: Rol; plan: Plan }): ItemNav[] {
  switch (rol) {
    case 'DUENIO':
      return [ITEM.inicio, ITEM.movimientos, ITEM.inventario, ITEM.alertas];
    case 'CONTADOR':
      return [ITEM.inicio, ITEM.rentabilidad, ITEM.alertas, ITEM.gastos];
    default:
      return [ITEM.inicio, ITEM.inventario, ITEM.movimientos, ITEM.plan];
  }
}

/** Nombre accesible del ítem: con el conteo de alertas cuando corresponde. */
export function nombreAccesible(item: ItemNav, alertas: number): string {
  if (!item.alerta || alertas <= 0) return item.etiqueta;
  return `${item.etiqueta}, ${alertas} ${alertas === 1 ? 'activa' : 'activas'}`;
}
