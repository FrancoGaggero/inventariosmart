import { tarjetasDePlanes } from '@/lib/plan-formato';
import { LIMITES_PLAN, type Plan } from '@inventariosmart/shared';
import {
  ArrowRight,
  BellRing,
  Check,
  FileSpreadsheet,
  LogIn,
  type LucideIcon,
  MessageCircle,
  Package,
  ShoppingCart,
  Smartphone,
  Sparkles,
  TrendingUp,
  Truck,
} from 'lucide-react';
import {
  type MotionValue,
  m,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Animado } from '@/features/publico/Animado';
import { BotonMagnetico } from '@/features/publico/BotonMagnetico';
import { BarraDeProgreso } from '@/features/publico/BarraDeProgreso';
import { ComoFuncionaAnclado } from '@/features/publico/ComoFuncionaAnclado';
import { Contador } from '@/features/publico/Contador';
import { FondoAnimado } from '@/features/publico/FondoAnimado';
import { Escalonado, Item, Revelar } from '@/features/publico/Revelar';
import { TarjetaInclinable } from '@/features/publico/TarjetaInclinable';
import { TextoQueSeArma } from '@/features/publico/TextoQueSeArma';
import { useMedia } from '@/features/publico/useMedia';
import { GraficaBarras } from '@/ui/GraficaBarras';
import { Logo } from '@/ui/Logo';
import { Lienzo3D } from './3d/Lienzo3D';
import { FrenteAFrente } from './FrenteAFrente';
import { MarquesinaRubros } from './MarquesinaRubros';
import { NavSecciones } from './NavSecciones';
import { HechoParaArgentina } from './HechoParaArgentina';

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
    Icono: BellRing,
    titulo: 'Te avisa antes de que falte',
    texto:
      'Con tu velocidad de venta y el plazo del proveedor, la alerta llega antes del faltante.',
  },
  {
    Icono: MessageCircle,
    titulo: 'Mandá la orden por WhatsApp',
    texto: 'La orden sale redactada al proveedor más conveniente; vos la confirmás y la enviás.',
  },
];

/** Lo propio de la portada; qué incluye cada plan sale del catálogo compartido (HU-14). */
const PORTADA: Record<Plan, { precio: string; boton: string; destacado: boolean }> = {
  FREE: { precio: 'Gratis', boton: 'Crear cuenta gratis', destacado: false },
  PRO: { precio: 'Mensual', boton: 'Quiero el plan Pro', destacado: true },
  PREMIUM: { precio: 'Mensual', boton: 'Quiero Premium', destacado: false },
};

const PLANES = tarjetasDePlanes().map((t) => ({
  nombre: t.nombre,
  clave: t.plan,
  detalle: t.detalle,
  incluye: t.incluye,
  ...PORTADA[t.plan],
}));

