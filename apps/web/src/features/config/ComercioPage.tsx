import {
  AjustesReportesPatchSchema,
  ComercioPatchSchema,
  planCumple,
} from '@inventariosmart/shared';
import { Mail, Plus, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { api, desenvolver, mensajeDe } from '@/lib/api';
import { useInvalidarMe, useMe } from '@/lib/me';
import { useActualizarAjustesReportes, useAjustesReportes } from '@/lib/reportes';
import { Aviso } from '@/ui/Aviso';
import { Campo } from '@/ui/Campo';

export function ComercioPage() {
  const me = useMe();
  const invalidarMe = useInvalidarMe();
  const [nombre, setNombre] = useState('');
  const [cuit, setCuit] = useState('');
  const [iva, setIva] = useState('21');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const ajustes = useAjustesReportes(tienePlan);
  const guardarAjustes = useActualizarAjustesReportes();
  const [destinatario, setDestinatario] = useState('');
  const [avisoReportes, setAvisoReportes] = useState<{
    tono: 'ok' | 'error';
    texto: string;
  } | null>(null);

  const cambiarAjustes = (patch: { activo?: boolean; destinatariosExtra?: string[] }) => {
    setAvisoReportes(null);
    const parsed = AjustesReportesPatchSchema.safeParse(patch);
    if (!parsed.success) {
      setAvisoReportes({
        tono: 'error',
        texto: parsed.error.issues[0]?.message ?? 'Datos inválidos.',
      });
      return;
    }
    guardarAjustes.mutate(parsed.data, {
      onSuccess: () => {
        setDestinatario('');
        setAvisoReportes({ tono: 'ok', texto: 'Ajustes del reporte guardados.' });
      },
      onError: (err) => setAvisoReportes({ tono: 'error', texto: mensajeDe(err) }),
    });
  };

  useEffect(() => {
    if (me.data) {
      setNombre(me.data.comercio.nombre);
      setCuit(me.data.comercio.cuit ?? '');
      setIva(me.data.comercio.ivaDefault);
    }
  }, [me.data]);

  const guardar = useMutation({
    mutationFn: async (body: { nombre?: string; cuit?: string | null; ivaDefault?: number }) =>
      desenvolver(await api.PATCH('/api/v1/comercio', { body })),
    onSuccess: async () => {
      setAviso({ tono: 'ok', texto: 'Datos del comercio guardados.' });
      await invalidarMe();
    },
    onError: (err) => setAviso({ tono: 'error', texto: mensajeDe(err) }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAviso(null);
    const parsed = ComercioPatchSchema.safeParse({
      nombre,
      cuit: cuit.trim() === '' ? null : cuit.trim(),
      ivaDefault: Number(iva.replace(',', '.')),
    });
    if (!parsed.success) {
      const e2: Record<string, string> = {};
      for (const i of parsed.error.issues) e2[String(i.path[0] ?? '_')] = i.message;
      setErrores(e2);
      return;
    }
    setErrores({});
    guardar.mutate(parsed.data);
  };

  return (
    <div className="space-y-8 max-w-xl">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Comercio</h1>
        <p className="text-t2 text-sm mt-1">
          Datos que aparecen en tus reportes y órdenes de compra.
        </p>
      </header>

      <form onSubmit={onSubmit} className="card p-5 space-y-4" noValidate>
        <Campo label="Nombre" value={nombre} onChange={setNombre} error={errores['nombre']} />
        <Campo
          label="CUIT"
          value={cuit}
          onChange={setCuit}
          placeholder="20123456789"
          ayuda="Opcional. 11 dígitos, sin guiones."
          error={errores['cuit']}
          inputMode="numeric"
        />
        <Campo
          label="IVA por defecto (%)"
          value={iva}
          onChange={setIva}
          ayuda="Se aplica a los productos nuevos; cada producto puede tener la suya (RN-03)."
          error={errores['ivaDefault']}
          inputMode="decimal"
        />
        {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn btn-primary" disabled={guardar.isPending}>
            Guardar
          </button>
          <span className="text-xs text-t3">
            Plan actual: <span className="font-mono text-brand-3">{me.data?.plan}</span>
          </span>
        </div>
      </form>

      <section className="card p-5 space-y-4">
        <div>
          <h2 className="font-bold flex items-center gap-2">
            <Mail className="w-4 h-4 text-brand-3" aria-hidden />
            Reporte semanal
          </h2>
          <p className="text-t2 text-sm mt-1">
            Cada lunes a las 8 llega por correo cómo te fue la semana: números, productos estrella y
            oportunidades de ahorro. Va a los dueños activos y a los correos que agregues.
          </p>
        </div>
        {!tienePlan && <Aviso tono="plan">Disponible en el plan PRO.</Aviso>}
        {tienePlan && ajustes.data && (
          <>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="accent-brand w-4 h-4"
                checked={ajustes.data.activo}
                disabled={guardarAjustes.isPending}
                onChange={(e) => cambiarAjustes({ activo: e.target.checked })}
              />
              Enviar el reporte semanal por correo
            </label>
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-t2">Destinatarios extra</span>
              {ajustes.data.destinatariosExtra.length === 0 ? (
                <p className="text-xs text-t3">Sólo los dueños activos.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {ajustes.data.destinatariosExtra.map((d) => (
                    <li key={d} className="chip">
                      {d}
                      <button
                        type="button"
                        aria-label={`Quitar ${d}`}
                        className="ml-1 hover:text-crit"
                        onClick={() =>
                          cambiarAjustes({
                            destinatariosExtra: ajustes.data.destinatariosExtra.filter(
                              (x) => x !== d,
                            ),
                          })
                        }
                      >
                        <X className="w-3 h-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!destinatario.trim()) return;
                  cambiarAjustes({
                    destinatariosExtra: [...ajustes.data!.destinatariosExtra, destinatario.trim()],
                  });
                }}
              >
                <input
                  type="email"
                  value={destinatario}
                  onChange={(e) => setDestinatario(e.target.value)}
                  placeholder="contadora@ejemplo.com"
                  aria-label="Correo extra"
                  className="campo !py-2.5"
                />
                <button type="submit" className="btn btn-ghost" disabled={guardarAjustes.isPending}>
                  <Plus className="w-4 h-4" aria-hidden />
                  Agregar
                </button>
              </form>
            </div>
            {avisoReportes && <Aviso tono={avisoReportes.tono}>{avisoReportes.texto}</Aviso>}
          </>
        )}
      </section>
    </div>
  );
}
