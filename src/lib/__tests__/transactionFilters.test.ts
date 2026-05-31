import { describe, it, expect } from 'vitest';
import { filterTransactions } from '../transactionFilters';
import type { Transaction } from '@/types';

const baseTxn: Omit<Transaction, 'id'> = {
  type: 'expense',
  accountId: 1,
  toAccountId: undefined,
  categoryId: 10,
  amount: 100,
  currency: 'MXN',
  date: new Date('2024-01-15'),
  description: 'Supermarket',
  notes: '',
  tags: [],
  isRecurring: false,
  recurringInterval: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const getAccountName = (id: number) => ({ 1: 'Cash', 2: 'Bank' }[id] || '—');
const getCategoryName = (id: number) => ({ 10: 'Food', 20: 'Transport' }[id] || '—');

function make(overrides: Partial<Transaction> = {}): Transaction {
  return { ...baseTxn, id: Math.random(), ...overrides } as Transaction;
}

const recurring = make({ isRecurring: true, recurringInterval: 'monthly' });
const nonRecurring = make({ isRecurring: false });
const expense = make({ type: 'expense' });
const income = make({ type: 'income' });
const transfer = make({ type: 'transfer' });
const foodTxn = make({ categoryId: 10, description: '' });
const transportTxn = make({ categoryId: 20, description: '' });
const namedTxn = make({ description: 'Netflix subscription' });
const allTxns = [recurring, nonRecurring, expense, income, transfer, foodTxn, transportTxn, namedTxn];

const defaultFilters = {
  searchTerm: '',
  filterType: '',
  filterAccount: '',
  filterCategory: '',
  filterRecurring: '',
  filterAmountMin: '',
  filterAmountMax: '',
  filterTag: '',
  getAccountName,
  getCategoryName,
};

describe('filterTransactions', () => {
  it('returns all transactions when no filters are applied', () => {
    const result = filterTransactions(allTxns, defaultFilters);
    expect(result).toHaveLength(allTxns.length);
  });

  it('returns empty array for empty input', () => {
    const result = filterTransactions([], defaultFilters);
    expect(result).toEqual([]);
  });

  describe('filterRecurring', () => {
    it('filters only recurring transactions', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        filterRecurring: 'recurring',
      });
      expect(result).toHaveLength(1);
      expect(result[0].isRecurring).toBe(true);
      expect(result[0]).toEqual(recurring);
    });

    it('filters only non-recurring transactions', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        filterRecurring: 'non-recurring',
      });
      expect(result.length).toBeGreaterThan(0);
      result.forEach(txn => {
        expect(txn.isRecurring).toBe(false);
      });
    });

    it('shows all transactions when filterRecurring is empty', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        filterRecurring: '',
      });
      expect(result).toHaveLength(allTxns.length);
    });
  });

  describe('filterType', () => {
    it('filters by expense type', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        filterType: 'expense',
      });
      expect(result.length).toBeGreaterThan(0);
      result.forEach(txn => expect(txn.type).toBe('expense'));
    });

    it('filters by income type', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        filterType: 'income',
      });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('income');
    });

    it('filters by transfer type', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        filterType: 'transfer',
      });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('transfer');
    });
  });

  describe('filterAccount', () => {
    it('filters by account id', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        filterAccount: '1',
      });
      result.forEach(txn => expect(txn.accountId).toBe(1));
    });

    it('returns empty when no transactions match account', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        filterAccount: '999',
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('filterCategory', () => {
    it('filters by category id', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        filterCategory: '10',
      });
      expect(result.length).toBeGreaterThan(0);
      result.forEach(txn => expect(txn.categoryId).toBe(10));
    });
  });

  describe('searchTerm', () => {
    it('filters by description text', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        searchTerm: 'Netflix',
      });
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Netflix subscription');
    });

    it('is case insensitive', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        searchTerm: 'netflix',
      });
      expect(result).toHaveLength(1);
    });

    it('searches in category name', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        searchTerm: 'Food',
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it('searches in account name', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        searchTerm: 'Cash',
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns empty when no match', () => {
      const result = filterTransactions(allTxns, {
        ...defaultFilters,
        searchTerm: 'zzzznotfound',
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('combined filters', () => {
    it('combines recurring + type filter', () => {
      // Create a recurring expense
      const recurringExpense = make({ type: 'expense', isRecurring: true, recurringInterval: 'monthly' });
      const txns = [recurringExpense, make({ type: 'income', isRecurring: true, recurringInterval: 'weekly' })];

      const result = filterTransactions(txns, {
        ...defaultFilters,
        filterRecurring: 'recurring',
        filterType: 'expense',
      });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('expense');
      expect(result[0].isRecurring).toBe(true);
    });

    it('combines search + type filter', () => {
      const match = make({ description: 'Salary payment', type: 'income' });
      const noMatch = make({ description: 'Salary payment', type: 'expense' });
      const txns = [match, noMatch];

      const result = filterTransactions(txns, {
        ...defaultFilters,
        searchTerm: 'Salary',
        filterType: 'income',
      });
      expect(result).toHaveLength(1);
    });
  });
});
