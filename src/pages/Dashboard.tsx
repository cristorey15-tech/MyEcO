import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAccountBalance } from '@/lib/db';
import { formatCurrency, formatDate, convertAmount, batchConvertAmounts, cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip as UITooltip } from '@/components/ui/tooltip';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, TrendingDown, Plus, ArrowLeftRight, PiggyBank, AlertTriangle, BellRing, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '@/stores/useToastStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { defaultCurrency } = useAppStore();

  const accounts = useLiveQuery(() => db.accounts.filter(a => !a.isArchived).toArray());

  // Separate query: last 10 recent transactions for the list view
  const recentTransactions = useLiveQuery(() =>
    db.transactions.orderBy('date').reverse().limit(10).toArray()
  );

  // Separate query: ALL transactions from current month for accurate summary
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

  const [balances, setBalances] = useState<Record<number, number>>({});
  const [convertedBalances, setConvertedBalances] = useState<Record<number, number>>({});
  const [ratesReady, setRatesReady] = useState(false);

  // Batch-convert all accounts at once (auto-fetch rates if missing first)
  useEffect(() => {
    if (!accounts || accounts.length === 0) return;
    let cancelled = false;
    (async () => {
      // Auto-fetch exchange rates if none exist yet
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

      // Batch-convert all balances
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

  // Batch-convert monthly transactions at once
  const [monthlySummary, setMonthlySummary] = useState({ income: 0, expense: 0 });
  const [convertedSpendingData, setConvertedSpendingData] = useState<{name: string; value: number; color: string}[]>([]);

  const [budgetComparison, setBudgetComparison] = useState<{
    categoryId: number;
    categoryName: string;
    categoryColor: string;
    budgeted: number;
    spent: number;
    percentage: number;
  }[]>([]);

  const addToast = useToastStore((s) => s.addToast);
  const notifiedOverspent = useRef(false);

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

      // Build converted spending data for pie chart
      const data = Object.entries(spendingByCat).map(([catId, amount]) => {
        const cat = categories.find(c => c.id === Number(catId));
        return {
          name: cat?.name || 'Sin categoría',
          value: amount,
          color: cat?.color || '#6b7280',
        };
      }).sort((a, b) => b.value - a.value).slice(0, 6);
      setConvertedSpendingData(data);

      // Build budget comparison (actual vs budgeted)
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

        // Show toast notification for overspent budgets (once per load)
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

  const getCategoryName = (id: number) => {
    return categories?.find(c => c.id === id)?.name || '—';
  };

  const getAccountName = (id: number) => {
    return accounts?.find(a => a.id === id)?.name || '—';
  };

  // Show loading skeleton until all data AND rates are ready
  const isLoading = !accounts || !recentTransactions || !monthlyTransactions || !categories || !monthlyBudgets;
  const isConverting = accounts && accounts.length > 0 && !ratesReady;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <UITooltip content={t('common.add') + ' ' + t('common.transaction')}>
          <Button onClick={() => navigate('/transactions')} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.add')} {t('common.transaction')}</span>
          </Button>          </UITooltip>
        </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-6 animate-pulse">
            <Skeleton className="h-4 w-24 bg-white/20" />
            <Skeleton className="h-8 w-36 mt-3 bg-white/20" />
          </div>
          {[1, 2].map(i => (
            <Card key={i}><CardContent><Skeleton className="h-4 w-16" /><Skeleton className="h-8 w-28 mt-3" /></CardContent></Card>
          ))}
        </div>
      ) : isConverting ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-6 animate-pulse">
            <Skeleton className="h-4 w-24 bg-white/20" />
            <Skeleton className="h-8 w-36 mt-3 bg-white/20" />
            <Skeleton className="h-4 w-32 mt-3 bg-white/20" />
          </div>
          {[1, 2].map(i => (
            <Card key={i}><CardContent><Skeleton className="h-4 w-16" /><Skeleton className="h-8 w-28 mt-3" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{t('common.income')}</p>
              <div className="p-2 rounded-lg bg-green-50">
                <TrendingUp className="w-4 h-4 text-income" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(monthlySummary.income, defaultCurrency)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{t('reports.currentMonth')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{t('common.expense')}</p>
              <div className="p-2 rounded-lg bg-red-50">
                <TrendingDown className="w-4 h-4 text-expense" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(monthlySummary.expense, defaultCurrency)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{t('reports.currentMonth')}</p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-900">{t('reports.spendingByCategory')}</h2>
          </CardHeader>
          <CardContent>
            {spendingData.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-40 h-40 min-w-[160px] min-h-[160px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={spendingData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {spendingData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value) => formatCurrency(Number(value), defaultCurrency)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {spendingData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-600">{item.name}</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(item.value, defaultCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>{t('common.noData')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accounts Overview */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-900">{t('accounts.title')}</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts?.length ? (
              accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
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
                      <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                      <p className="text-xs text-gray-400">{t(`accounts.${acc.type}`)}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(balances[acc.id!] || 0, acc.currency)}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">{t('accounts.title')}</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigate('/accounts')}>
                  <Plus className="w-4 h-4" />
                  {t('accounts.newAccount')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget Overview */}
      {budgetComparison.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-primary" />
                <h2 className="text-base font-semibold text-gray-900">{t('budgets.title')}</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/budgets')}>
                {t('common.all')}
                <ArrowLeftRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Total summary bar */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
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

            {/* Overspent budget alerts */}
            {(() => {
              const overspent = budgetComparison.filter(c => c.percentage > 100);
              if (overspent.length > 0) {
                return (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <BellRing className="w-4 h-4 text-danger" />
                      <span className="text-sm font-semibold text-red-800">{t('budgets.alerts')}</span>
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-200 text-red-700 ml-auto">
                        {overspent.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {overspent.slice(0, 4).map((item) => (
                        <div key={item.categoryId} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <AlertTriangle className="w-3.5 h-3.5 text-danger flex-shrink-0" />
                            <span className="text-red-700 truncate">{item.categoryName}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-xs font-medium text-red-600">
                              +{Math.round(item.percentage - 100)}%
                            </span>
                            <span className="text-xs text-red-500">
                              {formatCurrency(item.spent - item.budgeted, defaultCurrency)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {overspent.length > 4 && (
                      <button
                        onClick={() => navigate('/budgets')}
                        className="text-xs text-red-600 hover:text-red-700 hover:underline mt-1.5"
                      >
                        +{overspent.length - 4} {t('budgets.title').toLowerCase()} excedidos
                      </button>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {budgetComparison.length > 0 && budgetComparison.filter(c => c.percentage > 100).length === 0 && (
              <div className="mb-3 flex items-center gap-2 text-xs text-gray-400">
                <CheckCircle className="w-3.5 h-3.5 text-secondary" />
                <span>{t('budgets.noOverspent')}</span>
              </div>
            )}

            {/* Category budget bars */}
            <div className="space-y-3">
              {budgetComparison.slice(0, 5).map((item) => (
                <div key={item.categoryId} className="group">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.categoryColor }}
                      />
                      <span className="text-gray-700 truncate">{item.categoryName}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-xs text-gray-500">
                        {formatCurrency(item.spent, defaultCurrency)}
                        <span className="text-gray-300"> / {formatCurrency(item.budgeted, defaultCurrency)}</span>
                      </span>
                      {item.percentage > 100 && (
                        <AlertTriangle className="w-3.5 h-3.5 text-danger flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        item.percentage > 100 ? 'bg-danger' : item.percentage >= 75 ? 'bg-warning' : 'bg-secondary'
                      )}
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {budgetComparison.length > 5 && (
              <p className="text-xs text-gray-400 mt-3 text-center">
                +{budgetComparison.length - 5} {t('budgets.title').toLowerCase()} ·{' '}
                <button
                  onClick={() => navigate('/budgets')}
                  className="text-primary hover:underline"
                >
                  {t('common.all')}
                </button>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">{t('transactions.recent')}</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')}>
              {t('common.all')}
              <ArrowLeftRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentTransactions?.length ? (
            <div className="divide-y divide-gray-50">
              {recentTransactions.slice(0, 5).map((txn) => (
                <div key={txn.id} className="flex items-center justify-between py-3 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center',
                      txn.type === 'income' ? 'bg-green-50' : txn.type === 'expense' ? 'bg-red-50' : 'bg-blue-50'
                    )}>
                      {txn.type === 'income' ? (
                        <ArrowUpRight className="w-4 h-4 text-income" />
                      ) : txn.type === 'expense' ? (
                        <ArrowDownRight className="w-4 h-4 text-expense" />
                      ) : (
                        <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{txn.description || getCategoryName(txn.categoryId)}</p>
                      <p className="text-xs text-gray-400">
                        {getAccountName(txn.accountId)} · {formatDate(txn.date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'text-sm font-semibold',
                      txn.type === 'income' ? 'text-income' : txn.type === 'expense' ? 'text-expense' : 'text-gray-900'
                    )}>
                      {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}
                      {formatCurrency(txn.amount, txn.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">{t('common.noData')}</p>
              <UITooltip content={t('transactions.newTransaction')}>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/transactions')}>
                <Plus className="w-4 h-4" />
                {t('transactions.newTransaction')}
              </Button>
            </UITooltip>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