const entero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const unDecimal = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Cabecera que se compacta al bajar (landing-motion D3). */
function Cabecera() {
  const { scrollY } = useScroll();
  const [compacta, setCompacta] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setCompacta(y > 24));
  return (
    <header
      className={`sticky top-0 z-20 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
        compacta
          ? 'border-line bg-bg-2/90 backdrop-blur-md shadow-1'
          : 'border-transparent bg-bg-2/50 backdrop-blur'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
        <Link to="/" className="rounded-lg">
          <Logo />
        </Link>
        <NavSecciones />
        <div className="ml-auto flex items-center gap-2">
          <Link to="/login" className="btn btn-ghost !py-2 !px-3">
            <LogIn className="w-4 h-4" aria-hidden />
            Ingresar
          </Link>
          <BotonMagnetico max={4} className="hidden sm:inline-flex">
            <Link to="/registro" className="btn btn-primary !py-2 !px-3">
              Crear cuenta
            </Link>
          </BotonMagnetico>
        </div>
      </div>
    </header>
  );
}

/** Tarjeta del panel del hero: se inclina con el mouse y sube con el scroll (D3). */
function PanelDelHero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -60]);
  const rotate = useTransform(scrollYProgress, [0, 1], [1.5, -2]);
  return (
    <m.div
      ref={ref}
      style={{ y, rotate }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1], delay: 0.35 }}
    >
      <TarjetaInclinable max={7} redondeo="rounded-3xl">
        <div className="card card-inversa !rounded-3xl p-6 sm:p-8 shadow-3 overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-acento-inverso">
            Septiembre · panel del mes
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-brand text-on-brand p-3">
              <div className="opacity-75 text-xs">Ventas netas</div>
              <div className="text-lg sm:text-xl font-extrabold whitespace-nowrap">
                <Contador valor={1451652} formato={(n) => `$ ${entero.format(n)}`} />
              </div>
            </div>
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-on-inverso)_18%,transparent)] p-3">
              <div className="opacity-70 text-xs">Margen bruto</div>
              <div className="text-lg sm:text-xl font-extrabold whitespace-nowrap">
                <Contador valor={38.4} formato={(n) => `${unDecimal.format(n)} %`} />
              </div>
            </div>
          </div>
          <div className="mt-6">
            <GraficaBarras className="max-w-none text-acento-inverso" />
          </div>
          <Escalonado
            como="ul"
            inicio={1.1}
            paso={0.18}
            alMontar
            className="mt-4 space-y-2 text-sm"
          >
            <Item como="li" desde="derecha" className="flex items-center gap-2">
              <BellRing className="w-4 h-4 shrink-0" aria-hidden />
              Filtro FA-220: quedan 9 días de stock · pedir 56
            </Item>
            <Item como="li" desde="derecha" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 shrink-0" aria-hidden />
              Orden OC-0007 lista para confirmar · Distribuidora Sur
            </Item>
          </Escalonado>
        </div>
      </TarjetaInclinable>
    </m.div>
  );
}

function Encabezado({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Revelar>
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{titulo}</h2>
      <p className="text-t2 text-sm mt-1 max-w-2xl">{texto}</p>
    </Revelar>
  );
}

/**
 * Columna del panel del hero con el "depósito vivo" detrás (landing-3d D3): las cajas pasan de las
 * estanterías al gráfico del panel y a la curva de margen a medida que se baja.
 */
function VisualDelHero({
  avance,
  referencia,
}: {
  avance: MotionValue<number>;
  referencia: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={referencia} className="relative pt-40 sm:pt-48 lg:pt-32">
      <Lienzo3D
        escena="deposito"
        prioridad="idle"
        progreso={avance}
        imagen={{ ancho: 640, alto: 520 }}
        className="absolute -inset-x-4 -top-6 bottom-1/3 lg:-inset-x-10 lg:-top-20 lg:bottom-1/3"
      />
      <div className="relative z-10 lg:w-[88%]">
        <PanelDelHero />
      </div>
    </div>
  );
}

/** Portada pública en `/` para visitantes sin sesión (design D8), animada (landing-motion D3). */
export function LandingPage() {
  // Desde 1024 px el hero queda anclado mientras el depósito se transforma; en pantallas angostas
  // o con "reducir movimiento", la escena avanza mientras cruza la pantalla.
  const ancho = useMedia('(min-width: 1024px)');
  const reducido = useReducedMotion();
  const anclado = ancho && !reducido;
  const tramoAnclado = useRef<HTMLDivElement>(null);
  const visual = useRef<HTMLDivElement>(null);
  const { scrollYProgress: avanceAnclado } = useScroll({
    target: tramoAnclado,
    offset: ['start start', 'end end'],
  });
  const { scrollYProgress: avanceSuelto } = useScroll({
    target: visual,
    offset: ['start 90%', 'start 5%'],
  });
  return (
    <Animado>
      <div className="min-h-full flex flex-col">
        <FondoAnimado />
        <Cabecera />
        <BarraDeProgreso />

        <main className="flex-1">
          <div ref={tramoAnclado} className={anclado ? 'h-[175vh]' : undefined}>
            <section
              className={`max-w-6xl mx-auto px-4 md:px-6 grid gap-10 lg:grid-cols-2 lg:items-center ${
                anclado ? 'sticky top-14 min-h-[calc(100vh-3.5rem)] py-8' : 'pt-14 pb-10'
              }`}
            >
              <div className="space-y-6">
                <Revelar>
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-3">
                    <Sparkles className="w-4 h-4" aria-hidden />
                    Para PyMEs argentinas
                  </p>
                </Revelar>
                <TextoQueSeArma
                  subrayado={1}
                  className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]"
                  partes={[
                    { texto: 'Tu stock y tus' },
                    { texto: 'números reales', className: 'acento-serif text-[1.1em]' },
                    { texto: ', en un solo lugar.' },
                  ]}
                />
                <Escalonado alMontar inicio={0.55} paso={0.12} className="space-y-6">
                  <Item>
                    <p className="text-t2 text-lg max-w-xl">
                      Inventario, rentabilidad y reposición inteligente para el comercio que hoy
                      lleva todo en una planilla. Sabé qué te deja plata y qué se te va a acabar,
                      antes de que pase.
                    </p>
                  </Item>
                  <Item className="flex flex-wrap gap-3">
                    <BotonMagnetico>
                      <Link to="/registro" className="btn btn-primary btn-brillo">
                        Crear cuenta gratis
                        <ArrowRight className="w-4 h-4" aria-hidden />
                      </Link>
                    </BotonMagnetico>
                    <Link to="/login" className="btn btn-ghost">
                      <LogIn className="w-4 h-4" aria-hidden />
                      Ya tengo cuenta
                    </Link>
                  </Item>
                  <Item>
                    <p className="text-xs text-t3">
                      Sin tarjeta. El plan Free incluye hasta {LIMITES_PLAN.FREE.productos}{' '}
                      productos.
                    </p>
                  </Item>
                </Escalonado>
              </div>
              <VisualDelHero avance={anclado ? avanceAnclado : avanceSuelto} referencia={visual} />
            </section>
          </div>

          <MarquesinaRubros />

          <FrenteAFrente />

          <section
            id="servicios"
            className="max-w-6xl mx-auto px-4 md:px-6 py-12 space-y-6 scroll-mt-14"
          >
            <Encabezado
              titulo="Qué hace por tu comercio"
              texto="Seis piezas que trabajan juntas: lo que cargás en una, lo aprovechan las demás."
            />
            <Escalonado className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICIOS.map((s) => (
                <Item como="article" key={s.titulo}>
                  <TarjetaInclinable className="h-full">
                    <div className="card p-5 h-full">
                      <span
                        className={`w-10 h-10 rounded-xl grid place-items-center transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${s.tono}`}
                        aria-hidden
                      >
                        <s.Icono className="w-5 h-5" />
                      </span>
                      <h3 className="font-bold mt-3">{s.titulo}</h3>
                      <p className="text-sm text-t2 mt-1">{s.texto}</p>
                    </div>
                  </TarjetaInclinable>
                </Item>
              ))}
            </Escalonado>
          </section>

          <section id="como" className="max-w-6xl mx-auto px-4 md:px-6 py-12 scroll-mt-14">
            <ComoFuncionaAnclado
              pasos={PASOS}
              titulo="Cómo funciona"
              subtitulo="Cuatro pasos y el primer día ya tenés el panel."
              visual={(avance) => (
                <Lienzo3D
                  escena="como"
                  prioridad="cercania"
                  progreso={avance}
                  imagen={{ ancho: 640, alto: 480 }}
                  className="absolute inset-0 w-full h-full"
                />
              )}
            />
          </section>

          <HechoParaArgentina />

          <section
            id="planes"
            className="max-w-6xl mx-auto px-4 md:px-6 py-12 space-y-6 scroll-mt-14"
          >
            <Encabezado
              titulo="Planes"
              texto="Empezá gratis y pasá a Pro cuando quieras alertas y órdenes."
            />
            <Escalonado className="grid gap-4 md:grid-cols-3">
              {PLANES.map((p) => (
                <Item como="article" key={p.nombre}>
                  <TarjetaInclinable max={5} elevacion={p.destacado ? 10 : 6} className="h-full">
                    <div
                      className={`card p-5 flex flex-col h-full ${p.destacado ? 'borde-giratorio' : ''}`}
                    >
                      {p.destacado && (
                        <span className="etiqueta etiqueta-acento self-start mb-2">
                          Recomendado
                        </span>
                      )}
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
                      <BotonMagnetico max={p.destacado ? 6 : 0} className="mt-5 flex flex-col">
                        <Link
                          to={`/registro?plan=${p.clave}`}
                          className={`btn ${p.destacado ? 'btn-primary btn-brillo' : 'btn-ghost'}`}
                        >
                          {p.boton}
                        </Link>
                      </BotonMagnetico>
                    </div>
                  </TarjetaInclinable>
                </Item>
              ))}
            </Escalonado>
            <Revelar>
              <p className="text-xs text-t3">
                Toda cuenta empieza en Free. Después cambiás de plan cuando quieras desde la app, en
                Plan.
              </p>
            </Revelar>
          </section>
        </main>

        <footer className="border-t border-line">
          <Revelar className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-t3">
            <span>InventarioSmart · Trabajo final de Analista de Sistemas, Escuela Da Vinci.</span>
            <span className="flex gap-3">
              <Link to="/login" className="hover:text-t1">
                Ingresar
              </Link>
              <Link to="/registro" className="hover:text-t1">
                Crear cuenta
              </Link>
            </span>
          </Revelar>
        </footer>
      </div>
    </Animado>
  );
}
