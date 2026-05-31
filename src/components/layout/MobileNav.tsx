import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, Target, HandshakeIcon, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { path: '/', icon: LayoutDashboard, key: 'dashboard' },
  { path: '/accounts', icon: Wallet, key: 'accounts' },
  { path: '/transactions', icon: ArrowLeftRight, key: 'transactions' },
  { path: '/budgets', icon: PiggyBank, key: 'budgets' },
  { path: '/goals', icon: Target, key: 'goals' },
  { path: '/debts', icon: HandshakeIcon, key: 'debts' },
  { path: '/reports', icon: BarChart3, key: 'reports' },
  { path: '/settings', icon: Settings, key: 'settings' },
];

export function MobileNav() {
  const { t } = useTranslation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-40 overflow-x-auto scrollbar-hide safe-area-bottom">
      <div className="flex items-center px-1 py-1 gap-0">
        {mobileNavItems.map(({ path, icon: Icon, key }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all duration-200 flex-shrink-0',
              isActive ? 'text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight text-center whitespace-nowrap">{t(`nav.${key}`)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
