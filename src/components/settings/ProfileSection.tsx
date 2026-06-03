import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/useAppStore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { User } from 'lucide-react';

export function ProfileSection() {
  const { t } = useTranslation();
  const { userName, setUserName } = useAppStore();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('profile.title')}</h2>
        </div>
      </CardHeader>
      <CardContent>
        <Input
          label={t('profile.userName')}
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder={t('profile.userNamePlaceholder')}
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('profile.userNameDesc')}</p>
      </CardContent>
    </Card>
  );
}
