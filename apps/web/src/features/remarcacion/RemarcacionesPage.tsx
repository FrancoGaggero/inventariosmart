import { planCumple, type LoteRemarcacion, type ResultadoReversion } from '@inventariosmart/shared';
import { ChevronDown, Tags, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatearCalculo } from '@/lib/alertas';
import { mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import { formatearPesos } from '@/lib/productos';
import {
  fraseCriterio,
  fraseDeshecho,
  fraseReversion,
  useDeshacerRemarcacion,
  useLote,
  useLotes,
} from '@/lib/remarcacion';
import { Aviso } from '@/ui/Aviso';
import { Confirmar } from '@/ui/Confirmar';
import { Entrada } from '@/ui/Entrada';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { SkeletonFilas } from '@/ui/Skeleton';

const productos = (n: number) => (n === 1 ? '1 producto' : `${n} productos`);

function Detalle({ id }: { id: string }) {
  const lote = useLote(id);
  if (lote.isPending) return <SkeletonFilas filas={3} />;
  if (lote.isError) return <Aviso tono="error">{mensajeDe(lote.error)}</Aviso>;
  return (
    <ul className="divide-y divide-line text-sm border-t border-line">
      {lote.data.items.map((i) => (
        <li
          key={i.producto.id}
          className="px-4 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
        >
          <span className="min-w-0">
            <span className="font-semibold">{i.producto.nombre}</span>{' '}
            <span className="text-xs text-t3 font-mono">{i.producto.codigo}</span>
          </span>
          <span className="tabular-nums whitespace-nowrap text-t2">
            {formatearPesos(i.precioAnterior)} →{' '}
            <b className="text-t1">{formatearPesos(i.precioNuevo)}</b>
            {i.revertido && <span className="text-xs text-t3"> · volvió al anterior</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Remarcaciones aplicadas (/remarcaciones, HU-17). DUENIO deshace; CONTADOR consulta. */
export function RemarcacionesPage() {
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const lotes = useLotes(tienePlan);
  const deshacer = useDeshacerRemarcacion();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aDeshacer, setADeshacer] = useState<LoteRemarcacion | null>(null);
  const [resultado, setResultado] = useState<ResultadoReversion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = lotes.data?.pages.flatMap((p) => p.items) ?? [];

  const confirmar = () => {
    if (!aDeshacer) return;
    setError(null);
    setResultado(null);
    deshacer.mutate(aDeshacer.id, {
      onSuccess: (r) => {
        setADeshacer(null);
        setResultado(r);
      },
      onError: (err) => {
        setADeshacer(null);
        setError(mensajeDe(err));
      },
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Tags className="w-6 h-6 text-brand-3" aria-hidden />
            Remarcaciones
          </h1>
          <p className="text-t2 text-sm mt-1 max-w-2xl">
            {lotes.isError
              ? mensajeDe(lotes.error)
              : 'Cada remarcación queda guardada con los precios de antes y de después.'}
          </p>
        </div>
        {tienePlan && (
          <Link to="/remarcar" className="btn btn-primary">
            Remarcar precios
          </Link>
        )}
      </header>

      {me.data && !tienePlan && (
        <Aviso tono="plan">
          Disponible en el plan PRO: remarcá todos tus precios en un paso, con vista previa y la
          posibilidad de deshacer.
        </Aviso>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
      {resultado && (
        <Aviso tono={resultado.productosOmitidos.length > 0 ? 'warn' : 'ok'}>
          {fraseReversion(
            resultado.revertidos ?? 0,
            resultado.productosOmitidos.map((o) => o.producto.nombre),
          )}
        </Aviso>
      )}

      {tienePlan && (
        <>
          {lotes.isPending && (
            <div className="card">
              <SkeletonFilas filas={4} />
            </div>
          )}
          {lotes.isSuccess && items.length === 0 && (
            <div className="card">
              <EstadoVacio
                ilustracion="recibo"
                titulo="Todavía no hiciste ninguna remarcación."
                texto="Desde Precios e inflación podés remarcar los productos atrasados en un solo paso."
                accion={
                  <Link to="/remarcar" className="btn btn-primary">
                    Remarcar precios
                  </Link>
                }
              />
            </div>
          )}
          <ul className="space-y-3">
            {items.map((l, n) => (
              <Entrada as="li" indice={n} key={l.id} className="card overflow-hidden">
                <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{fraseCriterio(l.criterio, l.parametros)}</p>
                    <p className="text-xs text-t2">
                      {productos(l.cantidad)} · {formatearCalculo(l.creadoEn)} ·{' '}
                      {l.usuario.nombre ?? 'el dueño'}
                    </p>
                    {l.revertidoEn && (
                      <p className="text-xs text-t3 mt-1">
                        Deshecha el {formatearCalculo(l.revertidoEn)}
                        {l.revertidoPor?.nombre ? ` por ${l.revertidoPor.nombre}` : ''}:{' '}
                        {fraseDeshecho(l.revertidos ?? 0, l.omitidos ?? 0)}.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                        l.revertidoEn ? 'bg-fill text-t2' : 'bg-ok/15 text-ok'
                      }`}
                    >
                      {l.revertidoEn ? 'Deshecha' : 'Aplicada'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost !py-2 !px-3"
                      aria-expanded={abierto === l.id}
                      onClick={() => setAbierto((a) => (a === l.id ? null : l.id))}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition ${abierto === l.id ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                      Precios
                    </button>
                    {esDuenio && !l.revertidoEn && (
                      <button
                        type="button"
                        className="btn btn-ghost !py-2 !px-3"
                        onClick={() => setADeshacer(l)}
                        disabled={deshacer.isPending}
                      >
                        <Undo2 className="w-4 h-4" aria-hidden />
                        Deshacer
                      </button>
                    )}
                  </div>
                </div>
                {abierto === l.id && <Detalle id={l.id} />}
              </Entrada>
            ))}
          </ul>
          {lotes.hasNextPage && (
            <div className="text-center">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void lotes.fetchNextPage()}
                disabled={lotes.isFetchingNextPage}
              >
                Cargar más
              </button>
            </div>
          )}
        </>
      )}

      <Confirmar
        abierto={aDeshacer !== null}
        titulo="¿Deshacer la remarcación?"
        textoConfirmar="Deshacer"
        textoCancelar="Dejarla como está"
        peligroso
        ocupado={deshacer.isPending}
        onConfirmar={confirmar}
        onCancelar={() => setADeshacer(null)}
      >
        {aDeshacer &&
          `Vuelven al precio anterior los ${productos(aDeshacer.cantidad)} de esta remarcación que sigan con el precio remarcado. Los que cambiaste después no se tocan. Sólo se puede deshacer una vez.`}
      </Confirmar>
    </div>
  );
}
