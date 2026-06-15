# PWA Installation: Dev Mode vs Preview Mode

## The Difference

### `npm run dev` (Development Mode)

- **Service Worker**: Runs in development mode with hot-reload capabilities
- **Service Worker Activation**: May take longer to activate or may not fully activate
- **PWA Installation**: The `beforeinstallprompt` event may not fire reliably because:
  - The browser is more strict about PWA installation in dev mode
  - The service worker might not be fully active when the page loads
  - Development service workers are less optimized and may not meet all PWA requirements immediately
- **Install Button Behavior**: Shows "Install Instructions" if `beforeinstallprompt` doesn't fire

### `npm run build` + `npm run preview` (Production Preview)

- **Service Worker**: Properly built and optimized service worker
- **Service Worker Activation**: Activates quickly and reliably
- **PWA Installation**: The `beforeinstallprompt` event fires reliably because:
  - The service worker is fully built and optimized
  - All PWA requirements are met (manifest, icons, service worker)
  - The browser recognizes it as a proper installable PWA
- **Install Button Behavior**: Shows "Install App" and triggers the native install prompt

## Why This Happens

Browsers require several conditions to be met before firing the `beforeinstallprompt` event:

1. ✅ Valid manifest exists
2. ✅ Service worker is registered and **active**
3. ✅ Proper PNG icons exist (192x192 and 512x512)
4. ✅ Site is served over HTTPS or localhost
5. ✅ User has engaged with the site
6. ✅ App hasn't been dismissed before

In **dev mode**, condition #2 (service worker active) may not be met immediately, or the browser may be more strict about recognizing the PWA as installable.

In **preview mode**, all conditions are met reliably because the service worker is properly built and activated.

## What We've Fixed

We've improved the `PWAInstallPrompt` component to:

1. **Wait for Service Worker**: The component now waits for the service worker to be active before expecting the `beforeinstallprompt` event
2. **Better Logging**: Added comprehensive logging to help debug PWA installation issues
3. **Improved Service Worker Registration**: Enhanced the service worker registration in `main.tsx` with better logging and state tracking

## Testing

### To test in Dev Mode:

```bash
npm run dev
```

- Open browser console and look for PWA logs
- Wait for "Service Worker is active" message
- The install button should appear after 3 seconds
- If `beforeinstallprompt` fires, the button will say "Install App" and work directly
- If it doesn't fire, the button will show "Install Instructions"

### To test in Preview Mode (Recommended):

```bash
npm run build
npm run preview
```

- The install button should work immediately
- The `beforeinstallprompt` event should fire reliably
- Clicking the button will trigger the native browser install prompt

## Troubleshooting

If the install button doesn't work in dev mode:

1. **Check Browser Console**: Look for PWA-related logs
   - "PWA: Service Worker registered successfully"
   - "PWA: ✅ Service Worker is active"
   - "PWA: ✅ beforeinstallprompt event fired"

2. **Check Service Worker Status**:
   - Open DevTools → Application tab → Service Workers
   - Verify the service worker is registered and active

3. **Clear Browser Cache**:
   - DevTools → Application tab → Clear storage
   - Hard refresh (Ctrl+Shift+R)

4. **Wait Longer**: In dev mode, the service worker may take 5-10 seconds to fully activate

5. **Use Preview Mode**: For reliable PWA installation testing, always use `npm run build && npm run preview`

## Recommendation

For **development**, use dev mode for regular coding. For **testing PWA installation**, use preview mode (`npm run build && npm run preview`) as it provides a more accurate representation of how the PWA will behave in production.
