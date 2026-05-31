import type { Transaction } from '@/types';

export interface TransactionFilters {
  searchTerm: string;
  filterType: string;
  filterAccount: string;
  filterCategory: string;
  filterRecurring: string;
  filterAmountMin: string;
  filterAmountMax: string;
  getAccountName: (id: number) => string;
  getCategoryName: (id: number) => string;
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters
): Transaction[] {
  const { searchTerm, filterType, filterAccount, filterCategory, filterRecurring, filterAmountMin, filterAmountMax, getAccountName, getCategoryName } = filters;

  return transactions.filter(txn => {
    if (filterType && txn.type !== filterType) return false;
    if (filterAccount && txn.accountId !== Number(filterAccount)) return false;
    if (filterCategory && txn.categoryId !== Number(filterCategory)) return false;
    if (filterRecurring === 'recurring' && !txn.isRecurring) return false;
    if (filterRecurring === 'non-recurring' && txn.isRecurring) return false;
    if (filterAmountMin && txn.amount < Number(filterAmountMin)) return false;
    if (filterAmountMax && txn.amount > Number(filterAmountMax)) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const desc = (txn.description || '').toLowerCase();
      const catName = getCategoryName(txn.categoryId).toLowerCase();
      const accName = getAccountName(txn.accountId).toLowerCase();
      if (!desc.includes(search) && !catName.includes(search) && !accName.includes(search)) return false;
    }
    return true;
  });
}
