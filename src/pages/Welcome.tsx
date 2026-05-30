import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/useAppStore';
import { useToastStore } from '@/stores/useToastStore';
import { requestNotificationPermission } from '@/lib/notificationService';
import { seedDemoData } from '@/lib/demoData';
import { seedCategories } from '@/lib/db';
import {
  Wallet,
  TrendingUp,
  Shield,
  PiggyBank,
  ArrowRight,
  Sparkles,
  Loader2,
  Bell,
  Fingerprint,
  Check,
  Repeat,
  BarChart3,
  Target,
} from 'lucide-react';

const features = [
  { icon: Wallet, color: '#2563eb', bgColor: '#dbeafe', key: 'accounts' },
  { icon: TrendingUp, color: '#059669', bgColor: '#d1fae5', key: 'budgets' },
  { icon: PiggyBank, color: '#7c3aed', bgColor: '#ede9fe', key: 'goals' },
  { icon: BarChart3, color: '#d97706', bgColor: '#fef3c7', key: 'reports' },
];

interface FloatingIconProps {
  icon: typeof Wallet;
  color: string;
  delay: number;
  x: number;
  y: number;
  size: number;
}

function FloatingIcon({ icon: Icon, color, delay, x, y, size }: FloatingIconProps) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.15, 0.1, 0],
        scale: [0, 1, 0.8, 0],
        y: [0, -30, -60],
      }}
      transition={{
        duration: 4,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    >
      <Icon style={{ color }} size={size} />
    </motion.div>
  );
}

export function Welcome() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { completeSetup, setupCompleted } = useAppStore();
  const addToast = useToastStore((s) => s.addToast);

  const [step, setStep] = useState<'welcome' | 'loading'>('welcome');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    // Check if WebAuthn / biometric is supported
    setBiometricSupported(
      typeof window !== 'undefined' &&
      typeof PublicKeyCredential !== 'undefined'
    );
  }, []);

  // Redirect if already completed
  useEffect(() => {
    if (setupCompleted) {
      navigate('/', { replace: true });
    }
  }, [setupCompleted, navigate]);

  const handleStart = async (withDemo: boolean) => {
    setStep('loading');

    if (withDemo) {
      setLoadingMessage(t('welcome.creatingDemo'));
      await new Promise((r) => setTimeout(r, 600));

      // Seed categories + demo data
      await seedCategories();
      await seedDemoData();

      setLoadingMessage(t('welcome.almostDone'));
      await new Promise((r) => setTimeout(r, 500));
    } else {
      setLoadingMessage(t('welcome.preparing'));
      await new Promise((r) => setTimeout(r, 400));
      await seedCategories();
    }

    // Request notification permission
    setLoadingMessage(t('welcome.notifications'));
    const notifGranted = await requestNotificationPermission();
    await new Promise((r) => setTimeout(r, 300));

    completeSetup();
    setStep('welcome');

    if (withDemo) {
      addToast({
        title: t('welcome.demoLoaded'),
        message: t('welcome.demoLoadedDesc'),
        variant: 'success',
        duration: 6000,
      });
    }

    if (notifGranted) {
      addToast({
        title: t('welcome.notifEnabled'),
        variant: 'info',
      });
    }

    navigate('/', { replace: true });
  };

  // If already completed, render nothing while redirect happens
  if (setupCompleted) return null;

  return (
    <AnimatePresence mode="wait">
      {step === 'welcome' ? (
        <motion.div
          key="welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="min-h-screen bg-gradient-to-br from-[#f0f4ff] via-white to-[#f5f0ff] flex items-center justify-center p-4 relative overflow-hidden"
        >
          {/* Floating background icons */}
          <FloatingIcon icon={Wallet} color="#2563eb" delay={0} x={10} y={20} size={24} />
          <FloatingIcon icon={TrendingUp} color="#059669" delay={0.5} x={85} y={15} size={20} />
          <FloatingIcon icon={Shield} color="#7c3aed" delay={1} x={15} y={75} size={18} />
          <FloatingIcon icon={PiggyBank} color="#d97706" delay={1.5} x={80} y={70} size={22} />
          <FloatingIcon icon={Repeat} color="#2563eb" delay={2} x={5} y={50} size={16} />
          <FloatingIcon icon={Target} color="#059669" delay={2.5} x={90} y={45} size={16} />
          <FloatingIcon icon={BarChart3} color="#7c3aed" delay={3} x={50} y={5} size={14} />

          <div className="max-w-lg w-full">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm shadow-sm border border-gray-100 mb-6">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-700">MyEco</span>
              </div>
            </motion.div>

            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
              className="text-center mb-10"
            >
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
                {t('welcome.title')}
              </h1>
              <p className="text-lg text-gray-500 leading-relaxed max-w-md mx-auto">
                {t('welcome.subtitle')}
              </p>
            </motion.div>

            {/* Feature highlights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10"
            >
              {features.map((f, i) => {
                const Icon = f.icon;
                const labelKey = `nav.${f.key}`;
                const descKeys = ['accounts', 'budgets', 'goals', 'reports'];
                const descKey = `welcome.featureDesc${i + 1}`;
                return (
                  <div
                    key={f.key}
                    className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center mb-2.5"
                      style={{ backgroundColor: f.bgColor }}
                    >
                      <Icon className="w-5 h-5" style={{ color: f.color }} />
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{t(labelKey)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t(descKey)}</p>
                  </div>
                );
              })}
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45, ease: 'easeOut' }}
              className="space-y-3"
            >
              <button
                onClick={() => handleStart(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" />
                {t('welcome.withDemo')}
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleStart(false)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
              >
                {t('welcome.blankStart')}
              </button>

              {biometricSupported && (
                <div className="text-center pt-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-light/50 text-primary text-xs font-medium">
                    <Fingerprint className="w-3.5 h-3.5" />
                    {t('welcome.biometric')}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="text-center text-xs text-gray-400 mt-8"
            >
              {t('welcome.offlineNote')}
            </motion.p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="loading"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen bg-gradient-to-br from-[#f0f4ff] via-white to-[#f5f0ff] flex items-center justify-center p-4"
        >
          <div className="text-center max-w-sm">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg"
            >
              <Sparkles className="w-7 h-7 text-white" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-base font-medium text-gray-900 mb-1">
                {t('welcome.settingUp')}
              </p>
              <p className="text-sm text-gray-400">{loadingMessage}</p>
            </motion.div>
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 mt-6">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
