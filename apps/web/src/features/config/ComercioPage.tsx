import { ComercioPatchSchema } from '@inventariosmart/shared';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { api, desenvolver, mensajeDe } from '@/lib/api';
import { useInvalidarMe, useMe } from '@/lib/me';
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
    </div>
  );
}
