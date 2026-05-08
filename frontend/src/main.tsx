import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './styles/scrollbar-hide.css'
import App from './App.tsx'

// PWA Service Worker Registration
// Important: avoid stale cached assets during Lovable preview/dev.
if (import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      console.log('New content available, please refresh.')
    },
    onOfflineReady() {
      console.log('App ready to work offline')
    },
  })
} else {
  // If a service worker was registered previously, it can keep serving old bundles.
  // Unregister in dev to ensure the preview always reflects the latest code.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister())
    })
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
