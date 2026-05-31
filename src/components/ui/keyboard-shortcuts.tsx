import { useTranslation } from 'react-i18next';
import { X, Keyboard, Plus, LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, Target, HandshakeIcon, BarChart3, Settings, HelpCircle } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  labelKey: string;
  icon: React.ElementType;
}

interface ShortcutCategory {
  categoryKey: string;
  items: ShortcutItem[];
}

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const categories: ShortcutCategory[] = [
    {
      categoryKey: 'shortcuts.categoryNav',
      items: [
        { keys: ['D'], labelKey: 'shortcuts.dashboard', icon: LayoutDashboard },
        { keys: ['A'], labelKey: 'shortcuts.accounts', icon: Wallet },
        { keys: ['T'], labelKey: 'shortcuts.transactions', icon: ArrowLeftRight },
        { keys: ['B'], labelKey: 'shortcuts.budgets', icon: PiggyBank },
        { keys: ['G'], labelKey: 'shortcuts.goals', icon: Target },
        { keys: ['L'], labelKey: 'shortcuts.debts', icon: HandshakeIcon },
        { keys: ['R'], labelKey: 'shortcuts.reports', icon: BarChart3 },
        { keys: ['S'], labelKey: 'shortcuts.settings', icon: Settings },
      ],
    },
    {
      categoryKey: 'shortcuts.categoryActions',
      items: [
        { keys: ['N'], labelKey: 'shortcuts.newTransaction', icon: Plus },
      ],
    },
    {
      categoryKey: 'shortcuts.categoryGlobal',
      items: [
        { keys: ['⇧', '?'], labelKey: 'shortcuts.showHelp', icon: HelpCircle },
        { keys: ['Esc'], labelKey: 'shortcuts.closeModal', icon: X },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('shortcuts.title')}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('shortcuts.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto space-y-5">
          {categories.map((cat) => (
            <div key={cat.categoryKey}>
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
                {t(cat.categoryKey)}
              </p>
              <div className="space-y-1">
                {cat.items.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3.5 h-3.5 text-gray-500" />
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-200">{t(item.labelKey)}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                        {item.keys.map((key, ki) => (
                          <span key={ki}>
                            <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 shadow-sm">
                              {key}
                            </kbd>
                            {ki < item.keys.length - 1 && (
                              <span className="mx-1 text-gray-300 dark:text-gray-600 text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Tip */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
            <p className="text-xs text-gray-400 text-center">
              {t('shortcuts.tip')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
