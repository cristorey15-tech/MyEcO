import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { useToastStore } from '@/stores/useToastStore';
import { verifyPin, authenticateBiometric, isBiometricAvailable, hashPin } from '@/lib/auth';
import { Wallet, Fingerprint, X, ArrowLeft, HelpCircle, ShieldAlert } from 'lucide-react';

interface LockScreenProps {
  children: React.ReactNode;
}

export function LockScreen({ children }: LockScreenProps) {
  const { t } = useTranslation();
  const { pinHash, pinLength, lockEnabled, biometricEnabled, isLocked, setIsLocked, setPinHash, setLockEnabled, securityQuestions } = useAppStore();
  const addToast = useToastStore((s) => s.addToast);
  const [pin, setPin] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryAnswers, setRecoveryAnswers] = useState<string[]>([]);
  const [recoveryError, setRecoveryError] = useState('');

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

  const handleRecoveryAnswer = useCallback(async (idx: number, value: string) => {
    setRecoveryAnswers(prev => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
    setRecoveryError('');
  }, []);

  const handleRecoverySubmit = useCallback(async () => {
    if (securityQuestions.length === 0) return;

    // Check that all questions have answers
    for (let i = 0; i < securityQuestions.length; i++) {
      const answer = (recoveryAnswers[i] || '').toLowerCase().trim();
      if (!answer) {
        setRecoveryError(t('lockScreen.recoveryRequired'));
        return;
      }
    }

    // Verify each answer
    let allCorrect = true;
    for (let i = 0; i < securityQuestions.length; i++) {
      const answer = (recoveryAnswers[i] || '').toLowerCase().trim();
      const computedHash = await hashPin(answer);
      if (computedHash !== securityQuestions[i].answerHash) {
        allCorrect = false;
        break;
      }
    }

    if (allCorrect) {
      // Recovery successful — clear PIN and unlock
      setPinHash('');
      setLockEnabled(false);
      setIsLocked(false);
      addToast({
        title: t('lockScreen.recoverySuccessTitle'),
        message: t('lockScreen.recoverySuccessDesc'),
        variant: 'success',
        duration: 8000,
      });
    } else {
      setRecoveryError(t('lockScreen.recoveryFailed'));
    }
  }, [securityQuestions, recoveryAnswers, t, setPinHash, setLockEnabled, setIsLocked, addToast]);

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

        {recoveryMode ? (
          /* Recovery Mode */
          <>
            {/* Back button */}
            <button
              onClick={() => {
                setRecoveryMode(false);
                setRecoveryAnswers([]);
                setRecoveryError('');
              }}
              className="self-start flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('lockScreen.backToPin')}
            </button>

            <div className="text-center">
              <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <h2 className="text-base font-semibold text-white">{t('lockScreen.recoveryTitle')}</h2>
              <p className="text-xs text-gray-400 mt-1">{t('lockScreen.recoveryDesc')}</p>
            </div>

            <div className="w-full space-y-3">
              {securityQuestions.map((q, idx) => (
                <div key={idx}>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{q.question}</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={recoveryAnswers[idx] || ''}
                    onChange={(e) => handleRecoveryAnswer(idx, e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/10 text-white text-sm placeholder-gray-500 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
                    placeholder={t('lockScreen.answerPlaceholder')}
                  />
                </div>
              ))}
            </div>

            {/* Error */}
            <AnimatePresence mode="wait">
              {recoveryError && (
                <motion.p
                  key="recovery-error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-sm text-red-400"
                >
                  {recoveryError}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              onClick={handleRecoverySubmit}
              className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 active:bg-primary/80 transition-all active:scale-[0.98]"
            >
              {t('lockScreen.recoverButton')}
            </button>

            <p className="text-xs text-gray-500 text-center">
              {t('lockScreen.recoveryWarning')}
            </p>
          </>
        ) : (
          /* Normal PIN Mode */
          <>
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

            {/* Forgot PIN */}
            {securityQuestions.length > 0 && (
              <button
                onClick={() => setRecoveryMode(true)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {t('lockScreen.forgotPin')}
              </button>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
