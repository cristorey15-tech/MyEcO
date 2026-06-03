import { Settings as SettingsIcon } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { ThemeSection } from '@/components/settings/ThemeSection';
import { LanguageSection } from '@/components/settings/LanguageSection';
import { CurrencySection } from '@/components/settings/CurrencySection';
import { ExchangeRatesSection } from '@/components/settings/ExchangeRatesSection';
import { CategoriesSection } from '@/components/settings/CategoriesSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { SecuritySection } from '@/components/settings/SecuritySection';
import { TourSection } from '@/components/settings/TourSection';
import { DataManagementSection } from '@/components/settings/DataManagementSection';
import { useTranslation } from 'react-i18next';

export function Settings() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('settings.title')}</h1>
      <ProfileSection />
      <ThemeSection />
      <LanguageSection />
      <CurrencySection />
      <ExchangeRatesSection />
      <CategoriesSection />
      <NotificationsSection />
      <SecuritySection />
      <TourSection />
      <DataManagementSection />

      {/* About */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.about')}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400">MyEco - {t('app.tagline')}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('settings.version')} 1.0.0</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Built with React + TypeScript + Dexie.js + Tailwind CSS</p>
        </CardContent>
      </Card>
    </div>
  );
}
