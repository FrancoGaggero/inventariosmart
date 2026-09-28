import { mesActual, planCumple, type IndicadorValor } from '@inventariosmart/shared';
import { Landmark } from 'lucide-react';
import { Link } from 'react-router';
import { mensajeDe } from '@/lib/api';
import { useDashboard } from '@/lib/dashboard';
import {
  aDolares,
  formatearDia,
  formatearUsd,
  formatearVariacion,
  useIndicadores,
} from '@/lib/inflacion';
import { useMe } from '@/lib/me';
import { formatearPesos } from '@/lib/productos';
import { Aviso } from '@/ui/Aviso';
import { Skeleton } from '@/ui/Skeleton';

function Dato({
  titulo,
  valor,
  pie,
  cargando,
}: {
  titulo: string;
  valor: string | null;
  pie: string;
  cargando: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-t2 text-xs font-semibold uppercase tracking-wider truncate">{titulo}</dt>
      {cargando ? (
        <Skeleton variante="numero" className="mt-1.5" />
      ) : (
        <>
          <dd className="text-lg font-extrabold tabular-nums whitespace-nowrap mt-0.5">
            {valor ?? '—'}
          </dd>
          <dd className="text-[11px] text-t3 truncate">{valor === null ? 'Sin datos' : pie}</dd>
        </>
      )}
    </div>
  );
}

const pie = (i: IndicadorValor | null | undefined) =>
  i ? `${i.fuente} · ${formatearDia(i.fecha)}` : '';

/**
 * Tarjeta "Contexto" de Inicio (HU-15): inflación y dólar oficiales para todos los roles, y el
 * stock valorizado en dólares para quienes ven el panel (DUENIO y CONTADOR).
 */
export function Contexto({ conStock }: { conStock: boolean }) {
  const me = useMe();
  const indicadores = useIndicadores();
  const panel = useDashboard(mesActual(), conStock);
  const i = indicadores.data;
  const cargando = indicadores.isPending;
  const veComparacion = conStock && !!me.data && planCumple(me.data.plan, 'PRO');

  const stock = panel.data?.stock.valorizacion;
  const enDolares = aDolares(stock, i?.dolarMinorista?.valor);

  return (
    <section className="space-y-3" aria-labelledby="titulo-contexto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="titulo-contexto"
          className="text-sm font-semibold text-t2 uppercase tracking-wider flex items-center gap-2"
        >
          <Landmark className="w-4 h-4" aria-hidden />
          Contexto
        </h2>
        {veComparacion && (
          <Link to="/inflacion" className="text-xs font-semibold text-brand-3 hover:underline">
            Comparar con mis precios
          </Link>
        )}
      </div>
      {indicadores.isError ? (
        <Aviso tono="warn">{mensajeDe(indicadores.error)}</Aviso>
      ) : (
        <>
          <dl
            className={`card p-4 grid gap-4 grid-cols-2 ${conStock ? 'lg:grid-cols-4' : 'sm:grid-cols-3'}`}
          >
            <Dato
              titulo="Inflación del mes"
              valor={i?.inflacionMensual ? formatearVariacion(i.inflacionMensual.valor) : null}
              pie={pie(i?.inflacionMensual)}
              cargando={cargando}
            />
            <Dato
              titulo="Interanual"
              valor={
                i?.inflacionInteranual ? formatearVariacion(i.inflacionInteranual.valor) : null
              }
              pie={pie(i?.inflacionInteranual)}
              cargando={cargando}
            />
            <Dato
              titulo="Dólar minorista"
              valor={i?.dolarMinorista ? formatearPesos(i.dolarMinorista.valor) : null}
              pie={pie(i?.dolarMinorista)}
              cargando={cargando}
            />
            {conStock && (
              <Dato
                titulo="Stock en dólares"
                valor={enDolares === null ? null : formatearUsd(enDolares)}
                pie={`${formatearPesos(stock)} al dólar minorista`}
                cargando={cargando || panel.isPending}
              />
            )}
          </dl>
          {i?.desactualizado && (
            <Aviso tono="warn">
              No pudimos actualizar los datos del INDEC y del BCRA: estás viendo los últimos que
              guardamos.
            </Aviso>
          )}
        </>
      )}
    </section>
  );
}
