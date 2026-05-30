import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

  return (
    <aside className="layout-sidebar bg-white border-r border-gray-100">
      <div className="px-6 py-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">MyEco</h1>
            <p className="text-xs text-gray-500">{t('app.tagline')}</p>
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
                ? 'bg-primary-light text-primary shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Icon className={cn('w-5 h-5')} />
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">MyEco v1.0.0</p>
      </div>
    </aside>
  );
}
