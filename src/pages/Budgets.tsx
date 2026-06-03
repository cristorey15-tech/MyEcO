import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getBudgetSpent } from '@/lib/db';
import { formatCurrency, formatMonthYear, getCurrentMonth, getCurrentYear, calculatePercentage, cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Plus, PiggyBank, Search } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

export function Budgets() {
  const { t } = useTranslation();
  const { defaultCurrency } = useAppStore();

  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [currentYear, setCurrentYear] = useState(getCurrentYear());

  const budgets = useLiveQuery(() =>
    db.budgets.where({ month: currentMonth, year: currentYear }).toArray()
  );
  const categories = useLiveQuery(() => db.categories.where('type').equals('expense').toArray());

  const [spentAmounts, setSpentAmounts] = useState<Record<number, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<{ categoryId: number; amount: number } | null>(null);
  const [formAmount, setFormAmount] = useState(0);
  const [formCategoryId, setFormCategoryId] = useState(0);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!categories) return;
    Promise.all(
      categories.map(async (cat) => {
        const spent = await getBudgetSpent(cat.id!, currentMonth, currentYear);
        return { id: cat.id!, spent };
      })
    ).then(results => {
      const newSpent: Record<number, number> = {};
      results.forEach(r => { newSpent[r.id] = r.spent; });
      setSpentAmounts(newSpent);
    });
  }, [categories, currentMonth, currentYear]);

  const openNewBudget = () => {
    setEditingBudget(null);
    setFormErrors({});
    const uncategorized = categories?.filter(c => !budgets?.find(b => b.categoryId === c.id));
    setFormCategoryId(uncategorized?.[0]?.id || 0);
    setFormAmount(0);
    setIsModalOpen(true);
  };

  const openEditBudget = (budget: { categoryId: number; amount: number }) => {
    setEditingBudget(budget);
    setFormErrors({});
    setFormCategoryId(budget.categoryId);
    setFormAmount(budget.amount);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (formAmount <= 0) errors.amount = t('validation.positiveAmount');
    if (!formCategoryId) errors.categoryId = t('validation.selectCategory');
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const now = new Date();
    const existing = budgets?.filter(b => b.categoryId === formCategoryId) || [];

    if (existing.length > 0) {
      // Update the first one and delete any duplicates
      await db.budgets.update(existing[0].id!, {
        amount: formAmount,
        spent: spentAmounts[formCategoryId] || 0,
      });
      // Clean up duplicate budget rows for same category
      if (existing.length > 1) {
        await Promise.all(existing.slice(1).map(b => db.budgets.delete(b.id!)));
      }
    } else {
      await db.budgets.add({
        categoryId: formCategoryId,
        month: currentMonth,
        year: currentYear,
        amount: formAmount,
        spent: spentAmounts[formCategoryId] || 0,
        createdAt: now,
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (categoryId: number) => {
    // Delete ALL budgets for this category+month+year (handles duplicates)
    const toDelete = budgets?.filter(b => b.categoryId === categoryId) || [];
    if (toDelete.length > 0) {
      await Promise.all(toDelete.map(b => db.budgets.delete(b.id!)));
    }
  };

  const getCategoryName = (id: number) => categories?.find(c => c.id === id)?.name || '—';
  const getCategoryColor = (id: number) => categories?.find(c => c.id === id)?.color || '#6b7280';

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i).toLocaleDateString(undefined, { month: 'long' }),
  }));

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = getCurrentYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  // Merge budgets with categories
  const budgetData = (categories || []).map(cat => {
    const budget = budgets?.find(b => b.categoryId === cat.id);
    const spent = spentAmounts[cat.id!] || 0;
    const amount = budget?.amount || 0;
    const percentage = calculatePercentage(spent, amount);
    return { category: cat, budget, spent, amount, percentage };    }).filter(b => b.amount > 0).filter(b =>
        !searchTerm || b.category.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

  const totalBudgeted = budgetData.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgetData.reduce((sum, b) => sum + b.spent, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('budgets.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">{formatMonthYear(currentMonth, currentYear)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content={t('budgets.newBudget')}>
            <Button variant="outline" size="sm" onClick={openNewBudget}>
              <Plus className="w-4 h-4" />
              {t('budgets.newBudget')}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Month/Year selector */}
      <div className="flex gap-3">
        <Select
          value={String(currentMonth)}
          onChange={(e) => setCurrentMonth(Number(e.target.value))}
          options={monthOptions}
        />
        <Select
          value={String(currentYear)}
          onChange={(e) => setCurrentYear(Number(e.target.value))}
          options={yearOptions}
        />
      </div>

      {/* Summary */}
      {budgetData.length > 0 && (
        <Card className="bg-gradient-to-br from-primary to-primary-dark text-white border-0">
          <CardContent className="py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100">{t('budgets.title')}</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(totalSpent, defaultCurrency)}
                  <span className="text-lg text-blue-200 font-normal"> / {formatCurrency(totalBudgeted, defaultCurrency)}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-100">{t('budgets.remaining')}</p>
                <p className={cn(
                  'text-xl font-bold',
                  totalBudgeted - totalSpent >= 0 ? 'text-white' : 'text-red-300'
                )}>
                  {formatCurrency(totalBudgeted - totalSpent, defaultCurrency)}
                </p>
              </div>
            </div>
            <div className="mt-4 bg-white/20 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, calculatePercentage(totalSpent, totalBudgeted))}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 dark:text-gray-400" />
        <input
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder={t('common.search')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label={t('common.search')}
        />
      </div>

      {/* Budget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgetData.length > 0 ? (
          budgetData.map(({ category, spent, amount, percentage }) => (
            <Card key={category.id} hover>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg"
                      style={{ backgroundColor: category.color }}
                    >
                      {category.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{category.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">
                        {t('budgets.spentOf', { spent: formatCurrency(spent, defaultCurrency), total: formatCurrency(amount, defaultCurrency) })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={percentage > 100 ? 'expense' : percentage > 75 ? 'warning' : 'success'}
                    >
                      {percentage > 100 ? t('budgets.overspent') : t('budgets.onTrack')}
                    </Badge>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-1.5">
                    <span>{formatCurrency(spent, defaultCurrency)}</span>
                    <span>{formatCurrency(amount, defaultCurrency)}</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        percentage > 100 ? 'bg-danger' : percentage > 75 ? 'bg-warning' : 'bg-secondary'
                      )}
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">
                    {percentage > 100
                      ? `+${formatCurrency(spent - amount, defaultCurrency)} ${t('budgets.overspent').toLowerCase()}`
                      : `${formatCurrency(amount - spent, defaultCurrency)} ${t('budgets.remaining').toLowerCase()}`
                    }
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditBudget({ categoryId: category.id!, amount })}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:text-danger"
                      onClick={() => handleDelete(category.id!)}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-2">
            <Card>
              <CardContent className="text-center py-12">
                <PiggyBank className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">{t('budgets.noBudgets')}</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">{t('budgets.createFirst')}</p>
                <Tooltip content={t('budgets.newBudget')}>
                  <Button variant="outline" size="sm" className="mt-3" onClick={openNewBudget}>
                    <Plus className="w-4 h-4" />
                    {t('budgets.newBudget')}
                  </Button>
                </Tooltip>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBudget ? t('budgets.editBudget') : t('budgets.newBudget')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t('common.category')}
            value={String(formCategoryId)}
            onChange={(e) => { setFormCategoryId(Number(e.target.value)); setFormErrors({}); }}
            options={categories?.map(c => ({ value: String(c.id), label: c.name })) || []}
            error={formErrors.categoryId}
          />
          <Input
            label={t('budgets.budgetAmount')}
            type="number"
            step="0.01"
            value={formAmount}
            onChange={(e) => { setFormAmount(parseFloat(e.target.value) || 0); setFormErrors({}); }}
            error={formErrors.amount}
          />
        </div>
      </Modal>
    </div>
  );
}
