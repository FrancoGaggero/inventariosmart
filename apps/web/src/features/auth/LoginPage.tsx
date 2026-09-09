import { BarChart3, LogIn } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/lib/auth';

const MENSAJES: Record<string, string> = {
  'auth/invalid-credential': 'El email o la contraseña no son correctos.',
  'auth/invalid-email': 'El email no tiene un formato válido.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos y volvé a probar.',
};

function mensajeDeError(err: unknown): string {
  const code =
    typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  return MENSAJES[code] ?? 'No pudimos iniciar sesión. Intentá de nuevo.';
}

export function LoginPage() {
  const { user, cargando, loginConGoogle, loginConEmail } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (cargando) return null;
  if (user) {
    const destino = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={destino} replace />;
  }

  const ejecutar = async (fn: () => Promise<void>) => {
    setError(null);
    setEnviando(true);
    try {
      await fn();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ejecutar(() => loginConEmail(email, password));
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
          Tu stock y tus <span className="text-brand-3">números reales</span>, en un solo lugar.
        </h1>
        <p className="text-t2 text-sm mb-6">Entrá a tu panel.</p>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <label className="block">
            <span className="block text-xs font-semibold text-t2 mb-1.5">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-[#070C16] border border-white/12 px-4 py-3 text-sm outline-none focus:border-brand-2 focus:ring-4 focus:ring-brand/15"
              placeholder="carlos@repuestoscarlos.com.ar"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-t2 mb-1.5">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-[#070C16] border border-white/12 px-4 py-3 text-sm outline-none focus:border-brand-2 focus:ring-4 focus:ring-brand/15"
              placeholder="••••••••••"
            />
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
            <LogIn className="w-4 h-4" aria-hidden />
            Iniciar sesión
          </button>
        </form>

        <div className="flex items-center gap-3 my-4 text-xs text-t3">
          <span className="flex-1 h-px bg-white/10" />o<span className="flex-1 h-px bg-white/10" />
        </div>

        <button
          type="button"
          className="btn btn-ghost w-full"
          disabled={enviando}
          onClick={() => void ejecutar(loginConGoogle)}
        >
          <GoogleIcon />
          Continuar con Google
        </button>

        <p className="text-xs text-t3 text-center mt-8">
          Sprint 0 · el registro del comercio llega con la historia HU-11.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z"
      />
      <path
        fill="#FBBC04"
        d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.3c-1.7 3.4-1.7 7.4 0 10.8l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-5 6.7-5z"
      />
    </svg>
  );
}
