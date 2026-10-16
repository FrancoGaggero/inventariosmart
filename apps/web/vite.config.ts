import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // three y el motor de las escenas en un solo chunk con nombre estable (landing-3d D1);
        // verificar-chunks.mjs igual lo encuentra por firma, no por nombre.
        codeSplitting: {
          groups: [
            {
              name: 'tres',
              test: /node_modules[\\/](\.pnpm[\\/]three@[^\\/]+[\\/]node_modules[\\/])?three[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
