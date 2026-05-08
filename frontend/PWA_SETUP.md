# PWA Setup Instructions

## Step 1: Install Dependencies

First, install all dependencies including the PWA plugin:

```bash
cd friendly-sales-canvas
npm install
```

## Step 2: PWA Registration

The PWA registration is already enabled in `src/main.tsx` with `registerSW`. The service worker will automatically register when you run the app.

## Step 3: Generate PWA Icons

1. Open `public/generate-icons.html` in your browser
2. Click the generate buttons for each icon size
3. The icons will be automatically downloaded
4. Save the downloaded icons in the `public` folder:
   - `pwa-192x192.png`
   - `pwa-512x512.png`
   - `apple-touch-icon.png`

**Note:** If you don't generate icons, the app will fallback to using `favicon.ico`, but proper PWA icons are recommended for the best experience.

## Step 4: Build and Test

```bash
npm run build
npm run preview
```

## Step 5: Test Installation

- **Desktop**: Look for install icon in browser address bar or use the "Install App" button on the login page
- **Mobile**: Use "Add to Home Screen" option or the install button
- The install prompt will show when installation is available

## Troubleshooting

If you see "Failed to resolve import 'virtual:pwa-register'":
1. Make sure you ran `npm install`
2. Check that `vite-plugin-pwa` is in `package.json`
3. Restart the dev server: `npm run dev`

If the install button doesn't appear:
- Make sure you're accessing via `localhost` or HTTPS
- Check browser console for service worker registration messages
- The button appears automatically in development mode after a few seconds

## Current Status

✅ PWA plugin installed and configured
✅ Service worker registration enabled
✅ Install button added to login page
✅ Manifest configured
✅ Workbox caching configured


