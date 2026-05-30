import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAccountBalance } from '@/lib/db';
import { formatCurrency, formatDate, cn, batchConvertAmounts } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { useConfirm } from '@/hooks/useConfirm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Plus, Edit3, Wallet, CreditCard, PiggyBank, TrendingUp, X, Repeat, AlertTriangle, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { paginate } from '@/lib/paginationUtils';
import {
  pagBtnTransition,
  pagContainerVariants,
  pagChevronLeftVariants,
  pagPageBtnVariants,
  pagChevronRightVariants,
} from '@/lib/animations';
import type { AccountType, Account, Transaction, TransactionType, RecurringInterval } from '@/types';
import { CURRENCIES, ACCOUNT_TYPES } from '@/types';

const accountIcons: Record<AccountType, typeof Wallet> = {
  cash: Wallet,
  checking: CreditCard,
  savings: PiggyBank,
  credit_card: CreditCard,
  investment: TrendingUp,
};

const accountColors: Record<AccountType, string> = {
  cash: '#059669',
  checking: '#2563eb',
  savings: '#7c3aed',
  credit_card: '#dc2626',
  investment: '#d97706',
};

export function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { defaultCurrency } = useAppStore();
  const { confirm, ConfirmDialog } = useConfirm();

  const accountId = Number(id);

  // All hooks MUST be called unconditionally (React rules of hooks)
  const account = useLiveQuery(() => db.accounts.get(accountId), [accountId]);
  const categories = useLiveQuery(() => db.categories.toArray());
  const transactions = useLiveQuery(
    () => db.transactions
      .where({ accountId })
      .reverse()
      .sortBy('date'),
    [accountId]
  );
  const incomingTransfers = useLiveQuery(
    () => db.transactions
      .where({ toAccountId: accountId })
      .reverse()
      .sortBy('date'),
    [accountId]
  );

  const accounts = useLiveQuery(() => db.accounts.toArray());

  const [balance, setBalance] = useState<number>(0);
  const [convertedBalance, setConvertedBalance] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [accountEditModalOpen, setAccountEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountFormErrors, setAccountFormErrors] = useState<Record<string, string>>({});
  const [originalCurrency, setOriginalCurrency] = useState('');
  const [accountFormData, setAccountFormData] = useState({
    name: '',
    type: 'checking' as AccountType,
    currency: defaultCurrency,
    initialBalance: 0,
    color: '#2563eb',
  });

  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

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

  useEffect(() => {
    if (!account) return;
    let cancelled = false;

    (async () => {
      const bal = await getAccountBalance(accountId);
      if (cancelled) return;
      setBalance(bal);

      if (account.currency !== defaultCurrency) {
        const [conv] = await batchConvertAmounts([{ amount: bal, from: account.currency }], defaultCurrency);
        if (!cancelled) setConvertedBalance(conv);
      } else {
        setConvertedBalance(bal);
      }
    })();

    return () => { cancelled = true; };
  }, [account, accountId, defaultCurrency]);

  // Guard after ALL hooks — React rules of hooks: no early returns before hooks
  if (!id || isNaN(accountId)) {
    return <Navigate to="/accounts" replace />;
  }

  // Merge and sort all relevant transactions
  const allTxns = [...(transactions || []), ...(incomingTransfers || [])]
    .filter((txn, i, arr) => arr.findIndex(t => t.id === txn.id) === i) // dedup
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortBy === 'amount') cmp = a.amount - b.amount;
      return sortDir === 'desc' ? -cmp : cmp;
    });

  const { totalPages, safePage, pageItems: paginatedTxns, visiblePages } = paginate(allTxns, currentPage, PAGE_SIZE);

  const stats = {
    income: allTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    expense: allTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    transferOut: (transactions || []).filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0),
    transferIn: (incomingTransfers || []).reduce((s, t) => s + t.amount, 0),
  };

  const getCategoryName = (catId: number) => categories?.find(c => c.id === catId)?.name || '—';
  const getCategoryColor = (catId: number) => categories?.find(c => c.id === catId)?.color || '#6b7280';
  const getAccountName = (id: number) => accounts?.find(a => a.id === id)?.name || '—';

  const openAccountEditModal = () => {
    if (!account) return;
    setEditingAccount(account);
    setAccountFormErrors({});
    setOriginalCurrency(account.currency);
    setAccountFormData({
      name: account.name,
      type: account.type,
      currency: account.currency,
      initialBalance: account.initialBalance,
      color: account.color,
    });
    setAccountEditModalOpen(true);
  };

  const validateAccountForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!accountFormData.name.trim()) {
      errors.name = t('validation.required');
    }
    if (!accountFormData.currency.trim()) {
      errors.currency = t('validation.required');
    } else if (accountFormData.currency.length !== 3) {
      errors.currency = t('validation.maxLength', { max: 3 });
    }
    if (accountFormData.initialBalance < 0) {
      errors.initialBalance = t('validation.invalidAmount');
    }
    setAccountFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAccountSave = async () => {
    if (!validateAccountForm() || !editingAccount) return;
    await db.accounts.update(editingAccount.id!, {
      ...accountFormData,
      updatedAt: new Date(),
    });
    setAccountEditModalOpen(false);
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
    const errors: Record<string, string> = {};
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

  const handleDelete = async (txnId: number) => {
    const confirmed = await confirm({
      title: t('transactions.deleteConfirm'),
      message: t('transactions.deleteWarning'),
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (confirmed) {
      await db.transactions.delete(txnId);
    }
  };

  if (!account) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-5 space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-16" />
            </CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-0">
          {[1, 2, 3, 4].map(i => <TableRowSkeleton key={i} />)}
        </CardContent></Card>
      </div>
    );
  }

  const IconComponent = accountIcons[account.type] || Wallet;
  const currency = account.currency;

  return (
    <div className="space-y-6">
      {ConfirmDialog}

      {/* Back button & actions */}
      <div className="flex items-center justify-between">
        <Link
          to="/accounts"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('accounts.title')}
        </Link>
        <div className="flex items-center gap-2">
          <Tooltip content={t('common.edit')}>
            <Button
              variant="outline"
              size="sm"
              onClick={openAccountEditModal}
            >
              <Edit3 className="w-4 h-4" />
              {t('common.edit')}
            </Button>
          </Tooltip>
          <Tooltip content={t('transactions.newTransaction')}>
            <Button
              size="sm"
              onClick={() => navigate('/transactions')}
            >
              <Plus className="w-4 h-4" />
              {t('common.add')}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Account header */}
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: account.color || accountColors[account.type] || '#2563eb' }}
        >
          <IconComponent className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="info">{t(`accounts.${account.type}`)}</Badge>
            <Badge className={cn(currency !== defaultCurrency && 'ring-1 ring-primary/30')}>{currency}</Badge>
            {currency !== defaultCurrency && (
              <ArrowLeftRight className="w-3.5 h-3.5 text-primary/60" />
            )}
            {account.isArchived && <Badge variant="warning">{t('accounts.archived')}</Badge>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{t('common.balance')}</p>
          <p className={cn(
            'text-2xl font-bold mt-0.5',
            balance >= 0 ? 'text-gray-900' : 'text-danger'
          )}>
            {formatCurrency(balance, currency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            ≈ {formatCurrency(convertedBalance, defaultCurrency)}
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-income">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-xs text-gray-500">{t('common.income')}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(stats.income, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-expense">
              <ArrowDownRight className="w-4 h-4" />
              <span className="text-xs text-gray-500">{t('common.expense')}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(stats.expense, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600">
              <ArrowLeftRight className="w-4 h-4" />
              <span className="text-xs text-gray-500">{t('transactions.type_transfer')} →</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(stats.transferOut, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600">
              <ArrowLeftRight className="w-4 h-4" />
              <span className="text-xs text-gray-500">{t('transactions.type_transfer')} ←</span>
            </div>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(stats.transferIn, currency)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">{t('transactions.title')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (sortBy !== 'date') { setSortBy('date'); setSortDir('desc'); }
                else setSortDir(d => d === 'desc' ? 'asc' : 'desc');
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === 'date' ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
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
                sortBy === 'amount' ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ArrowUpDown className="w-3 h-3" />
              {t('common.amount')}
              {sortBy === 'amount' && (
                <span className="text-[10px]">{sortDir === 'desc' ? '↓' : '↑'}</span>
              )}
            </button>
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            {allTxns.length > 0 ? (
              <>
              <div className="divide-y divide-gray-50">
                {paginatedTxns.map((txn) => {
                  const isIncoming = txn.toAccountId === accountId && txn.accountId !== accountId;
                  const typeLabel = isIncoming ? t('transactions.type_transfer') : t(`transactions.type_${txn.type}`);
                  return (
                    <div
                      key={txn.id}
                      className="group flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => openEditModal(txn)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                          txn.type === 'income' ? 'bg-green-50' : txn.type === 'expense' ? 'bg-red-50' : 'bg-blue-50'
                        )}>
                          {txn.type === 'income' ? (
                            <ArrowUpRight className="w-5 h-5 text-income" />
                          ) : txn.type === 'expense' ? (
                            <ArrowDownRight className="w-5 h-5 text-expense" />
                          ) : isIncoming ? (
                            <ArrowDownRight className="w-5 h-5 text-blue-600" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {txn.description || typeLabel}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{formatDate(txn.date)}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{txn.currency}</span>
                            {txn.type === 'transfer' && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span className="text-xs text-gray-500">
                                  {isIncoming
                                    ? `← ${getAccountName(txn.accountId)}`
                                    : `→ ${getAccountName(txn.toAccountId!)}`
                                  }
                                </span>
                              </>
                            )}
                            <span className="text-gray-300">·</span>
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: getCategoryColor(txn.categoryId) }}
                            />
                            <span className="text-xs text-gray-400">{getCategoryName(txn.categoryId)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <p className={cn(
                          'text-sm font-semibold',
                          txn.type === 'income' ? 'text-income' : txn.type === 'expense' ? 'text-expense' : 'text-gray-900'
                        )}>
                          {(txn.type === 'income' || isIncoming) ? '+' : txn.type === 'expense' ? '−' : ''}
                          {formatCurrency(txn.amount, txn.currency)}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(txn.id!); }}
                          className="p-1 rounded text-gray-300 hover:text-danger hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          aria-label={t('common.delete')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
                  className="flex items-center justify-between px-5 py-3 border-t border-gray-100"
                >
                  <p className="text-xs text-gray-400">
                    {allTxns.length} {t('transactions.title').toLowerCase()}
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
                      onClick={() => setCurrentPage(p => p - 1)}
                      disabled={currentPage <= 1}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </motion.button>
                    {visiblePages.map(pageNum => (
                      <motion.button
                        key={pageNum}
                        variants={pagPageBtnVariants}
                        transition={pagBtnTransition}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          'w-7 h-7 rounded-lg text-xs font-medium transition-colors',
                          pageNum === safePage
                            ? 'bg-primary text-white'
                            : 'text-gray-500 hover:bg-gray-100'
                        )}
                      >
                        {pageNum}
                      </motion.button>
                    ))}
                    <motion.button
                      variants={pagChevronRightVariants}
                      transition={pagBtnTransition}
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage >= totalPages}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </motion.div>
                </motion.div>
              )}
              </>
            ) : (
              <div className="text-center py-12">
                <ArrowLeftRight className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">{t('common.noData')}</p>
                <Tooltip content={t('transactions.newTransaction')}>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/transactions')}>
                    <Plus className="w-4 h-4" />
                    {t('transactions.newTransaction')}
                  </Button>
                </Tooltip>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Edit Account Modal */}
      <Modal
        isOpen={accountEditModalOpen}
        onClose={() => setAccountEditModalOpen(false)}
        title={t('accounts.editAccount')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAccountEditModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAccountSave}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('accounts.accountName')}
            value={accountFormData.name}
            onChange={(e) => { setAccountFormData(prev => ({ ...prev, name: e.target.value })); setAccountFormErrors({}); }}
            placeholder={t('accounts.namePlaceholder')}
            error={accountFormErrors.name}
          />
          <Select
            label={t('accounts.accountType')}
            value={accountFormData.type}
            onChange={(e) => setAccountFormData(prev => ({ ...prev, type: e.target.value as AccountType }))}
            options={ACCOUNT_TYPES.map(at => ({ value: at.value, label: t(`accounts.${at.value}`) }))}
          />
          <Input
            label={t('accounts.initialBalance')}
            type="number"
            step="0.01"
            value={accountFormData.initialBalance}
            onChange={(e) => { setAccountFormData(prev => ({ ...prev, initialBalance: parseFloat(e.target.value) || 0 })); setAccountFormErrors({}); }}
            error={accountFormErrors.initialBalance}
          />
          {/* Currency change warning */}
          {editingAccount && accountFormData.currency !== originalCurrency && (transactions?.length || incomingTransfers?.length) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">{t('accounts.currencyWarningTitle')}</p>
                <p className="text-xs text-amber-700 mt-1">{t('accounts.currencyWarningDesc')}</p>
              </div>
            </div>
          )}
          <Input
            label={t('common.currency')}
            value={accountFormData.currency}
            onChange={(e) => { setAccountFormData(prev => ({ ...prev, currency: e.target.value.toUpperCase() })); setAccountFormErrors({}); }}
            placeholder="MXN, USD, EUR"
            maxLength={3}
            error={accountFormErrors.currency}
          />
          <Input
            label="Color"
            type="color"
            value={accountFormData.color}
            onChange={(e) => setAccountFormData(prev => ({ ...prev, color: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Edit Transaction Modal */}
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
            options={[
              { value: 'expense', label: t('transactions.type_expense') },
              { value: 'income', label: t('transactions.type_income') },
              { value: 'transfer', label: t('transactions.type_transfer') },
            ]}
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
                options={(categories?.filter(c => c.type === (formData.type === 'income' ? 'income' : 'expense')) || []).map(c => ({ value: String(c.id), label: c.name }))}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.date')}</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
          />

          <Input
            label={t('common.note')}
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder={t('transactions.notesPlaceholder')}
          />

          {/* Recurring toggle */}
          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                />
                <div className="w-10 h-6 rounded-full bg-gray-200 peer-checked:bg-primary transition-colors duration-200" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm peer-checked:translate-x-4 transition-transform duration-200" />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
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
                <p className="text-xs text-gray-400 mt-1.5">
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
