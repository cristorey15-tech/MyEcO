import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { formatCurrency, formatDate, getCurrentYear, batchConvertAmounts, cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import {
  BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon,
  Download, TrendingUp, TrendingDown, Wallet,
  ArrowUpRight, ArrowDownRight, ArrowLeftRight,
} from 'lucide-react';
import type { Transaction } from '@/types';

// Custom tooltip component for all charts
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 px-4 py-3 text-sm">
      <p className="font-medium text-gray-900 dark:text-gray-100 mb-1.5">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-500 dark:text-gray-400">{entry.name}:</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Interactive legend component with toggle toggles
function ChartLegend({ payload, onToggle, hiddenSeries }: any) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
      {payload.map((entry: any, idx: number) => {
        const isHidden = hiddenSeries?.has(entry.dataKey);
        return (
          <button
            key={idx}
            onClick={() => onToggle?.(entry.dataKey)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium transition-all duration-200',
              isHidden
                ? 'text-gray-300 dark:text-gray-600 line-through'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            )}
          >
            <div
              className={cn('w-2.5 h-2.5 rounded-full transition-opacity', isHidden && 'opacity-30')}
              style={{ backgroundColor: entry.color }}
            />
            {entry.value}
          </button>
        );
      })}
    </div>
  );
}

