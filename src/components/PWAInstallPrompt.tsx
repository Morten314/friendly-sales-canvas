import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

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
      setShowInstallButton(false);
      
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
        // Keep the prompt hidden
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
      console.log('✅ beforeinstallprompt event fired!');
    };

    window.addEventListener('beforeinstallprompt', handler);
    console.log('📡 Listening for beforeinstallprompt event...');

    // Show install button immediately - it will update when beforeinstallprompt fires
    // This gives better UX as the button appears right away
    setShowInstallButton(true);
    
    // Also set a fallback timer in case beforeinstallprompt takes longer
    const timer = setTimeout(() => {
      if (!isInstalled && !deferredPrompt) {
        // Show install button even if beforeinstallprompt didn't fire yet (iOS case or delayed prompt)
        setShowInstallButton(true);
      }
    }, 3000);

    // Listen for app installed event
    const installedHandler = () => {
      setIsInstalled(true);
      setShowInstallButton(false);
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
  }, [isInstalled, deferredPrompt]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Use browser's install prompt
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setShowInstallButton(false);
          setIsInstalled(true);
          // Save installation status to localStorage
          localStorage.setItem('pwa-installed', 'true');
        }
      } catch (error) {
        console.error('Install prompt error:', error);
      }
      
      setDeferredPrompt(null);
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

  if (isInstalled || !showInstallButton) return null;

  // Detect mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                   window.innerWidth < 768;

  return (
    <div 
      onClick={handleInstallClick}
      style={{
        position: 'fixed',
        bottom: isMobile ? '16px' : '20px',
        right: isMobile ? '16px' : '20px',
        left: isMobile ? '16px' : 'auto', // Mobile: full width with margins
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        color: 'white',
        padding: isMobile ? '14px 18px' : '16px 24px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        maxWidth: isMobile ? 'none' : '320px', // Mobile: full width, Desktop: max width
        transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.2s',
        // Mobile optimizations
        touchAction: 'manipulation', // Better touch response
        WebkitTapHighlightColor: 'transparent', // Remove tap highlight on iOS
        minHeight: '56px', // Minimum touch target size (accessibility standard)
        userSelect: 'none', // Prevent text selection on tap
      }}
      onMouseEnter={(e) => {
        if (window.matchMedia('(hover: hover)').matches) {
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
        e.currentTarget.style.transform = 'scale(0.98)';
        e.currentTarget.style.opacity = '0.9';
      }}
      onTouchEnd={(e) => {
        setTimeout(() => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.opacity = '1';
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
        style={{ flexShrink: 0 }} // Prevent icon from shrinking
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}> {/* Allow text to shrink if needed */}
        <div style={{ 
          fontWeight: '600', 
          fontSize: isMobile ? '15px' : '14px', 
          lineHeight: '1.3' 
        }}>
          {deferredPrompt ? 'Install App' : 'Install Instructions'}
        </div>
        <div style={{ 
          fontSize: isMobile ? '13px' : '12px', 
          opacity: 0.9, 
          lineHeight: '1.3', 
          marginTop: '2px' 
        }}>
          {deferredPrompt ? 'Add to home screen' : (isMobile ? 'Tap for instructions' : 'Click for instructions')}
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;

