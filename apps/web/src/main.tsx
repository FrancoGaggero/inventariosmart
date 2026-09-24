import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Providers } from './app/providers';
import { router } from './app/router';
import { aplicarTema, leerTema } from './lib/tema';
import './index.css';

// El tema se aplica antes del primer render para evitar el destello (design D2).
aplicarTema(leerTema());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
