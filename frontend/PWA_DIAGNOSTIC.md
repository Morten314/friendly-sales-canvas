# PWA Diagnostic Tool

Run this in your browser console (F12 → Console tab) to diagnose PWA installation issues:

```javascript
(async function diagnosePWA() {
  console.group('🔍 PWA Diagnostic Report');

  // 1. Check Service Worker Support
  const swSupported = 'serviceWorker' in navigator;
  console.log('1. Service Worker Support:', swSupported ? '✅ Yes' : '❌ No');

  // 2. Check HTTPS/Localhost
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  console.log('2. Secure Context (HTTPS/Localhost):', isSecure ? '✅ Yes' : '❌ No');

  // 3. Check Service Worker Registration
  let swRegistered = false;
  let swActive = false;
  let swControlling = false;
  if (swSupported) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      swRegistered = !!registration;
      swActive = !!registration?.active;
      swControlling = !!navigator.serviceWorker.controller;
      console.log('3. Service Worker Registered:', swRegistered ? '✅ Yes' : '❌ No');
      console.log('4. Service Worker Active:', swActive ? '✅ Yes' : '❌ No');
      console.log('5. Service Worker Controlling:', swControlling ? '✅ Yes' : '❌ No');
      if (registration) {
        console.log('   - Scope:', registration.scope);
        console.log('   - Installing:', !!registration.installing);
        console.log('   - Waiting:', !!registration.waiting);
      }
    } catch (error) {
      console.error('   Error:', error);
    }
  }

  // 6. Check Manifest
  let manifestFound = false;
  let manifestValid = false;
  try {
    const manifestResponse = await fetch('/manifest.webmanifest');
    manifestFound = manifestResponse.ok;
    if (manifestFound) {
      const manifest = await manifestResponse.json();
      manifestValid = !!manifest.name && !!manifest.icons && manifest.icons.length > 0;
      console.log('6. Manifest Found:', '✅ Yes');
      console.log('7. Manifest Valid:', manifestValid ? '✅ Yes' : '❌ No');
      console.log('   - Name:', manifest.name);
      console.log('   - Icons:', manifest.icons?.length || 0);
    } else {
      console.log('6. Manifest Found:', '❌ No (Status:', manifestResponse.status, ')');
    }
  } catch (error) {
    console.log('6. Manifest Found:', '❌ Error:', error.message);
  }

  // 8. Check Icons
  const iconPaths = ['/pwa-192x192.png', '/pwa-512x512.png'];
  console.log('8. Icon Check:');
  for (const iconPath of iconPaths) {
    try {
      const iconResponse = await fetch(iconPath);
      console.log(`   ${iconPath}:`, iconResponse.ok ? '✅ Found' : '❌ Not Found');
    } catch (error) {
      console.log(`   ${iconPath}:`, '❌ Error');
    }
  }

  // 9. Check if Already Installed
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isInstalled = isStandalone || isIOSStandalone;
  console.log('9. Already Installed:', isInstalled ? '✅ Yes' : '❌ No');

  // 10. Check User Engagement (browser requirement)
  console.log('10. User Engagement:', '✅ Required (interact with page)');

  // Summary
  console.groupEnd();
  console.group('📊 Summary');
  const allChecks = [
    swSupported,
    isSecure,
    swRegistered,
    swActive,
    manifestFound,
    manifestValid
  ];
  const passedChecks = allChecks.filter(Boolean).length;
  const totalChecks = allChecks.length;

  console.log(`Passed: ${passedChecks}/${totalChecks} checks`);

  if (swActive && manifestValid && isSecure && !isInstalled) {
    console.log('✅ All requirements met! beforeinstallprompt should fire.');
    console.log('⚠️  If it doesn\'t fire, try:');
    console.log('   1. Interact with the page (click, scroll, etc.)');
    console.log('   2. Wait 5-10 seconds');
    console.log('   3. Check if you dismissed the prompt before');
  } else {
    console.log('❌ Some requirements not met. Issues:');
    if (!swActive) console.log('   - Service Worker not active');
    if (!manifestValid) console.log('   - Manifest invalid or missing');
    if (!isSecure) console.log('   - Not in secure context');
  }
  console.groupEnd();
})();
```

## How to Use

1. Open your app in the browser (`http://localhost:8080`)
2. Open DevTools (F12)
3. Go to the **Console** tab
4. Copy and paste the entire diagnostic script above
5. Press Enter
6. Review the output to see what's missing

## What to Look For

- ✅ All checks should pass
- The most important checks are:
  - Service Worker Active: ✅ Yes
  - Manifest Valid: ✅ Yes
  - Secure Context: ✅ Yes

If all checks pass but `beforeinstallprompt` still doesn't fire:

- The browser might have dismissed the prompt before (clear browser data)
- You need to interact with the page first
- Wait a few seconds after page load
