import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1);
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getMonthName(month: number): string {
  const date = new Date(2000, month - 1);
  return new Intl.DateTimeFormat(undefined, { month: 'long' }).format(date);
}

export function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const { db } = await import('@/lib/db');

  // 1. Try exact match
  const rate = await db.exchangeRates
    .where({ fromCurrency: from, toCurrency: to })
    .first();
  if (rate) return rate.rate;

  // 2. Try inverse match
  const reverse = await db.exchangeRates
    .where({ fromCurrency: to, toCurrency: from })
    .first();
  if (reverse) return 1 / reverse.rate;

  // 3. Calculate cross-rate via USD base
  if (from !== 'USD' && to !== 'USD') {
    const [usdFrom, usdTo] = await Promise.all([
      db.exchangeRates.where({ fromCurrency: 'USD', toCurrency: from }).first(),
      db.exchangeRates.where({ fromCurrency: 'USD', toCurrency: to }).first(),
    ]);
    if (usdFrom && usdTo && usdFrom.rate > 0) {
      return usdTo.rate / usdFrom.rate;
    }
  }

  // 4. Try USD -> X if from is USD
  if (from === 'USD') {
    const usdRate = await db.exchangeRates
      .where({ fromCurrency: 'USD', toCurrency: to })
      .first();
    if (usdRate) return usdRate.rate;
  }

  // 5. Try X -> USD if to is USD
  if (to === 'USD') {
    const usdRate = await db.exchangeRates
      .where({ fromCurrency: 'USD', toCurrency: from })
      .first();
    if (usdRate) return 1 / usdRate.rate;
  }

  return 0;
}

export async function batchConvertAmounts(
  items: { amount: number; from: string }[],
  to: string
): Promise<number[]> {
  // Collect all unique source currencies
  const uniqueFrom = [...new Set(items.map(i => i.from))];

  // Fetch all needed rates in parallel
  const rateEntries = await Promise.all(
    uniqueFrom.map(async (from) => {
      if (from === to) return { from, rate: 1 };
      const rate = await getExchangeRate(from, to);
      return { from, rate: rate > 0 ? rate : 1 };
    })
  );

  const rateMap = Object.fromEntries(
    rateEntries.map(r => [r.from, r.rate])
  );

  return items.map(i => i.amount * (rateMap[i.from] || 1));
}

export async function convertAmount(amount: number, from: string, to: string): Promise<number> {
  if (from === to) return amount;
  const rate = await getExchangeRate(from, to);
  if (rate === 0) return amount; // fallback: show unconverted
  return amount * rate;
}
