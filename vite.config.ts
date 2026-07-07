import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import { handleAuthGatewayRequest } from './server/pocketbase-auth-bff';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version?: string };
const buildTimestamp = new Date().toISOString();
const buildVersion = `${packageJson.version ?? '0.0.0'}-${buildTimestamp}`;

export default defineConfig({
  base: './',
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    react(),
    {
      name: 'pocketbase-auth-bff-dev',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
          const isAuthGatewayRequest =
            requestUrl.pathname === '/api/health' || requestUrl.pathname.startsWith('/api/auth/');

          if (!isAuthGatewayRequest) {
            next();
            return;
          }

          void handleAuthGatewayRequest(request, response);
        });
      },
    },
    {
      name: 'app-version-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify(
            {
              generatedAt: buildTimestamp,
              version: buildVersion,
            },
            null,
            2,
          ),
        });
      },
    },
  ],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          antd: ['antd', '@ant-design/icons'],
          react: ['react', 'react-dom', 'react-router-dom'],
          state: ['@tanstack/react-query', 'zustand', 'zod'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.ts',
    css: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
