import { LIMITES_PLAN } from '@inventariosmart/shared';
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  FileSpreadsheet,
  LogIn,
  type LucideIcon,
  Package,
  ShoppingCart,
  Smartphone,
  Sparkles,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { Link } from 'react-router';
import { Entrada } from '@/ui/Entrada';
import { GraficaBarras } from '@/ui/GraficaBarras';

interface Servicio {
  Icono: LucideIcon;
  tono: string;
  titulo: string;
  texto: string;
}

const SERVICIOS: Servicio[] = [
  {
    Icono: Package,
    tono: 'bg-brand/15 text-brand-3',
    titulo: 'Inventario y movimientos',
    texto:
      'Catálogo con precios, costos y stock. Cada venta, ingreso o ajuste queda en un historial que no se borra.',
  },
  {
    Icono: TrendingUp,
    tono: 'bg-ok/15 text-ok',
    titulo: 'Rentabilidad real',
    texto:
      'Margen bruto y neto por producto, netos de IVA y con tus gastos prorrateados. Sabés qué te deja plata.',
  },
  {
    Icono: BellRing,
    tono: 'bg-warn/15 text-warn',
    titulo: 'Alertas predictivas',
    texto:
      'Con tu velocidad de venta y el plazo de cada proveedor, te avisa antes de que un producto se agote.',
  },
  {
    Icono: ShoppingCart,
    tono: 'bg-violet/15 text-violet',
    titulo: 'Órdenes en modo copiloto',
    texto:
      'El sistema arma el pedido al proveedor más conveniente y redacta el correo. Vos revisás y confirmás con un clic.',
  },
  {
    Icono: Truck,
    tono: 'bg-brand/15 text-brand-3',
    titulo: 'Proveedores y listas de precios',
    texto:
      'Importá las listas que te mandan y los costos se actualizan solos; el historial queda guardado.',
  },
  {
    Icono: Smartphone,
    tono: 'bg-ok/15 text-ok',
    titulo: 'App para el mostrador',
    texto:
      'Registrá la venta desde el celular con Android; el panel y las alertas se actualizan al instante.',
  },
];

const PASOS = [
  {
    Icono: FileSpreadsheet,
    titulo: 'Importá tu planilla',
    texto: 'Subí el Excel que ya usás: productos, precios y stock quedan cargados en minutos.',
  },
  {
    Icono: Smartphone,
    titulo: 'Registrá lo que vendés',
    texto: 'Desde la web o el celular. Sin tickets ni cuadernos: el stock baja solo.',
  },
  {
    Icono: BarChart3,
    titulo: 'Mirá tus números',
    texto: 'Panel del mes, productos más rentables, qué reponer y a quién comprarle.',
  },
];

const PLANES = [
  {
    nombre: 'Free',
    precio: 'Gratis',
    detalle: 'Para empezar',
    incluye: [
      `Hasta ${LIMITES_PLAN.FREE.productos} productos`,
      `${LIMITES_PLAN.FREE.usuarios} usuario`,
      'Inventario, movimientos y panel',
      'Importación desde Excel',
    ],
    destacado: false,
  },
  {
    nombre: 'Pro',
    precio: 'Mensual',
    detalle: 'Para el día a día',
    incluye: [
      'Productos y usuarios sin límite',
      'Alertas predictivas de reposición',
      'Órdenes de compra en modo copiloto',
      'Reportes semanales',
    ],
    destacado: true,
  },
  {
    nombre: 'Premium',
    precio: 'Mensual',
    detalle: 'Para decidir mejor',
    incluye: [
      'Todo lo de Pro',
      'Asistente con IA sobre tus datos',
      'Comparador de proveedores',
      'Soporte prioritario',
    ],
    destacado: false,
  },
];

