import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAccountBalance } from '@/lib/db';
import { formatCurrency, getCurrentYear, cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, Download, TrendingUp, TrendingDown } from 'lucide-react';
import * as XLSX from 'xlsx';

export function Reports() {
  const { t } = useTranslation();
  const { defaultCurrency } = useAppStore();

  const transactions = useLiveQuery(() => db.transactions.toArray());
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [chartType, setChartType] = useState<'pie' | 'bar' | 'area'>('pie');

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = getCurrentYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  // Monthly summary
  const monthlyData = useMemo(() => {
    if (!transactions) return [];
    const months: Record<string, { income: number; expense: number }> = {};

    for (let m = 1; m <= 12; m++) {
      const key = `${selectedYear}-${String(m).padStart(2, '0')}`;
      months[key] = { income: 0, expense: 0 };
    }

    transactions.forEach(t => {
      const d = new Date(t.date);
      if (d.getFullYear() !== selectedYear) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (months[key]) {
        if (t.type === 'income') months[key].income += t.amount;
        else if (t.type === 'expense') months[key].expense += t.amount;
      }
    });

    return Object.entries(months).map(([key, data]) => ({
      month: key,
      monthLabel: new Date(selectedYear, parseInt(key.split('-')[1]) - 1).toLocaleDateString(undefined, { month: 'short' }),
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense,
    }));
  }, [transactions, selectedYear]);

  // Category breakdown
  const categoryData = useMemo(() => {
    if (!transactions || !categories) return [];
    const spending: Record<number, { name: string; value: number; color: string }> = {};

    transactions.forEach(t => {
      if (t.type !== 'expense') return;
      const d = new Date(t.date);
      if (d.getFullYear() !== selectedYear) return;
      const cat = categories.find(c => c.id === t.categoryId);
      if (!spending[t.categoryId]) {
        spending[t.categoryId] = {
          name: cat?.name || 'Sin categoría',
          value: 0,
          color: cat?.color || '#6b7280',
        };
      }
      spending[t.categoryId].value += t.amount;
    });

    return Object.values(spending).sort((a, b) => b.value - a.value);
  }, [transactions, categories, selectedYear]);

  // Totals
  const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthlyData.reduce((s, m) => s + m.expense, 0);
  const netTotal = totalIncome - totalExpense;

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
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `myeco-transactions-${selectedYear}.xlsx`);
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

  const ChartIcon = chartType === 'pie' ? PieChartIcon : chartType === 'bar' ? BarChart3 : LineChartIcon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
        <div className="flex items-center gap-2">
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

      <Select
        value={String(selectedYear)}
        onChange={(e) => setSelectedYear(Number(e.target.value))}
        options={yearOptions}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{t('common.income')}</p>
              <TrendingUp className="w-4 h-4 text-income" />
            </div>
            <p className="text-xl font-bold text-income mt-1">{formatCurrency(totalIncome, defaultCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{t('common.expense')}</p>
              <TrendingDown className="w-4 h-4 text-expense" />
            </div>
            <p className="text-xl font-bold text-expense mt-1">{formatCurrency(totalExpense, defaultCurrency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{t('common.netWorth')}</p>
              <div className={cn('p-1.5 rounded-lg', netTotal >= 0 ? 'bg-green-50' : 'bg-red-50')}>
                {netTotal >= 0 ? <TrendingUp className="w-4 h-4 text-income" /> : <TrendingDown className="w-4 h-4 text-expense" />}
              </div>
            </div>
            <p className={cn('text-xl font-bold mt-1', netTotal >= 0 ? 'text-gray-900' : 'text-expense')}>
              {formatCurrency(netTotal, defaultCurrency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">{t('reports.monthlyTrend')}</h2>
            <div className="flex gap-1">
              {(['bar', 'area', 'pie'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    chartType === type ? 'bg-primary-light text-primary' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {type === 'pie' ? <PieChartIcon className="w-4 h-4" /> : type === 'bar' ? <BarChart3 className="w-4 h-4" /> : <LineChartIcon className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <ReTooltip formatter={(value) => formatCurrency(Number(value), defaultCurrency)} />
                  <Legend />
                  <Bar dataKey="income" name={t('common.income')} fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name={t('common.expense')} fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartType === 'area' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <ReTooltip formatter={(value) => formatCurrency(Number(value), defaultCurrency)} />
                  <Legend />
                  <Area type="monotone" dataKey="income" name={t('common.income')} stroke="#059669" fill="#059669" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="expense" name={t('common.expense')} stroke="#dc2626" fill="#dc2626" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {chartType === 'pie' && categoryData.length > 0 && (
              <div className="flex items-center justify-center gap-6 h-full">
                <div className="w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={80}
                        paddingAngle={3} dataKey="value"
                      >
                        {categoryData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <ReTooltip formatter={(value) => formatCurrency(Number(value), defaultCurrency)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {categoryData.slice(0, 8).map((item) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(item.value, defaultCurrency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
