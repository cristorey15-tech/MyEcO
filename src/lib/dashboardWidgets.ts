export type WidgetId =
  | 'netWorth'
  | 'incomeExpense'
  | 'spendingByCategory'
  | 'accountsOverview'
  | 'fiftyThirtyTwenty'
  | 'budgetOverview'
  | 'recentTransactions'
  | 'goalsSummary';

export interface WidgetConfig {
  id: WidgetId;
  visible: boolean;
}

const STORAGE_KEY = 'myeco-dashboard-widgets';

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'netWorth', visible: true },
  { id: 'incomeExpense', visible: true },
  { id: 'spendingByCategory', visible: true },
  { id: 'accountsOverview', visible: true },
  { id: 'fiftyThirtyTwenty', visible: true },
  { id: 'budgetOverview', visible: true },
  { id: 'recentTransactions', visible: true },
  { id: 'goalsSummary', visible: true },
];

export function loadWidgetConfig(): WidgetConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [...DEFAULT_WIDGETS];
    const parsed = JSON.parse(saved) as WidgetConfig[];
    // Merge with defaults in case new widgets were added
    const defaultIds = new Set(DEFAULT_WIDGETS.map(w => w.id));
    const existingIds = new Set(parsed.map(w => w.id));
    const merged = parsed.filter(w => defaultIds.has(w.id));
    for (const def of DEFAULT_WIDGETS) {
      if (!existingIds.has(def.id)) {
        merged.push(def);
      }
    }
    return merged;
  } catch {
    return [...DEFAULT_WIDGETS];
  }
}

export function saveWidgetConfig(widgets: WidgetConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  } catch {
    // Silently fail
  }
}

export function getWidgetLabel(widgetId: WidgetId, t: (key: string) => string): string {
  const labels: Record<WidgetId, string> = {
    netWorth: t('dashboardWidgets.netWorth'),
    incomeExpense: t('dashboardWidgets.incomeExpense'),
    spendingByCategory: t('dashboardWidgets.spendingByCategory'),
    accountsOverview: t('dashboardWidgets.accountsOverview'),
    fiftyThirtyTwenty: t('dashboardWidgets.fiftyThirtyTwenty'),
    budgetOverview: t('dashboardWidgets.budgetOverview'),
    recentTransactions: t('dashboardWidgets.recentTransactions'),
    goalsSummary: t('dashboardWidgets.goalsSummary'),
  };
  return labels[widgetId] || widgetId;
}
