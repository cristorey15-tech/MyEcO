import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToastStore } from '@/stores/useToastStore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Track globally whether the prompt has been dismissed this session
let sessionDismissed = false;

export function InstallBanner() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);

  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    // Check if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setAlreadyInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const onInstalled = () => {
      setDeferredPrompt(null);
      setAlreadyInstalled(true);
      addToast({
        title: t('pwaInstall.installed'),
        message: t('pwaInstall.installedDesc'),
        variant: 'success',
        duration: 6000,
      });
    };

    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Also check display mode on change (when installed mid-session)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handler = () => {
      if (mediaQuery.matches) {
        setDeferredPrompt(null);
        setAlreadyInstalled(true);
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    // If dismissed, keep the prompt for later if user changes mind
    // (Chrome only allows one prompt() call, so a new beforeinstallprompt will fire next page load)
    if (outcome === 'dismissed') {
      setDeferredPrompt(null);
      sessionDismissed = true;
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionDismissed = true;
  };

  // Don't show if already installed, no prompt, dismissed this session, or manually dismissed
  if (alreadyInstalled || !deferredPrompt || dismissed || sessionDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 z-50 max-w-sm mx-auto lg:mx-0 lg:left-auto lg:right-4">
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 animate-slide-up">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-0.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label={t('common.close')}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          {/* App icon */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg className="w-6 h-6 text-white" viewBox="0 0 48 46" fill="none">
              <path d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z" fill="currentColor"/>
            </svg>
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('pwaInstall.title')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t('pwaInstall.description')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            onClick={handleInstall}
            disabled={installing}
            className="flex-1"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {installing ? t('common.loading') : t('pwaInstall.install')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-gray-500"
          >
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
