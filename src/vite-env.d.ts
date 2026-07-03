/// <reference types="vite/client" />

declare const __APP_BUILD_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
