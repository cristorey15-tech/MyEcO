import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToastStore } from '@/stores/useToastStore';

export function SwUpdatePrompt() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onOfflineReady() {
      addToast({
        title: t('pwaInstall.offlineReady'),
        message: t('pwaInstall.offlineReadyDesc'),
        variant: 'info',
        duration: 3000,
      });
    },
    onRegistered(r) {
      if (r) {
        console.log('[SW] Registered:', r.scope);
      }
    },
    onRegisterError(err) {
      console.warn('[SW] Registration error:', err);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;

    addToast({
      title: t('pwaInstall.updateAvailable'),
      message: t('pwaInstall.updateAvailableDesc'),
      variant: 'info',
      duration: 4000,
    });

    // Auto-update after toast duration
    const timer = setTimeout(() => {
      updateServiceWorker(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, [needRefresh, updateServiceWorker, addToast, t]);

  return null;
}
