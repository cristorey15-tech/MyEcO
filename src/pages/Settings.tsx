import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db, seedCategories } from '@/lib/db';
import { useAppStore } from '@/stores/useAppStore';
import { useToastStore } from '@/stores/useToastStore';
import { useConfirm } from '@/hooks/useConfirm';
import { hashPin, isBiometricAvailable, registerBiometric, removeBiometricCredential } from '@/lib/auth';
import { fetchAllRates, getLastRateUpdate, needsRefresh, getRateHistory, detectRateDrop } from '@/lib/exchangeRateService';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import {
  Plus, Edit3, Trash2, Globe, Wallet, Palette, Repeat, RotateCcw,
  Save, DownloadCloud, Loader2, Bell, BellOff, AlertTriangle,
  ArrowLeftRight, Search, TrendingUp, TrendingDown, Minus,
  Briefcase, Laptop, Gift, PlusCircle,
  Utensils, Car, Home, Zap, Heart, Film, Book, ShoppingBag, Plane,
  MoreHorizontal, Shield, FileText, Music, Camera, Smartphone,
  Dumbbell, Wifi, Coffee, Star, User, Lock, Fingerprint, KeyRound
} from 'lucide-react';
import type { Category } from '@/types';
import { CURRENCIES } from '@/types';

// Available icons for categories
const CATEGORY_ICONS = [
  { name: 'briefcase', component: Briefcase },
  { name: 'laptop', component: Laptop },
  { name: 'trending-up', component: TrendingUp },
  { name: 'gift', component: Gift },
  { name: 'plus-circle', component: PlusCircle },
  { name: 'utensils', component: Utensils },
  { name: 'car', component: Car },
  { name: 'home', component: Home },
  { name: 'zap', component: Zap },
  { name: 'heart', component: Heart },
  { name: 'film', component: Film },
  { name: 'book', component: Book },
  { name: 'shopping-bag', component: ShoppingBag },
  { name: 'plane', component: Plane },
  { name: 'more-horizontal', component: MoreHorizontal },
  { name: 'file-text', component: FileText },
  { name: 'shield', component: Shield },
  { name: 'music', component: Music },
  { name: 'camera', component: Camera },
  { name: 'smartphone', component: Smartphone },
  { name: 'dumbbell', component: Dumbbell },
  { name: 'wifi', component: Wifi },
  { name: 'coffee', component: Coffee },
  { name: 'star', component: Star },
];

function getIconComponent(iconName: string) {
  const found = CATEGORY_ICONS.find(i => i.name === iconName);
  return found?.component || PlusCircle;
}

