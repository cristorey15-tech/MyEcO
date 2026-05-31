import { db, getBudgetSpent } from './db';

/**
 * Request notification permission from the browser.
 * Returns true if granted, false otherwise.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function hasNotificationPermission(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

// Anti-spam: cooldown between same-type notifications (1 hour)
const NOTIFICATION_COOLDOWN_MS = 60 * 60 * 1000;

function canNotify(key: string): boolean {
  try {
    const last = localStorage.getItem(`notify:${key}`);
    if (!last) return true;
    const ts = parseInt(last, 10);
    if (isNaN(ts)) return true;
    return Date.now() - ts > NOTIFICATION_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markNotified(key: string) {
  try {
    localStorage.setItem(`notify:${key}`, String(Date.now()));
  } catch {
    // localStorage may be unavailable
  }
}

// Check if user opted out of recurring payment reminders
function areRecurringRemindersEnabled(): boolean {
  try {
    return localStorage.getItem('myeco-recurring-reminders') !== 'false';
  } catch {
    return true;
  }
}

// Get reminder days-before setting (default 3)
function getReminderDaysBefore(): number {
  try {
    const val = localStorage.getItem('myeco-recurring-days-before');
    if (val) return Math.max(1, Math.min(7, parseInt(val, 10) || 3));
    return 3;
  } catch {
    return 3;
  }
}

// Check if user opted out of budget alerts
function areBudgetAlertsEnabled(): boolean {
  try {
    return localStorage.getItem('myeco-budget-alerts') !== 'false';
  } catch {
    return true;
  }
}

// Check if user opted out of goal milestones
function areGoalMilestonesEnabled(): boolean {
  try {
    return localStorage.getItem('myeco-goal-milestones') !== 'false';
  } catch {
    return true;
  }
}

// Check if user opted out of debt reminders
function areDebtRemindersEnabled(): boolean {
  try {
    return localStorage.getItem('myeco-debt-reminders') !== 'false';
  } catch {
    return true;
  }
}

/**
 * Show a local notification with the given title and body.
 * Respects the "do not disturb" flag and only shows if permission is granted.
 */
export function showLocalNotification(title: string, body: string, tag?: string) {
  if (!hasNotificationPermission()) return;

  const dedupKey = tag || 'myeco';
  if (!canNotify(dedupKey)) return;

  try {
    // Check if "do not disturb" is active (9pm - 8am)
    const hour = new Date().getHours();
    if (hour >= 21 || hour < 8) return; // Respect quiet hours

    const notification = new Notification(title, {
      body,
      tag: dedupKey,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      silent: false,
      requireInteraction: false,
    });

    // Focus the app when the notification is clicked
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 8 seconds
    setTimeout(() => notification.close(), 8000);

    markNotified(dedupKey);
  } catch {
    // Notification API may fail in some browsers
  }
}

/**
 * Check recurring transactions for upcoming payments (within configurable days).
 * This is the key function for recurring payment reminders.
 */
export async function checkRecurringPaymentReminders() {
  if (!hasNotificationPermission()) return;
  if (!areRecurringRemindersEnabled()) return;

  try {
    const recurringTxns = await db.transactions
      .where('isRecurring')
      .equals(1)
      .filter(t => t.recurringInterval != null)
      .toArray();

    if (recurringTxns.length === 0) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysBefore = getReminderDaysBefore();
    const lookAhead = new Date(today.getTime() + daysBefore * 24 * 60 * 60 * 1000);

    const categories = await db.categories.toArray();
    const accounts = await db.accounts.toArray();

    for (const txn of recurringTxns) {
      // Calculate the next expected due date based on the interval
      const nextDue = calculateNextRecurringDate(txn.date, txn.recurringInterval!);

      // Skip if next due date is in the past (should have been processed already)
      if (nextDue < today) continue;
      // Skip if outside our look-ahead window
      if (nextDue > lookAhead) continue;

      const daysUntilDue = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const category = categories.find(c => c.id === txn.categoryId);
      const account = accounts.find(a => a.id === txn.accountId);

      // Format amount with currency
      const formattedAmount = formatCurrencySimple(txn.amount, txn.currency);
      const categoryName = category?.name || 'Sin categoría';
      const accountName = account?.name || '';

      if (daysUntilDue === 0) {
        showLocalNotification(
          `📅 ${txn.description || categoryName}`,
          `Vence hoy — ${formattedAmount}${accountName ? ` · ${accountName}` : ''}`,
          `recurring-${txn.id}`
        );
      } else {
        showLocalNotification(
          `⏰ Recordatorio: ${txn.description || categoryName}`,
          `Vence en ${daysUntilDue} día${daysUntilDue !== 1 ? 's' : ''} — ${formattedAmount}${accountName ? ` · ${accountName}` : ''}`,
          `recurring-${txn.id}`
        );
      }
    }
  } catch {
    // Silently fail
  }
}

/**
 * Calculate the next future due date for a recurring transaction.
 * Given the original start date and interval, finds the most recent
 * occurrence that is either today or in the future.
 */
