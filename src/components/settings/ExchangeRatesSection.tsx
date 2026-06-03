import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useToastStore } from '@/stores/useToastStore';
import { fetchAllRates, getLastRateUpdate, needsRefresh, getRateHistory, detectRateDrop } from '@/lib/exchangeRateService';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import { Plus, Edit3, Trash2, Repeat, DownloadCloud, Loader2, AlertTriangle, ArrowLeftRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { CURRENCIES } from '@/types';

const currencyOptions = CURRENCIES.map(c => ({ value: c.code, label: `${c.flag} ${c.code} - ${c.name}` }));

function Sparkline({ data, width = 80, height = 24 }: { data: { rate: number }[]; width?: number; height?: number }) {
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
      <polyline fill="none" stroke={isUp ? '#059669' : '#dc2626'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export function ExchangeRatesSection() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const exchangeRates = useLiveQuery(() => db.exchangeRates.toArray());

  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<{ id?: number; fromCurrency: string; toCurrency: string; rate: number } | null>(null);
  const [rateForm, setRateForm] = useState({ fromCurrency: 'USD', toCurrency: 'MXN', rate: 0 });
  const [rateFormErrors, setRateFormErrors] = useState<Record<string, string>>({});
  const [ratesOutdated, setRatesOutdated] = useState(false);
  const [fetchingRates, setFetchingRates] = useState(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<Date | null>(null);
  const [rateHistories, setRateHistories] = useState<Record<string, { date: string; rate: number }[]>>({});
  const [rateDrops, setRateDrops] = useState<Record<string, { dropped: boolean; dropPercent: number } | null>>({});
  const [trendModalOpen, setTrendModalOpen] = useState(false);
  const [trendRate, setTrendRate] = useState<{ fromCurrency: string; toCurrency: string } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});

  useEffect(() => { getLastRateUpdate().then(setLastRateUpdate); }, []);
  useEffect(() => { needsRefresh().then(setRatesOutdated); }, [exchangeRates]);

  useEffect(() => {
    if (!exchangeRates || exchangeRates.length === 0) return;
    for (const rate of exchangeRates) {
      const key = `${rate.fromCurrency}-${rate.toCurrency}`;
      if (!rateHistories[key] && !loadingHistory[key]) {
        setLoadingHistory(prev => ({ ...prev, [key]: true }));
        getRateHistory(rate.fromCurrency, rate.toCurrency).then(history => {
          setRateHistories(prev => ({ ...prev, [key]: history }));
          setLoadingHistory(prev => ({ ...prev, [key]: false }));
        });
      }
      if (!rateDrops[key]) {
        detectRateDrop(rate.fromCurrency, rate.toCurrency).then(result => {
          setRateDrops(prev => ({ ...prev, [key]: result }));
        });
      }
    }
  }, [exchangeRates]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFetchRates = async () => {
    setFetchingRates(true);
    const result = await fetchAllRates();
    setFetchingRates(false);
    if (result.success && result.ratesFetched > 0) {
      const updated = await getLastRateUpdate();
      setLastRateUpdate(updated);
      setRateHistories({});
      setRateDrops({});
      addToast({ title: t('settings.ratesUpdated'), message: t('settings.ratesFetchedCount', { count: result.ratesFetched }), variant: 'success' });
    } else if (result.errors.length > 0) {
      addToast({ title: t('settings.ratesError'), message: result.errors.join(', '), variant: 'error', duration: 8000 });
    }
  };

  const openNewRate = () => { setEditingRate(null); setRateForm({ fromCurrency: 'USD', toCurrency: 'MXN', rate: 0 }); setRateFormErrors({}); setRateModalOpen(true); };
  const openEditRate = (rate: { id?: number; fromCurrency: string; toCurrency: string; rate: number }) => { setEditingRate(rate); setRateForm({ fromCurrency: rate.fromCurrency, toCurrency: rate.toCurrency, rate: rate.rate }); setRateFormErrors({}); setRateModalOpen(true); };
  const swapCurrencies = () => { setRateForm(prev => ({ ...prev, fromCurrency: prev.toCurrency, toCurrency: prev.fromCurrency })); };

  const validateRateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const from = rateForm.fromCurrency.toUpperCase();
    const to = rateForm.toCurrency.toUpperCase();
    if (rateForm.rate <= 0) errors.rate = t('settings.rateInvalidValue');
    if (from === to) errors.currencies = t('settings.rateSameCurrency');
    if (exchangeRates) {
      const duplicate = exchangeRates.find(r => r.fromCurrency === from && r.toCurrency === to && r.id !== editingRate?.id);
      if (duplicate) errors.currencies = t('settings.rateDuplicate');
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
      await db.exchangeRates.update(editingRate.id, { fromCurrency: from, toCurrency: to, rate: rateForm.rate, updatedAt: now });
    } else {
      await db.exchangeRates.add({ fromCurrency: from, toCurrency: to, rate: rateForm.rate, updatedAt: now });
    }
    setRateModalOpen(false);
  };

  const deleteRate = async (id: number) => {
    await db.exchangeRates.delete(id);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.exchangeRates')}</h2>
            </div>
            <div className="flex items-center gap-2">
              {lastRateUpdate && (
                <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                  {t('settings.lastUpdate')}: {lastRateUpdate.toLocaleDateString()} {lastRateUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Tooltip content={t('settings.fetchRates')}>
                <Button size="sm" variant="outline" onClick={handleFetchRates} disabled={fetchingRates}>
                  {fetchingRates ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                  {t('settings.fetchRates')}
                </Button>
              </Tooltip>
              <Tooltip content={t('settings.addRate')}>
                <Button size="sm" onClick={openNewRate}><Plus className="w-4 h-4" />{t('settings.addRate')}</Button>
              </Tooltip>
            </div>
          </div>
          {ratesOutdated && exchangeRates && exchangeRates.length > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 flex-1">{t('settings.rateOutdatedDesc')}</p>
              <Button size="sm" variant="outline" onClick={handleFetchRates} disabled={fetchingRates} className="text-xs h-7 px-2 border-amber-300 text-amber-700 hover:bg-amber-100">
                {fetchingRates ? <Loader2 className="w-3 h-3 animate-spin" /> : <DownloadCloud className="w-3 h-3" />}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {exchangeRates && exchangeRates.length > 0 ? (
            <div className="space-y-2">
              {[...exchangeRates].sort((a, b) => `${a.fromCurrency}→${a.toCurrency}`.localeCompare(`${b.fromCurrency}→${b.toCurrency}`)).map((rate) => {
                const key = `${rate.fromCurrency}-${rate.toCurrency}`;
                const history = rateHistories[key];
                const drop = rateDrops[key];
                const loadingHist = loadingHistory[key];
                return (
                  <div key={rate.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100 flex-shrink-0">
                        <span className="font-bold">{rate.fromCurrency}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-bold">{rate.toCurrency}</span>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        1 {rate.fromCurrency} = <strong>{rate.rate}</strong> {rate.toCurrency}
                      </span>
                      {loadingHist ? <Loader2 className="w-4 h-4 text-gray-300 animate-spin flex-shrink-0" /> : history && history.length >= 2 ? <Sparkline data={history} /> : null}
                      {drop?.dropped && (
                        <Tooltip content={t('settings.rateDropDetected', { percent: drop.dropPercent })}>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-200 flex-shrink-0">
                            <TrendingDown className="w-3 h-3" />{drop.dropPercent}%
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <Tooltip content={t('settings.rateTrend')}>
                        <button onClick={() => { setTrendRate({ fromCurrency: rate.fromCurrency, toCurrency: rate.toCurrency }); setTrendModalOpen(true); }} className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-white dark:hover:bg-gray-700 transition-colors">
                          {history && history.length >= 2 ? (history[history.length - 1].rate >= history[0].rate ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />) : <Minus className="w-3.5 h-3.5" />}
                        </button>
                      </Tooltip>
                      <Tooltip content={t('common.edit')}>
                        <button onClick={() => openEditRate(rate)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                      </Tooltip>
                      <Tooltip content={t('common.delete')}>
                        <button onClick={() => deleteRate(rate.id!)} className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-white dark:hover:bg-gray-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6"><Repeat className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" /><p className="text-sm text-gray-400">{t('settings.noRates')}</p></div>
          )}
        </CardContent>
      </Card>

      {/* Rate Modal */}
      <Modal isOpen={rateModalOpen} onClose={() => { setRateModalOpen(false); setRateFormErrors({}); }} title={editingRate ? t('settings.editRate') : t('settings.addRate')} footer={<><Button variant="ghost" onClick={() => { setRateModalOpen(false); setRateFormErrors({}); }}>{t('common.cancel')}</Button><Button onClick={saveRate}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
            <div className="space-y-1.5">
              <Select label={t('settings.fromCurrency')} value={rateForm.fromCurrency} onChange={(e) => { setRateForm(prev => ({ ...prev, fromCurrency: e.target.value })); setRateFormErrors({}); }} options={currencyOptions} />
              {rateFormErrors.currencies && <p className="text-xs text-danger">{rateFormErrors.currencies}</p>}
            </div>
            <Tooltip content={t('settings.rateSwap')}><button type="button" onClick={swapCurrencies} className="mb-1 p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"><ArrowLeftRight className="w-4 h-4" /></button></Tooltip>
            <Select label={t('settings.toCurrency')} value={rateForm.toCurrency} onChange={(e) => { setRateForm(prev => ({ ...prev, toCurrency: e.target.value })); setRateFormErrors({}); }} options={currencyOptions} />
          </div>
          <Input label={t('settings.rateValue')} type="number" step="0.0001" value={rateForm.rate} onChange={(e) => { setRateForm(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 })); setRateFormErrors({}); }} error={rateFormErrors.rate} />
        </div>
      </Modal>

      {/* Trend Modal */}
      <Modal isOpen={trendModalOpen} onClose={() => { setTrendModalOpen(false); setTrendRate(null); }} title={trendRate ? t('settings.rateTrendTitle', { from: trendRate.fromCurrency, to: trendRate.toCurrency }) : ''} size="lg">
        {trendRate && (() => {
          const key = `${trendRate.fromCurrency}-${trendRate.toCurrency}`;
          const history = rateHistories[key];
          if (!history || history.length < 2) return <div className="text-center py-12"><Minus className="w-12 h-12 mx-auto text-gray-300 mb-3" /><p className="text-sm text-gray-500">{t('settings.rateNoHistory')}</p></div>;
          const rates = history.map(h => h.rate);
          const min = Math.min(...rates); const max = Math.max(...rates); const current = rates[rates.length - 1]; const first = rates[0]; const change = ((current - first) / first) * 100; const isUp = change >= 0;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center"><p className="text-[10px] text-gray-400 uppercase font-semibold">{t('settings.rateCurrent')}</p><p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">{current.toFixed(6)}</p></div>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center"><p className="text-[10px] text-gray-400 uppercase font-semibold">{t('settings.rateMin')}</p><p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">{min.toFixed(6)}</p></div>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center"><p className="text-[10px] text-gray-400 uppercase font-semibold">{t('settings.rateMax')}</p><p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">{max.toFixed(6)}</p></div>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center"><p className="text-[10px] text-gray-400 uppercase font-semibold">{t('settings.rateChange', { days: history.length })}</p><p className={`text-sm font-bold mt-0.5 flex items-center justify-center gap-0.5 ${isUp ? 'text-secondary' : 'text-danger'}`}>{isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}{change >= 0 ? '+' : ''}{change.toFixed(1)}%</p></div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs><linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={isUp ? '#059669' : '#dc2626'} stopOpacity={0.3} /><stop offset="95%" stopColor={isUp ? '#059669' : '#dc2626'} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:opacity-20" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(val: string) => { const d = new Date(val); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(val: number) => val.toFixed(4)} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} formatter={(value) => [Number(value).toFixed(6), `${trendRate.fromCurrency} → ${trendRate.toCurrency}`] as [string, string]} labelFormatter={(label) => new Date(String(label)).toLocaleDateString()} />
                    <Area type="monotone" dataKey="rate" stroke={isUp ? '#059669' : '#dc2626'} strokeWidth={2} fill="url(#rateGradient)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-400 text-center">{t('settings.rateTrendPeriod', { days: history.length })}</p>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
