import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getAccountBalance } from '@/lib/db';
import { formatCurrency, batchConvertAmounts, cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { useConfirm } from '@/hooks/useConfirm';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';
import { Plus, Edit3, Trash2, Wallet, CreditCard, PiggyBank, TrendingUp, Eye, EyeOff, Search } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import type { Account, AccountType } from '@/types';
import { ACCOUNT_TYPES } from '@/types';

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

export function Accounts() {
  const { t } = useTranslation();
  const { defaultCurrency } = useAppStore();
  const { confirm, ConfirmDialog } = useConfirm();
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [convertedBalances, setConvertedBalances] = useState<Record<number, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking' as AccountType,
    currency: defaultCurrency,
    initialBalance: 0,
    color: '#2563eb',
    icon: 'credit-card',
  });

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = t('validation.required');
    }
    if (!formData.currency.trim()) {
      errors.currency = t('validation.required');
    } else if (formData.currency.length !== 3) {
      errors.currency = t('validation.maxLength', { max: 3 });
    }
    if (formData.initialBalance < 0) {
      errors.initialBalance = t('validation.invalidAmount');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

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
          console.warn('Auto-fetch rates failed in Accounts:', result.errors.join(', '));
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

      // Convert all balances to default currency
      const converted = await batchConvertAmounts(
        results.map(r => ({ amount: r.balance, from: r.currency })),
        defaultCurrency
      );
      if (cancelled) return;

      const newConverted: Record<number, number> = {};
      results.forEach((r, i) => { newConverted[r.id] = converted[i]; });
      setConvertedBalances(newConverted);
    })().catch(err => console.error('Error loading account balances in Accounts:', err));
    return () => { cancelled = true; };
  }, [accounts, defaultCurrency]);

  const openNewModal = () => {
    setEditingAccount(null);
    setFormErrors({});
    setFormData({
      name: '',
      type: 'checking',
      currency: defaultCurrency,
      initialBalance: 0,
      color: '#2563eb',
      icon: 'credit-card',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormErrors({});
    setFormData({
      name: account.name,
      type: account.type,
      currency: account.currency,
      initialBalance: account.initialBalance,
      color: account.color,
      icon: account.icon,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    const now = new Date();
    if (editingAccount) {
      await db.accounts.update(editingAccount.id!, {
        ...formData,
        updatedAt: now,
      });
    } else {
      await db.accounts.add({
        ...formData,
        isArchived: false,
        balance: formData.initialBalance,
        createdAt: now,
        updatedAt: now,
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: t('accounts.deleteConfirm'),
      message: t('accounts.deleteWarning'),
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (confirmed) {
      await db.accounts.delete(id);
    }
  };

  const toggleArchive = async (account: Account) => {
    await db.accounts.update(account.id!, {
      isArchived: !account.isArchived,
      updatedAt: new Date(),
    });
  };

  const visibleAccounts = accounts?.filter(a => showArchived || !a.isArchived) || [];
  const totalBalance = accounts?.reduce((sum, acc) => sum + (convertedBalances[acc.id!] || 0), 0) || 0;

  const accountTypeOptions = ACCOUNT_TYPES.map(at => ({
    value: at.value,
    label: t(`accounts.${at.value}`),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('accounts.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('accounts.totalBalance')}: <span className="font-semibold text-gray-900">{formatCurrency(totalBalance, defaultCurrency)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content={showArchived ? t('accounts.hideArchived') : t('accounts.title')}>
            <Button variant="ghost" size="sm" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </Tooltip>
          <Tooltip content={t('accounts.newAccount')}>
            <Button onClick={openNewModal}>
              <Plus className="w-4 h-4" />
              {t('accounts.newAccount')}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          placeholder={t('common.search')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label={t('common.search')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleAccounts.filter(acc =>
          acc.name.toLowerCase().includes(searchTerm.toLowerCase())
        ).map((acc) => {
          const IconComponent = accountIcons[acc.type] || Wallet;
          const balance = balances[acc.id!] || 0;
          return (
            <Card key={acc.id} hover className={cn(acc.isArchived && 'opacity-60')}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: acc.color || accountColors[acc.type] || '#2563eb' }}
                    >
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{acc.name}</p>
                      <p className="text-xs text-gray-400">
                        {t(`accounts.${acc.type}`)}
                        {acc.isArchived && ` · ${t('accounts.archived')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(acc)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      aria-label={t('common.edit')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleArchive(acc)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      aria-label={acc.isArchived ? t('accounts.title') : t('accounts.archived')}
                    >
                      {acc.isArchived ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id!)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-red-50 transition-colors"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-50">
                  <p className="text-xs text-gray-400">{t('accounts.currentBalance')}</p>
                  <p className={cn(
                    'text-xl font-bold mt-0.5',
                    balance >= 0 ? 'text-gray-900' : 'text-danger'
                  )}>
                    {formatCurrency(balance, acc.currency)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!accounts ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : visibleAccounts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Wallet className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">{t('accounts.title')}</p>              <Tooltip content={t('accounts.newAccount')}>
                <Button variant="outline" size="sm" className="mt-3" onClick={openNewModal}>
                  <Plus className="w-4 h-4" />
                  {t('accounts.newAccount')}
                </Button>
              </Tooltip>
          </CardContent>
        </Card>
      ) : null}

      {/* Modal */}
      {ConfirmDialog}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAccount ? t('accounts.editAccount') : t('accounts.newAccount')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('accounts.accountName')}
            value={formData.name}
            onChange={(e) => { setFormData(prev => ({ ...prev, name: e.target.value })); setFormErrors({}); }}
            placeholder={t('accounts.namePlaceholder')}
            error={formErrors.name}
          />
          <Select
            label={t('accounts.accountType')}
            value={formData.type}
            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as AccountType }))}
            options={accountTypeOptions}
          />
          <Input
            label={t('accounts.initialBalance')}
            type="number"
            step="0.01"
            value={formData.initialBalance}
            onChange={(e) => { setFormData(prev => ({ ...prev, initialBalance: parseFloat(e.target.value) || 0 })); setFormErrors({}); }}
            error={formErrors.initialBalance}
          />
          <Input
            label={t('common.currency')}
            value={formData.currency}
            onChange={(e) => { setFormData(prev => ({ ...prev, currency: e.target.value.toUpperCase() })); setFormErrors({}); }}
            placeholder="MXN, USD, EUR"
            maxLength={3}
            error={formErrors.currency}
          />
          <Input
            label="Color"
            type="color"
            value={formData.color}
            onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
