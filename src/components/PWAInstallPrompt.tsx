import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallPromptProps {
  variant?: 'fixed' | 'header';
}

const PWAInstallPrompt = ({ variant = 'header' }: PWAInstallPromptProps) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isLikelyInstallable, setIsLikelyInstallable] = useState(false);
  const isMobile = useIsMobile();
  
  // Track current pathname for fixed variant visibility
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : ''
  );
  
  // Listen for pathname changes (for fixed variant)
  useEffect(() => {
    if (variant === 'fixed') {
      const updatePath = () => {
        setCurrentPath(window.location.pathname);
      };
      
      // Update on initial load
      updatePath();
      
      // Listen for popstate (back/forward navigation)
      window.addEventListener('popstate', updatePath);
      
      // Poll for pathname changes (since we can't use useLocation)
      const interval = setInterval(updatePath, 100);
      
      return () => {
        window.removeEventListener('popstate', updatePath);
        clearInterval(interval);
      };
    }
  }, [variant]);
  
  const isLoginPage = currentPath === '/login';
  const shouldShowFixed = variant === 'fixed' && isLoginPage;
  
  // Check if app is likely installable (has manifest, service worker, etc.)
  useEffect(() => {
    const checkInstallability = async () => {
      try {
        // Check if manifest exists
        const manifestLink = document.querySelector('link[rel="manifest"]');
        const hasManifest = !!manifestLink;
        
        // Check if service worker is registered
        let hasServiceWorker = false;
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          hasServiceWorker = registrations.length > 0;
        }
        
        // Check if running on HTTPS or localhost
        const isSecure = window.location.protocol === 'https:' || 
                        window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';
        
        // If all criteria are met, app is likely installable
        if (hasManifest && hasServiceWorker && isSecure) {
          setIsLikelyInstallable(true);
        }
      } catch (error) {
        console.error('Error checking installability:', error);
      }
    };
    
    checkInstallability();
  }, []);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      // Save to localStorage for future reference
      localStorage.setItem('pwa-installed', 'true');
      return;
    }

    // Check localStorage for previous installation
    const wasInstalled = localStorage.getItem('pwa-installed') === 'true';
    if (wasInstalled) {
      // App was previously installed, but user is accessing via browser
      // Check if browser still considers it installable
      // If beforeinstallprompt doesn't fire within a short time, it's likely already installed
      setIsInstalled(true);
      setShowInstallButton(true); // Always show button in header
      
      // Still listen for beforeinstallprompt to detect if it's actually not installed
      const checkHandler = (e: Event) => {
        // If beforeinstallprompt fires, it means app is NOT installed
        // So we should show the prompt
        e.preventDefault();
        const promptEvent = e as BeforeInstallPromptEvent;
        setDeferredPrompt(promptEvent);
        setIsInstalled(false);
        setShowInstallButton(true);
        console.log('✅ beforeinstallprompt fired - app is not installed');
      };
      
      window.addEventListener('beforeinstallprompt', checkHandler);
      
      // Wait a bit to see if beforeinstallprompt fires
      const checkTimer = setTimeout(() => {
        // If beforeinstallprompt didn't fire, app is likely already installed
        window.removeEventListener('beforeinstallprompt', checkHandler);
      }, 2000);
      
      return () => {
        window.removeEventListener('beforeinstallprompt', checkHandler);
        clearTimeout(checkTimer);
      };
    }

    // Set up event listener immediately - browser will fire when ready
    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setShowInstallButton(true);
      setIsLikelyInstallable(true); // If beforeinstallprompt fires, definitely installable
      console.log('✅ beforeinstallprompt event fired!');
    };

    window.addEventListener('beforeinstallprompt', handler);
    console.log('📡 Listening for beforeinstallprompt event...');

    // Show install button immediately - it will update when beforeinstallprompt fires
    // This gives better UX as the button appears right away
    setShowInstallButton(true);
    
    // Wait longer for beforeinstallprompt to fire before assuming it won't
    // This helps show "Install App" instead of "Install Instructions" more often
    const timer = setTimeout(() => {
      if (!isInstalled && !deferredPrompt && isLikelyInstallable) {
        // If app is likely installable but beforeinstallprompt hasn't fired,
        // it might be delayed or user dismissed it before. Still show "Install App"
        setShowInstallButton(true);
      }
    }, 5000); // Increased from 3000 to 5000ms

    // Listen for app installed event
    const installedHandler = () => {
      setIsInstalled(true);
      setShowInstallButton(true); // Keep button visible in header
      setDeferredPrompt(null);
      // Save installation status to localStorage
      localStorage.setItem('pwa-installed', 'true');
      console.log('✅ App installed - saved to localStorage');
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      clearTimeout(timer);
    };
  }, [isInstalled, deferredPrompt, isLikelyInstallable]);

  const handleInstallClick = async () => {
    // Use native prompt if deferredPrompt is available
    if (deferredPrompt) {
      // Use browser's install prompt - this is the native install prompt
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setShowInstallButton(true); // Keep button visible
          setIsInstalled(true);
          // Save installation status to localStorage
          localStorage.setItem('pwa-installed', 'true');
        }
      } catch (error) {
        console.error('Install prompt error:', error);
        // If prompt fails, show instructions as fallback
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (isIOS) {
          alert(`📱 Install on iPhone/iPad:\n\n1. Tap the Share button (square with arrow) at the bottom\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" in the top right\n\nYour app will appear on your home screen!`);
        } else if (isAndroid) {
          alert(`📱 Install on Android:\n\n1. Tap the menu (3 dots) in your browser\n2. Select "Install app" or "Add to Home Screen"\n\nOR look for the install banner at the top of your screen!`);
        } else {
          alert('To install:\n1. Look for the install icon (➕) in your browser\'s address bar\n2. Or use the browser menu to "Install app"');
        }
      }
      
      setDeferredPrompt(null);
    } else if (isLikelyInstallable) {
      // App is installable but beforeinstallprompt didn't fire (maybe user dismissed it before)
      // Show instructions but indicate the app can be installed
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      
      if (isIOS) {
        alert(`📱 Install on iPhone/iPad:\n\n1. Tap the Share button (square with arrow) at the bottom\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" in the top right\n\nYour app will appear on your home screen!`);
      } else if (isAndroid) {
        alert(`📱 Install on Android:\n\n1. Tap the menu (3 dots) in your browser\n2. Select "Install app" or "Add to Home Screen"\n\nOR look for the install banner at the top of your screen!`);
      } else {
        alert('To install:\n1. Look for the install icon (➕) in your browser\'s address bar\n2. Or use the browser menu to "Install app"\n\nIf you don\'t see the install option, try refreshing the page.');
      }
    } else {
      // Manual install instructions with better mobile detection
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      
      if (isIOS) {
        const instructions = `📱 Install on iPhone/iPad:\n\n1. Tap the Share button (square with arrow) at the bottom\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" in the top right\n\nYour app will appear on your home screen!`;
        alert(instructions);
      } else if (isAndroid) {
        const instructions = `📱 Install on Android:\n\n1. Tap the menu (3 dots) in your browser\n2. Select "Install app" or "Add to Home Screen"\n\nOR look for the install banner at the top of your screen!`;
        alert(instructions);
      } else {
        alert('To install:\n1. Look for the install icon in your browser\'s address bar\n2. Or use the browser menu to "Install app"');
      }
    }
  };

  // Hide button if installed and in header mode
  if (variant === 'header' && isInstalled) {
    return null;
  }

  // For fixed variant, only show on login page
  if (variant === 'fixed') {
    if (currentPath !== '/login') {
      return null; // Don't show on any page other than /login
    }
    if (!showInstallButton) {
      return null;
    }
  }

  // Fixed variant - render as fixed bottom-right button (for login/signup pages)
  if (variant === 'fixed' && shouldShowFixed) {
    // Show "Install App" if we have deferredPrompt OR if app is likely installable
    // This way it shows "Install App" even if beforeinstallprompt hasn't fired yet
    const canInstall = deferredPrompt || isLikelyInstallable;
    const buttonText = isInstalled 
      ? 'Installed'
      : (canInstall 
        ? 'Install App'
        : 'Install Instructions');
    
    const subtitleText = canInstall 
      ? 'Add to home screen'
      : (isMobile ? 'Tap for instructions' : 'Click for instructions');

    return (
      <div 
        onClick={handleInstallClick}
        style={{
          position: 'fixed',
          bottom: isMobile ? '16px' : '20px',
          right: isMobile ? '16px' : '20px',
          left: isMobile ? '16px' : 'auto',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: 'white',
          padding: isMobile ? '14px 18px' : '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: isInstalled ? 'not-allowed' : 'pointer',
          maxWidth: isMobile ? 'none' : '320px',
          transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.2s',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          minHeight: '56px',
          userSelect: 'none',
          opacity: isInstalled ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isInstalled && window.matchMedia('(hover: hover)').matches) {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 25px rgba(0,0,0,0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (window.matchMedia('(hover: hover)').matches) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
          }
        }}
        onTouchStart={(e) => {
          if (!isInstalled) {
            e.currentTarget.style.transform = 'scale(0.98)';
            e.currentTarget.style.opacity = '0.9';
          }
        }}
        onTouchEnd={(e) => {
          setTimeout(() => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.opacity = isInstalled ? '0.6' : '1';
          }, 100);
        }}
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          style={{ flexShrink: 0 }}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontWeight: '600', 
            fontSize: isMobile ? '15px' : '14px', 
            lineHeight: '1.3' 
          }}>
            {buttonText}
          </div>
          {!isInstalled && (
            <div style={{ 
              fontSize: isMobile ? '13px' : '12px', 
              opacity: 0.9, 
              lineHeight: '1.3', 
              marginTop: '2px' 
            }}>
              {subtitleText}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Header variant - render as header button
  // Show "Install App" if we have deferredPrompt OR if app is likely installable
  const canInstall = deferredPrompt || isLikelyInstallable;
  const buttonText = isInstalled 
    ? (isMobile ? 'Installed' : 'Installed')
    : (canInstall 
      ? (isMobile ? 'Install' : 'Install App')
      : (isMobile ? 'Install' : 'Install'));

  return (
    <Button
      variant={isInstalled ? "outline" : "default"}
      size={isMobile ? "icon" : "sm"}
      onClick={handleInstallClick}
      disabled={isInstalled}
      className="flex items-center gap-2"
      title={isInstalled ? 'App is already installed' : (canInstall ? 'Install app' : 'Install instructions')}
    >
      <Download className="h-4 w-4" />
      {!isMobile && buttonText}
    </Button>
  );
};

export default PWAInstallPrompt;

