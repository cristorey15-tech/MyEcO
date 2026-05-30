import Dexie, { type Table } from 'dexie';
import type { Account, Transaction, Category, Budget, Goal, Debt, SharedBudget, ExchangeRate, RateHistory } from '@/types';

class MyEcoDB extends Dexie {
  accounts!: Table<Account, number>;
  transactions!: Table<Transaction, number>;
  categories!: Table<Category, number>;
  budgets!: Table<Budget, number>;
  goals!: Table<Goal, number>;
  debts!: Table<Debt, number>;
  sharedBudgets!: Table<SharedBudget, number>;
  exchangeRates!: Table<ExchangeRate, number>;
  rateHistory!: Table<RateHistory, number>;

  constructor() {
    super('MyEcoDB');
    this.version(2).stores({
      accounts: '++id, type, currency, isArchived',
      transactions: '++id, type, accountId, toAccountId, categoryId, date, currency, [type+date]',
      categories: '++id, type, isDefault',
      budgets: '++id, categoryId, [month+year]',
      goals: '++id, accountId',
      debts: '++id, type',
      sharedBudgets: '++id',
      exchangeRates: '++id, [fromCurrency+toCurrency]',
      rateHistory: '++id, [fromCurrency+toCurrency]',
    });
    // Handle migration from v1 to v2
    this.version(1).upgrade(async (tx) => {
      // rateHistory table is new, no data migration needed
    });
  }
}

export const db = new MyEcoDB();

// Seed default categories
export async function seedCategories() {
  const count = await db.categories.count();
  if (count === 0) {
    const { DEFAULT_CATEGORIES } = await import('@/types');
    const now = new Date();
    const categories = DEFAULT_CATEGORIES.map(c => ({
      name: c.nameEs,
      type: c.type,
      icon: c.icon,
      color: c.color,
      isDefault: true,
      createdAt: now,
    }));
    await db.categories.bulkAdd(categories as Category[]);
  }
}

// Helper to get current balance for an account
export async function getAccountBalance(accountId: number): Promise<number> {
  const account = await db.accounts.get(accountId);
  if (!account) return 0;

  const txns = await db.transactions
    .where({ accountId })
    .toArray();

  let balance = account.initialBalance;
  for (const t of txns) {
    if (t.type === 'income') balance += t.amount;
    else if (t.type === 'expense') balance -= t.amount;
    else if (t.type === 'transfer') {
      if (t.accountId === accountId) balance -= t.amount;
    }
  }

  // Add incoming transfers
  const incomingTxns = await db.transactions
    .where({ toAccountId: accountId })
    .toArray();
  for (const t of incomingTxns) {
    balance += t.amount;
  }

  return balance;
}

// Check if demo data exists (has accounts with transactions)
export async function demoDataExists(): Promise<boolean> {
  const accountCount = await db.accounts.count();
  const txnCount = await db.transactions.count();
  return accountCount > 0 || txnCount > 0;
}

// Compute spent amount for a budget
export async function getBudgetSpent(categoryId: number, month: number, year: number): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const txns = await db.transactions
    .where({ categoryId, type: 'expense' })
    .filter(t => {
      const d = new Date(t.date);
      return d >= startDate && d <= endDate;
    })
    .toArray();

  return txns.reduce((sum, t) => sum + t.amount, 0);
}
