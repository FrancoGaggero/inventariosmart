import { OnboardingSchema } from '@inventariosmart/shared';
import { FileSpreadsheet, PencilLine, Store } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, desenvolver, mensajeDe } from '@/lib/api';
import { useInvalidarMe, useMe } from '@/lib/me';
import { Campo } from '@/ui/Campo';

/**
 * Onboarding guiado (HU-11, HU-05): quien entró con Google elige el nombre de su comercio y
 * después cómo cargar el inventario: importándolo desde Excel o a mano.
 */
export function OnboardingPage() {
  const me = useMe();
  const invalidarMe = useInvalidarMe();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = OnboardingSchema.safeParse({ nombreComercio: nombre });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisá el nombre.');
      return;
    }
    setEnviando(true);
    try {
      desenvolver(await api.POST('/api/v1/me/onboarding', { body: parsed.data }));
      await invalidarMe();
      setPaso(2);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  };

  if (paso === 2) {
    return (
      <main className="min-h-full flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <p className="text-xs font-bold tracking-widest text-brand-3 mb-2">SEGUNDO PASO</p>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">¿Cómo querés empezar?</h1>
          <p className="text-t2 text-sm mb-6">
            Podés cargar tu inventario ahora o más tarde desde Inventario.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/importar?onboarding=1"
              className="card p-5 hover:border-brand-2/50 transition block"
            >
              <FileSpreadsheet className="w-6 h-6 text-brand-3 mb-3" aria-hidden />
              <h2 className="font-bold">Importar desde Excel</h2>
              <p className="text-t2 text-sm mt-1">
                Subí tu planilla de productos con precios y stock. Te mostramos qué se va a cargar
                antes de confirmar.
              </p>
            </Link>
            <Link
              to="/productos/nuevo"
              className="card p-5 hover:border-brand-2/50 transition block"
            >
              <PencilLine className="w-6 h-6 text-brand-3 mb-3" aria-hidden />
              <h2 className="font-bold">Cargar a mano</h2>
              <p className="text-t2 text-sm mt-1">
                Empezá con tus productos principales; el resto lo sumás cuando quieras.
              </p>
            </Link>
          </div>
          <button
            type="button"
            className="btn btn-ghost mt-5"
            onClick={() => navigate('/', { replace: true })}
          >
            Ir al inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-brand/15 grid place-items-center mb-5">
          <Store className="w-6 h-6 text-brand-3" aria-hidden />
        </div>
        <p className="text-xs font-bold tracking-widest text-brand-3 mb-2">PRIMER PASO</p>
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">¿Cómo se llama tu comercio?</h1>
        <p className="text-t2 text-sm mb-6">
          Hola {me.data?.usuario.nombre ?? me.data?.usuario.email}. Este nombre aparece en tus
          reportes y podés cambiarlo cuando quieras.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <Campo
            label="Nombre del comercio"
            value={nombre}
            onChange={setNombre}
            placeholder="Repuestos Carlos"
            autoComplete="organization"
            autoFocus
          />
          {error && (
            <p
              role="alert"
              className="text-sm text-crit bg-crit/10 border border-crit/30 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={enviando}>
            Guardar y continuar
          </button>
        </form>
      </div>
    </main>
  );
}
