import { db } from './db';

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
 * Check debts for upcoming due dates (within the next 3 days)
 * and show a notification if any are due soon.
 */
export async function checkDebtReminders() {
  if (!hasNotificationPermission()) return;

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

  const budgets = await db.budgets.toArray();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  for (const budget of budgets) {
    if (budget.month !== currentMonth || budget.year !== currentYear) continue;

    const spent = await getBudgetSpentSimple(budget.categoryId, budget.month, budget.year);
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
    ]);
  } catch {
    // Silently fail — non-critical feature
  }
}

/**
 * Get budget spent for a category in a given month/year.
 * Lightweight version without importing the full db helper.
 */
async function getBudgetSpentSimple(categoryId: number, month: number, year: number): Promise<number> {
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

function formatCurrencySimple(amount: number, currency?: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
