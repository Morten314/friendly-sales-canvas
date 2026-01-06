/// <reference types="vite/client" />

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: any) => void
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}

declare module 'virtual:pwa-register/react' {
  import type { RegisterSWOptions } from 'virtual:pwa-register'
  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, (reloadPage?: boolean) => Promise<void>]
    offlineReady: [boolean, () => void]
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  }
}