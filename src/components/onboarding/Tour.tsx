import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Sparkles, Check } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useNavigate, useLocation } from 'react-router-dom';

interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  route?: string;
  position?: 'bottom' | 'top' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'tour.welcome.title',
    description: 'tour.welcome.description',
    position: 'bottom',
  },
  {
    id: 'sidebar-dashboard',
    title: 'tour.dashboard.title',
    description: 'tour.dashboard.description',
    targetSelector: '[data-tour=\"dashboard\"]',
    route: '/',
    position: 'right',
  },
  {
    id: 'sidebar-accounts',
    title: 'tour.accounts.title',
    description: 'tour.accounts.description',
    targetSelector: '[data-tour=\"accounts\"]',
    route: '/accounts',
    position: 'right',
  },
  {
    id: 'sidebar-transactions',
    title: 'tour.transactions.title',
    description: 'tour.transactions.description',
    targetSelector: '[data-tour=\"transactions\"]',
    route: '/transactions',
    position: 'right',
  },
  {
    id: 'sidebar-budgets',
    title: 'tour.budgets.title',
    description: 'tour.budgets.description',
    targetSelector: '[data-tour=\"budgets\"]',
    route: '/budgets',
    position: 'right',
  },
  {
    id: 'sidebar-goals',
    title: 'tour.goals.title',
    description: 'tour.goals.description',
    targetSelector: '[data-tour=\"goals\"]',
    route: '/goals',
    position: 'right',
  },
  {
    id: 'sidebar-debts',
    title: 'tour.debts.title',
    description: 'tour.debts.description',
    targetSelector: '[data-tour=\"debts\"]',
    route: '/debts',
    position: 'right',
  },
  {
    id: 'sidebar-reports',
    title: 'tour.reports.title',
    description: 'tour.reports.description',
    targetSelector: '[data-tour=\"reports\"]',
    route: '/reports',
    position: 'right',
  },
  {
    id: 'sidebar-settings',
    title: 'tour.settings.title',
    description: 'tour.settings.description',
    targetSelector: '[data-tour=\"settings\"]',
    route: '/settings',
    position: 'right',
  },
  {
    id: 'final',
    title: 'tour.final.title',
    description: 'tour.final.description',
    position: 'bottom',
  },
];

export function Tour() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { tourCompleted, completeTour } = useAppStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [targetPosition, setTargetPosition] = useState<DOMRect | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [delayedShow, setDelayedShow] = useState(false);

  useEffect(() => {
    if (!tourCompleted) {
      // Small delay to let the UI render first
      const timer = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tourCompleted]);

  useEffect(() => {
    if (showTour) {
      const timer = setTimeout(() => setDelayedShow(true), 100);
      return () => clearTimeout(timer);
    } else {
      setDelayedShow(false);
    }
  }, [showTour]);

  const updateTargetPosition = useCallback((step: TourStep) => {
    if (step.targetSelector) {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        setTargetPosition(el.getBoundingClientRect());
        return;
      }
    }
    setTargetPosition(null);
  }, []);

  useEffect(() => {
    if (!showTour) return;
    updateTargetPosition(tourSteps[currentStep]);
    const onResize = () => updateTargetPosition(tourSteps[currentStep]);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [currentStep, showTour, updateTargetPosition]);

  const goToStep = useCallback((index: number) => {
    const step = tourSteps[index];
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
    }
    setCurrentStep(index);
  }, [navigate, location.pathname]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      goToStep(currentStep + 1);
    } else {
      setShowTour(false);
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    setShowTour(false);
    completeTour();
  };

  if (!showTour || !delayedShow) return null;

  const step = tourSteps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === tourSteps.length - 1;
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  // Calculate tooltip position based on target element or center
  const getTooltipStyle = () => {
    if (targetPosition && step.position === 'right') {
      return {
        left: targetPosition.right + 16,
        top: Math.max(16, targetPosition.top - 60),
      };
    }
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  };

  // Highlight ring for target element
  const getHighlightStyle = () => {
    if (!targetPosition) return {};
    return {
      position: 'fixed' as const,
      left: targetPosition.left - 4,
      top: targetPosition.top - 4,
      width: targetPosition.width + 8,
      height: targetPosition.height + 8,
      pointerEvents: 'none' as const,
    };
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Highlight ring around target */}
      {targetPosition && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute z-[101] rounded-xl border-2 border-primary shadow-[0_0_20px_rgba(37,99,235,0.3)]"
          style={getHighlightStyle()}
        />
      )}

      {/* Tooltip Card */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
        className="fixed z-[102] w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        style={getTooltipStyle()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <div className="p-5">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              {tourSteps.slice(0, 5).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? 'bg-primary w-3'
                      : i < currentStep
                      ? 'bg-primary/40'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-medium text-gray-400 ml-auto">
              {currentStep + 1} / {tourSteps.length}
            </span>
          </div>

          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-light to-blue-100 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>

          {/* Content */}
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {t(step.title)}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            {t(step.description)}
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
          >
            {t('tour.skip')}
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {t('tour.back')}
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors shadow-sm"
            >
              {isLast ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  {t('tour.start')}
                </>
              ) : (
                <>
                  {t('tour.next')}
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
