import { useState, useEffect } from 'react';
import { db, getAccountBalance } from '@/lib/db';
import { batchConvertAmounts } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import type { Account } from '@/types';

interface ConvertedBalanceState {
  balances: Record<number, number>;
  convertedBalances: Record<number, number>;
  totalBalance: number;
  ratesReady: boolean;
  isLoading: boolean;
}

/**
 * Custom hook that loads account balances and converts them to the default currency.
 * Encapsulates the repeated logic found in Dashboard.tsx and Accounts.tsx.
 */
export function useConvertedBalances(accounts: Account[] | undefined): ConvertedBalanceState {
  const { defaultCurrency } = useAppStore();
  const [state, setState] = useState<ConvertedBalanceState>({
    balances: {},
    convertedBalances: {},
    totalBalance: 0,
    ratesReady: false,
    isLoading: true,
  });

  useEffect(() => {
    if (!accounts || accounts.length === 0) {
      setState(prev => ({ ...prev, isLoading: false, ratesReady: true }));
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Auto-fetch exchange rates if none exist yet
        const count = await db.exchangeRates.count();
        if (count === 0) {
          const { fetchAllRates } = await import('@/lib/exchangeRateService');
          const result = await fetchAllRates();
          if (!result.success) {
            console.warn('Auto-fetch rates failed:', result.errors.join(', '));
          }
        }

        if (cancelled) return;

        // Load balances for all accounts
        const results = await Promise.all(
          accounts.map(async (acc) => {
            const balance = await getAccountBalance(acc.id!);
            return { id: acc.id!, balance, currency: acc.currency };
          })
        );

        if (cancelled) return;

        const newBalances: Record<number, number> = {};
        results.forEach(r => { newBalances[r.id] = r.balance; });

        // Convert all balances to default currency
        const converted = await batchConvertAmounts(
          results.map(r => ({ amount: r.balance, from: r.currency })),
          defaultCurrency
        );

        if (cancelled) return;

        const newConverted: Record<number, number> = {};
        let total = 0;
        results.forEach((r, i) => {
          newConverted[r.id] = converted[i];
          total += converted[i];
        });

        setState({
          balances: newBalances,
          convertedBalances: newConverted,
          totalBalance: total,
          ratesReady: true,
          isLoading: false,
        });
      } catch (err) {
        console.error('Error loading account balances:', err);
        if (!cancelled) {
          setState(prev => ({ ...prev, ratesReady: true, isLoading: false }));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [accounts, defaultCurrency]);

  return state;
}
