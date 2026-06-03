import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/useAppStore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

export function ThemeSection() {
  const { t } = useTranslation();
  const { darkMode, setDarkMode } = useAppStore();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {darkMode ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.theme')}</h2>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button variant={!darkMode ? 'primary' : 'outline'} size="sm" onClick={() => setDarkMode(false)}>
            <Sun className="w-4 h-4" />
            {t('settings.lightMode')}
          </Button>
          <Button variant={darkMode ? 'primary' : 'outline'} size="sm" onClick={() => setDarkMode(true)}>
            <Moon className="w-4 h-4" />
            {t('settings.darkMode')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
