import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach } from 'vitest';
import { db, getAccountBalance } from '../db';

const NOW = new Date('2025-06-01T00:00:00Z');

async function addAccount(overrides: Partial<Parameters<typeof db.accounts.add>[0]> = {}) {
  return db.accounts.add({
    name: 'Test Account',
    type: 'checking',
    currency: 'USD',
    balance: 0,
    initialBalance: 0,
    color: '#2563eb',
    icon: 'credit-card',
    isArchived: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as any);
}

async function addTxn(overrides: Partial<Parameters<typeof db.transactions.add>[0]> = {}) {
  return db.transactions.add({
    type: 'expense',
    accountId: 0,
    categoryId: 1,
    amount: 100,
    currency: 'USD',
    date: NOW,
    description: 'Test',
    notes: '',
    tags: [],
    isRecurring: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as any);
}

async function addRate(from: string, to: string, rate: number) {
  return db.exchangeRates.add({
    fromCurrency: from,
    toCurrency: to,
    rate,
    updatedAt: NOW,
  } as any);
}

describe('getAccountBalance', () => {
  beforeEach(async () => {
    await db.accounts.clear();
    await db.transactions.clear();
    await db.exchangeRates.clear();
  });

  // ------------------------------------------------------------------
  // Basic cases
  // ------------------------------------------------------------------
  it('returns 0 when account does not exist', async () => {
    const balance = await getAccountBalance(999);
    expect(balance).toBe(0);
  });

  it('returns initialBalance when there are no transactions', async () => {
    const id = await addAccount({ initialBalance: 500, balance: 500 });
    const balance = await getAccountBalance(id);
    expect(balance).toBe(500);
  });

  it('sums income and expense transactions in the same currency', async () => {
    const id = await addAccount({ initialBalance: 1000, balance: 1000, currency: 'USD' });
    await addTxn({ accountId: id, type: 'income', amount: 300, currency: 'USD' });
    await addTxn({ accountId: id, type: 'expense', amount: 100, currency: 'USD' });
    await addTxn({ accountId: id, type: 'expense', amount: 50, currency: 'USD' });

    const balance = await getAccountBalance(id);
    expect(balance).toBe(1150); // 1000 + 300 - 100 - 50
  });

  // ------------------------------------------------------------------
  // Multi-currency cases
  // ------------------------------------------------------------------
  it('converts income from a different currency to the account currency', async () => {
    // Account is in VES, receives income in USD
    const id = await addAccount({ initialBalance: 0, balance: 0, currency: 'VES' });
    await addRate('USD', 'VES', 35.0);

    // Income of 100 USD should become 3500 VES
    await addTxn({ accountId: id, type: 'income', amount: 100, currency: 'USD' });

    const balance = await getAccountBalance(id);
    expect(balance).toBe(3500);
  });

  it('converts expense in a different currency from the account currency', async () => {
    // Account is in VES, spends in USD
    const id = await addAccount({ initialBalance: 5000, balance: 5000, currency: 'VES' });
    await addRate('USD', 'VES', 35.0);

    // Expense of 50 USD → 1750 VES
    await addTxn({ accountId: id, type: 'expense', amount: 50, currency: 'USD' });

    const balance = await getAccountBalance(id);
    expect(balance).toBe(3250); // 5000 - 1750
  });

  it('handles mixed currency transactions correctly', async () => {
    const id = await addAccount({ initialBalance: 0, balance: 0, currency: 'VES' });
    await addRate('USD', 'VES', 35.0);
    await addRate('EUR', 'VES', 38.0);

    // Income: 100 USD → 3500 VES
    await addTxn({ accountId: id, type: 'income', amount: 100, currency: 'USD' });
    // Expense: 50 EUR → 1900 VES
    await addTxn({ accountId: id, type: 'expense', amount: 50, currency: 'EUR' });
    // Expense: 200 VES (same currency, no conversion)
    await addTxn({ accountId: id, type: 'expense', amount: 200, currency: 'VES' });

    const balance = await getAccountBalance(id);
    expect(balance).toBe(1400); // 3500 - 1900 - 200
  });

  it('does not convert transactions already in the account currency', async () => {
    const id = await addAccount({ initialBalance: 1000, balance: 1000, currency: 'USD' });
    // All in USD, no exchange rates needed
    await addTxn({ accountId: id, type: 'income', amount: 500, currency: 'USD' });
    await addTxn({ accountId: id, type: 'expense', amount: 200, currency: 'USD' });

    const balance = await getAccountBalance(id);
    expect(balance).toBe(1300); // 1000 + 500 - 200
  });

  // ------------------------------------------------------------------
  // Fallback when no exchange rate
  // ------------------------------------------------------------------
  it('falls back to original amount when no exchange rate found', async () => {
    const id = await addAccount({ initialBalance: 0, balance: 0, currency: 'VES' });
    // No exchange rates added — should use 1:1 fallback
    await addTxn({ accountId: id, type: 'income', amount: 100, currency: 'USD' });

    const balance = await getAccountBalance(id);
    // Falls back to original amount (100) since no rate found
    expect(balance).toBe(100);
  });

  // ------------------------------------------------------------------
  // Transfers
  // ------------------------------------------------------------------
  it('converts outgoing transfer amounts to the account currency', async () => {
    const fromId = await addAccount({ initialBalance: 5000, balance: 5000, currency: 'VES' });
    const toId = await addAccount({ initialBalance: 0, balance: 0, currency: 'USD' });
    await addRate('USD', 'VES', 35.0);

    // Transfer 100 USD from VES account
    await addTxn({ accountId: fromId, toAccountId: toId, type: 'transfer', amount: 100, currency: 'USD' });

    const balance = await getAccountBalance(fromId);
    expect(balance).toBe(1500); // 5000 - (100 * 35)
  });

  it('converts incoming transfer amounts to the receiving account currency', async () => {
    const fromId = await addAccount({ initialBalance: 0, balance: 0, currency: 'USD' });
    const toId = await addAccount({ initialBalance: 2000, balance: 2000, currency: 'VES' });
    await addRate('USD', 'VES', 35.0);

    // Transfer 50 USD to VES account
    await addTxn({ accountId: fromId, toAccountId: toId, type: 'transfer', amount: 50, currency: 'USD' });

    const balance = await getAccountBalance(toId);
    expect(balance).toBe(3750); // 2000 + (50 * 35)
  });

  it('handles transfers with same currency between accounts', async () => {
    const fromId = await addAccount({ initialBalance: 1000, balance: 1000, currency: 'USD' });
    const toId = await addAccount({ initialBalance: 500, balance: 500, currency: 'USD' });

    await addTxn({ accountId: fromId, toAccountId: toId, type: 'transfer', amount: 300, currency: 'USD' });

    const fromBalance = await getAccountBalance(fromId);
    const toBalance = await getAccountBalance(toId);

    expect(fromBalance).toBe(700);  // 1000 - 300
    expect(toBalance).toBe(800);     // 500 + 300
  });

  // ------------------------------------------------------------------
  // Edge cases
  // ------------------------------------------------------------------
  it('handles multiple converts from the same foreign currency', async () => {
    const id = await addAccount({ initialBalance: 1000, balance: 1000, currency: 'VES' });
    await addRate('USD', 'VES', 35.0);

    await addTxn({ accountId: id, type: 'income', amount: 10, currency: 'USD' });
    await addTxn({ accountId: id, type: 'income', amount: 20, currency: 'USD' });
    await addTxn({ accountId: id, type: 'expense', amount: 5, currency: 'USD' });

    const balance = await getAccountBalance(id);
    expect(balance).toBe(1875); // 1000 + (10*35) + (20*35) - (5*35)
  });

  it('returns correct balance for a single income transaction', async () => {
    const id = await addAccount({ initialBalance: 0, balance: 0, currency: 'USD' });
    await addTxn({ accountId: id, type: 'income', amount: 500, currency: 'USD' });

    const balance = await getAccountBalance(id);
    expect(balance).toBe(500);
  });

  it('returns negative balance when expenses exceed income and initial balance', async () => {
    const id = await addAccount({ initialBalance: 100, balance: 100, currency: 'USD' });
    await addTxn({ accountId: id, type: 'expense', amount: 300, currency: 'USD' });

    const balance = await getAccountBalance(id);
    expect(balance).toBe(-200);
  });
});