// Mini sparkline SVG component
function Sparkline({ data, width = 80, height = 24, color = '#2563eb' }: {
  data: { rate: number }[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const rates = data.map(d => d.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.rate - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const isUp = rates[rates.length - 1] >= rates[0];

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        fill="none"
        stroke={isUp ? '#059669' : '#dc2626'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { defaultCurrency, setDefaultCurrency, resetTour, tourCompleted, resetAllState, userName, setUserName, pinHash, setPinHash, pinLength, setPinLength, lockEnabled, setLockEnabled, biometricEnabled, setBiometricEnabled } = useAppStore();
  const { confirm, ConfirmDialog } = useConfirm();
  const categories = useLiveQuery(() => db.categories.toArray());
  const exchangeRates = useLiveQuery(() => db.exchangeRates.toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());

  // --- Category state ---
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: '', type: 'expense' as 'income' | 'expense', icon: 'plus-circle', color: '#2563eb' });
  const [catFormErrors, setCatFormErrors] = useState<Record<string, string>>({});
  const [catSearchTerm, setCatSearchTerm] = useState('');

  // Transaction count per category
  const catTxCounts = useMemo(() => {
    if (!transactions) return {} as Record<number, number>;
    const counts: Record<number, number> = {};
    for (const t of transactions) {
      counts[t.categoryId] = (counts[t.categoryId] || 0) + 1;
    }
    return counts;
  }, [transactions]);

  // --- PIN & Biometric state ---
  const [pinModalMode, setPinModalMode] = useState<'set' | 'change' | 'remove' | null>(null);
  const [pinForm, setPinForm] = useState({ currentPin: '', newPin: '', confirmPin: '' });
  const [pinFormErrors, setPinFormErrors] = useState<Record<string, string>>({});
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioRegistered, setBioRegistered] = useState(!!localStorage.getItem('myeco-biometric-credential'));

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
  }, []);

  const handleRegisterBiometric = async () => {
    const success = await registerBiometric(userName || 'MyEco User');
    if (success) {
      setBioRegistered(true);
      setBiometricEnabled(true);
      addToast({
        title: t('security.biometricRegistered'),
        variant: 'success',
      });
    } else {
      addToast({
        title: t('security.biometricNotAvailable'),
        variant: 'error',
      });
    }
  };

  const handleSavePin = async () => {
    const errors: Record<string, string> = {};

    if (pinModalMode === 'change' || pinModalMode === 'remove') {
      if (!pinForm.currentPin) {
        errors.currentPin = t('validation.required');
      } else if (pinHash) {
        const isValid = await hashPin(pinForm.currentPin).then(h => h === pinHash);
        if (!isValid) {
          errors.currentPin = t('security.wrongPin');
        }
      }
    }

    if (pinModalMode === 'set' || pinModalMode === 'change') {
      if (!pinForm.newPin) {
        errors.newPin = t('security.pinRequired');
      } else if (pinForm.newPin.length < pinLength) {
        errors.newPin = t('security.pinTooShort', { digits: pinLength });
      } else if (pinForm.newPin !== pinForm.confirmPin) {
        errors.confirmPin = t('security.pinMismatch');
      }
    }

    setPinFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (pinModalMode === 'remove') {
      setPinHash('');
      setLockEnabled(false);
      setBiometricEnabled(false);
      removeBiometricCredential();
      setBioRegistered(false);
    } else if (pinModalMode === 'set' || pinModalMode === 'change') {
      const newHash = await hashPin(pinForm.newPin);
      setPinHash(newHash);
      setLockEnabled(true);
    }

    setPinModalMode(null);
    setPinForm({ currentPin: '', newPin: '', confirmPin: '' });
    setPinFormErrors({});
  };

  // --- Exchange Rate state ---
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<{ id?: number; fromCurrency: string; toCurrency: string; rate: number } | null>(null);
  const [rateForm, setRateForm] = useState({ fromCurrency: 'USD', toCurrency: 'MXN', rate: 0 });
  const [rateFormErrors, setRateFormErrors] = useState<Record<string, string>>({});
  const [ratesOutdated, setRatesOutdated] = useState(false);

  const [tourResetMessage, setTourResetMessage] = useState(false);
  const [fetchingRates, setFetchingRates] = useState(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<Date | null>(null);
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unavailable'>('default');
  const addToast = useToastStore((s) => s.addToast);

  // --- Rate Trend state ---
  const [rateHistories, setRateHistories] = useState<Record<string, { date: string; rate: number }[]>>({});
  const [rateDrops, setRateDrops] = useState<Record<string, { dropped: boolean; dropPercent: number } | null>>({});
  const [trendModalOpen, setTrendModalOpen] = useState(false);
  const [trendRate, setTrendRate] = useState<{ fromCurrency: string; toCurrency: string } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});

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

  // Check if rates are outdated
  useEffect(() => {
    needsRefresh().then(setRatesOutdated);
  }, [exchangeRates]);

  // Load rate histories and detect drops for all rates
  useEffect(() => {
    if (!exchangeRates || exchangeRates.length === 0) return;

    for (const rate of exchangeRates) {
      const key = `${rate.fromCurrency}-${rate.toCurrency}`;

      // Load history
      if (!rateHistories[key] && !loadingHistory[key]) {
        setLoadingHistory(prev => ({ ...prev, [key]: true }));
        getRateHistory(rate.fromCurrency, rate.toCurrency).then(history => {
          setRateHistories(prev => ({ ...prev, [key]: history }));
          setLoadingHistory(prev => ({ ...prev, [key]: false }));
        });
      }

      // Detect drop
      if (!rateDrops[key]) {
        detectRateDrop(rate.fromCurrency, rate.toCurrency).then(result => {
          setRateDrops(prev => ({ ...prev, [key]: result }));
        });
      }
    }
  }, [exchangeRates]);

  const handleFetchRates = async () => {
    setFetchingRates(true);
    const result = await fetchAllRates();
    setFetchingRates(false);

    if (result.success && result.ratesFetched > 0) {
      const updated = await getLastRateUpdate();
      setLastRateUpdate(updated);
      // Clear cached histories/drops so they reload
      setRateHistories({});
      setRateDrops({});
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

  // --- Category handlers ---
  const openNewCategory = () => {
    setEditingCategory(null);
    setCatFormErrors({});
    setCatForm({ name: '', type: 'expense', icon: 'plus-circle', color: '#2563eb' });
    setCategoryModalOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCatFormErrors({});
    setCatForm({ name: cat.name, type: cat.type, icon: cat.icon || 'plus-circle', color: cat.color });
    setCategoryModalOpen(true);
  };

  const saveCategory = async () => {
    const errors: Record<string, string> = {};
    if (!catForm.name.trim()) errors.name = t('validation.required');
    setCatFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (editingCategory) {
      await db.categories.update(editingCategory.id!, {
        name: catForm.name,
        color: catForm.color,
        icon: catForm.icon,
      });
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

  // --- Exchange Rate handlers ---
  const openNewRate = () => {
    setEditingRate(null);
    setRateForm({ fromCurrency: 'USD', toCurrency: 'MXN', rate: 0 });
    setRateFormErrors({});
    setRateModalOpen(true);
  };

  const openEditRate = (rate: { id?: number; fromCurrency: string; toCurrency: string; rate: number }) => {
    setEditingRate(rate);
    setRateForm({ fromCurrency: rate.fromCurrency, toCurrency: rate.toCurrency, rate: rate.rate });
    setRateFormErrors({});
    setRateModalOpen(true);
  };

  const swapCurrencies = () => {
    setRateForm(prev => ({ ...prev, fromCurrency: prev.toCurrency, toCurrency: prev.fromCurrency }));
  };

  const validateRateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const from = rateForm.fromCurrency.toUpperCase();
    const to = rateForm.toCurrency.toUpperCase();

    if (rateForm.rate <= 0) {
      errors.rate = t('settings.rateInvalidValue');
    }
    if (from === to) {
      errors.currencies = t('settings.rateSameCurrency');
    }
    // Check for duplicate pair (exclude current rate when editing)
    if (exchangeRates) {
      const duplicate = exchangeRates.find(
        r => r.fromCurrency === from && r.toCurrency === to && r.id !== editingRate?.id
      );
      if (duplicate) {
        errors.currencies = t('settings.rateDuplicate');
      }
    }

    setRateFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveRate = async () => {
    if (!validateRateForm()) return;

    const now = new Date();
    const from = rateForm.fromCurrency.toUpperCase();
    const to = rateForm.toCurrency.toUpperCase();

    if (editingRate && editingRate.id) {
      await db.exchangeRates.update(editingRate.id, {
        fromCurrency: from,
        toCurrency: to,
        rate: rateForm.rate,
        updatedAt: now,
      });
    } else {
      await db.exchangeRates.add({
        fromCurrency: from,
        toCurrency: to,
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

  const openTrendModal = async (fromCurrency: string, toCurrency: string) => {
    setTrendRate({ fromCurrency, toCurrency });
    setTrendModalOpen(true);
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
    await db.rateHistory.clear();

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

  // Filtered/search categories
  const filteredCategories = useMemo(() => {
    if (!categories) return { income: [] as Category[], expense: [] as Category[] };
    const income = categories.filter(c => c.type === 'income');
    const expense = categories.filter(c => c.type === 'expense');
    if (!catSearchTerm) return { income, expense };
    const term = catSearchTerm.toLowerCase();
    return {
      income: income.filter(c => c.name.toLowerCase().includes(term)),
      expense: expense.filter(c => c.name.toLowerCase().includes(term)),
    };
  }, [categories, catSearchTerm]);

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-gray-900">{t('profile.title')}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Input
            label={t('profile.userName')}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder={t('profile.userNamePlaceholder')}
          />
          <p className="text-xs text-gray-400 mt-2">{t('profile.userNameDesc')}</p>
        </CardContent>
      </Card>

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
          {/* Outdated rates banner */}
          {ratesOutdated && exchangeRates && exchangeRates.length > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 flex-1">
                {t('settings.rateOutdatedDesc')}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleFetchRates}
                disabled={fetchingRates}
                className="text-xs h-7 px-2 border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                {fetchingRates ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <DownloadCloud className="w-3 h-3" />
                )}
                {t('settings.fetchRates')}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {exchangeRates && exchangeRates.length > 0 ? (
            <div className="space-y-2">
              {/* Mobile last update info */}
              {lastRateUpdate && (
                <div className="sm:hidden flex items-center gap-1.5 text-xs text-gray-400 mb-2 pb-2 border-b border-gray-100">
                  <DownloadCloud className="w-3 h-3" />
                  <span>
                    {t('settings.lastUpdate')}: {lastRateUpdate.toLocaleDateString()} {lastRateUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {[...exchangeRates]
                .sort((a, b) => {
                  const pairA = `${a.fromCurrency}→${a.toCurrency}`;
                  const pairB = `${b.fromCurrency}→${b.toCurrency}`;
                  return pairA.localeCompare(pairB);
                })
                .map((rate) => {
                  const key = `${rate.fromCurrency}-${rate.toCurrency}`;
                  const history = rateHistories[key];
                  const drop = rateDrops[key];
                  const loadingHist = loadingHistory[key];

                  return (
                  <div
                    key={rate.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900 flex-shrink-0">
                        <span className="font-bold">{rate.fromCurrency}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-bold">{rate.toCurrency}</span>
                      </div>
                      <span className="text-sm text-gray-500 truncate">
                        1 {rate.fromCurrency} = <strong>{rate.rate}</strong> {rate.toCurrency}
                      </span>
                      {/* Inline sparkline */}
                      {loadingHist ? (
                        <Loader2 className="w-4 h-4 text-gray-300 animate-spin flex-shrink-0" />
                      ) : history && history.length >= 2 ? (
                        <Sparkline data={history} />
                      ) : null}
                      {/* Rate drop indicator */}
                      {drop?.dropped && (
                        <Tooltip content={t('settings.rateDropDetected', { percent: drop.dropPercent })}>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-200 flex-shrink-0">
                            <TrendingDown className="w-3 h-3" />
                            {drop.dropPercent}%
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {/* Trend button */}
                      <Tooltip content={t('settings.rateTrend')}>
                        <button
                          onClick={() => openTrendModal(rate.fromCurrency, rate.toCurrency)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-white transition-colors"
                        >
                          {history && history.length >= 2 ? (
                            history[history.length - 1].rate >= history[0].rate
                              ? <TrendingUp className="w-3.5 h-3.5" />
                              : <TrendingDown className="w-3.5 h-3.5" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </Tooltip>
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
                );
              })}
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
          {/* Category search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-colors"
              placeholder={t('settings.catSearchPlaceholder')}
              value={catSearchTerm}
              onChange={(e) => setCatSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('common.income')} ({filteredCategories.income.length})</h3>
            <div className="flex flex-wrap gap-2">
              {filteredCategories.income.length > 0 ? filteredCategories.income.map(cat => {
                const IconComp = getIconComponent(cat.icon);
                const txCount = catTxCounts[cat.id!] || 0;
                return (
                <div key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm group hover:shadow-sm transition-shadow"
                     style={{ borderColor: cat.color + '30' }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                    <IconComp className="w-3 h-3" style={{ color: cat.color }} />
                  </div>
                  <span className="font-medium text-gray-800">{cat.name}</span>
                  <Badge variant="default" className="text-[10px] px-1.5 py-0">
                    {txCount > 0 ? t('settings.catUsage', { count: txCount }) : t('settings.catNoUsage')}
                  </Badge>
                  <div className="flex ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
              )}) : (
                <p className="text-xs text-gray-400 italic">—</p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('common.expense')} ({filteredCategories.expense.length})</h3>
            <div className="flex flex-wrap gap-2">
              {filteredCategories.expense.length > 0 ? filteredCategories.expense.map(cat => {
                const IconComp = getIconComponent(cat.icon);
                const txCount = catTxCounts[cat.id!] || 0;
                return (
                <div key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm group hover:shadow-sm transition-shadow"
                     style={{ borderColor: cat.color + '30' }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                    <IconComp className="w-3 h-3" style={{ color: cat.color }} />
                  </div>
                  <span className="font-medium text-gray-800">{cat.name}</span>
                  <Badge variant="default" className="text-[10px] px-1.5 py-0">
                    {txCount > 0 ? t('settings.catUsage', { count: txCount }) : t('settings.catNoUsage')}
                  </Badge>
                  <div className="flex ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
              )}) : (
                <p className="text-xs text-gray-400 italic">—</p>
              )}
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

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-gray-900">{t('security.title')}</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PIN Lock */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('security.pinLock')}</p>
                <p className="text-xs text-gray-400">{t('security.pinLockDesc')}</p>
              </div>
              {pinHash ? (
                <div className="flex items-center gap-2">
                  <Tooltip content={t('security.changePin')}>
                    <Button size="sm" variant="outline" onClick={() => setPinModalMode('change')}>
                      <KeyRound className="w-3.5 h-3.5" />
                      {t('security.changePin')}
                    </Button>
                  </Tooltip>
                  <Tooltip content={t('security.removePin')}>
                    <Button size="sm" variant="outline" className="text-danger border-danger/30 hover:bg-danger-light" onClick={() => setPinModalMode('remove')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </Tooltip>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setPinModalMode('set')}>
                  <KeyRound className="w-3.5 h-3.5" />
                  {t('security.setPin')}
                </Button>
              )}
            </div>
            {pinHash && (
              <label className="flex items-center gap-3 cursor-pointer mt-2">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={lockEnabled}
                    onChange={(e) => setLockEnabled(e.target.checked)}
                  />
                  <div className="w-10 h-6 rounded-full bg-gray-200 peer-checked:bg-primary transition-colors duration-200" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm peer-checked:translate-x-4 transition-transform duration-200" />
                </div>
                <span className="text-sm text-gray-700 font-medium">{t('security.pinLock')}</span>
              </label>
            )}
          </div>

          {/* Biometric */}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('security.biometric')}</p>
                <p className="text-xs text-gray-400">{t('security.biometricDesc')}</p>
              </div>
              {bioAvailable ? (
                <div className="flex items-center gap-2">
                  {bioRegistered ? (
                    <>
                      <Badge variant="info" className="text-xs">
                        <Fingerprint className="w-3 h-3 mr-1" />
                        {t('security.biometricRegistered')}
                      </Badge>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={biometricEnabled}
                            onChange={(e) => {
                              setBiometricEnabled(e.target.checked);
                              if (!e.target.checked) {
                                removeBiometricCredential();
                                setBioRegistered(false);
                              }
                            }}
                          />
                          <div className="w-10 h-6 rounded-full bg-gray-200 peer-checked:bg-primary transition-colors duration-200" />
                          <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm peer-checked:translate-x-4 transition-transform duration-200" />
                        </div>
                      </label>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleRegisterBiometric}>
                      <Fingerprint className="w-3.5 h-3.5" />
                      {t('security.registerBiometric')}
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-xs text-gray-400">{t('security.biometricNotAvailable')}</span>
              )}
            </div>
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
        size="lg"
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
          {/* Icon selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.catIcon')}</label>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
              {CATEGORY_ICONS.map(({ name, component: IconComp }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCatForm(prev => ({ ...prev, icon: name }))}
                  className={`p-2 rounded-lg border transition-all ${
                    catForm.icon === name
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                  title={name}
                >
                  <IconComp className="w-4 h-4 mx-auto" />
                </button>
              ))}
            </div>
          </div>
          {/* Preview */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
            {(() => {
              const PreviewIcon = getIconComponent(catForm.icon);
              return (
                <>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: catForm.color + '20' }}>
                    <PreviewIcon className="w-4 h-4" style={{ color: catForm.color }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{catForm.name || '(preview)'}</span>
                  <span className="text-xs text-gray-400">{catForm.type === 'income' ? t('common.income') : t('common.expense')}</span>
                </>
              );
            })()}
          </div>
        </div>
      </Modal>

      {/* Exchange Rate Modal */}
      <Modal
        isOpen={rateModalOpen}
        onClose={() => { setRateModalOpen(false); setRateFormErrors({}); }}
        title={editingRate ? t('settings.editRate') : t('settings.addRate')}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRateModalOpen(false); setRateFormErrors({}); }}>{t('common.cancel')}</Button>
            <Button onClick={saveRate}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div className="space-y-1.5">
              <Select
                label={t('settings.fromCurrency')}
                value={rateForm.fromCurrency}
                onChange={(e) => { setRateForm(prev => ({ ...prev, fromCurrency: e.target.value })); setRateFormErrors({}); }}
                options={currencyOptions}
              />
              {rateFormErrors.currencies && (
                <p className="text-xs text-danger">{rateFormErrors.currencies}</p>
              )}
            </div>
            <Tooltip content={t('settings.rateSwap')}>
              <button
                type="button"
                onClick={swapCurrencies}
                className="mb-1 p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </Tooltip>
            <Select
              label={t('settings.toCurrency')}
              value={rateForm.toCurrency}
              onChange={(e) => { setRateForm(prev => ({ ...prev, toCurrency: e.target.value })); setRateFormErrors({}); }}
              options={currencyOptions}
            />
          </div>
          <Input
            label={t('settings.rateValue')}
            type="number"
            step="0.0001"
            value={rateForm.rate}
            onChange={(e) => { setRateForm(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 })); setRateFormErrors({}); }}
            error={rateFormErrors.rate}
          />
          <p className="text-xs text-gray-400">{t('settings.rateExample')}</p>
        </div>
      </Modal>

      {/* PIN Modal */}
      <Modal
        isOpen={pinModalMode !== null}
        onClose={() => { setPinModalMode(null); setPinForm({ currentPin: '', newPin: '', confirmPin: '' }); setPinFormErrors({}); }}
        title={pinModalMode === 'set' ? t('security.setPin') : pinModalMode === 'change' ? t('security.changePin') : t('security.removePin')}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setPinModalMode(null); setPinForm({ currentPin: '', newPin: '', confirmPin: '' }); setPinFormErrors({}); }}>{t('common.cancel')}</Button>
            <Button onClick={handleSavePin}>{pinModalMode === 'remove' ? t('common.confirm') : t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {(pinModalMode === 'change' || pinModalMode === 'remove') && (
            <Input
              label={t('security.enterCurrentPin')}
              type="password"
              inputMode="numeric"
              maxLength={pinLength}
              value={pinForm.currentPin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, pinLength);
                setPinForm(prev => ({ ...prev, currentPin: val }));
                setPinFormErrors({});
              }}
              error={pinFormErrors.currentPin}
            />
          )}
          {pinModalMode !== 'remove' && (
            <>
              {/* PIN Length selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('security.pinLength')}</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPinLength(4)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      pinLength === 4
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    4 {t('security.digits')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPinLength(6)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      pinLength === 6
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    6 {t('security.digits')}
                  </button>
                </div>
              </div>
              <Input
                label={t('security.enterNewPin')}
                type="password"
                inputMode="numeric"
                maxLength={pinLength}
                value={pinForm.newPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, pinLength);
                  setPinForm(prev => ({ ...prev, newPin: val }));
                  setPinFormErrors({});
                }}
                error={pinFormErrors.newPin}
              />
              <Input
                label={t('security.confirmPin')}
                type="password"
                inputMode="numeric"
                maxLength={pinLength}
                value={pinForm.confirmPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, pinLength);
                  setPinForm(prev => ({ ...prev, confirmPin: val }));
                  setPinFormErrors({});
                }}
                error={pinFormErrors.confirmPin}
              />
            </>
          )}
          {pinModalMode === 'remove' && (
            <p className="text-sm text-gray-500">{t('security.pinLockDesc')}</p>
          )}
        </div>
      </Modal>

      {/* Rate Trend Modal */}
      <Modal
        isOpen={trendModalOpen}
        onClose={() => { setTrendModalOpen(false); setTrendRate(null); }}
        title={trendRate ? t('settings.rateTrendTitle', { from: trendRate.fromCurrency, to: trendRate.toCurrency }) : ''}
        size="lg"
      >
        {trendRate && (() => {
          const key = `${trendRate.fromCurrency}-${trendRate.toCurrency}`;
          const history = rateHistories[key];

          if (!history || history.length < 2) {
            return (
              <div className="text-center py-12">
                <Minus className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">{t('settings.rateNoHistory')}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {t('settings.rateTrendPeriod', { days: 30 })}
                </p>
              </div>
            );
          }

          const rates = history.map(h => h.rate);
          const min = Math.min(...rates);
          const max = Math.max(...rates);
          const current = rates[rates.length - 1];
          const first = rates[0];
          const change = ((current - first) / first) * 100;
          const changeAbs = current - first;
          const isUp = change >= 0;

          return (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-gray-50 text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">{t('settings.rateCurrent')}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{current.toFixed(6)}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">{t('settings.rateMin')}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{min.toFixed(6)}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">{t('settings.rateMax')}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{max.toFixed(6)}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">{t('settings.rateChange', { days: history.length })}</p>
                  <p className={`text-sm font-bold mt-0.5 flex items-center justify-center gap-0.5 ${isUp ? 'text-secondary' : 'text-danger'}`}>
                    {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isUp ? '#059669' : '#dc2626'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={isUp ? '#059669' : '#dc2626'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val: string) => {
                        const d = new Date(val);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val: number) => val.toFixed(4)}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        fontSize: '12px',
                      }}
                      formatter={(value: any) => [Number(value).toFixed(6), `${trendRate.fromCurrency} → ${trendRate.toCurrency}`] as any}
                      labelFormatter={(label: any) => {
                        const d = new Date(label);
                        return d.toLocaleDateString();
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke={isUp ? '#059669' : '#dc2626'}
                      strokeWidth={2}
                      fill="url(#rateGradient)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <p className="text-xs text-gray-400 text-center">
                {t('settings.rateTrendPeriod', { days: history.length })}
              </p>
            </div>
          );
        })()}
      </Modal>

      {ConfirmDialog}
    </div>
  );
}
