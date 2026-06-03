import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { db, seedCategories } from '@/lib/db';
import { useAppStore } from '@/stores/useAppStore';
import { useConfirm } from '@/hooks/useConfirm';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { AlertTriangle, DownloadCloud } from 'lucide-react';

export function DataManagementSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();
  const { resetAllState } = useAppStore();

  const handleResetAllData = async () => {
    const confirmed = await confirm({
      title: t('settings.resetDataTitle'),
      message: t('settings.resetDataDesc'),
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (!confirmed) return;

    await db.accounts.clear();
    await db.transactions.clear();
    await db.categories.clear();
    await db.budgets.clear();
    await db.goals.clear();
    await db.debts.clear();
    await db.sharedBudgets.clear();
    await db.exchangeRates.clear();
    await db.rateHistory.clear();
    await seedCategories();
    resetAllState();
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

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.dataManagement')}</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Tooltip content={t('settings.exportAllData')}>
              <Button variant="outline" onClick={exportAllData}><DownloadCloud className="w-4 h-4" />{t('settings.exportAllData')}</Button>
            </Tooltip>
            <Tooltip content={t('settings.importData')}>
              <Button variant="outline" onClick={importData}>{t('settings.importData')}</Button>
            </Tooltip>
            <Tooltip content={t('settings.resetData')}>
              <Button variant="outline" className="text-danger border-danger/30 hover:bg-danger-light hover:text-danger hover:border-danger" onClick={handleResetAllData}><AlertTriangle className="w-4 h-4" />{t('settings.resetData')}</Button>
            </Tooltip>
          </div>
        </CardContent>
      </Card>
      {ConfirmDialog}
    </>
  );
}
