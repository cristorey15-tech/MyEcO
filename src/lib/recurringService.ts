import { db } from './db';
import type { Transaction, RecurringInterval } from '@/types';

/**
 * Check and create recurring transactions that are due.
 * For each recurring transaction, we check when the last instance was created
 * and create a new one if enough time has passed based on the interval.
 */
export async function processRecurringTransactions(): Promise<number> {
  const recurringTxns = await db.transactions
    .where('isRecurring')
    .equals(1)
    .filter(t => t.recurringInterval != null)
    .toArray();

  let created = 0;

  for (const txn of recurringTxns) {
    const shouldCreate = await shouldCreateNewInstance(txn);
    if (shouldCreate) {
      await createRecurringInstance(txn);
      created++;
    }
  }

  return created;
}

/**
 * Determine if a new instance of a recurring transaction should be created.
 * Checks the last created instance date and compares with the interval.
 */
async function shouldCreateNewInstance(txn: Transaction): Promise<boolean> {
  if (!txn.recurringInterval) return false;

  // Find the most recent instance of this recurring series
  // We identify series by matching description + accountId + categoryId + isRecurring flag
  // For the original recurring template, we check its own createdAt
  const lastInstance = await db.transactions
    .where({ isRecurring: 0 }) // Look for non-recurring instances
    .filter(t =>
      t.description === txn.description &&
      t.accountId === txn.accountId &&
      t.categoryId === txn.categoryId
    )
    .reverse()
    .first();

  // Use the last instance date, or the original transaction date
  const lastDate = lastInstance ? new Date(lastInstance.date) : new Date(txn.date);
  const now = new Date();

  switch (txn.recurringInterval) {
    case 'daily':
      return daysBetween(lastDate, now) >= 1;
    case 'weekly':
      return daysBetween(lastDate, now) >= 7;
    case 'monthly':
      return monthsBetween(lastDate, now) >= 1;
    case 'yearly':
      return monthsBetween(lastDate, now) >= 12;
    default:
      return false;
  }
}

/**
 * Create a new instance of a recurring transaction.
 */
async function createRecurringInstance(template: Transaction): Promise<void> {
  const now = new Date();
  const newDate = calculateNextDate(template.date, template.recurringInterval!);

  // Don't create future instances
  if (newDate > now) return;

  const newTxn: Omit<Transaction, 'id'> = {
    type: template.type,
    accountId: template.accountId,
    toAccountId: template.toAccountId,
    categoryId: template.categoryId,
    amount: template.amount,
    currency: template.currency,
    date: newDate,
    description: template.description,
    notes: template.notes,
    tags: [...template.tags],
    isRecurring: false, // This instance is not itself recurring
    recurringInterval: undefined,
    createdAt: now,
    updatedAt: now,
  };

  await db.transactions.add(newTxn);

  // Update the template's createdAt to track when we last processed it
  await db.transactions.update(template.id!, {
    updatedAt: now,
  });
}

/**
 * Calculate the next date for a recurring transaction based on its interval.
 */
function calculateNextDate(originalDate: Date, interval: RecurringInterval): Date {
  const d = new Date(originalDate);
  const now = new Date();

  switch (interval) {
    case 'daily': {
      // Find next occurrence before or equal to today
      const next = new Date(now);
      next.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
      return next;
    }
    case 'weekly': {
      const dayOfWeek = d.getDay();
      const next = new Date(now);
      next.setDate(next.getDate() + ((dayOfWeek - next.getDay() + 7) % 7));
      next.setHours(d.getHours(), d.getMinutes(), d.getSeconds());
      if (next > now) {
        next.setDate(next.getDate() - 7);
      }
      return next;
    }
    case 'monthly': {
      const next = new Date(now.getFullYear(), now.getMonth(), d.getDate());
      next.setHours(d.getHours(), d.getMinutes(), d.getSeconds());
      if (next > now) {
        next.setMonth(next.getMonth() - 1);
      }
      return next;
    }
    case 'yearly': {
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      next.setMonth(d.getMonth(), d.getDate());
      next.setHours(d.getHours(), d.getMinutes(), d.getSeconds());
      if (next > now) {
        next.setFullYear(next.getFullYear() - 1);
      }
      return next;
    }
    default:
      return now;
  }
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = b.getTime() - a.getTime();
  return Math.floor(diff / msPerDay);
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