export function Reports() {
  const { t } = useTranslation();
  const { defaultCurrency } = useAppStore();

  const transactions = useLiveQuery(() => db.transactions.toArray());
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  // Chart view selection for first card
  const [trendChartType, setTrendChartType] = useState<'bar' | 'area' | 'line'>('bar');
  // Hidden series for interactive legend
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  // Drill-down state
  const [drillModal, setDrillModal] = useState<{ open: boolean; title: string; transactions: Transaction[]; converted: number[] }>({ open: false, title: '', transactions: [], converted: [] });
  // Category detail modal
  const [catDetail, setCatDetail] = useState<{ open: boolean; categoryName: string; color: string; monthlyData: { month: string; amount: number }[] } | null>(null);

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = getCurrentYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  // Converted data
  const [convertedMonthlyData, setConvertedMonthlyData] = useState<Array<{
    month: string;
    monthLabel: string;
    monthNum: number;
    income: number;
    expense: number;
    net: number;
  }>>([]);

  const [convertedCategoryData, setConvertedCategoryData] = useState<Array<{
    name: string;
    value: number;
    color: string;
    count: number;
  }>>([]);

  // Net worth data (running balance)
  const [netWorthData, setNetWorthData] = useState<Array<{
    month: string;
    monthLabel: string;
    netWorth: number;
  }>>([]);

  // Category monthly breakdown for drill-down
  const [categoryMonthlyMap, setCategoryMonthlyMap] = useState<Map<string, { month: string; amount: number }[]>>(new Map());

  // Toggle series visibility
  const toggleSeries = useCallback((dataKey: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  }, []);

  // Convert all yearly transactions and compute data
  useEffect(() => {
    if (!transactions || !categories || !accounts) return;

    const yearTxns = transactions.filter(t => new Date(t.date).getFullYear() === selectedYear);

    if (yearTxns.length === 0) {
      setConvertedMonthlyData([]);
      setConvertedCategoryData([]);
      setNetWorthData([]);
      setCategoryMonthlyMap(new Map());
      return;
    }

    batchConvertAmounts(
      yearTxns.map(t => ({ amount: t.amount, from: t.currency })),
      defaultCurrency
    ).then(converted => {
      // --- Monthly data ---
      const months: Record<string, { income: number; expense: number; txns: Transaction[]; convertedAmounts: number[] }> = {};
      for (let m = 1; m <= 12; m++) {
        const key = `${selectedYear}-${String(m).padStart(2, '0')}`;
        months[key] = { income: 0, expense: 0, txns: [], convertedAmounts: [] };
      }

      yearTxns.forEach((t, i) => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (months[key]) {
          if (t.type === 'income') months[key].income += converted[i];
          else if (t.type === 'expense') months[key].expense += converted[i];
          months[key].txns.push(t);
          months[key].convertedAmounts.push(converted[i]);
        }
      });

      const monthlyData = Object.entries(months).map(([key, data]) => ({
        month: key,
        monthLabel: new Date(selectedYear, parseInt(key.split('-')[1]) - 1).toLocaleDateString(undefined, { month: 'short' }),
        monthNum: parseInt(key.split('-')[1]),
        income: data.income,
        expense: data.expense,
        net: data.income - data.expense,
      }));
      setConvertedMonthlyData(monthlyData);

      // --- Net worth trend (running balance from start of year) ---
      let runningNet = 0;
      const netWorth = monthlyData.map(m => {
        runningNet += m.net;
        return { month: m.month, monthLabel: m.monthLabel, netWorth: runningNet };
      });
      setNetWorthData(netWorth);

      // --- Category breakdown ---
      const spending: Record<number, { name: string; value: number; color: string; count: number }> = {};
      // Category monthly data for drill-down
      const catMonthlyMap = new Map<string, { month: string; amount: number }[]>();

      yearTxns.forEach((t, i) => {
        if (t.type !== 'expense') return;
        const cat = categories.find(c => c.id === t.categoryId);
        if (!spending[t.categoryId]) {
          spending[t.categoryId] = {
            name: cat?.name || 'Sin categoría',
            value: 0,
            color: cat?.color || '#6b7280',
            count: 0,
          };
        }
        spending[t.categoryId].value += converted[i];
        spending[t.categoryId].count++;

        // Build monthly data for this category
        const d = new Date(t.date);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const catKey = `${t.categoryId}`;
        if (!catMonthlyMap.has(catKey)) catMonthlyMap.set(catKey, []);
        const catMonthData = catMonthlyMap.get(catKey)!;
        const existing = catMonthData.find(m => m.month === monthKey);
        if (existing) existing.amount += converted[i];
        else catMonthData.push({ month: monthKey, amount: converted[i] });
      });
      setCategoryMonthlyMap(catMonthlyMap);

      setConvertedCategoryData(
        Object.values(spending).sort((a, b) => b.value - a.value)
      );
    });
  }, [transactions, categories, accounts, selectedYear, defaultCurrency]);

  // Totals
  const totalIncome = convertedMonthlyData.reduce((s, m) => s + m.income, 0);
  const totalExpense = convertedMonthlyData.reduce((s, m) => s + m.expense, 0);
  const netTotal = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((netTotal / totalIncome) * 100) : 0;

  // Click handler: drill down into a month's transactions
  const handleMonthClick = useCallback((monthNum: number) => {
    if (!transactions || !categories) return;
    const yearTxns = transactions.filter(t => new Date(t.date).getFullYear() === selectedYear);
    const monthTxns = yearTxns.filter(t => new Date(t.date).getMonth() + 1 === monthNum);

    if (monthTxns.length === 0) return;

    batchConvertAmounts(
      monthTxns.map(t => ({ amount: t.amount, from: t.currency })),
      defaultCurrency
    ).then(converted => {
      const monthLabel = new Date(selectedYear, monthNum - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      setDrillModal({ open: true, title: monthLabel, transactions: monthTxns, converted });
    });
  }, [transactions, categories, selectedYear, defaultCurrency]);

  // Click handler: drill down into a category
  const handleCategoryClick = useCallback((data: any, idx: number) => {
    if (!data) return;
    const catName = data.name || data;
    // Find monthly breakdown for this category
    const cat = categories?.find(c => c.name === catName || c.id === Number(data.categoryId));
    if (!cat) return;
    const catData = categoryMonthlyMap.get(`${cat.id}`) || [];
    setCatDetail({
      open: true,
      categoryName: cat.name,
      color: cat.color,
      monthlyData: catData.sort((a, b) => a.month.localeCompare(b.month)),
    });
  }, [categories, categoryMonthlyMap]);

  // Click on pie slice → open category detail
  const handlePieClick = useCallback((data: any) => {
    if (data?.name) {
      handleCategoryClick(data.name, 0);
    }
  }, [handleCategoryClick]);

  // Export functions
  const exportToExcel = () => {
    if (!transactions) return;
    const exportData = transactions.map(t => ({
      Date: new Date(t.date).toLocaleDateString(),
      Type: t.type,
      Description: t.description,
      Amount: t.amount,
      Currency: t.currency,
      Category: categories?.find(c => c.id === t.categoryId)?.name || '',
      Account: accounts?.find(a => a.id === t.accountId)?.name || '',
    }));
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
      XLSX.writeFile(wb, `myeco-transactions-${selectedYear}.xlsx`);
    });
  };

  const exportToCSV = () => {
    if (!transactions) return;
    const headers = ['Date,Type,Description,Amount,Currency,Category,Account'];
    const rows = transactions.map(t =>
      `${new Date(t.date).toLocaleDateString()},${t.type},"${(t.description || '').replace(/"/g, '""')}",${t.amount},${t.currency},${(categories?.find(c => c.id === t.categoryId)?.name || '').replace(/,/g, ' ')},${(accounts?.find(a => a.id === t.accountId)?.name || '').replace(/,/g, ' ')}`
    );
    const csv = [...headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `myeco-transactions-${selectedYear}.csv`;
    link.click();
  };

  // All months with data (for net worth legend)
  const monthsWithData = convertedMonthlyData.filter(m => m.income > 0 || m.expense > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('reports.title')}</h1>
        <div className="flex items-center gap-2">
          <Select
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            options={yearOptions}
          />
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={exportToExcel}>
              <Download className="w-4 h-4" />
              Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4" />
              CSV
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.income')}</p>
              <TrendingUp className="w-4 h-4 text-income" />
            </div>
            <p className="text-lg font-bold text-income">{formatCurrency(totalIncome, defaultCurrency)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{selectedYear}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.expense')}</p>
              <TrendingDown className="w-4 h-4 text-expense" />
            </div>
            <p className="text-lg font-bold text-expense">{formatCurrency(totalExpense, defaultCurrency)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{selectedYear}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.netWorth')}</p>
              <div className={cn('p-1 rounded-lg', netTotal >= 0 ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30')}>
                {netTotal >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-income" /> : <TrendingDown className="w-3.5 h-3.5 text-expense" />}
              </div>
            </div>
            <p className={cn('text-lg font-bold mt-0.5', netTotal >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-expense')}>
              {formatCurrency(netTotal, defaultCurrency)}
            </p>
            <p className={cn('text-[10px] mt-0.5', netTotal >= 0 ? 'text-secondary' : 'text-expense')}>
              {netTotal >= 0 ? '+' : ''}{savingsRate.toFixed(1)}% {t('fiftyThirtyTwenty.ofIncome')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('reports.cashFlow')}</p>
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {monthsWithData.length > 0
                ? formatCurrency(convertedMonthlyData.reduce((sum, m) => sum + Math.abs(m.net), 0) / Math.max(monthsWithData.length, 1), defaultCurrency)
                : '—'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{t('reports.avgMonthly')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('reports.monthlyTrend')}</h2>
            <div className="flex gap-1">
              {(['bar', 'area', 'line'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setTrendChartType(type)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    trendChartType === type
                      ? 'bg-primary-light text-primary dark:bg-primary/20'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  )}
                  title={type === 'bar' ? t('reports.incomeVsExpenses') : type === 'area' ? t('reports.cashFlow') : t('reports.netWorth')}
                >
                  {type === 'bar' ? <BarChart3 className="w-4 h-4" /> : type === 'area' ? <LineChartIcon className="w-4 h-4" /> : <LineChartIcon className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('reports.clickBarHint')}</p>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {trendChartType === 'bar' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={convertedMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-20" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <ReTooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v, defaultCurrency)} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Legend content={<ChartLegend onToggle={toggleSeries} hiddenSeries={hiddenSeries} />} />
                  {!hiddenSeries.has('income') && (
                    <Bar
                      dataKey="income"
                      name={t('common.income')}
                      fill="#059669"
                      radius={[4, 4, 0, 0]}
                      onClick={(data) => handleMonthClick(data?.monthNum)}
                      cursor="pointer"
                    />
                  )}
                  {!hiddenSeries.has('expense') && (
                    <Bar
                      dataKey="expense"
                      name={t('common.expense')}
                      fill="#dc2626"
                      radius={[4, 4, 0, 0]}
                      onClick={(data) => handleMonthClick(data?.monthNum)}
                      cursor="pointer"
                    />
                  )}
                  {!hiddenSeries.has('net') && (
                    <Bar
                      dataKey="net"
                      name={t('common.netWorth')}
                      fill="#7c3aed"
                      radius={[4, 4, 0, 0]}
                      opacity={0.6}
                      onClick={(data) => handleMonthClick(data?.monthNum)}
                      cursor="pointer"
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
            {trendChartType === 'area' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={convertedMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-20" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <ReTooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v, defaultCurrency)} />} />
                  <Legend content={<ChartLegend onToggle={toggleSeries} hiddenSeries={hiddenSeries} />} />
                  {!hiddenSeries.has('income') && (
                    <Area type="monotone" dataKey="income" name={t('common.income')} stroke="#059669" fill="#059669" fillOpacity={0.1} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  )}
                  {!hiddenSeries.has('expense') && (
                    <Area type="monotone" dataKey="expense" name={t('common.expense')} stroke="#dc2626" fill="#dc2626" fillOpacity={0.1} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  )}
                  {!hiddenSeries.has('net') && (
                    <Area type="monotone" dataKey="net" name={t('common.netWorth')} stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.05} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
            {trendChartType === 'line' && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={convertedMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-20" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <ReTooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v, defaultCurrency)} />} />
                  <Legend content={<ChartLegend onToggle={toggleSeries} hiddenSeries={hiddenSeries} />} />
                  {!hiddenSeries.has('income') && (
                    <Line type="monotone" dataKey="income" name={t('common.income')} stroke="#059669" strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  )}
                  {!hiddenSeries.has('expense') && (
                    <Line type="monotone" dataKey="expense" name={t('common.expense')} stroke="#dc2626" strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  )}
                  {!hiddenSeries.has('net') && (
                    <Line type="monotone" dataKey="net" name={t('common.netWorth')} stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Net Worth Trend & Cash Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Worth Trend */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('reports.netWorth')}</h2>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {netWorthData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={netWorthData}>
                    <defs>
                      <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-20" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, defaultCurrency)} />
                    <ReTooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v, defaultCurrency)} />} />
                    <Area type="monotone" dataKey="netWorth" name={t('common.netWorth')} stroke="#7c3aed" strokeWidth={2} fill="url(#netWorthGradient)" dot={{ r: 3, strokeWidth: 0, fill: '#7c3aed' }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-gray-400">{t('common.noData')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('reports.cashFlow')}</h2>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {convertedMonthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={convertedMonthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-20" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, defaultCurrency)} />
                    <ReTooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v, defaultCurrency)} />} />
                    <Bar
                      dataKey="net"
                      name={t('reports.cashFlow')}
                      radius={[4, 4, 0, 0]}
                      onClick={(data) => handleMonthClick(data?.monthNum)}
                      cursor="pointer"
                    >
                      {convertedMonthlyData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.net >= 0 ? '#059669' : '#dc2626'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-gray-400">{t('common.noData')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie / Donut */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('reports.spendingByCategory')}</h2>
          </CardHeader>
          <CardContent>
            {convertedCategoryData.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <div className="w-52 h-52 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={convertedCategoryData}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        onClick={(_, idx) => handlePieClick(convertedCategoryData[idx])}
                        cursor="pointer"
                      >
                        {convertedCategoryData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <ReTooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v, defaultCurrency)} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 w-full max-w-[220px]">
                  {convertedCategoryData.slice(0, 10).map((item, idx) => (
                    <button
                      key={item.name}
                      onClick={() => handlePieClick(item)}
                      className="w-full flex items-center gap-2 text-xs group hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg px-2 py-1 transition-colors text-left"
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{item.name}</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency(item.value, defaultCurrency)}</span>
                      <span className="text-gray-400 dark:text-gray-500 tabular-nums w-8 text-right">
                        {totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(0) : 0}%
                      </span>
                    </button>
                  ))}
                  {convertedCategoryData.length > 10 && (
                    <p className="text-[10px] text-gray-400 text-center pt-1">
                      +{convertedCategoryData.length - 10} {t('common.more')}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-52 flex items-center justify-center">
                <p className="text-sm text-gray-400">{t('common.noData')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Comparison (horizontal bars) */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('reports.categoryComparison')}</h2>
          </CardHeader>
          <CardContent>
            {convertedCategoryData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={convertedCategoryData.slice(0, 10).reverse()}
                    layout="vertical"
                    margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-20" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, defaultCurrency)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={90} />
                    <ReTooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v, defaultCurrency)} />} />
                    <Bar
                      dataKey="value"
                      name={t('common.expense')}
                      radius={[0, 4, 4, 0]}
                      onClick={(data) => handlePieClick(data)}
                      cursor="pointer"
                    >
                      {convertedCategoryData.slice(0, 10).reverse().map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-52 flex items-center justify-center">
                <p className="text-sm text-gray-400">{t('common.noData')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Detail Drill-down Modal */}
      <Modal
        isOpen={drillModal.open}
        onClose={() => setDrillModal(prev => ({ ...prev, open: false }))}
        title={`📅 ${drillModal.title}`}
        size="lg"
      >
        {drillModal.transactions.length > 0 ? (
          <div className="space-y-2">
            {/* Summary */}
            <div className="flex items-center gap-4 pb-3 border-b border-gray-100 dark:border-gray-700/30 mb-3">
              <div className="flex items-center gap-1.5 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-income" />
                <span className="text-gray-500">{t('common.income')}:</span>
                <span className="font-semibold text-income">
                  {formatCurrency(
                    drillModal.transactions
                      .filter((t, i) => t.type === 'income')
                      .reduce((s, t, i, arr) => s + (drillModal.converted[drillModal.transactions.indexOf(t)] || 0), 0),
                    defaultCurrency
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <TrendingDown className="w-3.5 h-3.5 text-expense" />
                <span className="text-gray-500">{t('common.expense')}:</span>
                <span className="font-semibold text-expense">
                  {formatCurrency(
                    drillModal.transactions
                      .filter((t) => t.type === 'expense')
                      .reduce((s, t) => s + (drillModal.converted[drillModal.transactions.indexOf(t)] || 0), 0),
                    defaultCurrency
                  )}
                </span>
              </div>
              <span className="text-xs text-gray-400">{drillModal.transactions.length} {t('common.transaction')}(s)</span>
            </div>

            {/* Transaction list */}
            {drillModal.transactions.map((txn, idx) => {
              const cat = categories?.find(c => c.id === txn.categoryId);
              const account = accounts?.find(a => a.id === txn.accountId);
              return (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                      txn.type === 'income' ? 'bg-green-50 dark:bg-green-900/30' :
                      txn.type === 'expense' ? 'bg-red-50 dark:bg-red-900/30' :
                      'bg-blue-50 dark:bg-blue-900/30'
                    )}>
                      {txn.type === 'income' ? <ArrowUpRight className="w-3.5 h-3.5 text-income" /> :
                       txn.type === 'expense' ? <ArrowDownRight className="w-3.5 h-3.5 text-expense" /> :
                       <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{txn.description || cat?.name || t('common.transaction')}</p>
                      <p className="text-gray-400 truncate mt-0.5">
                        {formatDate(txn.date)}
                        {cat ? ` · ${cat.name}` : ''}
                        {account ? ` · ${account.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    'font-semibold tabular-nums ml-3 flex-shrink-0',
                    txn.type === 'income' ? 'text-income' :
                    txn.type === 'expense' ? 'text-expense' :
                    'text-blue-500'
                  )}>
                    {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}
                    {formatCurrency(drillModal.converted[idx], defaultCurrency)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">{t('common.noData')}</p>
        )}
      </Modal>

      {/* Category Detail Modal */}
      <Modal
        isOpen={catDetail?.open || false}
        onClose={() => setCatDetail(null)}
        title={catDetail ? `● ${catDetail.categoryName}` : ''}
        size="md"
      >
        {catDetail && catDetail.monthlyData.length > 0 ? (
          <div className="space-y-4">
            {/* Mini bar chart for monthly breakdown */}
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catDetail.monthlyData.map(m => ({
                  ...m,
                  monthLabel: new Date(selectedYear, parseInt(m.month.split('-')[1]) - 1).toLocaleDateString(undefined, { month: 'short' }),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-20" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, defaultCurrency)} />
                  <ReTooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v, defaultCurrency)} />} />
                  <Bar dataKey="amount" name={t('common.expense')} fill={catDetail.color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly list */}
            <div className="space-y-1">
              {catDetail.monthlyData
                .sort((a, b) => a.month.localeCompare(b.month))
                .map(m => {
                  const monthLabel = new Date(selectedYear, parseInt(m.month.split('-')[1]) - 1).toLocaleDateString(undefined, { month: 'long' });
                  return (
                    <div key={m.month} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-700/20 last:border-0">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{monthLabel}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(m.amount, defaultCurrency)}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">{t('common.noData')}</p>
        )}
      </Modal>
    </div>
  );
}
