/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of apps/api, e.g. http://localhost:3001. Never hardcode this —
   * always read it from here. Vite only exposes env vars prefixed with
   * VITE_ to client code, so the underlying var is VITE_API_BASE_URL.
   */
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
