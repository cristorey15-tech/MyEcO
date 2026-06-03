import type { Budget, Category } from '@/types';

export interface BudgetComparisonItem {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  budgeted: number;
  spent: number;
  percentage: number;
}

/**
 * Pure function: computes budget comparison data from budgets, categories, and spending.
 * Extracted from Dashboard.tsx to be unit-testable.
 */
export function computeBudgetComparison(
  budgets: Budget[],
  categories: Category[],
  spendingByCategory: Record<number, number>,
): BudgetComparisonItem[] {
  if (budgets.length === 0) return [];

  // Deduplicate by categoryId (keep highest amount as canonical)
  const deduped = new Map<number, Budget>();
  for (const b of budgets) {
    const existing = deduped.get(b.categoryId);
    if (!existing || b.amount > existing.amount) {
      deduped.set(b.categoryId, b);
    }
  }

  return Array.from(deduped.values())
    .map((b) => {
      const spent = spendingByCategory[b.categoryId] || 0;
      const cat = categories.find((c) => c.id === b.categoryId);
      return {
        categoryId: b.categoryId,
        categoryName: cat?.name || '—',
        categoryColor: cat?.color || '#6b7280',
        budgeted: b.amount,
        spent,
        percentage: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);
}
