// PWA Diagnostics Utility
export const checkPWAReadiness = async () => {
  const diagnostics: Record<string, any> = {
    serviceWorkerSupported: 'serviceWorker' in navigator,
    isHTTPS: location.protocol === 'https:' || location.hostname === 'localhost',
    userAgent: navigator.userAgent,
  };

  // Check service worker
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      diagnostics.serviceWorkerRegistered = !!registration;
      diagnostics.serviceWorkerActive = !!registration?.active;
      diagnostics.serviceWorkerScope = registration?.scope;
    } catch (error) {
      diagnostics.serviceWorkerError = error;
    }
  }

  // Check manifest
  try {
    const manifestResponse = await fetch('/manifest.webmanifest');
    if (manifestResponse.ok) {
      const manifest = await manifestResponse.json();
      diagnostics.manifestFound = true;
      diagnostics.manifestName = manifest.name;
      diagnostics.manifestIcons = manifest.icons?.length || 0;
      
      // Check if icons exist
      if (manifest.icons) {
        const iconChecks = await Promise.all(
          manifest.icons.map(async (icon: any) => {
            try {
              const iconResponse = await fetch(icon.src);
              return { src: icon.src, exists: iconResponse.ok, size: icon.sizes };
            } catch {
              return { src: icon.src, exists: false, size: icon.sizes };
            }
          })
        );
        diagnostics.iconStatus = iconChecks;
      }
    } else {
      diagnostics.manifestFound = false;
      diagnostics.manifestError = `Status: ${manifestResponse.status}`;
    }
  } catch (error) {
    diagnostics.manifestError = error;
  }

  // Check if app is already installed
  diagnostics.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  diagnostics.isInWebApp = (window.navigator as any).standalone === true;

  return diagnostics;
};

export const logPWADiagnostics = async () => {
  const diagnostics = await checkPWAReadiness();
  
  console.group('%c🔍 PWA Diagnostics', 'color: #2563eb; font-size: 16px; font-weight: bold');
  console.log('Service Worker:', diagnostics.serviceWorkerSupported ? '✅ Supported' : '❌ Not Supported');
  console.log('Service Worker Registered:', diagnostics.serviceWorkerRegistered ? '✅ Yes' : '❌ No');
  console.log('Service Worker Active:', diagnostics.serviceWorkerActive ? '✅ Yes' : '❌ No');
  console.log('HTTPS/Localhost:', diagnostics.isHTTPS ? '✅ Yes' : '❌ No');
  console.log('Manifest Found:', diagnostics.manifestFound ? '✅ Yes' : '❌ No');
  
  if (diagnostics.manifestIcons) {
    console.log(`Icons in Manifest: ${diagnostics.manifestIcons}`);
    if (diagnostics.iconStatus) {
      diagnostics.iconStatus.forEach((icon: any) => {
        console.log(`  ${icon.exists ? '✅' : '❌'} ${icon.src} (${icon.size})`);
      });
    }
  }
  
  console.log('Already Installed:', diagnostics.isStandalone || diagnostics.isInWebApp ? '✅ Yes' : '❌ No');
  console.log('Full Diagnostics:', diagnostics);
  console.groupEnd();
  
  return diagnostics;
};


