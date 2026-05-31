import type { Transaction, Category } from '@/types';
import { batchConvertAmounts } from './utils';

export interface FiftyThirtyTwentyData {
  totalIncome: number;
  needs: number;
  wants: number;
  savings: number;
  needsPercentage: number;
  wantsPercentage: number;
  savingsPercentage: number;
  needsIdeal: number;   // 50% of income
  wantsIdeal: number;   // 30% of income
  savingsIdeal: number; // 20% of income
  needsOnTrack: boolean;
  wantsOnTrack: boolean;
  savingsOnTrack: boolean;
}

/**
 * Calculate 50/30/20 rule breakdown from monthly transactions.
 *
 * The rule:
 * - 50% of after-tax income → Needs (essential: housing, food, transport, utilities, health, etc.)
 * - 30% → Wants (discretionary: entertainment, shopping, travel, dining out, etc.)
 * - 20% → Savings (savings, debt payments, investments)
 *
 * We derive savings as: totalIncome - needs - wants
 */
export async function calculateFiftyThirtyTwenty(
  transactions: Transaction[],
  categories: Category[],
  defaultCurrency: string
): Promise<FiftyThirtyTwentyData> {
  if (transactions.length === 0 || categories.length === 0) {
    return {
      totalIncome: 0,
      needs: 0,
      wants: 0,
      savings: 0,
      needsPercentage: 0,
      wantsPercentage: 0,
      savingsPercentage: 0,
      needsIdeal: 0,
      wantsIdeal: 0,
      savingsIdeal: 0,
      needsOnTrack: true,
      wantsOnTrack: true,
      savingsOnTrack: true,
    };
  }

  // Convert all amounts to default currency in one batch
  const convertedAmounts = await batchConvertAmounts(
    transactions.map(t => ({ amount: t.amount, from: t.currency })),
    defaultCurrency
  );

  // Build a map of categoryId → categoryType
  const categoryTypeMap: Record<number, 'need' | 'want' | undefined> = {};
  for (const cat of categories) {
    if (cat.id !== undefined) {
      categoryTypeMap[cat.id] = cat.type === 'expense' ? cat.categoryType : undefined;
    }
  }

  let totalIncome = 0;
  let needs = 0;
  let wants = 0;

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    const convertedAmount = convertedAmounts[i];

    if (t.type === 'income') {
      totalIncome += convertedAmount;
    } else if (t.type === 'expense') {
      const catType = categoryTypeMap[t.categoryId];
      if (catType === 'need') {
        needs += convertedAmount;
      } else if (catType === 'want') {
        wants += convertedAmount;
      } else {
        // Unclassified → default to need (conservative)
        needs += convertedAmount;
      }
    }
    // Transfers are excluded from the calculation
  }

  const savings = Math.max(0, totalIncome - needs - wants);
  const needsPercentage = totalIncome > 0 ? (needs / totalIncome) * 100 : 0;
  const wantsPercentage = totalIncome > 0 ? (wants / totalIncome) * 100 : 0;
  const savingsPercentage = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

  const needsIdeal = totalIncome * 0.5;
  const wantsIdeal = totalIncome * 0.3;
  const savingsIdeal = totalIncome * 0.2;

  return {
    totalIncome,
    needs,
    wants,
    savings,
    needsPercentage,
    wantsPercentage,
    savingsPercentage,
    needsIdeal,
    wantsIdeal,
    savingsIdeal,
    needsOnTrack: needsPercentage <= 55, // Allow 5% tolerance
    wantsOnTrack: wantsPercentage <= 35, // Allow 5% tolerance
    savingsOnTrack: savingsPercentage >= 15, // Allow 5% tolerance
  };
}
