import { OnboardingSchema } from '@inventariosmart/shared';
import { BarChart3, UserPlus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { api, desenvolver, mensajeDe } from '@/lib/api';
import { mensajeFirebase, useAuth } from '@/lib/auth';
import { useInvalidarMe } from '@/lib/me';
import { Campo } from '@/ui/Campo';

/** Registro con email: crea la cuenta en Firebase y confirma el nombre del comercio (CP-11.2c). */
export function RegistroPage() {
  const { user, cargando, registrarConEmail } = useAuth();
  const invalidarMe = useInvalidarMe();
  const navigate = useNavigate();
  const [nombreComercio, setNombreComercio] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (cargando) return null;
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const nombre = OnboardingSchema.safeParse({ nombreComercio });
    if (!nombre.success) {
      setError(nombre.error.issues[0]?.message ?? 'Revisá el nombre del comercio.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña tiene que tener al menos 8 caracteres.');
      return;
    }
    if (!acepta) {
      setError('Tenés que aceptar los términos y la política de privacidad.');
      return;
    }
    setEnviando(true);
    try {
      await registrarConEmail(email.trim(), password);
    } catch (err) {
      setError(mensajeFirebase(err, 'No pudimos crear la cuenta. Intentá de nuevo.'));
      setEnviando(false);
      return;
    }
    try {
      desenvolver(
        await api.POST('/api/v1/me/onboarding', {
          body: { nombreComercio: nombre.data.nombreComercio },
        }),
      );
      await invalidarMe();
      navigate('/', { replace: true });
    } catch (err) {
      // La cuenta ya existe: el onboarding se completa en /onboarding.
      setError(mensajeDe(err));
      navigate('/onboarding', { replace: true });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-violet grid place-items-center">
            <BarChart3 className="w-5 h-5 text-white" aria-hidden />
          </div>
          <span className="font-extrabold text-lg">InventarioSmart</span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight leading-tight mb-1">
          Empezá <span className="text-brand-3">gratis</span> y en minutos.
        </h1>
        <p className="text-t2 text-sm mb-6">Registrá tu comercio.</p>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
          <Campo
            label="Nombre del comercio"
            value={nombreComercio}
            onChange={setNombreComercio}
            placeholder="Repuestos Carlos"
            autoComplete="organization"
          />
          <Campo
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="carlos@repuestoscarlos.com.ar"
            autoComplete="email"
          />
          <Campo
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
          />
          <label className="flex items-center gap-2 text-xs text-t2 cursor-pointer">
            <input
              type="checkbox"
              checked={acepta}
              onChange={(e) => setAcepta(e.target.checked)}
              className="accent-brand"
            />
            Acepto los términos y la política de privacidad
          </label>

          {error && (
            <p
              role="alert"
              className="text-sm text-crit bg-crit/10 border border-crit/30 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={enviando}>
            <UserPlus className="w-4 h-4" aria-hidden />
            Crear cuenta
          </button>
        </form>

        <p className="text-sm text-t2 text-center mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-brand-3 font-semibold">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
