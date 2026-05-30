import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, Target, HandshakeIcon, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { path: '/', icon: LayoutDashboard, label: 'Inicio' },
  { path: '/accounts', icon: Wallet, label: 'Cuentas' },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Mov.' },
  { path: '/budgets', icon: PiggyBank, label: 'Presup.' },
  { path: '/goals', icon: Target, label: 'Metas' },
  { path: '/debts', icon: HandshakeIcon, label: 'Deudas' },
  { path: '/reports', icon: BarChart3, label: 'Reportes' },
  { path: '/settings', icon: Settings, label: 'Ajustes' },
];

export function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 overflow-x-auto scrollbar-hide safe-area-bottom">
      <div className="flex items-center px-1 py-1 gap-0">
        {mobileNavItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all duration-200 flex-shrink-0',
              isActive ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight text-center whitespace-nowrap">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
