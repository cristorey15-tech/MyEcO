import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore, type ToastVariant } from '@/stores/useToastStore';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const variantConfig: Record<ToastVariant, {
  bg: string;
  border: string;
  icon: typeof CheckCircle;
  iconColor: string;
}> = {
  success: {
    bg: 'bg-white dark:bg-gray-800',
    border: 'border-l-secondary',
    icon: CheckCircle,
    iconColor: 'text-secondary',
  },
  error: {
    bg: 'bg-white dark:bg-gray-800',
    border: 'border-l-danger',
    icon: XCircle,
    iconColor: 'text-danger',
  },
  info: {
    bg: 'bg-white dark:bg-gray-800',
    border: 'border-l-primary',
    icon: Info,
    iconColor: 'text-primary',
  },
  warning: {
    bg: 'bg-white dark:bg-gray-800',
    border: 'border-l-warning',
    icon: AlertTriangle,
    iconColor: 'text-warning',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast, index) => {
          const config = variantConfig[toast.variant];
          const Icon = config.icon;

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{
                type: 'spring',
                duration: 0.4,
                bounce: 0.25,
                delay: index * 0.05,
              }}
              className={cn(
                'pointer-events-auto rounded-xl shadow-lg border border-gray-100 dark:border-gray-700/50 border-l-4 overflow-hidden',
                config.bg,
                config.border
              )}
            >
              <div className="flex items-start gap-3 p-4">
                <div className={cn('flex-shrink-0 mt-0.5', config.iconColor)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {toast.title}
                  </p>
                  {toast.message && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      {toast.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 p-1 rounded-lg text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Auto-dismiss progress bar */}
              {(toast.duration ?? 5000) > 0 && (
                <ToastProgress
                  key={toast.id}
                  duration={toast.duration ?? 5000}
                  onComplete={() => removeToast(toast.id)}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function ToastProgress({ duration, onComplete }: { duration: number; onComplete: () => void }) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Small delay before starting the progress bar animation
    const startTimer = setTimeout(() => setIsActive(true), 200);
    return () => clearTimeout(startTimer);
  }, []);

  return (
    <div className="h-0.5 bg-gray-50 dark:bg-gray-700">
      <motion.div
        className="h-full bg-gray-200 dark:bg-gray-600 rounded-full"
        initial={{ width: '100%' }}
        animate={isActive ? { width: '0%' } : { width: '100%' }}
        transition={{
          duration: duration / 1000 - 0.2,
          ease: 'linear',
        }}
        onAnimationComplete={onComplete}
      />
    </div>
  );
}
