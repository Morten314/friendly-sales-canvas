import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "@/shared/styles/index.css";
import "@/shared/styles/scrollbar-hide.css";
import App from "./App.tsx";

function isLovableHostedPreview(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com");
}

function unregisterServiceWorkers(): void {
  if (!("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => {
      void r.unregister();
    });
  });
}

// PWA service workers break Lovable's iframe preview (workbox cache conflicts + stale bundles).
const shouldRegisterPwa = import.meta.env.PROD && !isLovableHostedPreview();

if (shouldRegisterPwa) {
  registerSW({
    onNeedRefresh() {
      console.log("New content available, please refresh.");
    },
    onOfflineReady() {
      console.log("App ready to work offline");
    },
  });
} else {
  unregisterServiceWorkers();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
