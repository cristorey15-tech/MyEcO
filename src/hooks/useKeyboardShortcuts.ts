import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Shortcut {
  key: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  category: 'navigation' | 'action' | 'global';
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  const isInputFocused = useCallback(() => {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      (active as HTMLElement).isContentEditable ||
      active.getAttribute('role') === 'textbox'
    );
  }, []);

  useEffect(() => {
    const shortcuts: Shortcut[] = [
      // Navigation
      { key: 'd', action: () => navigate('/'), description: 'shortcuts.dashboard', category: 'navigation' },
      { key: 'a', action: () => navigate('/accounts'), description: 'shortcuts.accounts', category: 'navigation' },
      { key: 't', action: () => navigate('/transactions'), description: 'shortcuts.transactions', category: 'navigation' },
      { key: 'b', action: () => navigate('/budgets'), description: 'shortcuts.budgets', category: 'navigation' },
      { key: 'g', action: () => navigate('/goals'), description: 'shortcuts.goals', category: 'navigation' },
      { key: 'l', action: () => navigate('/debts'), description: 'shortcuts.debts', category: 'navigation' },
      { key: 'r', action: () => navigate('/reports'), description: 'shortcuts.reports', category: 'navigation' },
      { key: 's', action: () => navigate('/settings'), description: 'shortcuts.settings', category: 'navigation' },
      // Actions
      { key: 'n', action: () => navigate('/transactions'), description: 'shortcuts.newTransaction', category: 'action' },
      // Global
      { key: '?', shift: true, action: () => setHelpOpen(prev => !prev), description: 'shortcuts.showHelp', category: 'global' },
      { key: 'Escape', action: () => setHelpOpen(false), description: '', category: 'global' },
    ];

    const handler = (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs
      if (isInputFocused()) return;

      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;

      for (const shortcut of shortcuts) {
        // Skip Escape — it's handled by Modal component
        if (key === 'Escape') continue;

        const keyMatches =
          key.toLowerCase() === shortcut.key.toLowerCase() &&
          !!e.shiftKey === !!shortcut.shift &&
          ctrl === (!!shortcut.ctrl || !!shortcut.meta);

        if (keyMatches) {
          e.preventDefault();
          e.stopPropagation();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, isInputFocused, setHelpOpen]);

  return { helpOpen, setHelpOpen };
}
