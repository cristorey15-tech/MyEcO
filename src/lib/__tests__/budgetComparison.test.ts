import { describe, it, expect } from 'vitest';
import { computeBudgetComparison } from '../budgetComparison';
import type { Budget, Category } from '@/types';

const baseCategory: Category = {
  id: 1,
  name: 'Alimentación',
  type: 'expense',
  categoryType: 'need',
  icon: 'utensils',
  color: '#dc2626',
  isDefault: true,
  createdAt: new Date(),
};

const makeCategory = (overrides: Partial<Category> & { id: number }): Category => ({
  ...baseCategory,
  ...overrides,
});

const makeBudget = (overrides: Partial<Budget> & { categoryId: number; amount: number }): Budget => ({
  id: overrides.id ?? overrides.categoryId,
  month: 6,
  year: 2026,
  spent: 0,
  createdAt: new Date(),
  ...overrides,
});

describe('computeBudgetComparison', () => {
  describe('empty inputs', () => {
    it('returns empty array when budgets is empty', () => {
      const result = computeBudgetComparison([], [baseCategory], {});
      expect(result).toEqual([]);
    });

    it('handles empty categories gracefully (uses fallback name/color)', () => {
      const budgets = [makeBudget({ categoryId: 1, amount: 500 })];
      const result = computeBudgetComparison(budgets, [], {});
      expect(result).toHaveLength(1);
      expect(result[0].categoryName).toBe('—');
      expect(result[0].categoryColor).toBe('#6b7280');
    });
  });

  describe('spending calculation', () => {
    it('calculates 0% when no spending exists', () => {
      const budgets = [makeBudget({ categoryId: 1, amount: 500 })];
      const categories = [makeCategory({ id: 1 })];
      const result = computeBudgetComparison(budgets, categories, {});
      expect(result[0].spent).toBe(0);
      expect(result[0].percentage).toBe(0);
    });

    it('calculates percentage correctly for partial spending', () => {
      const budgets = [makeBudget({ categoryId: 1, amount: 1000 })];
      const categories = [makeCategory({ id: 1 })];
      const result = computeBudgetComparison(budgets, categories, { 1: 350 });
      expect(result[0].spent).toBe(350);
      expect(result[0].percentage).toBe(35);
    });

    it('calculates 100% when spending equals budget', () => {
      const budgets = [makeBudget({ categoryId: 1, amount: 500 })];
      const categories = [makeCategory({ id: 1 })];
      const result = computeBudgetComparison(budgets, categories, { 1: 500 });
      expect(result[0].percentage).toBe(100);
    });

    it('calculates over 100% when overspent', () => {
      const budgets = [makeBudget({ categoryId: 1, amount: 500 })];
      const categories = [makeCategory({ id: 1 })];
      const result = computeBudgetComparison(budgets, categories, { 1: 750 });
      expect(result[0].percentage).toBe(150);
    });

    it('rounds percentage to nearest integer', () => {
      const budgets = [makeBudget({ categoryId: 1, amount: 300 })];
      const categories = [makeCategory({ id: 1 })];
      const result = computeBudgetComparison(budgets, categories, { 1: 100 });
      // 100/300 = 33.33... → rounds to 33
      expect(result[0].percentage).toBe(33);
    });
  });

  describe('multiple budgets', () => {
    it('returns one item per budget', () => {
      const budgets = [
        makeBudget({ categoryId: 1, amount: 500 }),
        makeBudget({ categoryId: 2, amount: 300 }),
        makeBudget({ categoryId: 3, amount: 200 }),
      ];
      const categories = [
        makeCategory({ id: 1, name: 'Alimentación', color: '#dc2626' }),
        makeCategory({ id: 2, name: 'Transporte', color: '#2563eb' }),
        makeCategory({ id: 3, name: 'Entretenimiento', color: '#7c3aed' }),
      ];
      const result = computeBudgetComparison(budgets, categories, { 1: 200, 2: 150, 3: 50 });
      expect(result).toHaveLength(3);
    });

    it('sorts by percentage descending (highest first)', () => {
      const budgets = [
        makeBudget({ categoryId: 1, amount: 1000 }), // 50%
        makeBudget({ categoryId: 2, amount: 100 }),  // 90%
        makeBudget({ categoryId: 3, amount: 500 }),  // 20%
      ];
      const categories = [
        makeCategory({ id: 1, name: 'Food' }),
        makeCategory({ id: 2, name: 'Transport' }),
        makeCategory({ id: 3, name: 'Entertainment' }),
      ];
      const result = computeBudgetComparison(budgets, categories, { 1: 500, 2: 90, 3: 100 });
      expect(result[0].percentage).toBe(90);  // Transport
      expect(result[1].percentage).toBe(50);  // Food
      expect(result[2].percentage).toBe(20);  // Entertainment
    });
  });

  describe('category matching', () => {
    it('uses category name and color when found', () => {
      const budgets = [makeBudget({ categoryId: 7, amount: 500 })];
      const categories = [makeCategory({ id: 7, name: 'Transporte', color: '#2563eb' })];
      const result = computeBudgetComparison(budgets, categories, {});
      expect(result[0].categoryName).toBe('Transporte');
      expect(result[0].categoryColor).toBe('#2563eb');
    });

    it('uses fallback when category not found', () => {
      const budgets = [makeBudget({ categoryId: 99, amount: 500 })];
      const categories = [makeCategory({ id: 1 })];
      const result = computeBudgetComparison(budgets, categories, {});
      expect(result[0].categoryName).toBe('—');
      expect(result[0].categoryColor).toBe('#6b7280');
    });
  });

  describe('regression: race condition scenario (deleted budgets)', () => {
    it('reflects only remaining budgets after deletion (the bug fix scenario)', () => {
      // Scenario: user had 3 budgets for transporte (different categories),
      // deleted 2, leaving only 1
      const allBudgets = [
        makeBudget({ categoryId: 1, amount: 300 }),
        makeBudget({ categoryId: 2, amount: 200 }),
        makeBudget({ categoryId: 3, amount: 150 }),
      ];

      // After deletion, only 1 budget remains
      const remainingBudgets = [allBudgets[0]];
      const categories = [
        makeCategory({ id: 1, name: 'Transporte' }),
        makeCategory({ id: 2, name: 'Alimentación' }),
        makeCategory({ id: 3, name: 'Servicios' }),
      ];

      // The function should only process what's passed to it
      const result = computeBudgetComparison(remainingBudgets, categories, { 1: 100 });
      expect(result).toHaveLength(1);
      expect(result[0].categoryId).toBe(1);
      expect(result[0].categoryName).toBe('Transporte');
      expect(result[0].percentage).toBe(33);
    });

    it('returns empty when all budgets are deleted', () => {
      const result = computeBudgetComparison([], [baseCategory], { 1: 500 });
      expect(result).toEqual([]);
    });

    it('concurrent calls return consistent results (no shared state)', () => {
      const budgets1 = [makeBudget({ categoryId: 1, amount: 500 })];
      const budgets2 = [makeBudget({ categoryId: 1, amount: 500 }), makeBudget({ categoryId: 2, amount: 300 })];
      const categories = [
        makeCategory({ id: 1, name: 'Food' }),
        makeCategory({ id: 2, name: 'Transport' }),
      ];

      const result1 = computeBudgetComparison(budgets1, categories, { 1: 200 });
      const result2 = computeBudgetComparison(budgets2, categories, { 1: 200, 2: 100 });

      // result1 should NOT be affected by result2's data
      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('handles budget with 0 amount (avoids division by zero)', () => {
      const budgets = [makeBudget({ categoryId: 1, amount: 0 })];
      const categories = [makeCategory({ id: 1 })];
      const result = computeBudgetComparison(budgets, categories, { 1: 100 });
      expect(result[0].percentage).toBe(0);
      expect(result[0].budgeted).toBe(0);
    });

    it('handles spending for category with no budget (spending key exists but no matching budget)', () => {
      const budgets = [makeBudget({ categoryId: 1, amount: 500 })];
      const categories = [makeCategory({ id: 1 })];
      const spending = { 1: 200, 99: 999 }; // category 99 has no budget
      const result = computeBudgetComparison(budgets, categories, spending);
      // Only category 1 should appear (99 has no budget entry)
      expect(result).toHaveLength(1);
      expect(result[0].spent).toBe(200);
    });

    it('handles large amounts correctly', () => {
      const budgets = [makeBudget({ categoryId: 1, amount: 1_000_000 })];
      const categories = [makeCategory({ id: 1 })];
      const result = computeBudgetComparison(budgets, categories, { 1: 500_000 });
      expect(result[0].percentage).toBe(50);
    });
  });
});
