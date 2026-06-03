export interface Account {
  id?: number;
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  initialBalance: number;
  color: string;
  icon: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AccountType = 'cash' | 'checking' | 'savings' | 'credit_card' | 'investment';

export interface Transaction {
  id?: number;
  type: TransactionType;
  accountId: number;
  toAccountId?: number;
  categoryId: number;
  amount: number;
  currency: string;
  date: Date;
  description: string;
  notes: string;
  tags: string[];
  isRecurring: boolean;
  recurringInterval?: RecurringInterval;
  templateId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type RecurringInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Category {
  id?: number;
  name: string;
  type: 'income' | 'expense';
  categoryType?: 'need' | 'want';
  icon: string;
  color: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface Budget {
  id?: number;
  categoryId: number;
  month: number;
  year: number;
  amount: number;
  spent: number;
  createdAt: Date;
}

export interface Goal {
  id?: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  targetDate?: Date;
  accountId?: number;
  color: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Debt {
  id?: number;
  name: string;
  type: 'owed' | 'lent';
  totalAmount: number;
  remainingAmount: number;
  currency: string;
  interestRate?: number;
  installments?: number;
  paidInstallments?: number;
  dueDate?: Date;
  creditorName?: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharedBudget {
  id?: number;
  name: string;
  participants: Participant[];
  expenses: SharedExpense[];
  createdAt: Date;
}

export interface Participant {
  name: string;
  color: string;
}

export interface SharedExpense {
  description: string;
  amount: number;
  paidBy: string;
  date: Date;
  splitBetween: string[];
}

export interface ExchangeRate {
  id?: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  updatedAt: Date;
}

export interface RateHistory {
  id?: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: Date;
}

export type Currency = {
  code: string;
  name: string;
  symbol: string;
  flag: string;
};

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs.', flag: '🇻🇪' },
  { code: 'MXN', name: 'Peso Mexicano', symbol: '$', flag: '🇲🇽' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'COP', name: 'Peso Colombiano', symbol: '$', flag: '🇨🇴' },
  { code: 'ARS', name: 'Peso Argentino', symbol: '$', flag: '🇦🇷' },
  { code: 'CLP', name: 'Peso Chileno', symbol: '$', flag: '🇨🇱' },
  { code: 'PEN', name: 'Sol Peruano', symbol: 'S/', flag: '🇵🇪' },
  { code: 'BRL', name: 'Real Brasileño', symbol: 'R$', flag: '🇧🇷' },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£', flag: '🇬🇧' },
];

export const ACCOUNT_TYPES: { value: AccountType; labelEs: string; labelEn: string; icon: string }[] = [
  { value: 'cash', labelEs: 'Efectivo', labelEn: 'Cash', icon: 'wallet' },
  { value: 'checking', labelEs: 'Débito', labelEn: 'Checking', icon: 'credit-card' },
  { value: 'savings', labelEs: 'Ahorros', labelEn: 'Savings', icon: 'piggy-bank' },
  { value: 'credit_card', labelEs: 'Tarjeta de Crédito', labelEn: 'Credit Card', icon: 'credit-card' },
  { value: 'investment', labelEs: 'Inversión', labelEn: 'Investment', icon: 'trending-up' },
];

export const DEFAULT_CATEGORIES: { nameEs: string; nameEn: string; type: 'income' | 'expense'; categoryType?: 'need' | 'want'; icon: string; color: string }[] = [
  // Income
  { nameEs: 'Salario', nameEn: 'Salary', type: 'income', icon: 'briefcase', color: '#059669' },
  { nameEs: 'Freelance', nameEn: 'Freelance', type: 'income', icon: 'laptop', color: '#2563eb' },
  { nameEs: 'Inversiones', nameEn: 'Investments', type: 'income', icon: 'trending-up', color: '#7c3aed' },
  { nameEs: 'Regalos', nameEn: 'Gifts', type: 'income', icon: 'gift', color: '#d97706' },
  { nameEs: 'Otros Ingresos', nameEn: 'Other Income', type: 'income', icon: 'plus-circle', color: '#6b7280' },
  // Expenses
  { nameEs: 'Alimentación', nameEn: 'Food', type: 'expense', categoryType: 'need', icon: 'utensils', color: '#dc2626' },
  { nameEs: 'Transporte', nameEn: 'Transport', type: 'expense', categoryType: 'need', icon: 'car', color: '#2563eb' },
  { nameEs: 'Vivienda', nameEn: 'Housing', type: 'expense', categoryType: 'need', icon: 'home', color: '#d97706' },
  { nameEs: 'Servicios', nameEn: 'Utilities', type: 'expense', categoryType: 'need', icon: 'zap', color: '#ca8a04' },
  { nameEs: 'Salud', nameEn: 'Health', type: 'expense', categoryType: 'need', icon: 'heart', color: '#dc2626' },
  { nameEs: 'Entretenimiento', nameEn: 'Entertainment', type: 'expense', categoryType: 'want', icon: 'film', color: '#7c3aed' },
  { nameEs: 'Educación', nameEn: 'Education', type: 'expense', categoryType: 'need', icon: 'book', color: '#2563eb' },
  { nameEs: 'Compras', nameEn: 'Shopping', type: 'expense', categoryType: 'want', icon: 'shopping-bag', color: '#db2777' },
  { nameEs: 'Viajes', nameEn: 'Travel', type: 'expense', categoryType: 'want', icon: 'plane', color: '#0891b2' },
  { nameEs: 'Suscripciones', nameEn: 'Subscriptions', type: 'expense', categoryType: 'want', icon: 'repeat', color: '#6b7280' },
  { nameEs: 'Impuestos', nameEn: 'Taxes', type: 'expense', categoryType: 'need', icon: 'file-text', color: '#dc2626' },
  { nameEs: 'Otros Gastos', nameEn: 'Other Expenses', type: 'expense', categoryType: 'need', icon: 'more-horizontal', color: '#6b7280' },
];
