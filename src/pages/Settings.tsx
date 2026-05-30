import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db, seedCategories } from '@/lib/db';
import { useAppStore } from '@/stores/useAppStore';
import { useToastStore } from '@/stores/useToastStore';
import { useConfirm } from '@/hooks/useConfirm';
import { fetchAllRates, getLastRateUpdate } from '@/lib/exchangeRateService';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import { Plus, Edit3, Trash2, Globe, Wallet, Palette, Repeat, RotateCcw, Save, DownloadCloud, Loader2, Bell, BellOff, AlertTriangle } from 'lucide-react';
import type { Category } from '@/types';
import { CURRENCIES } from '@/types';

export function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { defaultCurrency, setDefaultCurrency, resetTour, tourCompleted, resetAllState } = useAppStore();
  const { confirm, ConfirmDialog } = useConfirm();
  const categories = useLiveQuery(() => db.categories.toArray());
  const exchangeRates = useLiveQuery(() => db.exchangeRates.toArray());

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: '', type: 'expense' as 'income' | 'expense', icon: '', color: '#2563eb' });
  const [catFormErrors, setCatFormErrors] = useState<Record<string, string>>({});

  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<{ id?: number; fromCurrency: string; toCurrency: string; rate: number } | null>(null);
  const [rateForm, setRateForm] = useState({ fromCurrency: 'USD', toCurrency: 'MXN', rate: 0 });

  const [tourResetMessage, setTourResetMessage] = useState(false);
  const [fetchingRates, setFetchingRates] = useState(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<Date | null>(null);
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unavailable'>('default');
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    const supported = 'Notification' in window;
    setNotifSupported(supported);
    if (supported) {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission('unavailable');
    }
  }, []);

  // Check last rate update on mount
  useEffect(() => {
    getLastRateUpdate().then(setLastRateUpdate);
  }, []);

  const handleFetchRates = async () => {
    setFetchingRates(true);
    const result = await fetchAllRates();
    setFetchingRates(false);

    if (result.success && result.ratesFetched > 0) {
      const updated = await getLastRateUpdate();
      setLastRateUpdate(updated);
      addToast({
        title: t('settings.ratesUpdated'),
        message: t('settings.ratesFetchedCount', { count: result.ratesFetched }),
        variant: 'success',
      });
    } else if (result.errors.length > 0) {
      addToast({
        title: t('settings.ratesError'),
        message: result.errors.join(', '),
        variant: 'error',
        duration: 8000,
      });
    }
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const openNewCategory = () => {
    setEditingCategory(null);
    setCatFormErrors({});
    setCatForm({ name: '', type: 'expense', icon: 'plus-circle', color: '#2563eb' });
    setCategoryModalOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCatFormErrors({});
    setCatForm({ name: cat.name, type: cat.type, icon: cat.icon, color: cat.color });
    setCategoryModalOpen(true);
  };

  const saveCategory = async () => {
    const errors: Record<string, string> = {};
    if (!catForm.name.trim()) errors.name = t('validation.required');
    setCatFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (editingCategory) {
      await db.categories.update(editingCategory.id!, { name: catForm.name, color: catForm.color });
    } else {
      await db.categories.add({
        name: catForm.name,
        type: catForm.type,
        icon: catForm.icon || 'plus-circle',
        color: catForm.color,
        isDefault: false,
        createdAt: new Date(),
      });
    }
    setCategoryModalOpen(false);
  };

  const deleteCategory = async (id: number) => {
    const confirmed = await confirm({
      title: t('common.delete') + ' ' + t('common.category'),
      message: '¿Eliminar esta categoría permanentemente?',
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (confirmed) {
      await db.categories.delete(id);
    }
  };

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      addToast({
        title: t('settings.notificationsUnavailable'),
        variant: 'warning',
      });
      return;
    }

    const result = await Notification.requestPermission();
    setNotifPermission(result);

    if (result === 'granted') {
      addToast({
        title: t('settings.notificationsEnabled'),
        variant: 'success',
      });
    } else {
      addToast({
        title: t('settings.notificationsDisabled'),
        variant: 'warning',
      });
    }
  };

  const handleResetTour = () => {
    resetTour();
    setTourResetMessage(true);
    setTimeout(() => setTourResetMessage(false), 3000);
  };

  // Exchange Rate handlers
  const openNewRate = () => {
    setEditingRate(null);
    setRateForm({ fromCurrency: 'USD', toCurrency: 'MXN', rate: 0 });
    setRateModalOpen(true);
  };

  const openEditRate = (rate: { id?: number; fromCurrency: string; toCurrency: string; rate: number }) => {
    setEditingRate(rate);
    setRateForm({ fromCurrency: rate.fromCurrency, toCurrency: rate.toCurrency, rate: rate.rate });
    setRateModalOpen(true);
  };

  const saveRate = async () => {
    const now = new Date();
    if (editingRate && editingRate.id) {
      await db.exchangeRates.update(editingRate.id, {
        fromCurrency: rateForm.fromCurrency.toUpperCase(),
        toCurrency: rateForm.toCurrency.toUpperCase(),
        rate: rateForm.rate,
        updatedAt: now,
      });
    } else {
      await db.exchangeRates.add({
        fromCurrency: rateForm.fromCurrency.toUpperCase(),
        toCurrency: rateForm.toCurrency.toUpperCase(),
        rate: rateForm.rate,
        updatedAt: now,
      });
    }
    setRateModalOpen(false);
  };

  const deleteRate = async (id: number) => {
    const confirmed = await confirm({
      title: t('settings.deleteRate'),
      message: t('settings.rateDeleteConfirm'),
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (confirmed) {
      await db.exchangeRates.delete(id);
    }
  };

  const currencyOptions = CURRENCIES.map(c => ({ value: c.code, label: `${c.flag} ${c.code} - ${c.name}` }));

  const handleResetAllData = async () => {
    const confirmed = await confirm({
      title: t('settings.resetDataTitle'),
      message: t('settings.resetDataDesc'),
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (!confirmed) return;

    // Clear all IndexedDB tables
    await db.accounts.clear();
    await db.transactions.clear();
    await db.categories.clear();
    await db.budgets.clear();
    await db.goals.clear();
    await db.debts.clear();
    await db.sharedBudgets.clear();
    await db.exchangeRates.clear();

    // Re-seed default categories
    await seedCategories();

    // Reset store state
    resetAllState();

    // Redirect to welcome page
    navigate('/welcome');
  };

  const exportAllData = async () => {
    const data = {
      accounts: await db.accounts.toArray(),
      transactions: await db.transactions.toArray(),
      categories: await db.categories.toArray(),
      budgets: await db.budgets.toArray(),
      goals: await db.goals.toArray(),
      debts: await db.debts.toArray(),
      exchangeRates: await db.exchangeRates.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `myeco-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.accounts) await db.accounts.bulkAdd(data.accounts);
      if (data.transactions) await db.transactions.bulkAdd(data.transactions);
      if (data.categories) await db.categories.bulkAdd(data.categories);
      if (data.budgets) await db.budgets.bulkAdd(data.budgets);
      if (data.goals) await db.goals.bulkAdd(data.goals);
      if (data.debts) await db.debts.bulkAdd(data.debts);
      if (data.exchangeRates) await db.exchangeRates.bulkAdd(data.exchangeRates);
    };
    input.click();
  };

  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];
  const incomeCategories = categories?.filter(c => c.type === 'income') || [];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>

      {/* Language */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-gray-900">{t('settings.language')}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={i18n.language?.startsWith('es') ? 'primary' : 'outline'}
              size="sm"
              onClick={() => changeLanguage('es')}
            >
              🇪🇸 {t('settings.spanish')}
            </Button>
            <Button
              variant={i18n.language?.startsWith('en') ? 'primary' : 'outline'}
              size="sm"
              onClick={() => changeLanguage('en')}
            >
              🇺🇸 {t('settings.english')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-gray-900">{t('settings.defaultCurrency')}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Select
            value={defaultCurrency}
            onChange={(e) => setDefaultCurrency(e.target.value)}
            options={currencyOptions}
          />
          <p className="text-xs text-gray-400 mt-2">{t('settings.exchangeRatesDesc')}</p>
        </CardContent>
      </Card>

      {/* Exchange Rates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-gray-900">{t('settings.exchangeRates')}</h2>
            </div>
            <div className="flex items-center gap-2">
              {lastRateUpdate && (
                <span className="text-xs text-gray-400 hidden sm:block">
                  {t('settings.lastUpdate')}: {lastRateUpdate.toLocaleDateString()} {lastRateUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Tooltip content={t('settings.fetchRates')}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleFetchRates}
                  disabled={fetchingRates}
                >
                  {fetchingRates ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <DownloadCloud className="w-4 h-4" />
                  )}
                  {t('settings.fetchRates')}
                </Button>
              </Tooltip>
              <Tooltip content={t('settings.addRate')}>
                <Button size="sm" onClick={openNewRate}>
                  <Plus className="w-4 h-4" />
                  {t('settings.addRate')}
                </Button>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {exchangeRates && exchangeRates.length > 0 ? (
            <div className="space-y-2">
              {exchangeRates.map((rate) => (
                <div
                  key={rate.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                      <span className="font-bold">{rate.fromCurrency}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-bold">{rate.toCurrency}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      1 {rate.fromCurrency} = <strong>{rate.rate}</strong> {rate.toCurrency}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip content={t('common.edit')}>
                      <button
                        onClick={() => openEditRate(rate)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip content={t('common.delete')}>
                      <button
                        onClick={() => deleteRate(rate.id!)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-white transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Repeat className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">{t('settings.noRates')}</p>
              <p className="text-xs text-gray-300 mt-1">{t('settings.rateExample')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-gray-900">{t('settings.categories')}</h2>
            </div>
            <Tooltip content={t('settings.newCategory')}>
              <Button size="sm" onClick={openNewCategory}>
                <Plus className="w-4 h-4" />
                {t('settings.newCategory')}
              </Button>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('common.income')}</h3>
            <div className="flex flex-wrap gap-2">
              {incomeCategories.map(cat => (
                <div key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm"
                     style={{ borderColor: cat.color + '30' }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span>{cat.name}</span>
                  <div className="flex ml-1">
                    <Tooltip content={t('common.edit')}>
                      <button onClick={() => openEditCategory(cat)} className="p-0.5 text-gray-400 hover:text-gray-600">
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </Tooltip>
                    <Tooltip content={t('common.delete')}>
                      <button onClick={() => deleteCategory(cat.id!)} className="p-0.5 text-gray-400 hover:text-danger">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('common.expense')}</h3>
            <div className="flex flex-wrap gap-2">
              {expenseCategories.map(cat => (
                <div key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm"
                     style={{ borderColor: cat.color + '30' }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span>{cat.name}</span>
                  <div className="flex ml-1">
                    <Tooltip content={t('common.edit')}>
                      <button onClick={() => openEditCategory(cat)} className="p-0.5 text-gray-400 hover:text-gray-600">
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </Tooltip>
                    <Tooltip content={t('common.delete')}>
                      <button onClick={() => deleteCategory(cat.id!)} className="p-0.5 text-gray-400 hover:text-danger">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-gray-900">{t('settings.notifications')}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">{t('settings.notificationsDesc')}</p>
          <div className="flex items-center gap-3">
            {notifPermission === 'granted' ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary-light text-secondary text-sm font-medium">
                <Bell className="w-4 h-4" />
                {t('settings.notificationsEnabled')}
              </div>
            ) : notifPermission === 'unavailable' ? (
              <span className="text-sm text-gray-400">{t('settings.notificationsUnavailable')}</span>
            ) : (
              <Tooltip content={t('settings.enableNotifications')}>
                <Button variant="outline" onClick={handleEnableNotifications}>
                  <BellOff className="w-4 h-4" />
                  {t('settings.enableNotifications')}
                </Button>
              </Tooltip>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tour / Onboarding */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-gray-900">{t('settings.tour')}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">{t('settings.resetTourDesc')}</p>
          <div className="flex items-center gap-3">
            <Tooltip content={tourCompleted ? t('settings.resetTour') : t('settings.tour')}>
              <Button variant="outline" onClick={handleResetTour}>
                <RotateCcw className="w-4 h-4" />
                {t('settings.resetTour')}
              </Button>
            </Tooltip>
            {tourResetMessage && (
              <span className="text-xs font-medium text-secondary animate-fade-in">
                <Save className="w-3.5 h-3.5 inline mr-1" />
                {t('settings.tourResetSuccess')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">{t('settings.dataManagement')}</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Tooltip content={t('settings.exportAllData')}>
              <Button variant="outline" onClick={exportAllData}>
                <DownloadCloud className="w-4 h-4" />
                {t('settings.exportAllData')}
              </Button>
            </Tooltip>
            <Tooltip content={t('settings.importData')}>
              <Button variant="outline" onClick={importData}>
                {t('settings.importData')}
              </Button>
            </Tooltip>
            <Tooltip content={t('settings.resetData')}>
              <Button variant="outline" className="text-danger border-danger/30 hover:bg-danger-light hover:text-danger hover:border-danger" onClick={handleResetAllData}>
                <AlertTriangle className="w-4 h-4" />
                {t('settings.resetData')}
              </Button>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">{t('settings.about')}</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">MyEco - {t('app.tagline')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('settings.version')} 1.0.0</p>
          <p className="text-xs text-gray-400 mt-2">Built with React + TypeScript + Dexie.js + Tailwind CSS</p>
        </CardContent>
      </Card>

      {/* Category Modal */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategory ? t('common.edit') + ' ' + t('common.category') : t('settings.newCategory')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCategoryModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={saveCategory}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('common.name')}
            value={catForm.name}
            onChange={(e) => { setCatForm(prev => ({ ...prev, name: e.target.value })); setCatFormErrors({}); }}
            error={catFormErrors.name}
          />
          {!editingCategory && (
            <Select
              label={t('common.type')}
              value={catForm.type}
              onChange={(e) => setCatForm(prev => ({ ...prev, type: e.target.value as 'income' | 'expense' }))}
              options={[
                { value: 'expense', label: t('common.expense') },
                { value: 'income', label: t('common.income') },
              ]}
            />
          )}
          <Input
            label="Color"
            type="color"
            value={catForm.color}
            onChange={(e) => setCatForm(prev => ({ ...prev, color: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Exchange Rate Modal */}
      <Modal
        isOpen={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        title={editingRate ? t('settings.editRate') : t('settings.addRate')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRateModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={saveRate}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('settings.fromCurrency')}
              value={rateForm.fromCurrency}
              onChange={(e) => setRateForm(prev => ({ ...prev, fromCurrency: e.target.value }))}
              options={currencyOptions}
            />
            <Select
              label={t('settings.toCurrency')}
              value={rateForm.toCurrency}
              onChange={(e) => setRateForm(prev => ({ ...prev, toCurrency: e.target.value }))}
              options={currencyOptions}
            />
          </div>
          <Input
            label={t('settings.rateValue')}
            type="number"
            step="0.0001"
            value={rateForm.rate}
            onChange={(e) => setRateForm(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
          />
          <p className="text-xs text-gray-400">{t('settings.rateExample')}</p>
        </div>
      </Modal>

      {ConfirmDialog}
    </div>
  );
}