function calculateNextRecurringDate(originalDate: Date, interval: string): Date {
  const start = new Date(originalDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (interval) {
    case 'daily': {
      // Every day — next due is today (or today if already passed)
      const next = new Date(today);
      next.setHours(start.getHours(), start.getMinutes(), 0, 0);
      if (next < today) next.setDate(next.getDate() + 1);
      return next;
    }
    case 'weekly': {
      // Same day of week each week
      const dayOfWeek = start.getDay();
      const next = new Date(today);
      const diff = (dayOfWeek - next.getDay() + 7) % 7;
      next.setDate(next.getDate() + diff);
      next.setHours(start.getHours(), start.getMinutes(), 0, 0);
      if (next < today) next.setDate(next.getDate() + 7);
      return next;
    }
    case 'monthly': {
      // Same day of month each month
      const next = new Date(today.getFullYear(), today.getMonth(), start.getDate());
      next.setHours(start.getHours(), start.getMinutes(), 0, 0);
      if (next < today) next.setMonth(next.getMonth() + 1);
      return next;
    }
    case 'yearly': {
      // Same month/day each year
      const next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
      next.setHours(start.getHours(), start.getMinutes(), 0, 0);
      if (next < today) next.setFullYear(next.getFullYear() + 1);
      return next;
    }
    default:
      return today;
  }
}

/**
 * Check debts for upcoming due dates (within the next 3 days)
 * and show a notification if any are due soon.
 */
export async function checkDebtReminders() {
  if (!hasNotificationPermission()) return;
  if (!areDebtRemindersEnabled()) return;

  const debts = await db.debts.toArray();
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const debt of debts) {
    if (!debt.dueDate || debt.remainingAmount <= 0) continue;

    const dueDate = new Date(debt.dueDate);
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    // Due today
    if (dueDay.getTime() === today.getTime()) {
      showLocalNotification(
        `📅 Vence hoy: ${debt.name}`,
        debt.type === 'owed'
          ? `Debes pagar ${formatCurrencySimple(debt.remainingAmount, debt.currency)}`
          : `Te deben pagar ${formatCurrencySimple(debt.remainingAmount, debt.currency)}`,
        `debt-${debt.id}`
      );
    }
    // Due within 3 days
    else if (dueDay.getTime() > today.getTime() && dueDay.getTime() <= threeDaysFromNow.getTime()) {
      const daysLeft = Math.ceil((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      showLocalNotification(
        `⏰ Recordatorio: ${debt.name}`,
        `Vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''} — ${formatCurrencySimple(debt.remainingAmount, debt.currency)}`,
        `debt-${debt.id}`
      );
    }
  }
}

/**
 * Check budget status and notify if any budgets are overspent or near limit.
 */
export async function checkBudgetAlerts() {
  if (!hasNotificationPermission()) return;
  if (!areBudgetAlertsEnabled()) return;

  const budgets = await db.budgets.toArray();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  for (const budget of budgets) {
    if (budget.month !== currentMonth || budget.year !== currentYear) continue;

    const spent = await getBudgetSpent(budget.categoryId, budget.month, budget.year);
    const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    if (spent >= budget.amount && budget.amount > 0) {
      showLocalNotification(
        '🚨 Presupuesto excedido',
        `Has gastado ${formatCurrencySimple(spent)} de ${formatCurrencySimple(budget.amount)} en esta categoría`,
        `budget-${budget.id}`
      );
    } else if (percentage >= 80 && percentage < 100) {
      showLocalNotification(
        '⚠️ Presupuesto casi al límite',
        `Has usado el ${Math.round(percentage)}% de tu presupuesto (${formatCurrencySimple(spent)} de ${formatCurrencySimple(budget.amount)})`,
        `budget-${budget.id}`
      );
    }
  }
}

/**
 * Check savings goals progress and notify of achievements.
 */
export async function checkGoalMilestones() {
  if (!hasNotificationPermission()) return;
  if (!areGoalMilestonesEnabled()) return;

  const goals = await db.goals.toArray();

  for (const goal of goals) {
    if (goal.targetAmount <= 0) continue;

    const percentage = (goal.currentAmount / goal.targetAmount) * 100;

    // Newly achieved (between 95% and 100%)
    if (percentage >= 100 && goal.currentAmount > 0) {
      showLocalNotification(
        '🎉 Meta alcanzada: ' + goal.name,
        `¡Felicidades! Completaste tu meta de ahorro de ${formatCurrencySimple(goal.targetAmount, goal.currency)}`,
        `goal-${goal.id}`
      );
    }
    // 50% milestone
    else if (percentage >= 50 && percentage < 55) {
      showLocalNotification(
        '🏆 ¡Vas por buen camino!',
        `Llevas el ${Math.round(percentage)}% de tu meta "${goal.name}"`,
        `goal-half-${goal.id}`
      );
    }
  }
}

/**
 * Run all periodic checks (for use in setInterval or on app focus).
 */
export async function runAllPeriodicChecks() {
  if (!hasNotificationPermission()) return;

  try {
    await Promise.all([
      checkDebtReminders(),
      checkBudgetAlerts(),
      checkGoalMilestones(),
      checkRecurringPaymentReminders(),
    ]);
  } catch {
    // Silently fail — non-critical feature
  }
}

/**
 * Also export the recurring-specific check functions for use in App.tsx
 */
export { areRecurringRemindersEnabled, getReminderDaysBefore };

function formatCurrencySimple(amount: number, currency?: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
