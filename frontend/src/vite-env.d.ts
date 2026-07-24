/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Base for the client API stack: `/api` in local dev (Vite proxy), or the
  // full backend URL in deployed environments. See src/shared/api/transport.ts.
  readonly VITE_API_BASE_URL: string;
  // Deployed backend host for raw direct-backend calls and the dev proxy target.
  readonly VITE_BACKEND_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "virtual:pwa-register" {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

declare module "virtual:pwa-register/react" {
  import type { RegisterSWOptions } from "virtual:pwa-register";
  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, (reloadPage?: boolean) => Promise<void>];
    offlineReady: [boolean, () => void];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
