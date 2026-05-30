import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { PageTransition } from '@/components/ui/page-transition';
import { Tour } from '@/components/onboarding/Tour';
import { seedCategories } from '@/lib/db';
import { useAppStore } from '@/stores/useAppStore';
import { runAllPeriodicChecks } from '@/lib/notificationService';
import { processRecurringTransactions } from '@/lib/recurringService';

const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Accounts = lazy(() => import('@/pages/Accounts').then(m => ({ default: m.Accounts })));
const Transactions = lazy(() => import('@/pages/Transactions').then(m => ({ default: m.Transactions })));
const Budgets = lazy(() => import('@/pages/Budgets').then(m => ({ default: m.Budgets })));
const Goals = lazy(() => import('@/pages/Goals').then(m => ({ default: m.Goals })));
const Debts = lazy(() => import('@/pages/Debts').then(m => ({ default: m.Debts })));
const Reports = lazy(() => import('@/pages/Reports').then(m => ({ default: m.Reports })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const Welcome = lazy(() => import('@/pages/Welcome').then(m => ({ default: m.Welcome })));
const NotFound = lazy(() => import('@/pages/NotFound').then(m => ({ default: m.NotFound })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Cargando...</p>
      </div>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const { setupCompleted, isHydrated } = useAppStore();

  // Don't show route guard until store is hydrated
  if (!isHydrated) {
    return <PageLoader />;
  }

  // Route guard: redirect to /welcome if not set up
  if (!setupCompleted && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <>
      {/* Tour persists across route changes — outside AnimatePresence so it doesn't remount */}
      <Tour />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Welcome page - outside Layout */}
          <Route path="/welcome" element={<Welcome />} />

          {/* Main app routes inside Layout */}
          <Route element={<Layout />}>
            <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
            <Route path="/accounts" element={<PageTransition><Accounts /></PageTransition>} />
            <Route path="/transactions" element={<PageTransition><Transactions /></PageTransition>} />
            <Route path="/budgets" element={<PageTransition><Budgets /></PageTransition>} />
            <Route path="/goals" element={<PageTransition><Goals /></PageTransition>} />
            <Route path="/debts" element={<PageTransition><Debts /></PageTransition>} />
            <Route path="/reports" element={<PageTransition><Reports /></PageTransition>} />
            <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Route>
        </Routes>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  useEffect(() => {
    seedCategories().catch((err) => {
      console.warn('Failed to seed categories:', err);
    });

    // Periodic notification checks (every 10 minutes)
    const notifInterval = setInterval(() => {
      runAllPeriodicChecks();
    }, 10 * 60 * 1000);

    // Also check on visibility change (user returns to tab)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runAllPeriodicChecks();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Initial check after 3 seconds
    setTimeout(() => {
      runAllPeriodicChecks();
      processRecurringTransactions();
    }, 3000);

    // Periodic recurring transaction checks (every hour)
    const recurringInterval = setInterval(() => {
      processRecurringTransactions();
    }, 60 * 60 * 1000);

    // Also check recurring on visibility change
    const onVisibilityChangeRecurring = () => {
      if (document.visibilityState === 'visible') {
        processRecurringTransactions();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChangeRecurring);

    return () => {
      clearInterval(notifInterval);
      clearInterval(recurringInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('visibilitychange', onVisibilityChangeRecurring);
    };
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <AnimatedRoutes />
      </Suspense>
    </BrowserRouter>
  );
}
