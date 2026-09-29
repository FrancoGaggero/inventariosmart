import { NOMBRE_PLAN, type Plan } from '@inventariosmart/shared';
import { BadgeCheck, Check } from 'lucide-react';
import { useState } from 'react';
import { formatearCalculo } from '@/lib/alertas';
import { ErrorApi, mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import {
  AVISO_SIN_COBRO,
  confirmacionDeCambio,
  esSubida,
  fraseCambio,
  fraseCambioHecho,
  fraseUso,
  tarjetasDePlanes,
  textoBoton,
  useCambiarPlan,
  useHistorialPlan,
  usePlan,
} from '@/lib/plan';
import { Aviso } from '@/ui/Aviso';
import { Confirmar } from '@/ui/Confirmar';
import { Entrada } from '@/ui/Entrada';
import { SkeletonFilas } from '@/ui/Skeleton';

const TARJETAS = tarjetasDePlanes();

function Uso({
  recurso,
  cantidad,
  limite,
}: {
  recurso: 'productos' | 'usuarios';
  cantidad: number;
  limite: number | null;
}) {
  const frase = fraseUso(recurso, cantidad, limite);
  const pct = limite === null ? 0 : Math.min(100, Math.round((cantidad / limite) * 100));
  const color =
    pct >= 100 ? 'var(--color-crit)' : pct >= 80 ? 'var(--color-warn)' : 'var(--color-brand)';
  return (
    <div className="space-y-1.5">
      <p className="text-sm">{frase}</p>
      {limite !== null && (
        <div
          role="progressbar"
          aria-label={frase}
          aria-valuemin={0}
          aria-valuemax={limite}
          aria-valuenow={Math.min(cantidad, limite)}
          className="h-1.5 w-full rounded-full bg-line-2 overflow-hidden"
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}

/** Plan del comercio (/configuracion/plan, HU-14). Todos lo ven; sólo el DUENIO lo cambia. */
export function PlanPage() {
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const plan = usePlan();
  const historial = useHistorialPlan(esDuenio);
  const cambiar = useCambiarPlan();
  const [elegido, setElegido] = useState<Plan | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'warn' | 'error'; texto: string } | null>(null);
  const cambios = historial.data?.pages.flatMap((p) => p.items) ?? [];
  const actual = plan.data?.plan;
  const confirmacion = actual && elegido ? confirmacionDeCambio(actual, elegido) : null;

  const confirmar = () => {
    if (!elegido) return;
    const nuevo = elegido;
    setAviso(null);
    cambiar.mutate(nuevo, {
      onSuccess: () => setAviso({ tono: 'ok', texto: fraseCambioHecho(nuevo) }),
      onError: (err) =>
        setAviso({
          // Un 409 es una regla del plan, no una falla: se explica qué sobra.
          tono: err instanceof ErrorApi && err.status === 409 ? 'warn' : 'error',
          texto: mensajeDe(err),
        }),
      onSettled: () => setElegido(null),
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <BadgeCheck className="w-6 h-6 text-brand-3" aria-hidden />
          Plan
        </h1>
        <p className="text-t2 text-sm mt-1 max-w-2xl">
          {plan.isError
            ? mensajeDe(plan.error)
            : actual
              ? `Tu comercio está en el plan ${NOMBRE_PLAN[actual]}.`
              : 'Qué incluye tu plan y cómo cambiarlo.'}
        </p>
      </header>

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      {plan.isPending && (
        <div className="card">
          <SkeletonFilas filas={4} />
        </div>
      )}

      {plan.data && (
        <>
          <section className="card p-5 space-y-4" aria-label="Uso del plan">
            <h2 className="font-bold">Lo que estás usando</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Uso
                recurso="productos"
                cantidad={plan.data.uso.productos}
                limite={plan.data.limites.productos}
              />
              <Uso
                recurso="usuarios"
                cantidad={plan.data.uso.usuarios}
                limite={plan.data.limites.usuarios}
              />
            </div>
          </section>

          <section className="space-y-3" aria-label="Planes">
            <div className="grid gap-4 md:grid-cols-3">
              {TARJETAS.map((t, i) => {
                const vigente = t.plan === plan.data.plan;
                return (
                  <Entrada
                    as="article"
                    indice={i}
                    key={t.plan}
                    className={`card p-5 flex flex-col ${vigente ? 'ring-2 ring-brand/60' : ''}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="font-extrabold text-lg">{t.nombre}</h2>
                      {vigente && (
                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-brand/15 text-brand-3 whitespace-nowrap">
                          Tu plan
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-t2">{t.detalle}</p>
                    <ul className="mt-4 space-y-2 text-sm flex-1">
                      {t.incluye.map((x) => (
                        <li key={x} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-ok shrink-0 mt-0.5" aria-hidden />
                          {x}
                        </li>
                      ))}
                    </ul>
                    {esDuenio && (
                      <button
                        type="button"
                        className={`btn mt-5 ${
                          esSubida(plan.data.plan, t.plan) ? 'btn-primary' : 'btn-ghost'
                        }`}
                        disabled={vigente || cambiar.isPending}
                        onClick={() => setElegido(t.plan)}
                      >
                        {textoBoton(plan.data.plan, t.plan)}
                      </button>
                    )}
                  </Entrada>
                );
              })}
            </div>
            <p className="text-xs text-t3 max-w-2xl">
              {esDuenio ? AVISO_SIN_COBRO : 'Sólo el dueño del comercio puede cambiar el plan.'}
            </p>
          </section>
        </>
      )}

      {esDuenio && plan.data && (
        <section className="space-y-3" aria-label="Historial de cambios">
          <h2 className="font-bold">Cambios de plan</h2>
          <div className="card overflow-hidden">
            {historial.isPending && <SkeletonFilas filas={2} />}
            {historial.isError && (
              <p className="p-4 text-sm text-crit">{mensajeDe(historial.error)}</p>
            )}
            {historial.isSuccess && cambios.length === 0 && (
              <p className="p-4 text-sm text-t2">Todavía no cambiaste de plan.</p>
            )}
            <ul className="divide-y divide-line text-sm">
              {cambios.map((c) => (
                <li
                  key={c.id}
                  className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                >
                  <span className="font-semibold">{fraseCambio(c)}</span>
                  <span className="text-t2 text-xs">
                    {formatearCalculo(c.creadoEn)} · {c.usuario.nombre ?? 'el dueño'}
                  </span>
                </li>
              ))}
            </ul>
            {historial.hasNextPage && (
              <div className="p-3 border-t border-line text-center">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void historial.fetchNextPage()}
                  disabled={historial.isFetchingNextPage}
                >
                  {historial.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <Confirmar
        abierto={confirmacion !== null}
        titulo={confirmacion?.titulo ?? ''}
        textoConfirmar={confirmacion?.textoConfirmar}
        peligroso={confirmacion?.baja}
        ocupado={cambiar.isPending}
        onConfirmar={confirmar}
        onCancelar={() => setElegido(null)}
      >
        {confirmacion && (
          <div className="space-y-2">
            {confirmacion.parrafos.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        )}
      </Confirmar>
    </div>
  );
}
