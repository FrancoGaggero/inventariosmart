import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { firebaseAuth, googleProvider } from './firebase';

interface AuthState {
  /** Usuario de Firebase; null sin sesión. */
  user: User | null;
  /** true mientras Firebase restaura la sesión al cargar la página. */
  cargando: boolean;
  loginConGoogle: () => Promise<void>;
  loginConEmail: (email: string, password: string) => Promise<void>;
  registrarConEmail: (email: string, password: string, nombre?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      setCargando(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      cargando,
      loginConGoogle: async () => {
        await signInWithPopup(firebaseAuth, googleProvider);
      },
      loginConEmail: async (email, password) => {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      },
      registrarConEmail: async (email, password, nombre) => {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (nombre) await updateProfile(cred.user, { displayName: nombre });
      },
      logout: () => signOut(firebaseAuth),
    }),
    [user, cargando],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

/** ID token vigente del usuario actual (Firebase lo renueva solo), o null sin sesión. */
export async function obtenerIdToken(): Promise<string | null> {
  const u = firebaseAuth.currentUser;
  return u ? u.getIdToken() : null;
}

const MENSAJES_FIREBASE: Record<string, string> = {
  'auth/invalid-credential': 'El email o la contraseña no son correctos.',
  'auth/invalid-email': 'El email no tiene un formato válido.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese email. Probá iniciar sesión.',
  'auth/weak-password': 'La contraseña tiene que tener al menos 8 caracteres.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  'auth/popup-blocked':
    'El navegador bloqueó la ventana de Google. Permití las ventanas emergentes.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos y volvé a probar.',
  'auth/network-request-failed': 'Sin conexión. Revisá tu red e intentá de nuevo.',
};

/** Mensaje en español para un error de Firebase Auth. */
export function mensajeFirebase(
  err: unknown,
  porDefecto = 'No pudimos completar la operación.',
): string {
  const code =
    typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  return MENSAJES_FIREBASE[code] ?? porDefecto;
}
