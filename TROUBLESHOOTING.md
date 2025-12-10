# PWA Install Troubleshooting - Step by Step

If the install button is not working, follow these steps **in order**:

## Step 1: Complete Browser Reset for localhost:8080

1. **Open DevTools** (F12)
2. Go to **Application** tab
3. In left sidebar, click **Storage**
4. Click **Clear site data** button (this clears everything for localhost:8080)
5. **Close DevTools**
6. **Close the browser tab** completely
7. **Wait 5 seconds**
8. Open a **fresh browser window** (or incognito mode)
9. Navigate to `http://localhost:8080`

## Step 2: Verify Service Worker is Fresh

1. Open DevTools (F12) → **Application** tab
2. Click **Service Workers** in left sidebar
3. You should see:
   - ✅ One service worker registered
   - ✅ Status: "activated and is running"
   - ✅ "Update on reload" should be checked (if available)
4. If you see multiple service workers or old ones:
   - Click **Unregister** on all of them
   - Hard refresh (Ctrl+Shift+R)
   - Wait 10 seconds
   - Check again

## Step 3: Check Console Logs

Look for these messages in the console:

**Good signs:**
- `App ready to work offline`
- `📡 Listening for beforeinstallprompt event...`
- `✅ beforeinstallprompt event fired!`

**Problem signs:**
- No "App ready to work offline" message
- No "Listening for beforeinstallprompt" message
- Errors about service worker

## Step 4: Verify Manifest

1. In DevTools → **Application** tab
2. Click **Manifest** in left sidebar
3. Should show:
   - ✅ Name: "Friendly Sales Canvas"
   - ✅ Icons: 2 icons listed
   - ✅ No errors

## Step 5: Check Icon Files

Verify icons exist and are accessible:
- Open `http://localhost:8080/pwa-192x192.png` in browser
- Open `http://localhost:8080/pwa-512x512.png` in browser
- Both should display (not 404)

## Step 6: Test in Incognito Mode

1. Open **Incognito/Private window**
2. Navigate to `http://localhost:8080`
3. This bypasses all browser cache and extensions
4. Check if install button works here

## Step 7: Compare with Working Project

If the other project works in the same browser:

1. **Check the other project's console logs** - what do you see?
2. **Compare the service worker status** - are they the same?
3. **Check if both use the same port** - maybe try changing this project's port to match?

## Step 8: Nuclear Option - Complete Reset

If nothing works:

1. **Stop the dev server** (Ctrl+C)
2. **Delete node_modules/.vite** folder (if exists)
3. **Clear browser data** for localhost (Step 1)
4. **Restart dev server**: `npm run dev`
5. **Open in incognito mode**
6. **Wait 10 seconds after page loads**
7. **Interact with page** (click, scroll)
8. **Wait another 10 seconds**
9. Check if install button works

## Common Issues

### Issue: "beforeinstallprompt never fires"
**Possible causes:**
- Browser has dismissed prompt before (clear browser data)
- Service worker not fully active (wait longer)
- Need user interaction first (click on page)
- Browser extension interfering (test in incognito)

### Issue: "Install button shows but clicking does nothing"
**Possible causes:**
- deferredPrompt is null (check console)
- Browser blocked the prompt (check browser settings)
- Already installed (check if app is in standalone mode)

### Issue: "Works in other project but not this one"
**Possible causes:**
- Different vite-plugin-pwa version
- Different browser state for this origin
- Different service worker configuration
- Icons not accessible

## What to Report

If it still doesn't work, please share:

1. **Console logs** - copy all messages
2. **Service Worker status** - screenshot or describe
3. **Manifest status** - does it load?
4. **Icon accessibility** - do the URLs work?
5. **Browser and version** - what browser are you using?
6. **Incognito test** - does it work in incognito?


















