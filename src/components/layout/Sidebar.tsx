import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/useAppStore';
import { LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, Target, HandshakeIcon, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: LayoutDashboard, key: 'dashboard' },
  { path: '/accounts', icon: Wallet, key: 'accounts' },
  { path: '/transactions', icon: ArrowLeftRight, key: 'transactions' },
  { path: '/budgets', icon: PiggyBank, key: 'budgets' },
  { path: '/goals', icon: Target, key: 'goals' },
  { path: '/debts', icon: HandshakeIcon, key: 'debts' },
  { path: '/reports', icon: BarChart3, key: 'reports' },
  { path: '/settings', icon: Settings, key: 'settings' },
];

export function Sidebar() {
  const { t } = useTranslation();
  const { userName } = useAppStore();

  return (
    <aside className="layout-sidebar bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800">
      <div className="px-6 py-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight">MyEco</h1>
            {userName ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userName}</p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('app.tagline')}</p>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, key }) => (
          <NavLink
            key={path}
            to={path}
            data-tour={key}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-primary-light dark:bg-primary/20 text-primary shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
            )}
          >
            <Icon className={cn('w-5 h-5')} />
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-400 dark:text-gray-500">MyEco v1.0.0</p>
      </div>
    </aside>
  );
}
