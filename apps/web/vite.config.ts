import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, repositoryRoot, 'VITE_');

  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    envDir: repositoryRoot,
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: ['.e2b.app', 'localhost'],
      proxy: {
        '/api': {
          target: environment.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: ['.e2b.app', 'localhost'],
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      clearMocks: true,
    },
  };
});