/** Portada pública en `/` para visitantes sin sesión (design D8). */
export function LandingPage() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg-2/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-extrabold">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-violet grid place-items-center shadow-[0_6px_16px_-8px_var(--color-glow)]">
              <BarChart3 className="w-4 h-4 text-on-brand" aria-hidden />
            </span>
            InventarioSmart
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4 text-sm" aria-label="Secciones">
            <a
              href="#servicios"
              className="px-3 py-2 rounded-lg text-t2 hover:text-t1 hover:bg-fill"
            >
              Servicios
            </a>
            <a href="#como" className="px-3 py-2 rounded-lg text-t2 hover:text-t1 hover:bg-fill">
              Cómo funciona
            </a>
            <a href="#planes" className="px-3 py-2 rounded-lg text-t2 hover:text-t1 hover:bg-fill">
              Planes
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="btn btn-ghost !py-2 !px-3">
              <LogIn className="w-4 h-4" aria-hidden />
              Ingresar
            </Link>
            <Link to="/registro" className="btn btn-primary !py-2 !px-3 hidden sm:inline-flex">
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 md:px-6 pt-14 pb-10 grid gap-10 lg:grid-cols-2 lg:items-center">
          <Entrada className="space-y-6">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-3">
              <Sparkles className="w-4 h-4" aria-hidden />
              Para PyMEs argentinas
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
              Tu stock y tus <span className="text-brand-3">números reales</span>, en un solo lugar.
            </h1>
            <p className="text-t2 text-lg max-w-xl">
              Inventario, rentabilidad y reposición inteligente para el comercio que hoy lleva todo
              en una planilla. Sabé qué te deja plata y qué se te va a acabar, antes de que pase.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/registro" className="btn btn-primary">
                Crear cuenta gratis
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link to="/login" className="btn btn-ghost">
                <LogIn className="w-4 h-4" aria-hidden />
                Ya tengo cuenta
              </Link>
            </div>
            <p className="text-xs text-t3">
              Sin tarjeta. El plan Free incluye hasta {LIMITES_PLAN.FREE.productos} productos.
            </p>
          </Entrada>
          <Entrada
            indice={2}
            className="rounded-2xl border border-white/15 p-6 sm:p-8 bg-gradient-to-br from-brand via-brand-2 to-violet text-white shadow-[0_30px_60px_-30px_var(--color-glow)] overflow-hidden"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              Septiembre · panel del mes
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/15 p-3">
                <div className="text-white/80 text-xs">Ventas netas</div>
                <div className="text-xl font-extrabold tabular-nums">$ 1.451.652</div>
              </div>
              <div className="rounded-xl bg-white/15 p-3">
                <div className="text-white/80 text-xs">Margen bruto</div>
                <div className="text-xl font-extrabold tabular-nums">38,4 %</div>
              </div>
            </div>
            <div className="mt-6">
              <GraficaBarras className="max-w-none" />
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <BellRing className="w-4 h-4 shrink-0" aria-hidden />
                Filtro FA-220: quedan 9 días de stock · pedir 56
              </li>
              <li className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 shrink-0" aria-hidden />
                Orden OC-0007 lista para confirmar · Distribuidora Sur
              </li>
            </ul>
          </Entrada>
        </section>

        <section id="servicios" className="max-w-6xl mx-auto px-4 md:px-6 py-12 space-y-6">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Qué hace por tu comercio</h2>
            <p className="text-t2 text-sm mt-1 max-w-2xl">
              Seis piezas que trabajan juntas: lo que cargás en una, lo aprovechan las demás.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICIOS.map((s, i) => (
              <Entrada as="article" indice={i} key={s.titulo} className="card card-hover p-5">
                <span
                  className={`w-10 h-10 rounded-xl grid place-items-center ${s.tono}`}
                  aria-hidden
                >
                  <s.Icono className="w-5 h-5" />
                </span>
                <h3 className="font-bold mt-3">{s.titulo}</h3>
                <p className="text-sm text-t2 mt-1">{s.texto}</p>
              </Entrada>
            ))}
          </div>
        </section>

        <section id="como" className="max-w-6xl mx-auto px-4 md:px-6 py-12 space-y-6">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Cómo funciona</h2>
            <p className="text-t2 text-sm mt-1">Tres pasos y el primer día ya tenés el panel.</p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {PASOS.map((p, i) => (
              <Entrada as="li" indice={i} key={p.titulo} className="card p-5 flex gap-4">
                <span className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-violet text-white grid place-items-center font-extrabold shrink-0">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-bold flex items-center gap-2">
                    <p.Icono className="w-4 h-4 text-brand-3" aria-hidden />
                    {p.titulo}
                  </h3>
                  <p className="text-sm text-t2 mt-1">{p.texto}</p>
                </div>
              </Entrada>
            ))}
          </ol>
        </section>

        <section id="planes" className="max-w-6xl mx-auto px-4 md:px-6 py-12 space-y-6">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Planes</h2>
            <p className="text-t2 text-sm mt-1">
              Empezá gratis y pasá a Pro cuando quieras alertas y órdenes.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {PLANES.map((p, i) => (
              <Entrada
                as="article"
                indice={i}
                key={p.nombre}
                className={`card card-hover p-5 flex flex-col ${
                  p.destacado ? 'ring-2 ring-brand/60' : ''
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-extrabold text-lg">{p.nombre}</h3>
                  <span className="text-xs font-semibold text-brand-3">{p.precio}</span>
                </div>
                <p className="text-sm text-t2">{p.detalle}</p>
                <ul className="mt-4 space-y-2 text-sm flex-1">
                  {p.incluye.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-ok shrink-0 mt-0.5" aria-hidden />
                      {x}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/registro"
                  className={`btn mt-5 ${p.destacado ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {p.nombre === 'Free' ? 'Crear cuenta' : 'Empezar con Free'}
                </Link>
              </Entrada>
            ))}
          </div>
          <p className="text-xs text-t3">
            Los planes Pro y Premium se activan por ahora desde el equipo de InventarioSmart; la
            gestión de planes en la app llega en una próxima etapa.
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-t3">
          <span>InventarioSmart · Trabajo final de Analista de Sistemas, Escuela Da Vinci.</span>
          <span className="flex gap-3">
            <Link to="/login" className="hover:text-t1">
              Ingresar
            </Link>
            <Link to="/registro" className="hover:text-t1">
              Crear cuenta
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
