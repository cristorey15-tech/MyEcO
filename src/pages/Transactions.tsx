import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { useConfirm } from '@/hooks/useConfirm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { TableRowSkeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Search, Filter, X, ChevronLeft, ChevronRight, Repeat, ArrowUpDown } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import type { Transaction, TransactionType, RecurringInterval } from '@/types';
import { CURRENCIES } from '@/types';
import type { TransactionFilterState } from '@/stores/useAppStore';
import { filterTransactions } from '@/lib/transactionFilters';
import { paginate } from '@/lib/paginationUtils';
import {
  quickAddItemVariants,
  quickAddItemTransition,
  pagBtnTransition,
  pagContainerVariants,
  pagChevronLeftVariants,
  pagPageBtnVariants,
  pagChevronRightVariants,
} from '@/lib/animations';

const PAGE_SIZE = 15;

interface FormErrors {
  amount?: string;
  accountId?: string;
  categoryId?: string;
  toAccountId?: string;
  description?: string;
}

export function Transactions() {
  const { t } = useTranslation();
  const { defaultCurrency, transactionFilters, setTransactionFilters, resetTransactionFilters } = useAppStore();
  const { confirm, ConfirmDialog } = useConfirm();

  const accounts = useLiveQuery(() => db.accounts.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const transactions = useLiveQuery(() =>
    db.transactions.orderBy('date').reverse().toArray()
  );

  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const {
    searchTerm,
    filterType,
    filterAccount,
    filterCategory,
    filterRecurring,
    showFilters,
    currentPage,
  } = transactionFilters;
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState({
    type: 'expense' as TransactionType,
    accountId: 0,
    toAccountId: 0,
    categoryId: 0,
    amount: 0,
    currency: defaultCurrency,
    date: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
    isRecurring: false,
    recurringInterval: '' as RecurringInterval | '',
  });

  const getAccountCurrency = (accountId: number): string => {
    const account = accounts?.find(a => a.id === accountId);
    return account?.currency || defaultCurrency;
  };

  const openNewModal = (type?: TransactionType) => {
    const firstAccountId = accounts?.[0]?.id || 0;
    setEditingTxn(null);
    setFormErrors({});
    setFormData({
      type: type || 'expense',
      accountId: firstAccountId,
      toAccountId: 0,
      categoryId: categories?.find(c => c.type === 'expense')?.id || 0,
      amount: 0,
      currency: getAccountCurrency(firstAccountId),
      date: new Date().toISOString().split('T')[0],
      description: '',
      notes: '',
      isRecurring: false,
      recurringInterval: '' as RecurringInterval | '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (txn: Transaction) => {
    setEditingTxn(txn);
    setFormErrors({});
    setFormData({
      type: txn.type,
      accountId: txn.accountId,
      toAccountId: txn.toAccountId || 0,
      categoryId: txn.categoryId,
      amount: txn.amount,
      currency: txn.currency,
      date: new Date(txn.date).toISOString().split('T')[0],
      description: txn.description,
      notes: txn.notes,
      isRecurring: txn.isRecurring,
      recurringInterval: txn.recurringInterval || '',
    });
    setIsModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.amount || formData.amount <= 0) {
      errors.amount = t('validation.positiveAmount');
    }
    if (!formData.accountId) {
      errors.accountId = t('validation.selectAccount');
    }
    if (formData.type === 'transfer') {
      if (!formData.toAccountId) {
        errors.toAccountId = t('validation.selectAccount');
      }
      if (formData.toAccountId === formData.accountId) {
        errors.toAccountId = t('validation.accountsMustDiffer');
      }
    } else if (!formData.categoryId) {
      errors.categoryId = t('validation.selectCategory');
    }
    if (formData.description && formData.description.length > 100) {
      errors.description = t('validation.maxLength', { max: 100 });
    }
    if (formData.isRecurring && !formData.recurringInterval) {
      errors.description = t('validation.selectRecurringInterval');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const now = new Date();
    const data = {
      ...formData,
      date: new Date(formData.date),
      tags: [],
      isRecurring: formData.isRecurring,
      recurringInterval: formData.isRecurring ? formData.recurringInterval || undefined : undefined,
      createdAt: now,
      updatedAt: now,
    };

    if (editingTxn) {
      await db.transactions.update(editingTxn.id!, { ...data, createdAt: editingTxn.createdAt });
    } else {
      await db.transactions.add(data);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: t('transactions.deleteConfirm'),
      message: t('transactions.deleteWarning'),
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (confirmed) {
      await db.transactions.delete(id);
    }
  };

  const getAccountName = (id: number) => accounts?.find(a => a.id === id)?.name || '—';
  const getCategoryName = (id: number) => categories?.find(c => c.id === id)?.name || '—';
  const getCategoryColor = (id: number) => categories?.find(c => c.id === id)?.color || '#6b7280';

  const hasActiveFilters = Boolean(searchTerm || filterType || filterAccount || filterCategory || filterRecurring);

  const filteredTransactions = filterTransactions(transactions || [], {
    searchTerm,
    filterType,
    filterAccount,
    filterCategory,
    filterRecurring,
    getAccountName,
    getCategoryName,
  }).sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    else if (sortBy === 'amount') cmp = a.amount - b.amount;
    else if (sortBy === 'description') cmp = (a.description || '').localeCompare(b.description || '');
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const { totalPages, safePage, pageItems: paginatedTransactions, visiblePages } = paginate(filteredTransactions, currentPage, PAGE_SIZE);

  // Reset to page 1 when filters change
  const handleFilterChange = (key: keyof Omit<TransactionFilterState, 'showFilters' | 'currentPage'>) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTransactionFilters({ [key]: e.target.value, currentPage: 1 });
  };

  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];
  const incomeCategories = categories?.filter(c => c.type === 'income') || [];

  const selectedCategories = formData.type === 'income' ? incomeCategories : expenseCategories;

  const transactionTypeOptions = [
    { value: 'expense', label: t('transactions.type_expense') },
    { value: 'income', label: t('transactions.type_income') },
    { value: 'transfer', label: t('transactions.type_transfer') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('transactions.title')}</h1>
        <div className="flex items-center gap-2">
          <Tooltip content={t('common.filter')}>
            <Button variant="ghost" size="sm" onClick={() => setTransactionFilters({ showFilters: !showFilters })} aria-label={t('common.filter')}>
              <Filter className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content={t('transactions.newTransaction')}>
            <Button onClick={() => openNewModal()}>
              <Plus className="w-4 h-4" />
              {t('common.add')}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Quick add buttons */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
          hidden: {},
        }}
        className="flex gap-2 flex-wrap"
      >
        <motion.div variants={quickAddItemVariants} transition={quickAddItemTransition}>
          <Tooltip content={`${t('common.add')} ${t('transactions.type_expense').toLowerCase()}`}>
            <Button variant="outline" size="sm" onClick={() => openNewModal('expense')}>
              <ArrowDownRight className="w-4 h-4 text-expense" />
              {t('transactions.type_expense')}
            </Button>
          </Tooltip>
        </motion.div>
        <motion.div variants={quickAddItemVariants} transition={quickAddItemTransition}>
          <Tooltip content={`${t('common.add')} ${t('transactions.type_income').toLowerCase()}`}>
            <Button variant="outline" size="sm" onClick={() => openNewModal('income')}>
              <ArrowUpRight className="w-4 h-4 text-income" />
              {t('transactions.type_income')}
            </Button>
          </Tooltip>
        </motion.div>
        <motion.div variants={quickAddItemVariants} transition={quickAddItemTransition}>
          <Tooltip content={`${t('common.add')} ${t('transactions.type_transfer').toLowerCase()}`}>
            <Button variant="outline" size="sm" onClick={() => openNewModal('transfer')}>
              <ArrowLeftRight className="w-4 h-4 text-blue-600" />
              {t('transactions.type_transfer')}
            </Button>
          </Tooltip>
        </motion.div>
      </motion.div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/90 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder={t('common.search')}
            value={searchTerm}
            onChange={(e) => setTransactionFilters({ searchTerm: e.target.value, currentPage: 1 })}
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-slide-up">
            <Select
              value={filterType}
              onChange={handleFilterChange('filterType')}
              options={[
                { value: 'expense', label: t('transactions.type_expense') },
                { value: 'income', label: t('transactions.type_income') },
                { value: 'transfer', label: t('transactions.type_transfer') },
              ]}
              placeholder={t('common.type')}
            />
            <Select
              value={filterAccount}
              onChange={handleFilterChange('filterAccount')}
              options={accounts?.map(a => ({ value: String(a.id), label: a.name })) || []}
              placeholder={t('common.account')}
            />
            <Select
              value={filterCategory}
              onChange={handleFilterChange('filterCategory')}
              options={categories?.map(c => ({ value: String(c.id), label: c.name })) || []}
              placeholder={t('common.category')}
            />
            <Select
              value={filterRecurring}
              onChange={handleFilterChange('filterRecurring')}
              options={[
                { value: 'recurring', label: t('transactions.recurring') },
                { value: 'non-recurring', label: t('common.oneTime') },
              ]}
              placeholder={t('common.all')}
            />
          </div>
        )}

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (sortBy !== 'date') { setSortBy('date'); setSortDir('desc'); }
              else setSortDir(d => d === 'desc' ? 'asc' : 'desc');
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sortBy === 'date' ? 'bg-primary/10 text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
            aria-label={`${t('transactions.sortBy')} ${t('common.date')}`}
          >
            <ArrowUpDown className="w-3 h-3" />
            {t('common.date')}
            {sortBy === 'date' && (
              <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>
            )}
          </button>
          <button
            onClick={() => {
              if (sortBy !== 'amount') { setSortBy('amount'); setSortDir('desc'); }
              else setSortDir(d => d === 'desc' ? 'asc' : 'desc');
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sortBy === 'amount' ? 'bg-primary/10 text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
            aria-label={`${t('transactions.sortBy')} ${t('common.amount')}`}
          >
            <ArrowUpDown className="w-3 h-3" />
            {t('common.amount')}
            {sortBy === 'amount' && (
              <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>
            )}
          </button>
          <button
            onClick={() => {
              if (sortBy !== 'description') { setSortBy('description'); setSortDir('desc'); }
              else setSortDir(d => d === 'desc' ? 'asc' : 'desc');
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sortBy === 'description' ? 'bg-primary/10 text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
            aria-label={`${t('transactions.sortBy')} ${t('common.description')}`}
          >
            <ArrowUpDown className="w-3 h-3" />
            {t('common.description')}
            {sortBy === 'description' && (
              <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>
            )}
          </button>
        </div>

        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {filteredTransactions.length} {t('transactions.title').toLowerCase()}
              </span>
              <button
                onClick={resetTransactionFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-danger hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                {t('common.clearFilters')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transactions List */}
      <Card>
        <CardContent className="p-0">
          {!transactions ? (
            <div className="px-5 py-2">
              {[1, 2, 3, 4, 5].map(i => <TableRowSkeleton key={i} />)}
            </div>
          ) : paginatedTransactions.length > 0 ? (
            <>
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                <AnimatePresence mode="popLayout">
                  {paginatedTransactions.map((txn, i) => (
                    <motion.div
                      key={txn.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: i * 0.025, duration: 0.2, ease: 'easeOut' } }}
                      exit={{ opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.15, ease: 'easeOut' } }}
                      layout
                      className="group flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                      onClick={() => openEditModal(txn)}
                    >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                        txn.type === 'income' ? 'bg-green-50 dark:bg-green-900/30' : txn.type === 'expense' ? 'bg-red-50 dark:bg-red-900/30' : 'bg-blue-50 dark:bg-blue-900/30'
                      )}>
                        {txn.type === 'income' ? (
                          <ArrowUpRight className="w-5 h-5 text-income" />
                        ) : txn.type === 'expense' ? (
                          <ArrowDownRight className="w-5 h-5 text-expense" />
                        ) : (
                          <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {txn.description || getCategoryName(txn.categoryId)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400 dark:text-gray-500">{getAccountName(txn.accountId)}</span>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(txn.date)}</span>
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: getCategoryColor(txn.categoryId) }}
                          />
                          <span className="text-xs text-gray-400 dark:text-gray-500">{getCategoryName(txn.categoryId)}</span>
                          {txn.isRecurring && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-light text-primary">
                              <Repeat className="w-3 h-3" />
                              {t('transactions.recurring')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <p className={cn(
                        'text-sm font-semibold',
                        txn.type === 'income' ? 'text-income' : txn.type === 'expense' ? 'text-expense' : 'text-gray-900 dark:text-gray-100'
                      )}>
                        {txn.type === 'income' ? '+' : txn.type === 'expense' ? '−' : ''}
                        {formatCurrency(txn.amount, txn.currency)}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(txn.id!); }}
                        className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label={t('common.delete')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
                  className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700/50"
                >
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {filteredTransactions.length} {t('transactions.title').toLowerCase()}
                  </p>
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={pagContainerVariants}
                    className="flex items-center gap-2"
                  >
                    <motion.button
                      variants={pagChevronLeftVariants}
                      transition={pagBtnTransition}
                      onClick={() => setTransactionFilters({ currentPage: safePage - 1 })}
                      disabled={safePage <= 1}
                      className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </motion.button>
                    {visiblePages.map(pageNum => (
                      <motion.button
                        key={pageNum}
                        variants={pagPageBtnVariants}
                        transition={pagBtnTransition}
                        onClick={() => setTransactionFilters({ currentPage: pageNum })}
                        className={cn(
                          'w-7 h-7 rounded-lg text-xs font-medium transition-colors',
                          pageNum === safePage
                            ? 'bg-primary text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                        )}
                      >
                        {pageNum}
                      </motion.button>
                    ))}
                    <motion.button
                      variants={pagChevronRightVariants}
                      transition={pagBtnTransition}
                      onClick={() => setTransactionFilters({ currentPage: safePage + 1 })}
                      disabled={safePage >= totalPages}
                      className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </motion.div>
                </motion.div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <ArrowLeftRight className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">{t('common.noData')}</p>
              <Tooltip content={t('transactions.newTransaction')}>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => openNewModal()}>
                  <Plus className="w-4 h-4" />
                  {t('transactions.newTransaction')}
                </Button>
              </Tooltip>
            </div>
          )}
        </CardContent>
      </Card>

      {ConfirmDialog}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTxn ? t('transactions.editTransaction') : t('transactions.newTransaction')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t('common.type')}
            value={formData.type}
            onChange={(e) => {
              const newType = e.target.value as TransactionType;
              const defaultCat = categories?.find(c => c.type === (newType === 'income' ? 'income' : 'expense'));
              setFormData(prev => ({
                ...prev,
                type: newType,
                categoryId: defaultCat?.id || 0,
                toAccountId: newType === 'transfer' ? (accounts?.[1]?.id || 0) : 0,
              }));
              setFormErrors({});
            }}
            options={transactionTypeOptions}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label={formData.type === 'transfer' ? t('transactions.transferFrom') : t('common.account')}
              value={String(formData.accountId)}
              onChange={(e) => {
                const newAccountId = Number(e.target.value);
                const selectedAccount = accounts?.find(a => a.id === newAccountId);
                setFormData(prev => ({
                  ...prev,
                  accountId: newAccountId,
                  currency: selectedAccount?.currency || defaultCurrency,
                }));
                setFormErrors({});
              }}
              options={accounts?.map(a => ({ value: String(a.id), label: `${a.name} (${a.currency})` })) || []}
              error={formErrors.accountId}
            />
            {formData.type === 'transfer' ? (
              <Select
                label={t('transactions.transferTo')}
                value={String(formData.toAccountId)}
                onChange={(e) => { setFormData(prev => ({ ...prev, toAccountId: Number(e.target.value) })); setFormErrors({}); }}
                options={accounts?.map(a => ({ value: String(a.id), label: a.name })) || []}
                error={formErrors.toAccountId}
              />
            ) : (
              <Select
                label={t('common.category')}
                value={String(formData.categoryId)}
                onChange={(e) => { setFormData(prev => ({ ...prev, categoryId: Number(e.target.value) })); setFormErrors({}); }}
                options={selectedCategories.map(c => ({ value: String(c.id), label: c.name }))}
                error={formErrors.categoryId}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`${t('common.amount')} (${formData.currency})`}
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount || ''}
              onChange={(e) => { setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 })); setFormErrors({}); }}
              error={formErrors.amount}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.date')}</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <Select
            label={t('common.currency')}
            value={formData.currency}
            onChange={(e) => { setFormData(prev => ({ ...prev, currency: e.target.value })); setFormErrors({}); }}
            options={CURRENCIES.map(c => ({ value: c.code, label: `${c.flag} ${c.code} - ${c.symbol}` }))}
          />

          <Input
            label={t('common.description')}
            value={formData.description}
            onChange={(e) => { setFormData(prev => ({ ...prev, description: e.target.value })); setFormErrors({}); }}
            placeholder={t('transactions.descriptionPlaceholder')}
            error={formErrors.description}
          />

          <Input
            label={t('common.note')}
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder={t('transactions.notesPlaceholder')}
          />

          {/* Recurring toggle */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                />
                <div className="w-10 h-6 rounded-full bg-gray-200 dark:bg-gray-700 peer-checked:bg-primary transition-colors duration-200" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm peer-checked:translate-x-4 transition-transform duration-200" />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Repeat className="w-4 h-4 text-primary" />
                <span className="font-medium">{t('transactions.recurring')}</span>
              </div>
            </label>

            {formData.isRecurring && (
              <div className="mt-3 animate-slide-up">
                <Select
                  label={t('transactions.recurring')}
                  value={formData.recurringInterval}
                  onChange={(e) => setFormData(prev => ({ ...prev, recurringInterval: e.target.value as RecurringInterval }))}
                  options={[
                    { value: 'daily', label: t('transactions.everyDay') },
                    { value: 'weekly', label: t('transactions.everyWeek') },
                    { value: 'monthly', label: t('transactions.everyMonth') },
                    { value: 'yearly', label: t('transactions.everyYear') },
                  ]}
                  placeholder={t('common.select')}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  {t('transactions.recurringInfo')}
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}