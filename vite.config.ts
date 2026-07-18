import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version?: string };
const buildTimestamp = new Date();
const buildTimestampIso = buildTimestamp.toISOString();
const buildVersionFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
});

const formatBuildVersionTimestamp = (value: Date): string => {
  const parts = Object.fromEntries(
    buildVersionFormatter
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
};

const packageVersionDigits = (packageJson.version ?? '0.0.0').replace(/\D/g, '') || '000';
const buildVersion = `${packageVersionDigits}${formatBuildVersionTimestamp(buildTimestamp)}`;

const defaultDevApiProxyTarget = 'https://www.easybake.top';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const devApiProxyTarget = env.VITE_DEV_API_PROXY_TARGET.trim() || defaultDevApiProxyTarget;

  return {
    base: './',
    define: {
      __APP_BUILD_VERSION__: JSON.stringify(buildVersion),
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'app-version-manifest',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify(
              {
                generatedAt: buildTimestampIso,
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
            react: ['react', 'react-dom', 'react-router-dom'],
            state: ['@tanstack/react-query', 'zustand', 'zod'],
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          changeOrigin: true,
          secure: false,
          target: devApiProxyTarget,
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
  };
});
