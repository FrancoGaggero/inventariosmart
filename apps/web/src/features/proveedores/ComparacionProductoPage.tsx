import { PESOS_PUNTAJE, planCumple, type ProveedorComparado } from '@inventariosmart/shared';
import { ArrowLeft, Scale } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { mensajeDe } from '@/lib/api';
import {
  componentesPuntaje,
  formatearCosto,
  formatearDiferencia,
  formatearPlazo,
  formatearPuntaje,
  fraseConfirmarPrincipal,
  fraseRecomendacion,
  useComparacionProducto,
  useUsarComoPrincipal,
} from '@/lib/comparador';
import { useMe } from '@/lib/me';
import { estrellas } from '@/lib/proveedores';
import { Aviso } from '@/ui/Aviso';
import { Barra } from '@/ui/Barra';
import { Confirmar } from '@/ui/Confirmar';
import { Entrada } from '@/ui/Entrada';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { SkeletonFilas } from '@/ui/Skeleton';

const fecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const pct = (peso: number) => Math.round(peso * 100);

function Chip({ tono, children }: { tono: 'ok' | 'brand' | 'neutro'; children: string }) {
  const clase = {
    ok: 'bg-ok/15 text-ok',
    brand: 'bg-brand/15 text-brand-3',
    neutro: 'bg-fill text-t2',
  }[tono];
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${clase}`}>
      {children}
    </span>
  );
}

/** Detalle de un insumo (/proveedores/comparador/:productoId, HU-12). */
export function ComparacionProductoPage() {
  const { productoId } = useParams<{ productoId: string }>();
  const me = useMe();
  const tienePlan = me.data ? planCumple(me.data.plan, 'PREMIUM') : false;
  const comparacion = useComparacionProducto(productoId, tienePlan);
  const usar = useUsarComoPrincipal();
  const [elegido, setElegido] = useState<ProveedorComparado | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);
  const c = comparacion.data;

  const confirmar = () => {
    if (!elegido || !c) return;
    const proveedor = elegido.proveedor.nombre;
    setAviso(null);
    usar.mutate(
      { productoId: c.producto.id, proveedorId: elegido.proveedor.id },
      {
        onSuccess: () => {
          setElegido(null);
          setAviso({
            tono: 'ok',
            texto: `${proveedor} ya es el proveedor principal de ${c.producto.nombre}.`,
          });
        },
        onError: (err) => {
          setElegido(null);
          setAviso({ tono: 'error', texto: mensajeDe(err) });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <Link
        to="/proveedores/comparador"
        className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Comparador
      </Link>

      <header>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Scale className="w-6 h-6 text-brand-3 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            {c ? c.producto.nombre : 'Comparar proveedores'}
          </span>
        </h1>
        {c && (
          <p className="text-t2 text-sm mt-1 max-w-2xl">
            <span className="font-mono text-xs text-t3">{c.producto.codigo}</span> ·{' '}
            {fraseRecomendacion(c)}
          </p>
        )}
      </header>

      {me.data && !tienePlan && (
        <Aviso tono="plan">
          Disponible en el plan PREMIUM: compará a tus proveedores insumo por insumo y mirá con
          quién te conviene comprar.
        </Aviso>
      )}
      {comparacion.isError && <Aviso tono="error">{mensajeDe(comparacion.error)}</Aviso>}
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      {tienePlan && comparacion.isPending && (
        <div className="card">
          <SkeletonFilas filas={3} />
        </div>
      )}

      {c && c.proveedores.length === 0 && (
        <div className="card">
          <EstadoVacio
            ilustracion="camion"
            titulo="Ningún proveedor cargó un costo para este insumo."
            texto="Cargá o importá la lista de precios de al menos dos proveedores para compararlos."
            accion={
              <Link to="/proveedores" className="btn btn-primary">
                Ir a proveedores
              </Link>
            }
          />
        </div>
      )}

      {c && c.proveedores.length > 0 && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {c.proveedores.map((p, n) => {
            const esRecomendado = c.recomendado?.id === p.proveedor.id;
            const esMasBarato = c.masBarato?.id === p.proveedor.id;
            return (
              <Entrada
                as="li"
                indice={n}
                key={p.proveedor.id}
                className={`card p-4 space-y-4 ${esRecomendado ? '!border-ok/50' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={`/proveedores/${p.proveedor.id}`}
                      className="font-bold text-lg hover:text-brand-3 break-words"
                    >
                      {p.proveedor.nombre}
                    </Link>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {esRecomendado && <Chip tono="ok">Recomendado</Chip>}
                      {esMasBarato && <Chip tono="brand">Más barato</Chip>}
                      {p.esPrincipal && <Chip tono="neutro">Principal</Chip>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold tabular-nums leading-none">
                      {formatearPuntaje(p.puntaje)}
                    </div>
                    <div className="text-xs text-t3">puntos de 100</div>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-t3">Costo neto</dt>
                    <dd className="font-semibold tabular-nums">{formatearCosto(p.costoNeto)}</dd>
                    <dd className="text-xs text-t2">{formatearDiferencia(p.diferenciaPct)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-t3">Plazo y confiabilidad</dt>
                    <dd className="font-semibold">{formatearPlazo(p.leadTimeDias)}</dd>
                    <dd className="text-warn tracking-wider" title={`${p.confiabilidad} de 5`}>
                      {estrellas(p.confiabilidad)}
                    </dd>
                  </div>
                </dl>

                <div className="space-y-2">
                  {componentesPuntaje(p).map((parte) => (
                    <div key={parte.clave}>
                      <div className="flex justify-between gap-2 text-xs text-t2 mb-1">
                        <span>
                          {parte.etiqueta} <span className="text-t3">· pesa {parte.peso} %</span>
                        </span>
                        <span className="tabular-nums">
                          {formatearPuntaje(String(parte.valor))} de 100
                        </span>
                      </div>
                      <Barra
                        valor={parte.valor}
                        maximo={100}
                        critico={40}
                        alerta={70}
                        etiqueta={`${parte.etiqueta} de ${p.proveedor.nombre}`}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-t3">
                    Costo vigente desde el {fecha.format(new Date(p.vigenteDesde))}
                  </span>
                  {!p.esPrincipal && (
                    <button
                      type="button"
                      className={`btn ${esRecomendado ? 'btn-primary' : 'btn-ghost'} !py-2 !px-3`}
                      onClick={() => setElegido(p)}
                      disabled={usar.isPending}
                    >
                      Usar como principal
                    </button>
                  )}
                </div>
              </Entrada>
            );
          })}
        </ul>
      )}

      {c && c.proveedores.length > 0 && (
        <section className="card p-4 space-y-2 text-sm">
          <h2 className="font-bold">Cómo se calcula</h2>
          <p className="text-t2">
            El puntaje va de 0 a 100 y combina tres cosas: el precio pesa{' '}
            {pct(PESOS_PUNTAJE.precio)} %, el plazo de entrega {pct(PESOS_PUNTAJE.plazo)} % y la
            confiabilidad {pct(PESOS_PUNTAJE.confiabilidad)} %.
          </p>
          <ul className="text-t2 list-disc pl-5 space-y-1">
            <li>
              Precio: el proveedor más barato tiene 100 y el resto baja según cuánto más cobra.
            </li>
            <li>Plazo: el que entrega más rápido tiene 100.</li>
            <li>Confiabilidad: las estrellas que le pusiste al proveedor; 5 estrellas son 100.</li>
          </ul>
          <p className="text-xs text-t3">
            Se usa el último costo que cargó cada proveedor activo. Podés cambiar el plazo y la
            confiabilidad desde la ficha del proveedor.
          </p>
        </section>
      )}

      <Confirmar
        abierto={elegido !== null}
        titulo="¿Usar como proveedor principal?"
        textoConfirmar="Usar como principal"
        ocupado={usar.isPending}
        onConfirmar={confirmar}
        onCancelar={() => setElegido(null)}
      >
        {elegido &&
          c &&
          fraseConfirmarPrincipal(c.producto.nombre, elegido.proveedor.nombre, elegido.costoNeto)}
      </Confirmar>
    </div>
  );
}
