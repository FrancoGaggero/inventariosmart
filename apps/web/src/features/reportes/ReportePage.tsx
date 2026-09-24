import {
  type ContenidoReporte,
  ETIQUETA_MOTIVO_NO_ENVIO_REPORTE,
  ETIQUETA_MOTIVO_RESUMEN,
  UMBRAL_MARGEN_BAJO_PCT,
  planCumple,
} from '@inventariosmart/shared';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  type LucideIcon,
  Mail,
  Percent,
  PiggyBank,
  Send,
  ShoppingBag,
  Star,
  TrendingDown,
  TrendingUp,
  Truck,
  Warehouse,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatearCalculo } from '@/lib/alertas';
import { mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import { formatearPesos } from '@/lib/productos';
import { formatearSemana, useReenviarReporte, useReporte } from '@/lib/reportes';
import { claseSigno, formatearPct } from '@/lib/rentabilidad';
import { Anillo } from '@/ui/Anillo';
import { Aviso } from '@/ui/Aviso';
import { Barra } from '@/ui/Barra';
import { Entrada } from '@/ui/Entrada';
import { Skeleton } from '@/ui/Skeleton';
import { useContador } from '@/ui/useContador';

function MontoAnimado({ valor, className = '' }: { valor: string | null; className?: string }) {
  const animado = useContador(valor === null ? null : Number(valor));
  return (
    <span
      className={`tabular-nums ${className}`}
      aria-label={valor === null ? 'No calculable' : formatearPesos(valor)}
      aria-live="off"
    >
      {animado === null ? '—' : formatearPesos(animado.toFixed(2))}
    </span>
  );
}

const TONO = {
  brand: 'bg-brand/15 text-brand-3',
  ok: 'bg-ok/15 text-ok',
  violet: 'bg-violet/15 text-violet',
  warn: 'bg-warn/15 text-warn',
} as const;

function Kpi({
  indice,
  titulo,
  Icono,
  tono,
  valor,
  claseValor = '',
  detalle,
  extra,
}: {
  indice: number;
  titulo: string;
  Icono: LucideIcon;
  tono: keyof typeof TONO;
  valor: string | null;
  claseValor?: string;
  detalle: string;
  extra?: React.ReactNode;
}) {
  return (
    <Entrada indice={indice} className="card card-hover p-4 flex gap-3 min-w-0 overflow-hidden">
      <span
        className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${TONO[tono]}`}
        aria-hidden
      >
        <Icono className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-t2 text-xs font-semibold uppercase tracking-wider">{titulo}</dt>
        <dd
          className={`text-lg sm:text-xl font-extrabold leading-tight mt-0.5 whitespace-nowrap ${claseValor}`}
        >
          <MontoAnimado valor={valor} />
        </dd>
        <dd className="text-xs text-t3 mt-1 truncate">{detalle}</dd>
      </div>
      {extra}
    </Entrada>
  );
}

function Oportunidad({
  indice,
  titulo,
  Icono,
  total,
  vacio,
  children,
}: {
  indice: number;
  titulo: string;
  Icono: LucideIcon;
  total: string;
  vacio: string;
  children: React.ReactNode[];
}) {
  return (
    <Entrada as="article" indice={indice} className="card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold flex items-center gap-2">
          <Icono className="w-4 h-4 text-brand-3" aria-hidden />
          {titulo}
        </h3>
        <span className="text-sm font-semibold tabular-nums">{formatearPesos(total)}</span>
      </div>
      {children.length === 0 ? (
        <p className="text-sm text-ok">{vacio}</p>
      ) : (
        <ul className="space-y-2 text-sm">{children}</ul>
      )}
    </Entrada>
  );
}

/** Detalle de un reporte semanal (/reportes/:id, HU-09). */
export function ReportePage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const reporte = useReporte(tienePlan ? id : undefined);
  const reenviar = useReenviarReporte();
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  if (me.data && !tienePlan) {
    return <Aviso tono="plan">Disponible en el plan PRO.</Aviso>;
  }

  const r = reporte.data;
  const c: ContenidoReporte | undefined = r?.contenido;
  const o = c?.oportunidades;
  const sinOportunidades =
    !!o &&
    o.comprarMasBarato.items.length +
      o.capitalInmovilizado.items.length +
      o.margenBajo.items.length ===
      0;

  const reenviarAhora = () => {
    setAviso(null);
    reenviar.mutate(id!, {
      onSuccess: (x) =>
        setAviso(
          x.enviadoEn
            ? { tono: 'ok', texto: `Reporte enviado a ${x.destinatarios.join(', ')}.` }
            : {
                tono: 'error',
                texto: x.motivoNoEnvio
                  ? ETIQUETA_MOTIVO_NO_ENVIO_REPORTE[x.motivoNoEnvio]
                  : 'No se envió.',
              },
        ),
      onError: (err) => setAviso({ tono: 'error', texto: mensajeDe(err) }),
    });
  };

  return (
    <div className="space-y-6">
      <Link to="/reportes" className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1">
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Reportes
      </Link>

      {reporte.isError && <Aviso tono="error">{mensajeDe(reporte.error)}</Aviso>}
      {reporte.isPending && tienePlan && (
        <div className="space-y-4">
          <Skeleton variante="numero" className="w-1/3" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variante="bloque" />
            ))}
          </div>
        </div>
      )}

      {r && c && (
        <>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-3">
                Semana {c.semana}
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight">
                Tu semana del {formatearSemana(c.semana)}
              </h1>
              <p className="text-t2 text-sm mt-1">
                {c.semanaAnterior.variacionVentasPct === null
                  ? 'Sin semana anterior para comparar.'
                  : `${Number(c.semanaAnterior.variacionVentasPct) >= 0 ? '▲' : '▼'} ${formatearPct(c.semanaAnterior.variacionVentasPct)} en ventas netas contra la semana del ${formatearSemana(c.semanaAnterior.semana)} (${formatearPesos(c.semanaAnterior.ventasNetas)}).`}
              </p>
            </div>
            {esDuenio && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={reenviarAhora}
                disabled={reenviar.isPending}
              >
                <Send className="w-4 h-4" aria-hidden />
                Reenviar por correo
              </button>
            )}
          </header>

          {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
          {c.resumen.motivo && (
            <Aviso tono="warn">{ETIQUETA_MOTIVO_RESUMEN[c.resumen.motivo]}</Aviso>
          )}

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <Kpi
              indice={0}
              titulo="Ventas netas"
              Icono={ShoppingBag}
              tono="violet"
              valor={c.resumen.ventasNetas}
              detalle={`${c.resumen.unidadesVendidas} unidades vendidas`}
            />
            <Kpi
              indice={1}
              titulo="Costo vendido"
              Icono={Truck}
              tono="brand"
              valor={c.resumen.costoVendido}
              detalle="Costos vigentes al generar (RN-08)"
            />
            <Kpi
              indice={2}
              titulo="Margen bruto"
              Icono={TrendingUp}
              tono="ok"
              valor={c.resumen.margenBruto}
              claseValor={claseSigno(c.resumen.margenBruto)}
              detalle={`${formatearPct(c.resumen.margenBrutoPct)} sobre ventas`}
              extra={
                <Anillo
                  valor={
                    c.resumen.margenBrutoPct === null ? null : Number(c.resumen.margenBrutoPct)
                  }
                  etiqueta="Margen bruto sobre ventas"
                  tamanio={56}
                  grosor={6}
                />
              }
            />
            <Kpi
              indice={3}
              titulo="Margen neto"
              Icono={Percent}
              tono="warn"
              valor={c.resumen.margenNeto}
              claseValor={claseSigno(c.resumen.margenNeto)}
              detalle={
                c.resumen.margenNeto === null
                  ? 'No calculable'
                  : `${formatearPct(c.resumen.margenNetoPct)} · gastos ${formatearPesos(c.resumen.gastos)} (${c.mesGastos})`
              }
              extra={
                <Anillo
                  valor={c.resumen.margenNetoPct === null ? null : Number(c.resumen.margenNetoPct)}
                  etiqueta="Margen neto sobre ventas"
                  tamanio={56}
                  grosor={6}
                />
              }
            />
          </dl>

          <Entrada as="section" indice={4} className="card p-5">
            <h2 className="font-bold flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-warn" aria-hidden />
              Productos estrella
            </h2>
            {c.estrellas.length === 0 ? (
              <p className="text-sm text-t2">Sin ventas esta semana.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {c.estrellas.map((e, i) => {
                    const max = Number(c.estrellas[0]?.margenBrutoSemana ?? 0);
                    return (
                      <Entrada
                        as="tr"
                        indice={i}
                        key={e.producto.id}
                        className="border-t border-line first:border-0"
                      >
                        <td className="py-2 pr-2 text-t3 tabular-nums w-6">{i + 1}</td>
                        <td className="py-2">
                          <Link
                            to={`/productos/${e.producto.id}`}
                            className="font-semibold hover:underline"
                          >
                            {e.producto.nombre}
                          </Link>
                          <div className="text-xs text-t2">
                            {e.unidadesVendidas} vendidas · {formatearPct(e.margenBrutoPct)} de
                            margen
                          </div>
                          <Barra
                            valor={Number(e.margenBrutoSemana)}
                            maximo={max > 0 ? max : 1}
                            etiqueta={`Margen de ${e.producto.nombre} respecto del primero`}
                            className="mt-1.5 max-w-48"
                          />
                        </td>
                        <td
                          className={`py-2 text-right tabular-nums font-semibold ${claseSigno(e.margenBrutoSemana)}`}
                        >
                          {formatearPesos(e.margenBrutoSemana)}
                        </td>
                      </Entrada>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Entrada>

          <section className="space-y-3">
            <h2 className="font-bold flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-ok" aria-hidden />
              Oportunidades de ahorro
            </h2>
            {sinOportunidades && (
              <Aviso tono="ok">
                Sin oportunidades esta semana: comprás bien, la mercadería rota y el margen
                acompaña.
              </Aviso>
            )}
            <div className="grid gap-4 lg:grid-cols-3">
              <Oportunidad
                indice={5}
                titulo="Comprar más barato"
                Icono={Truck}
                total={o!.comprarMasBarato.total}
                vacio="Comprás a quien tiene el mejor precio cargado."
              >
                {o!.comprarMasBarato.items.map((i) => (
                  <li key={i.producto.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <Link
                        to={`/productos/${i.producto.id}`}
                        className="font-semibold hover:underline"
                      >
                        {i.producto.nombre}
                      </Link>
                      <span className="block text-xs text-t2">
                        {i.proveedorSugerido} a {formatearPesos(i.costoSugerido)} vs.{' '}
                        {i.proveedorActual ?? 'sin principal'} a {formatearPesos(i.costoActual)} ·{' '}
                        {i.unidades30d} en 30 días
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-ok whitespace-nowrap">
                      {formatearPesos(i.ahorroEstimado)}
                    </span>
                  </li>
                ))}
              </Oportunidad>
              <Oportunidad
                indice={6}
                titulo="Capital inmovilizado"
                Icono={Warehouse}
                total={o!.capitalInmovilizado.total}
                vacio="Todo lo que tenés en stock se movió en los últimos 30 días."
              >
                {o!.capitalInmovilizado.items.map((i) => (
                  <li key={i.producto.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <Link
                        to={`/productos/${i.producto.id}`}
                        className="font-semibold hover:underline"
                      >
                        {i.producto.nombre}
                      </Link>
                      <span className="block text-xs text-t2">
                        {i.stock} en stock a {formatearPesos(i.costoActual)} · sin ventas en 30 días
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums whitespace-nowrap">
                      {formatearPesos(i.monto)}
                    </span>
                  </li>
                ))}
              </Oportunidad>
              <Oportunidad
                indice={7}
                titulo="Margen bajo"
                Icono={TrendingDown}
                total={o!.margenBajo.total}
                vacio={`Ningún producto vendido está por debajo del ${UMBRAL_MARGEN_BAJO_PCT} % de margen.`}
              >
                {o!.margenBajo.items.map((i) => (
                  <li key={i.producto.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <Link
                        to={`/productos/${i.producto.id}`}
                        className="font-semibold hover:underline"
                      >
                        {i.producto.nombre}
                      </Link>
                      <span className="block text-xs text-t2">
                        {formatearPct(i.margenBrutoPct)} de margen · neto{' '}
                        {formatearPesos(i.precioNeto)} vs. costo {formatearPesos(i.costoActual)} ·{' '}
                        {i.unidadesSemana} vendidas
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums whitespace-nowrap">
                      {formatearPesos(i.monto)}
                    </span>
                  </li>
                ))}
              </Oportunidad>
            </div>
          </section>

          {c.alertasCriticas.length > 0 && (
            <Entrada as="section" indice={8} className="card p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-bold flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-crit" aria-hidden />
                  Reposición urgente al cierre
                </h2>
                <Link to="/alertas" className="text-xs font-semibold text-brand-3 hover:underline">
                  Ver alertas
                </Link>
              </div>
              <ul className="space-y-2 text-sm">
                {c.alertasCriticas.map((a) => (
                  <li key={a.producto.id} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-crit shrink-0" aria-hidden />
                      <span className="truncate">
                        <b>{a.producto.nombre}</b>{' '}
                        <span className="text-t2">
                          quedan {a.stock}
                          {a.diasCobertura === null ? '' : ` (${a.diasCobertura} días)`}
                        </span>
                      </span>
                    </span>
                    <span className="text-xs text-t2 whitespace-nowrap">
                      pedir {a.cantidadSugerida}
                    </span>
                  </li>
                ))}
              </ul>
            </Entrada>
          )}

          <footer className="text-xs text-t3 flex flex-wrap items-center gap-2">
            <Mail className="w-3.5 h-3.5" aria-hidden />
            {r.enviadoEn
              ? `Enviado el ${formatearCalculo(r.enviadoEn)} a ${r.destinatarios.join(', ')}.`
              : r.motivoNoEnvio
                ? ETIQUETA_MOTIVO_NO_ENVIO_REPORTE[r.motivoNoEnvio]
                : 'Sin enviar.'}
            <span>· Generado el {formatearCalculo(r.generadoEn)}.</span>
          </footer>
        </>
      )}
    </div>
  );
}
