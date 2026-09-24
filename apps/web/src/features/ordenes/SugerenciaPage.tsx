import {
  ETIQUETA_MOTIVO_ELECCION,
  ETIQUETA_SEVERIDAD,
  type GrupoSugerido,
  planCumple,
  subtotalItem,
  totalOrden,
} from '@inventariosmart/shared';
import { AlertTriangle, ArrowLeft, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { formatearCalculo, formatearCobertura } from '@/lib/alertas';
import { mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import {
  type SeveridadSugerencia,
  fraseSugerencia,
  useCrearOrden,
  useSugerencia,
} from '@/lib/ordenes';
import { formatearPesos } from '@/lib/productos';
import { Aviso } from '@/ui/Aviso';
import { Entrada } from '@/ui/Entrada';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { SkeletonFilas } from '@/ui/Skeleton';

/** Sugerencia de órdenes por proveedor más conveniente (/ordenes/nueva, HU-07 criterio 1). */
export function SugerenciaPage() {
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const [params, setParams] = useSearchParams();
  const severidad: SeveridadSugerencia = params.get('severidad') === 'TODAS' ? 'TODAS' : 'CRITICA';
  const sugerencia = useSugerencia(severidad, tienePlan);
  const crear = useCrearOrden();
  const navigate = useNavigate();
  const [aviso, setAviso] = useState<string | null>(null);
  /** Cantidades editadas por producto antes de crear el borrador. */
  const [cantidades, setCantidades] = useState<Record<string, string>>({});

  useEffect(() => setCantidades({}), [severidad]);

  const cantidadDe = (g: GrupoSugerido, productoId: string): number => {
    const item = g.items.find((i) => i.producto.id === productoId)!;
    const editada = cantidades[productoId];
    if (editada === undefined) return item.cantidad;
    const n = Number(editada);
    return Number.isInteger(n) && n >= 1 ? n : item.cantidad;
  };

  const crearBorrador = (g: GrupoSugerido) => {
    setAviso(null);
    crear.mutate(
      {
        proveedorId: g.proveedor.id,
        items: g.items.map((i) => ({
          productoId: i.producto.id,
          cantidad: cantidadDe(g, i.producto.id),
          alertaId: i.alertaId,
        })),
      },
      {
        onSuccess: (o) => navigate(`/ordenes/${o.id}`),
        onError: (err) => setAviso(mensajeDe(err)),
      },
    );
  };

  const s = sugerencia.data;

  return (
    <div className="space-y-6">
      <Link to="/ordenes" className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1">
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Órdenes
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-3" aria-hidden />
            Orden sugerida
          </h1>
          <p className="text-t2 text-sm mt-1 max-w-2xl">
            {sugerencia.isError ? mensajeDe(sugerencia.error) : fraseSugerencia(s)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <label className="flex items-center gap-2 text-sm text-t2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-brand"
              checked={severidad === 'TODAS'}
              onChange={(e) =>
                setParams(e.target.checked ? { severidad: 'TODAS' } : {}, { replace: true })
              }
            />
            Incluir próximas al quiebre
          </label>
          <span className="text-[11px] text-t3">
            Alertas calculadas: {formatearCalculo(s?.calculadasEn ?? null)}
          </span>
        </div>
      </header>

      {me.data && !tienePlan && <Aviso tono="plan">Disponible en el plan PRO.</Aviso>}
      {aviso && <Aviso tono="error">{aviso}</Aviso>}

      {sugerencia.isPending && tienePlan && (
        <div className="card">
          <SkeletonFilas filas={3} />
        </div>
      )}

      {s && s.grupos.length === 0 && s.sinProveedor.length === 0 && (
        <div className="card">
          <EstadoVacio
            ilustracion="carrito"
            titulo="Nada para pedir por ahora."
            texto={`La sugerencia toma las alertas activas${
              severidad === 'CRITICA' ? ' críticas (por debajo del punto de reposición)' : ''
            }.`}
            accion={
              <Link to="/alertas" className="btn btn-ghost">
                Ver alertas
              </Link>
            }
          />
        </div>
      )}

      {s?.grupos.map((g, gi) => {
        const items = g.items.map((i) => ({
          cantidad: cantidadDe(g, i.producto.id),
          costoUnitarioNeto: i.costoUnitarioNeto,
        }));
        const total = totalOrden(items);
        return (
          <Entrada as="section" indice={gi} key={g.proveedor.id} className="card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-line">
              <div>
                <h2 className="font-bold">{g.proveedor.nombre}</h2>
                <p className="text-xs text-t3">
                  lead time {g.proveedor.leadTimeDias} d · confiabilidad {g.proveedor.confiabilidad}
                  /5 · {g.proveedor.email ?? 'sin email: se envía por otro medio'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">
                  Total neto {formatearPesos(total)}
                </span>
                {esDuenio && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => crearBorrador(g)}
                    disabled={crear.isPending}
                  >
                    Crear borrador
                  </button>
                )}
              </div>
            </header>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-t2">
                <tr>
                  <th className="px-4 py-2">Producto</th>
                  <th className="px-4 py-2">Cobertura</th>
                  <th className="px-4 py-2 text-right">Cantidad</th>
                  <th className="px-4 py-2 text-right">Costo neto</th>
                  <th className="px-4 py-2 text-right">Subtotal</th>
                  <th className="px-4 py-2">Por qué este proveedor</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((i) => {
                  const cantidad = cantidadDe(g, i.producto.id);
                  return (
                    <tr key={i.producto.id} className="border-t border-line align-top">
                      <td className="px-4 py-2">
                        <Link
                          to={`/productos/${i.producto.id}`}
                          className="font-semibold hover:underline"
                        >
                          {i.producto.nombre}
                        </Link>
                        <div className="text-xs text-t3 font-mono">
                          {i.producto.codigo} · stock {i.producto.stockActual}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            i.severidad === 'CRITICA' ? 'text-crit' : 'text-warn'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                          {formatearCobertura(i.diasCobertura)}
                        </span>
                        <div className="text-[11px] text-t3">{ETIQUETA_SEVERIDAD[i.severidad]}</div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {esDuenio ? (
                          <input
                            type="number"
                            min={1}
                            step={1}
                            aria-label={`Cantidad de ${i.producto.nombre}`}
                            value={cantidades[i.producto.id] ?? String(i.cantidad)}
                            onChange={(e) =>
                              setCantidades((c) => ({ ...c, [i.producto.id]: e.target.value }))
                            }
                            className="w-24 rounded-lg bg-field border border-line px-2 py-1 text-right text-sm outline-none focus:border-brand-2"
                          />
                        ) : (
                          <span className="tabular-nums">{cantidad}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {i.costoUnitarioNeto ? formatearPesos(i.costoUnitarioNeto) : 'a confirmar'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">
                        {i.costoUnitarioNeto
                          ? formatearPesos(subtotalItem(cantidad, i.costoUnitarioNeto) ?? '0')
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-t2">
                        {ETIQUETA_MOTIVO_ELECCION[i.motivoEleccion]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Entrada>
        );
      })}

      {s && s.sinProveedor.length > 0 && (
        <section className="card p-4 space-y-2">
          <h2 className="font-bold">Sin proveedor</h2>
          <p className="text-sm text-t2">
            Estos productos están en alerta pero no tienen precios cargados ni proveedor principal.
            Asignales uno desde la ficha del producto para incluirlos en una orden.
          </p>
          <ul className="text-sm divide-y divide-line">
            {s.sinProveedor.map((x) => (
              <li key={x.producto.id} className="py-2 flex items-center justify-between gap-3">
                <span>
                  <Link
                    to={`/productos/${x.producto.id}`}
                    className="font-semibold hover:underline"
                  >
                    {x.producto.nombre}
                  </Link>
                  <span className="text-xs text-t3 font-mono ml-2">{x.producto.codigo}</span>
                </span>
                <span className="text-t2 tabular-nums">
                  sugerido {x.cantidad} · {ETIQUETA_SEVERIDAD[x.severidad]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
