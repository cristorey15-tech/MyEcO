import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/useAppStore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Wallet } from 'lucide-react';
import { CURRENCIES } from '@/types';

const currencyOptions = CURRENCIES.map(c => ({ value: c.code, label: `${c.flag} ${c.code} - ${c.name}` }));

export function CurrencySection() {
  const { t } = useTranslation();
  const { defaultCurrency, setDefaultCurrency } = useAppStore();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.defaultCurrency')}</h2>
        </div>
      </CardHeader>
      <CardContent>
        <Select
          value={defaultCurrency}
          onChange={(e) => setDefaultCurrency(e.target.value)}
          options={currencyOptions}
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('settings.exchangeRatesDesc')}</p>
      </CardContent>
    </Card>
  );
}
