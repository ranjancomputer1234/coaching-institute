import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '');
  const apiBase = env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3333';
  const port = Number(process.env.PORT || env.VITE_DEV_PORT || 5173);

  return {
    envDir: rootDir,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
    server: {
      // Railway sets PORT and reaches the container from outside localhost.
      host: process.env.PORT ? true : 'localhost',
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiBase,
          changeOrigin: true,
        },
      },
    },
  };
});
