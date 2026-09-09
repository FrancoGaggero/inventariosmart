import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
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
