import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageSection() {
  const { t, i18n } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.language')}</h2>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button
            variant={i18n.language?.startsWith('es') ? 'primary' : 'outline'}
            size="sm"
            onClick={() => i18n.changeLanguage('es')}
          >
            🇪🇸 {t('settings.spanish')}
          </Button>
          <Button
            variant={i18n.language?.startsWith('en') ? 'primary' : 'outline'}
            size="sm"
            onClick={() => i18n.changeLanguage('en')}
          >
            🇺🇸 {t('settings.english')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
