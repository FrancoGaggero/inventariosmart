import { ETIQUETA_MOTIVO_NO_ENVIO_REPORTE, planCumple } from '@inventariosmart/shared';
import { FileBarChart, Mail, MailX, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatearCalculo } from '@/lib/alertas';
import { mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import { formatearPesos } from '@/lib/productos';
import { formatearSemana, fraseReportes, useGenerarReporte, useReportes } from '@/lib/reportes';
import { claseSigno, formatearPct } from '@/lib/rentabilidad';
import { Anillo } from '@/ui/Anillo';
import { Aviso } from '@/ui/Aviso';
import { Entrada } from '@/ui/Entrada';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { Skeleton } from '@/ui/Skeleton';

/** Historial de reportes semanales (HU-09). DUENIO genera, CONTADOR consulta. */
export function ReportesPage() {
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const reportes = useReportes(tienePlan);
  const generar = useGenerarReporte();
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);
  const items = reportes.data?.pages.flatMap((p) => p.items) ?? [];

  const generarActual = () => {
    setAviso(null);
    generar.mutate(
      {},
      {
        onSuccess: (r) =>
          setAviso({
            tono: 'ok',
            texto: `Reporte de la semana del ${formatearSemana(r.semana)} generado${r.enviadoEn ? ' y enviado' : ''}.`,
          }),
        onError: (err) => setAviso({ tono: 'error', texto: mensajeDe(err) }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-brand-3" aria-hidden />
            Reportes semanales
          </h1>
          <p className="text-t2 text-sm mt-1 max-w-2xl">
            {reportes.isError ? mensajeDe(reportes.error) : fraseReportes(items[0])}
          </p>
        </div>
        {esDuenio && tienePlan && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={generarActual}
            disabled={generar.isPending}
          >
            <RefreshCw
              className={`w-4 h-4 ${generar.isPending ? 'animate-spin' : ''}`}
              aria-hidden
            />
            Generar el de esta semana
          </button>
        )}
      </header>

      {me.data && !tienePlan && (
        <Aviso tono="plan">
          Disponible en el plan PRO: cada lunes recibís por correo cómo te fue la semana, con
          productos estrella y oportunidades de ahorro.
        </Aviso>
      )}
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      {tienePlan && (
        <>
          {reportes.isPending && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card p-5 space-y-3">
                  <Skeleton variante="linea" />
                  <Skeleton variante="numero" />
                  <Skeleton variante="linea" />
                </div>
              ))}
            </div>
          )}

          {reportes.isSuccess && items.length === 0 && (
            <div className="card">
              <EstadoVacio
                ilustracion="recibo"
                titulo="Todavía no hay reportes."
                texto="El primero se genera solo el lunes que viene con la semana que cierra; si querés ver uno ahora, generá el de esta semana."
                accion={
                  esDuenio && (
                    <button type="button" className="btn btn-primary" onClick={generarActual}>
                      Generar el de esta semana
                    </button>
                  )
                }
              />
            </div>
          )}

          {items.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r, i) => (
                <Entrada as="li" indice={i} key={r.id}>
                  <Link to={`/reportes/${r.id}`} className="card card-hover p-5 flex gap-4 h-full">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wider text-t2">
                        {formatearSemana(r.semana)}
                      </div>
                      <div className="text-xl font-extrabold tabular-nums">
                        {formatearPesos(r.ventasNetas)}
                      </div>
                      <div className="text-xs text-t2">
                        {r.unidadesVendidas} vendidas · margen bruto{' '}
                        <span className={`font-semibold ${claseSigno(r.margenBruto)}`}>
                          {formatearPesos(r.margenBruto)}
                        </span>
                      </div>
                      <div className="text-xs text-t3">
                        {r.variacionVentasPct === null
                          ? 'sin semana anterior'
                          : `${Number(r.variacionVentasPct) >= 0 ? '▲' : '▼'} ${formatearPct(r.variacionVentasPct)} vs. semana anterior`}
                        {r.oportunidades > 0 &&
                          ` · ${r.oportunidades} oportunidad${r.oportunidades === 1 ? '' : 'es'}`}
                      </div>
                      <div className="text-[11px] text-t3 flex items-center gap-1 pt-1">
                        {r.enviadoEn ? (
                          <>
                            <Mail className="w-3 h-3" aria-hidden />
                            Enviado {formatearCalculo(r.enviadoEn)}
                          </>
                        ) : (
                          <>
                            <MailX className="w-3 h-3" aria-hidden />
                            {r.motivoNoEnvio
                              ? ETIQUETA_MOTIVO_NO_ENVIO_REPORTE[r.motivoNoEnvio]
                              : 'Sin enviar'}
                          </>
                        )}
                      </div>
                    </div>
                    <Anillo
                      valor={r.margenBrutoPct === null ? null : Number(r.margenBrutoPct)}
                      etiqueta="Margen bruto sobre ventas"
                      tamanio={56}
                      grosor={6}
                    />
                  </Link>
                </Entrada>
              ))}
            </ul>
          )}

          {reportes.hasNextPage && (
            <div className="text-center">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void reportes.fetchNextPage()}
                disabled={reportes.isFetchingNextPage}
              >
                Cargar más
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
