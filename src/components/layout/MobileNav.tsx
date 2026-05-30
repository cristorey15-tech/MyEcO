import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, Plus, Target, HandshakeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { path: '/', icon: LayoutDashboard, label: 'Inicio' },
  { path: '/accounts', icon: Wallet, label: 'Cuentas' },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Movimientos' },
  { path: '/budgets', icon: PiggyBank, label: 'Presup.' },
  { path: '/goals', icon: Target, label: 'Metas' },
  { path: '/debts', icon: HandshakeIcon, label: 'Deudas' },
];

export function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {mobileNavItems.slice(0, 5).map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg transition-all duration-200 min-w-0',
              isActive ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight text-center">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
