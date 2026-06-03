import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/useAppStore';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

export function NotificationsSection() {
  const { t } = useTranslation();
  const {
    budgetAlerts, setBudgetAlerts,
    goalMilestones, setGoalMilestones,
    debtReminders, setDebtReminders,
    recurringReminders, setRecurringReminders,
    reminderDaysBefore, setReminderDaysBefore,
  } = useAppStore();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unavailable'>(
    'Notification' in window ? Notification.permission : 'unavailable'
  );

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center cursor-pointer flex-shrink-0">
      <div className="relative">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="w-10 h-6 rounded-full bg-gray-200 dark:bg-gray-600 peer-checked:bg-primary dark:peer-checked:bg-primary transition-colors duration-200" />
        <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm peer-checked:translate-x-4 transition-transform duration-200" />
      </div>
    </label>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.notifications')}</h2>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('settings.notificationsDesc')}</p>
        <div className="flex items-center gap-3">
          {notifPermission === 'granted' ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary-light dark:bg-secondary/20 text-secondary dark:text-green-300 text-sm font-medium">
              <Bell className="w-4 h-4" />{t('settings.notificationsEnabled')}
            </div>
          ) : notifPermission === 'unavailable' ? (
            <span className="text-sm text-gray-400">{t('settings.notificationsUnavailable')}</span>
          ) : (
            <Tooltip content={t('settings.enableNotifications')}>
              <Button variant="outline" onClick={handleEnableNotifications}><BellOff className="w-4 h-4" />{t('settings.enableNotifications')}</Button>
            </Tooltip>
          )}
        </div>
        {notifPermission === 'granted' && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700/30 mt-3 space-y-3">
            {[
              { label: t('settings.budgetAlerts'), desc: t('settings.budgetAlertsDesc'), checked: budgetAlerts, onChange: setBudgetAlerts },
              { label: t('settings.goalMilestones'), desc: t('settings.goalMilestonesDesc'), checked: goalMilestones, onChange: setGoalMilestones },
              { label: t('settings.debtReminders'), desc: t('settings.debtRemindersDesc'), checked: debtReminders, onChange: setDebtReminders },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.desc}</p>
                </div>
                <Toggle checked={item.checked} onChange={item.onChange} />
              </div>
            ))}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700/30">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.recurringReminders')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t('settings.recurringRemindersDesc')}</p>
                </div>
                <Toggle checked={recurringReminders} onChange={setRecurringReminders} />
              </div>
              {recurringReminders && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-sm text-gray-700 dark:text-gray-300">{t('settings.remindDaysBefore')}</label>
                  <select
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 dark:text-gray-100"
                    value={reminderDaysBefore}
                    onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                      <option key={d} value={d}>{d} {d === 1 ? t('notifications.dayBefore') : t('notifications.daysBefore')}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
