import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/useAppStore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, Save } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

export function TourSection() {
  const { t } = useTranslation();
  const { resetTour, tourCompleted } = useAppStore();
  const [tourResetMessage, setTourResetMessage] = useState(false);

  const handleResetTour = () => {
    resetTour();
    setTourResetMessage(true);
    setTimeout(() => setTourResetMessage(false), 3000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.tour')}</h2>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('settings.resetTourDesc')}</p>
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
  );
}
