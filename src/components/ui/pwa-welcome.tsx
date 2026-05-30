import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '@/stores/useToastStore';

const STORAGE_KEY = 'myeco-pwa-welcomed';

export function PwaWelcome() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const shown = useRef(false);

  useEffect(() => {
    // Only run once
    if (shown.current) return;
    shown.current = true;

    // Check if running in standalone mode (installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || (window.navigator as any).standalone === true; // iOS Safari

    if (!isStandalone) return;

    // Check if we already showed the welcome toast for this install
    const alreadyWelcomed = localStorage.getItem(STORAGE_KEY);
    if (alreadyWelcomed) return;

    // Mark as shown so it only fires once per install
    localStorage.setItem(STORAGE_KEY, 'true');

    // Small delay so the app has time to fully render before the toast appears
    setTimeout(() => {
      addToast({
        title: t('pwaInstall.welcomeBack'),
        message: t('pwaInstall.welcomeBackDesc'),
        variant: 'success',
        duration: 5000,
      });
    }, 1000);
  }, [t, addToast]);

  return null;
}
