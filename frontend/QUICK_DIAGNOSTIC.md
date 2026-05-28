# Quick Diagnostic - Run in Console

Open your app at `http://localhost:5173`, then open DevTools Console and run this:

```javascript
(async () => {
  console.log("=== PWA Diagnostic ===");

  // 1. Service Worker
  const reg = await navigator.serviceWorker.getRegistration();
  console.log("1. SW Registered:", !!reg);
  console.log("2. SW Active:", !!reg?.active);
  console.log("3. SW Controlling:", !!navigator.serviceWorker.controller);

  // 2. Manifest
  try {
    const m = await fetch("/manifest.webmanifest").then((r) => r.json());
    console.log("4. Manifest:", m.name);
    console.log("5. Icons:", m.icons?.length);
  } catch (e) {
    console.log("4. Manifest: ERROR", e);
  }

  // 3. Icons
  const icon1 = await fetch("/pwa-192x192.png").then((r) => r.ok);
  const icon2 = await fetch("/pwa-512x512.png").then((r) => r.ok);
  console.log("6. Icon 192:", icon1);
  console.log("7. Icon 512:", icon2);

  console.log("=== End Diagnostic ===");
})();
```

**Copy the output and share it!**
