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
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Plus, Edit3, Wallet, CreditCard, PiggyBank, TrendingUp, X } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import type { AccountType } from '@/types';

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

  const [balance, setBalance] = useState<number>(0);
  const [convertedBalance, setConvertedBalance] = useState<number>(0);

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
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const stats = {
    income: allTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    expense: allTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    transferOut: (transactions || []).filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0),
    transferIn: (incomingTransfers || []).reduce((s, t) => s + t.amount, 0),
  };

  const getCategoryName = (catId: number) => categories?.find(c => c.id === catId)?.name || '—';
  const getCategoryColor = (catId: number) => categories?.find(c => c.id === catId)?.color || '#6b7280';

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
              onClick={() => navigate(`/accounts?edit=${accountId}`)}
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
            <Badge>{currency}</Badge>
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
          {currency !== defaultCurrency && (
            <p className="text-xs text-gray-400 mt-0.5">
              ≈ {formatCurrency(convertedBalance, defaultCurrency)}
            </p>
          )}
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
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('transactions.title')}</h2>
        <Card>
          <CardContent className="p-0">
            {allTxns.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {allTxns.slice(0, 50).map((txn) => {
                  const isIncoming = txn.toAccountId === accountId && txn.accountId !== accountId;
                  const typeLabel = isIncoming ? t('transactions.type_transfer') : t(`transactions.type_${txn.type}`);
                  return (
                    <div
                      key={txn.id}
                      className="group flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
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
    </div>
  );
}
