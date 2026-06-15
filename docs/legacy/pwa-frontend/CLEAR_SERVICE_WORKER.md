# Clear Service Worker Cache - Troubleshooting Guide

If the PWA install button is not working consistently, you likely have a stale service worker cache. Follow these steps:

## Method 1: Clear via Browser DevTools (Recommended)

1. **Open DevTools** (F12)
2. Go to **Application** tab
3. In the left sidebar, click **Service Workers**
4. Click **Unregister** for any registered service workers
5. Go to **Storage** in the left sidebar
6. Click **Clear site data** (or individually clear):
   - Cache Storage
   - Service Workers
   - Local Storage
   - Session Storage
7. **Hard refresh** the page (Ctrl+Shift+R or Cmd+Shift+R)

## Method 2: Clear via Browser Settings

1. Open browser settings
2. Go to **Privacy and security** → **Site settings**
3. Find your localhost site
4. Clear all data
5. Restart the browser

## Method 3: Use Incognito/Private Mode

1. Open a new incognito/private window
2. Navigate to `http://localhost:8080`
3. This will bypass any cached service workers

## Method 4: Programmatic Unregister (Temporary Fix)

Open browser console and run:

```javascript
navigator.serviceWorker.getRegistrations().then(function (registrations) {
  for (let registration of registrations) {
    registration.unregister();
  }
});
```

Then hard refresh the page.

## After Clearing

1. Restart your dev server: `npm run dev`
2. Open the app in a fresh browser window
3. Wait 2-3 seconds for the service worker to register
4. Check console for "App ready to work offline"
5. The install button should now work properly

## Verify Service Worker Status

In DevTools → Application → Service Workers, you should see:

- ✅ Service worker is registered
- ✅ Status: activated and is running
- ✅ No errors in the console
