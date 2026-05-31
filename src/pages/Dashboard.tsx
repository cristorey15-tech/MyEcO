import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { db, getAccountBalance } from '@/lib/db';
import { formatCurrency, formatDate, batchConvertAmounts, cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip as UITooltip } from '@/components/ui/tooltip';
import {
  ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, TrendingDown, Plus,
  ArrowLeftRight, AlertTriangle, BellRing, CheckCircle, House, ShoppingBag,
  PiggyBank, Settings2, GripVertical
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '@/stores/useToastStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { calculateFiftyThirtyTwenty, type FiftyThirtyTwentyData } from '@/lib/fiftyThirtyTwenty';
import { DashboardWidget } from '@/components/dashboard/DashboardWidget';
import { WidgetCustomizer } from '@/components/dashboard/WidgetCustomizer';
import {
  loadWidgetConfig, saveWidgetConfig,
  type WidgetConfig, type WidgetId,
} from '@/lib/dashboardWidgets';

export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { defaultCurrency } = useAppStore();
  const setTransactionFilters = useAppStore((s) => s.setTransactionFilters);

  const accounts = useLiveQuery(() => db.accounts.filter(a => !a.isArchived).toArray());
  const recentTransactions = useLiveQuery(() =>
    db.transactions.orderBy('date').reverse().limit(10).toArray()
  );
  const monthlyTransactions = useLiveQuery(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return db.transactions
      .filter(t => new Date(t.date).getTime() >= startOfMonth)
      .toArray();
  });
  const categories = useLiveQuery(() => db.categories.toArray());
  const monthlyBudgets = useLiveQuery(() => {
    const now = new Date();
    return db.budgets
      .where({ month: now.getMonth() + 1, year: now.getFullYear() })
      .toArray();
  });

  const goals = useLiveQuery(() => db.goals.toArray());

  const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfig[]>(() => loadWidgetConfig());
  const [showCustomizer, setShowCustomizer] = useState(false);

  const saveWidgets = useCallback((widgets: WidgetConfig[]) => {
    setWidgetConfigs(widgets);
    saveWidgetConfig(widgets);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWidgetConfigs((prev) => {
      const oldIndex = prev.findIndex((w) => w.id === active.id);
      const newIndex = prev.findIndex((w) => w.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(oldIndex, 1);
      copy.splice(newIndex, 0, moved);
      saveWidgetConfig(copy);
      return copy;
    });
  }

  // State for data processing
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [convertedBalances, setConvertedBalances] = useState<Record<number, number>>({});
  const [ratesReady, setRatesReady] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState({ income: 0, expense: 0 });
  const [convertedSpendingData, setConvertedSpendingData] = useState<{name: string; value: number; color: string; categoryId: number}[]>([]);
  const [budgetComparison, setBudgetComparison] = useState<{
    categoryId: number;
    categoryName: string;
    categoryColor: string;
    budgeted: number;
    spent: number;
    percentage: number;
  }[]>([]);
  const [fiftyThirtyTwentyData, setFiftyThirtyTwentyData] = useState<FiftyThirtyTwentyData | null>(null);

  const addToast = useToastStore((s) => s.addToast);
  const notifiedOverspent = useRef(false);

  // Batch-convert account balances
  useEffect(() => {
    if (!accounts || accounts.length === 0) return;
    let cancelled = false;
    (async () => {
      const count = await db.exchangeRates.count();
      if (count === 0) {
        const { fetchAllRates } = await import('@/lib/exchangeRateService');
        const result = await fetchAllRates();
        if (!result.success) {
          console.warn('Auto-fetch rates failed:', result.errors.join(', '));
        }
      }
      if (cancelled) return;
      const results = await Promise.all(
        accounts.map(async (acc) => {
          const balance = await getAccountBalance(acc.id!);
          return { id: acc.id!, balance, currency: acc.currency };
        })
      );
      if (cancelled) return;
      const newBalances: Record<number, number> = {};
      results.forEach(r => { newBalances[r.id] = r.balance; });
      setBalances(newBalances);
      const converted = await batchConvertAmounts(
        results.map(r => ({ amount: r.balance, from: r.currency })),
        defaultCurrency
      );
      if (cancelled) return;
      const newConverted: Record<number, number> = {};
      results.forEach((r, i) => { newConverted[r.id] = converted[i]; });
      setConvertedBalances(newConverted);
      setRatesReady(true);
    })().catch(err => {
      console.error('Error loading account balances:', err);
      setRatesReady(true);
    });
    return () => { cancelled = true; };
  }, [accounts, defaultCurrency]);

  // Process monthly transactions
  useEffect(() => {
    if (!monthlyTransactions || !categories) return;
    batchConvertAmounts(
      monthlyTransactions.map(t => ({ amount: t.amount, from: t.currency })),
      defaultCurrency
    ).then(converted => {
      let incomeSum = 0;
      let expenseSum = 0;
      const spendingByCat: Record<number, number> = {};

      monthlyTransactions.forEach((t, i) => {
        const convertedAmount = converted[i];
        if (t.type === 'income') {
          incomeSum += convertedAmount;
        } else if (t.type === 'expense') {
          expenseSum += convertedAmount;
          spendingByCat[t.categoryId] = (spendingByCat[t.categoryId] || 0) + convertedAmount;
        }
      });
      setMonthlySummary({ income: incomeSum, expense: expenseSum });

      const data = Object.entries(spendingByCat).map(([catId, amount]) => {
        const cat = categories.find(c => c.id === Number(catId));
        return {
          name: cat?.name || 'Sin categoría',
          value: amount,
          color: cat?.color || '#6b7280',
          categoryId: Number(catId),
        };
      }).sort((a, b) => b.value - a.value).slice(0, 6);
      setConvertedSpendingData(data);

      if (categories) {
        calculateFiftyThirtyTwenty(monthlyTransactions, categories, defaultCurrency)
          .then(setFiftyThirtyTwentyData)
          .catch(() => setFiftyThirtyTwentyData(null));
      }

      if (monthlyBudgets && monthlyBudgets.length > 0) {
        const comparison = monthlyBudgets.map(b => {
          const spent = spendingByCat[b.categoryId] || 0;
          const cat = categories.find(c => c.id === b.categoryId);
          return {
            categoryId: b.categoryId,
            categoryName: cat?.name || '—',
            categoryColor: cat?.color || '#6b7280',
            budgeted: b.amount,
            spent,
            percentage: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
          };
        }).sort((a, b) => b.percentage - a.percentage);
        setBudgetComparison(comparison);

        const overspent = comparison.filter(c => c.percentage > 100);
        if (overspent.length > 0 && !notifiedOverspent.current) {
          notifiedOverspent.current = true;
          addToast({
            title: t('budgets.overspent'),
            message: t('budgets.overspentCategories', { count: overspent.length }),
            variant: 'warning',
            duration: 8000,
          });
        }
      } else {
        setBudgetComparison([]);
      }
    }).catch(err => console.error('Error converting monthly transactions:', err));
  }, [monthlyTransactions, defaultCurrency, categories, monthlyBudgets]);

  const totalBalance = Object.values(convertedBalances).reduce((sum, b) => sum + b, 0);
  const spendingData = convertedSpendingData;

  const getCategoryName = (id: number) => categories?.find(c => c.id === id)?.name || '—';
  const getAccountName = (id: number) => accounts?.find(a => a.id === id)?.name || '—';

  const isLoading = !accounts || !recentTransactions || !monthlyTransactions || !categories || !monthlyBudgets || !goals;
  const isConverting = accounts && accounts.length > 0 && !ratesReady;

  // Get visible widgets in order
  const visibleWidgets = widgetConfigs.filter(w => w.visible);
  const visibleWidgetIds = visibleWidgets.map(w => w.id);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header t={t} navigate={navigate} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-primary to-primary-dark dark:from-primary-dark dark:to-primary/80 rounded-2xl p-6 animate-pulse">
            <Skeleton className="h-4 w-24 bg-white/20" />
            <Skeleton className="h-8 w-36 mt-3 bg-white/20" />
          </div>
          {[1, 2].map(i => (
            <Card key={i}><CardContent><Skeleton className="h-4 w-16" /><Skeleton className="h-8 w-28 mt-3" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  // Converting state
  if (isConverting) {
    return (
      <div className="space-y-6">
        <Header t={t} navigate={navigate} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-primary to-primary-dark dark:from-primary-dark dark:to-primary/80 rounded-2xl p-6 animate-pulse">
            <Skeleton className="h-4 w-24 bg-white/20" />
            <Skeleton className="h-8 w-36 mt-3 bg-white/20" />
            <Skeleton className="h-4 w-32 mt-3 bg-white/20" />
          </div>
          {[1, 2].map(i => (
            <Card key={i}><CardContent><Skeleton className="h-4 w-16" /><Skeleton className="h-8 w-28 mt-3" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header t={t} navigate={navigate} onCustomize={() => setShowCustomizer(true)} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleWidgetIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {visibleWidgets.map((w) => (
              <DashboardWidget key={w.id} id={w.id}>
                {renderWidget(w.id)}
              </DashboardWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {showCustomizer && (
        <WidgetCustomizer
          widgets={widgetConfigs}
          onSave={saveWidgets}
          onClose={() => setShowCustomizer(false)}
        />
      )}
    </div>
  );

  function renderWidget(widgetId: WidgetId) {
    switch (widgetId) {
      case 'netWorth':
        return renderNetWorth();
      case 'incomeExpense':
        return renderIncomeExpense();
      case 'spendingByCategory':
        return renderSpendingByCategory();
      case 'accountsOverview':
        return renderAccountsOverview();
      case 'fiftyThirtyTwenty':
        return renderFiftyThirtyTwenty();
      case 'budgetOverview':
        return renderBudgetOverview();
      case 'recentTransactions':
        return renderRecentTransactions();
      case 'goalsSummary':
        return renderGoalsSummary();
      default:
        return null;
    }
  }

  function renderNetWorth() {
    return (
      <Card className="bg-gradient-to-br from-primary to-primary-dark text-white border-0">
        <CardContent>
          <p className="text-sm text-blue-100 font-medium">{t('common.netWorth')}</p>
          <p className="text-3xl font-bold mt-2">{formatCurrency(totalBalance, defaultCurrency)}</p>
          <div className="flex items-center gap-2 mt-3 text-sm text-blue-100">
            <Wallet className="w-4 h-4" />
            <span>{accounts?.length || 0} {t('accounts.title').toLowerCase()}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderIncomeExpense() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.income')}</p>
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30">
                <TrendingUp className="w-4 h-4 text-income" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {formatCurrency(monthlySummary.income, defaultCurrency)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('reports.currentMonth')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.expense')}</p>
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30">
                <TrendingDown className="w-4 h-4 text-expense" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {formatCurrency(monthlySummary.expense, defaultCurrency)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('reports.currentMonth')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function handleCategoryClick(categoryId: number) {
    setTransactionFilters({ filterCategory: String(categoryId), currentPage: 1 });
    navigate('/transactions');
  }

  function renderSpendingByCategory() {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('reports.spendingByCategory')}</h2>
        </CardHeader>
        <CardContent>
          {spendingData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-40 h-40 min-w-[160px] min-h-[160px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={spendingData}
                      cx="50%" cy="50%"
                      innerRadius={35} outerRadius={65}
                      paddingAngle={3} dataKey="value"
                      onClick={(data: any) => handleCategoryClick(data?.categoryId)}
                      cursor="pointer"
                    >
                      {spendingData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} onClick={() => handleCategoryClick(entry.categoryId)} cursor="pointer" />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => formatCurrency(Number(value), defaultCurrency)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {spendingData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => handleCategoryClick(item.categoryId)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600 dark:text-gray-300">{item.name}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(item.value, defaultCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <p>{t('common.noData')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderAccountsOverview() {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('accounts.title')}</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts?.length ? (
            accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                onClick={() => navigate('/accounts')}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: acc.color || '#2563eb' }}
                  >
                    {acc.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{acc.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{t(`accounts.${acc.type}`)}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(balances[acc.id!] || 0, acc.currency)}
                </p>
              </div>
            ))
          ) : (
            <div className="text-center py-6 dark:text-gray-400">
              <p className="text-gray-400 text-sm">{t('accounts.title')}</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigate('/accounts')}>
                <Plus className="w-4 h-4" />
                {t('accounts.newAccount')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderFiftyThirtyTwenty() {
    if (!fiftyThirtyTwentyData || fiftyThirtyTwentyData.totalIncome <= 0) return null;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">50/30/20 {t('budgets.title')}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50">
              <div className="flex items-center gap-1.5 text-blue-700">
                <House className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">{t('fiftyThirtyTwenty.needs')}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(fiftyThirtyTwentyData.needs, defaultCurrency)}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">{fiftyThirtyTwentyData.needsPercentage.toFixed(0)}%</span>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', fiftyThirtyTwentyData.needsOnTrack ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}>
                  {fiftyThirtyTwentyData.needsOnTrack ? '✓' : '✗'} 50%
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800/50">
              <div className="flex items-center gap-1.5 text-purple-700">
                <ShoppingBag className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">{t('fiftyThirtyTwenty.wants')}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(fiftyThirtyTwentyData.wants, defaultCurrency)}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">{fiftyThirtyTwentyData.wantsPercentage.toFixed(0)}%</span>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', fiftyThirtyTwentyData.wantsOnTrack ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}>
                  {fiftyThirtyTwentyData.wantsOnTrack ? '✓' : '✗'} 30%
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800/50">
              <div className="flex items-center gap-1.5 text-green-700">
                <PiggyBank className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">{t('fiftyThirtyTwenty.savings')}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(fiftyThirtyTwentyData.savings, defaultCurrency)}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">{fiftyThirtyTwentyData.savingsPercentage.toFixed(0)}%</span>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', fiftyThirtyTwentyData.savingsOnTrack ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600')}>
                  {fiftyThirtyTwentyData.savingsOnTrack ? '✓' : '!'} 20%
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <span>{t('fiftyThirtyTwenty.current')}</span>
              </div>
              <div className="h-6 rounded-full overflow-hidden flex">
                <div className="bg-blue-500 transition-all duration-700" style={{ width: `${Math.max(1, fiftyThirtyTwentyData.needsPercentage)}%` }} />
                <div className="bg-purple-500 transition-all duration-700" style={{ width: `${Math.max(0, fiftyThirtyTwentyData.wantsPercentage)}%` }} />
                <div className="bg-green-500 transition-all duration-700" style={{ width: `${Math.max(0, fiftyThirtyTwentyData.savingsPercentage)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                <span>{t('fiftyThirtyTwenty.ideal')}</span>
              </div>
              <div className="h-4 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-700/50">
                <div className="bg-blue-300/60" style={{ width: '50%' }} />
                <div className="bg-purple-300/60" style={{ width: '30%' }} />
                <div className="bg-green-300/60" style={{ width: '20%' }} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="capitalize">{t('fiftyThirtyTwenty.needs')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="capitalize">{t('fiftyThirtyTwenty.wants')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="capitalize">{t('fiftyThirtyTwenty.savings')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderBudgetOverview() {
    if (budgetComparison.length === 0) return null;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('budgets.title')}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/budgets')}>
              {t('common.all')}
              <ArrowLeftRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(budgetComparison.reduce((s, b) => s + b.spent, 0), defaultCurrency)}
                <span className="text-sm text-gray-400 font-normal">
                  {' '}/ {formatCurrency(budgetComparison.reduce((s, b) => s + b.budgeted, 0), defaultCurrency)}
                </span>
              </p>
            </div>
            <span className={cn(
              'text-xs font-medium px-2 py-1 rounded-full',
              budgetComparison.reduce((s, b) => s + b.spent, 0) > budgetComparison.reduce((s, b) => s + b.budgeted, 0)
                ? 'bg-red-50 text-red-600'
                : 'bg-green-50 text-green-600'
            )}>
              {budgetComparison.reduce((s, b) => s + b.spent, 0) > budgetComparison.reduce((s, b) => s + b.budgeted, 0)
                ? t('budgets.overspent')
                : t('budgets.onTrack')}
            </span>
          </div>

          {(() => {
            const overspent = budgetComparison.filter(c => c.percentage > 100);
            if (overspent.length > 0) {
              return (
                <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <BellRing className="w-4 h-4 text-danger" />
                    <span className="text-sm font-semibold text-red-800">{t('budgets.alerts')}</span>
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-200 text-red-700 ml-auto">{overspent.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {overspent.slice(0, 4).map((item) => (
                      <div key={item.categoryId} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className="w-3.5 h-3.5 text-danger flex-shrink-0" />
                          <span className="text-red-700 truncate">{item.categoryName}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-xs font-medium text-red-600">+{Math.round(item.percentage - 100)}%</span>
                          <span className="text-xs text-red-500">{formatCurrency(item.spent - item.budgeted, defaultCurrency)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {overspent.length > 4 && (
                    <button onClick={() => navigate('/budgets')} className="text-xs text-red-600 hover:text-red-700 hover:underline mt-1.5">
                      +{overspent.length - 4} {t('budgets.title').toLowerCase()} excedidos
                    </button>
                  )}
                </div>
              );
            }
            return null;
          })()}

          {budgetComparison.length > 0 && budgetComparison.filter(c => c.percentage > 100).length === 0 && (
            <div className="mb-3 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <CheckCircle className="w-3.5 h-3.5 text-secondary" />
              <span>{t('budgets.noOverspent')}</span>
            </div>
          )}

          <div className="space-y-3">
            {budgetComparison.slice(0, 5).map((item) => (
              <div key={item.categoryId} className="group">
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.categoryColor }} />
                    <span className="text-gray-700 dark:text-gray-300 truncate">{item.categoryName}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatCurrency(item.spent, defaultCurrency)}
                      <span className="text-gray-300"> / {formatCurrency(item.budgeted, defaultCurrency)}</span>
                    </span>
                    {item.percentage > 100 && <AlertTriangle className="w-3.5 h-3.5 text-danger flex-shrink-0" />}
                  </div>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', item.percentage > 100 ? 'bg-danger' : item.percentage >= 75 ? 'bg-warning' : 'bg-secondary')}
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {budgetComparison.length > 5 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
              +{budgetComparison.length - 5} {t('budgets.title').toLowerCase()} ·{' '}
              <button onClick={() => navigate('/budgets')} className="text-primary hover:underline">{t('common.all')}</button>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderGoalsSummary() {
    if (!goals || goals.length === 0) {
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('goals.title')}</h2>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-gray-400 dark:text-gray-500 mb-3">{t('common.noData')}</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/goals')}>
                <Plus className="w-4 h-4" />
                {t('goals.newGoal')}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalCurrent = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const achieved = goals.filter(g => g.currentAmount >= g.targetAmount).length;
    const overallPercentage = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('goals.title')}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/goals')}>
              {t('common.all')}
              <ArrowLeftRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('common.total')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">{goals.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800/50">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">{t('goals.achieved')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">{achieved}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800/50">
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">{t('goals.progress')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">{overallPercentage}%</p>
            </div>
          </div>

          {/* Overall progress bar */}
          {goals.length > 1 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-500 dark:text-gray-400">{t('goals.progress')}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(totalCurrent, defaultCurrency)} / {formatCurrency(totalTarget, defaultCurrency)}
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-700"
                  style={{ width: `${Math.min(100, overallPercentage)}%` }}
                />
              </div>
            </div>
          )}

          {/* Individual goals */}
          <div className="space-y-3">
            {goals.slice(0, 5).map((goal) => {
              const pct = calculatePercentage(goal.currentAmount, goal.targetAmount);
              const isAchieved = goal.currentAmount >= goal.targetAmount;
              return (
                <div
                  key={goal.id}
                  className="group cursor-pointer rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => navigate('/goals')}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: goal.color || '#7c3aed' }}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {goal.name}
                      </span>
                      {isAchieved && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0 ml-2">
                      {formatCurrency(goal.targetAmount, goal.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
                    <span>
                      {formatCurrency(goal.currentAmount, goal.currency)}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        isAchieved ? 'bg-secondary' : 'bg-accent'
                      )}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {goals.length > 5 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
              +{goals.length - 5} {t('goals.title').toLowerCase()} ·{' '}
              <button onClick={() => navigate('/goals')} className="text-primary hover:underline">{t('common.all')}</button>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderRecentTransactions() {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('transactions.recent')}</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')}>
              {t('common.all')}
              <ArrowLeftRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentTransactions?.length ? (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/30">
              {recentTransactions.slice(0, 5).map((txn) => (
                <div key={txn.id} className="flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg px-2 -mx-2 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center',
                      txn.type === 'income' ? 'bg-green-50' : txn.type === 'expense' ? 'bg-red-50' : 'bg-blue-50'
                    )}>
                      {txn.type === 'income' ? <ArrowUpRight className="w-4 h-4 text-income" /> : txn.type === 'expense' ? <ArrowDownRight className="w-4 h-4 text-expense" /> : <ArrowLeftRight className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{txn.description || getCategoryName(txn.categoryId)}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{getAccountName(txn.accountId)} · {formatDate(txn.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-semibold', txn.type === 'income' ? 'text-income' : txn.type === 'expense' ? 'text-expense' : 'text-gray-900 dark:text-gray-100')}>
                      {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}{formatCurrency(txn.amount, txn.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">{t('common.noData')}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/transactions')}>
                <Plus className="w-4 h-4" />
                {t('transactions.newTransaction')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
}

// Separate header component
function Header({
  t,
  navigate,
  onCustomize,
}: {
  t: (key: string) => string;
  navigate: (path: string) => void;
  onCustomize?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('nav.dashboard')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onCustomize && (
          <UITooltip content={t('dashboardWidgets.customize')}>
            <Button variant="outline" size="icon" onClick={onCustomize}>
              <GripVertical className="w-4 h-4" />
            </Button>
          </UITooltip>
        )}
        <UITooltip content={`${t('common.add')} ${t('common.transaction')}`}>
          <Button onClick={() => navigate('/transactions')} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.add')} {t('common.transaction')}</span>
          </Button>
        </UITooltip>
      </div>
    </div>
  );
}
