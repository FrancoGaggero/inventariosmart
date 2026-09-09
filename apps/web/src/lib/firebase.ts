import { getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const requerida = (nombre: string): string => {
  const valor = import.meta.env[nombre] as string | undefined;
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre} (ver apps/web/.env.example)`);
  return valor;
};

const config = {
  apiKey: requerida('VITE_FIREBASE_API_KEY'),
  authDomain: requerida('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requerida('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requerida('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requerida('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requerida('VITE_FIREBASE_APP_ID'),
};

export const firebaseApp = getApps()[0] ?? initializeApp(config);
export const firebaseAuth = getAuth(firebaseApp);
firebaseAuth.languageCode = 'es';

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
