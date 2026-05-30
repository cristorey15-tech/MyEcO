import { db } from './db';
import type { Account, Transaction, Budget, Goal, Debt, Category } from '@/types';

/**
 * Seed the app with demo data for a new user to explore.
 * Creates accounts, categories, transactions, budgets, goals, and debts.
 */
export async function seedDemoData(): Promise<void> {
  // Categories are already seeded by seedCategories() in App.tsx
  const allCategories = await db.categories.toArray();
  const salaryCat = allCategories.find(c => c.name === 'Salario') || allCategories[0];
  const foodCat = allCategories.find(c => c.name === 'Alimentación') || allCategories[1];
  const transportCat = allCategories.find(c => c.name === 'Transporte') || allCategories[1];
  const housingCat = allCategories.find(c => c.name === 'Vivienda') || allCategories[2];
  const entertainmentCat = allCategories.find(c => c.name === 'Entretenimiento') || allCategories[5];
  const freelanceCat = allCategories.find(c => c.name === 'Freelance') || allCategories[1];
  const subscriptionsCat = allCategories.find(c => c.name === 'Suscripciones') || allCategories[0];
  const healthCat = allCategories.find(c => c.name === 'Salud') || allCategories[4];
  const shoppingCat = allCategories.find(c => c.name === 'Compras') || allCategories[7];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Create accounts
  const account1 = await db.accounts.add({
    name: 'Checking Account',
    type: 'checking',
    currency: 'USD',
    balance: 1250,
    initialBalance: 250,
    color: '#2563eb',
    icon: 'credit-card',
    isArchived: false,
    createdAt: new Date(currentYear, 0, 1),
    updatedAt: new Date(currentYear, 0, 1),
  } as Account);

  const account2 = await db.accounts.add({
    name: 'Cash',
    type: 'cash',
    currency: 'USD',
    balance: 175,
    initialBalance: 100,
    color: '#059669',
    icon: 'wallet',
    isArchived: false,
    createdAt: new Date(currentYear, 0, 1),
    updatedAt: new Date(currentYear, 0, 1),
  } as Account);

  const account3 = await db.accounts.add({
    name: 'Credit Card',
    type: 'credit_card',
    currency: 'USD',
    balance: -425,
    initialBalance: 0,
    color: '#dc2626',
    icon: 'credit-card',
    isArchived: false,
    createdAt: new Date(currentYear, 0, 1),
    updatedAt: new Date(currentYear, 0, 1),
  } as Account);

  const account4 = await db.accounts.add({
    name: 'Savings',
    type: 'savings',
    currency: 'USD',
    balance: 2250,
    initialBalance: 1500,
    color: '#7c3aed',
    icon: 'piggy-bank',
    isArchived: false,
    createdAt: new Date(currentYear, 0, 1),
    updatedAt: new Date(currentYear, 0, 1),
  } as Account);

  const account5 = await db.accounts.add({
    name: 'Bolívares (Efectivo)',
    type: 'cash',
    currency: 'VES',
    balance: 450,
    initialBalance: 200,
    color: '#d97706',
    icon: 'wallet',
    isArchived: false,
    createdAt: new Date(currentYear, 0, 1),
    updatedAt: new Date(currentYear, 0, 1),
  } as Account);

  // Create transactions for the past 3 months
  const transactions: Omit<Transaction, 'id'>[] = [];

  // Helper to create a date in the past months
  const d = (monthOffset: number, day: number) =>
    new Date(currentYear, currentMonth - monthOffset, day, 12, 0, 0);

  // Salary income (monthly)
  for (let m = 0; m < 3; m++) {
    transactions.push({
      type: 'income',
      accountId: account1,
      toAccountId: undefined,
      categoryId: salaryCat.id!,
      amount: 1750,
      currency: 'USD',
      date: d(m, 15),
      description: 'Monthly Salary',
      notes: '',
      tags: ['work'],
      isRecurring: true,
      recurringInterval: 'monthly',
      createdAt: d(m, 15),
      updatedAt: d(m, 15),
    });
  }

  // Freelance income
  transactions.push({
    type: 'income',
    accountId: account1,
    toAccountId: undefined,
    categoryId: freelanceCat.id!,
    amount: 400,
    currency: 'USD',
    date: d(0, 20),
    description: 'Freelance web design project',
    notes: 'Client: TechCorp',
    tags: ['freelance'],
    isRecurring: false,
    recurringInterval: undefined,
    createdAt: d(0, 20),
    updatedAt: d(0, 20),
  });

  // Housing expense
  for (let m = 0; m < 3; m++) {
    transactions.push({
      type: 'expense',
      accountId: account1,
      toAccountId: undefined,
      categoryId: housingCat.id!,
      amount: 425,
      currency: 'USD',
      date: d(m, 5),
      description: 'Apartment Rent',
      notes: '',
      tags: ['housing'],
      isRecurring: true,
      recurringInterval: 'monthly',
      createdAt: d(m, 5),
      updatedAt: d(m, 5),
    });
  }

  // Food expenses (several per month)
  const foodItems = [
    ['Weekly Groceries', 85],
    ['Fast Food', 25],
    ['Dinner with friends', 45],
    ['Restaurant', 35],
    ['Coffee & snacks', 15],
  ] as const;
  for (let m = 0; m < 3; m++) {
    for (let i = 0; i < foodItems.length; i++) {
      transactions.push({
        type: 'expense',
        accountId: i % 2 === 0 ? account1 : account2,
        toAccountId: undefined,
        categoryId: foodCat.id!,
        amount: foodItems[i][1],
        currency: 'USD',
        date: d(m, 7 + i * 4),
        description: foodItems[i][0],
        notes: '',
        tags: ['food'],
        isRecurring: false,
        recurringInterval: undefined,
        createdAt: d(m, 7 + i * 4),
        updatedAt: d(m, 7 + i * 4),
      });
    }
  }

  // Transport expenses
  const transportItems = [
    ['Gas', 60],
    ['Uber', 15],
    ['Bus pass', 25],
    ['Parking', 10],
  ] as const;
  for (let m = 0; m < 3; m++) {
    for (const [desc, amount] of transportItems) {
      transactions.push({
        type: 'expense',
        accountId: account2,
        toAccountId: undefined,
        categoryId: transportCat.id!,
        amount,
        currency: 'USD',
        date: d(m, 3 + Math.floor(Math.random() * 20)),
        description: desc,
        notes: '',
        tags: ['transport'],
        isRecurring: false,
        recurringInterval: undefined,
        createdAt: d(m, 3 + Math.floor(Math.random() * 20)),
        updatedAt: d(m, 3 + Math.floor(Math.random() * 20)),
      });
    }
  }

  // Entertainment
  const entertainmentItems = [
    ['Movie night', 28],
    ['Netflix', 15],
    ['Concert', 60],
    ['Video game', 45],
  ] as const;
  for (let m = 0; m < 2; m++) {
    const [entertainmentDesc, entertainmentAmount] = entertainmentItems[m];
    transactions.push({
      type: 'expense',
      accountId: account3,
      toAccountId: undefined,
      categoryId: entertainmentCat.id!,
      amount: entertainmentAmount,
      currency: 'USD',
      date: d(m, 12),
      description: entertainmentDesc,
      notes: '',
      tags: ['entertainment'],
      isRecurring: false,
      recurringInterval: undefined,
      createdAt: d(m, 12),
      updatedAt: d(m, 12),
    });
  }

  // Subscriptions
  transactions.push({
    type: 'expense',
    accountId: account3,
    toAccountId: undefined,
    categoryId: subscriptionsCat.id!,
    amount: 15,
    currency: 'USD',
    date: d(0, 1),
    description: 'Spotify Premium',
    notes: '',
    tags: ['subscriptions'],
    isRecurring: true,
    recurringInterval: 'monthly',
    createdAt: d(0, 1),
    updatedAt: d(0, 1),
  });

  // Health
  transactions.push({
    type: 'expense',
    accountId: account1,
    toAccountId: undefined,
    categoryId: healthCat.id!,
    amount: 80,
    currency: 'USD',
    date: d(0, 18),
    description: 'Doctor appointment',
    notes: 'Dr. Smith',
    tags: ['health'],
    isRecurring: false,
    recurringInterval: undefined,
    createdAt: d(0, 18),
    updatedAt: d(0, 18),
  });

  // Shopping
  transactions.push({
    type: 'expense',
    accountId: account3,
    toAccountId: undefined,
    categoryId: shoppingCat.id!,
    amount: 125,
    currency: 'USD',
    date: d(0, 22),
    description: 'New clothes',
    notes: '',
    tags: ['shopping'],
    isRecurring: false,
    recurringInterval: undefined,
    createdAt: d(0, 22),
    updatedAt: d(0, 22),
  });

  // Credit card payment (transfer)
  transactions.push({
    type: 'transfer',
    accountId: account1,
    toAccountId: account3,
    categoryId: salaryCat.id!,
    amount: 250,
    currency: 'USD',
    date: d(0, 10),
    description: 'Credit card payment',
    notes: '',
    tags: ['payments'],
    isRecurring: false,
    recurringInterval: undefined,
    createdAt: d(0, 10),
    updatedAt: d(0, 10),
  });

  // Transfer to savings
  transactions.push({
    type: 'transfer',
    accountId: account1,
    toAccountId: account4,
    categoryId: salaryCat.id!,
    amount: 150,
    currency: 'USD',
    date: d(0, 15),
    description: 'Transfer to savings',
    notes: '',
    tags: ['savings'],
    isRecurring: true,
    recurringInterval: 'monthly',
    createdAt: d(0, 15),
    updatedAt: d(0, 15),
  });

  // VES transaction
  transactions.push({
    type: 'expense',
    accountId: account5,
    toAccountId: undefined,
    categoryId: foodCat.id!,
    amount: 120,
    currency: 'VES',
    date: d(0, 8),
    description: 'Mercado local',
    notes: '',
    tags: ['food'],
    isRecurring: false,
    recurringInterval: undefined,
    createdAt: d(0, 8),
    updatedAt: d(0, 8),
  });

  // VES income
  transactions.push({
    type: 'income',
    accountId: account5,
    toAccountId: undefined,
    categoryId: freelanceCat.id!,
    amount: 300,
    currency: 'VES',
    date: d(0, 5),
    description: 'Pago freelance local',
    notes: '',
    tags: ['freelance'],
    isRecurring: false,
    recurringInterval: undefined,
    createdAt: d(0, 5),
    updatedAt: d(0, 5),
  });

  await db.transactions.bulkAdd(transactions as Transaction[]);

  // Create budgets for current month
  const budgets: Omit<Budget, 'id'>[] = [
    { categoryId: foodCat.id!, month: currentMonth + 1, year: currentYear, amount: 300, spent: 175, createdAt: now },
    { categoryId: transportCat.id!, month: currentMonth + 1, year: currentYear, amount: 100, spent: 55, createdAt: now },
    { categoryId: entertainmentCat.id!, month: currentMonth + 1, year: currentYear, amount: 75, spent: 73, createdAt: now },
    { categoryId: healthCat.id!, month: currentMonth + 1, year: currentYear, amount: 50, spent: 80, createdAt: now },
    { categoryId: shoppingCat.id!, month: currentMonth + 1, year: currentYear, amount: 100, spent: 125, createdAt: now },
    { categoryId: subscriptionsCat.id!, month: currentMonth + 1, year: currentYear, amount: 25, spent: 15, createdAt: now },
  ];
  await db.budgets.bulkAdd(budgets as Budget[]);

  // Create savings goals
  const goals: Omit<Goal, 'id'>[] = [
    {
      name: 'Emergency Fund',
      targetAmount: 3000,
      currentAmount: 2250,
      currency: 'USD',
      targetDate: new Date(currentYear + 1, 5, 1),
      color: '#059669',
      icon: 'shield',
      createdAt: new Date(currentYear, 0, 1),
      updatedAt: now,
    },
    {
      name: 'Trip to Japan',
      targetAmount: 4000,
      currentAmount: 750,
      currency: 'USD',
      targetDate: new Date(currentYear + 1, 11, 1),
      color: '#7c3aed',
      icon: 'plane',
      createdAt: new Date(currentYear, 2, 1),
      updatedAt: now,
    },
    {
      name: 'New Laptop',
      targetAmount: 1750,
      currentAmount: 400,
      currency: 'USD',
      targetDate: new Date(currentYear, 8, 1),
      color: '#2563eb',
      icon: 'laptop',
      createdAt: new Date(currentYear, 4, 1),
      updatedAt: now,
    },
  ];
  await db.goals.bulkAdd(goals as Goal[]);

  // Create debts
  const debts: Omit<Debt, 'id'>[] = [
    {
      name: 'Car Loan',
      type: 'owed',
      totalAmount: 7500,
      remainingAmount: 4250,
      currency: 'USD',
      interestRate: 8.5,
      installments: 36,
      paidInstallments: 18,
      dueDate: new Date(currentYear, currentMonth, 15),
      creditorName: 'National Bank',
      notes: 'Monthly payment of $260',
      createdAt: new Date(currentYear - 1, 5, 1),
      updatedAt: now,
    },
    {
      name: 'Loan to Carlos',
      type: 'lent',
      totalAmount: 250,
      remainingAmount: 100,
      currency: 'USD',
      interestRate: undefined,
      installments: undefined,
      paidInstallments: undefined,
      dueDate: new Date(currentYear, currentMonth + 1, 10),
      creditorName: 'Carlos Lopez',
      notes: 'For car repair',
      createdAt: new Date(currentYear, 0, 20),
      updatedAt: now,
    },
  ];
  await db.debts.bulkAdd(debts as Debt[]);

  // Update account balances to reflect transactions
  // (simplified - the dashboard computes balances dynamically)
}
