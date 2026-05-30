import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { verifyPin, authenticateBiometric, isBiometricAvailable } from '@/lib/auth';
import { Wallet, Fingerprint, X } from 'lucide-react';

interface LockScreenProps {
  children: React.ReactNode;
}

export function LockScreen({ children }: LockScreenProps) {
  const { t } = useTranslation();
  const { pinHash, pinLength, lockEnabled, biometricEnabled, isLocked, setIsLocked } = useAppStore();
  const [pin, setPin] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    if (biometricEnabled) {
      isBiometricAvailable().then(setBioAvailable);
    }
  }, [biometricEnabled]);

  // Listen for visibility changes to re-lock
  useEffect(() => {
    if (!lockEnabled) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && lockEnabled && pinHash) {
        setIsLocked(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [lockEnabled, pinHash, setIsLocked]);

  // Lock on mount if lock is enabled
  useEffect(() => {
    if (lockEnabled && pinHash) {
      setIsLocked(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDigit = useCallback((digit: string) => {
    setError('');
    setPin(prev => {
      const next = [...prev, digit];
      if (next.length >= pinLength) {
        // Auto-verify when all digits entered
        setTimeout(() => verify(next.join('')), 50);
        return next;
      }
      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBackspace = useCallback(() => {
    setError('');
    setPin(prev => prev.slice(0, -1));
  }, []);

  const verify = useCallback(async (enteredPin: string) => {
    const isValid = await verifyPin(enteredPin, pinHash);
    if (isValid) {
      setPin([]);
      setError('');
      setIsLocked(false);
    } else {
      setError(t('lockScreen.wrongPin'));
      setPin([]);
    }
  }, [pinHash, setIsLocked, t]);

  const handleBiometric = useCallback(async () => {
    const success = await authenticateBiometric();
    if (success) {
      setPin([]);
      setError('');
      setIsLocked(false);
    } else {
      setError(t('lockScreen.wrongPin'));
    }
  }, [setIsLocked, t]);

  // Only show lock if needed
  if (!lockEnabled || !pinHash || !isLocked) {
    return <>{children}</>;
  }

  const pinDisplay = pin.join('');

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex flex-col items-center gap-8 w-full max-w-xs px-6"
      >
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-white" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">{t('lockScreen.title')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('lockScreen.subtitle')}</p>
        </div>

        {/* PIN Dots */}
        <div className="flex items-center gap-3 h-8">
          {Array.from({ length: pinLength }, (_, i) => i).map(i => (
            <motion.div
              key={i}
              initial={false}
              animate={{
                scale: pin.length > i ? 1 : 0.8,
                backgroundColor: pin.length > i ? '#ffffff' : 'rgba(255,255,255,0.2)',
              }}
              transition={{ duration: 0.15 }}
              className="w-3 h-3 rounded-full"
            />
          ))}
        </div>

        {/* Error */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-sm text-red-400"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* PIN Pad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
            <button
              key={digit}
              onClick={() => handleDigit(String(digit))}
              className="w-full aspect-square rounded-2xl bg-white/10 text-white text-2xl font-semibold hover:bg-white/20 active:bg-white/30 transition-colors active:scale-95"
            >
              {digit}
            </button>
          ))}
          {/* Empty space */}
          <div />
          <button
            onClick={() => handleDigit('0')}
            className="w-full aspect-square rounded-2xl bg-white/10 text-white text-2xl font-semibold hover:bg-white/20 active:bg-white/30 transition-colors active:scale-95"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="w-full aspect-square rounded-2xl bg-white/10 text-white/60 hover:bg-white/20 active:bg-white/30 transition-colors flex items-center justify-center active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Biometric */}
        {bioAvailable && biometricEnabled && (
          <button
            onClick={handleBiometric}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
          >
            <Fingerprint className="w-5 h-5" />
            {t('lockScreen.useBiometric')}
          </button>
        )}
      </motion.div>
    </div>
  );
}
