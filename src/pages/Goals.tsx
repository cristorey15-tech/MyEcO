import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { formatCurrency, formatDate, calculatePercentage, cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { useConfirm } from '@/hooks/useConfirm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Plus, Target, TrendingUp, Calendar, CheckCircle2 } from 'lucide-react';
import type { Goal } from '@/types';

export function Goals() {
  const { t } = useTranslation();
  const { defaultCurrency } = useAppStore();
  const { confirm, ConfirmDialog } = useConfirm();

  const goals = useLiveQuery(() => db.goals.toArray());
  const accounts = useLiveQuery(() => db.accounts.where('isArchived').equals(0).toArray());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    targetAmount: 0,
    currentAmount: 0,
    currency: defaultCurrency,
    targetDate: '',
    accountId: 0,
    color: '#7c3aed',
    icon: 'target',
  });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<number>(0);
  const [addAmount, setAddAmount] = useState(0);

  const openNewModal = () => {
    setEditingGoal(null);
    setFormErrors({});
    setFormData({
      name: '',
      targetAmount: 0,
      currentAmount: 0,
      currency: defaultCurrency,
      targetDate: '',
      accountId: accounts?.[0]?.id || 0,
      color: '#7c3aed',
      icon: 'target',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setFormErrors({});
    setFormData({
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      currency: goal.currency,
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : '',
      accountId: goal.accountId || 0,
      color: goal.color,
      icon: goal.icon,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t('validation.required');
    if (formData.targetAmount <= 0) errors.targetAmount = t('validation.positiveAmount');
    if (formData.currentAmount < 0) errors.currentAmount = t('validation.invalidAmount');
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const now = new Date();
    const data = {
      name: formData.name,
      targetAmount: formData.targetAmount,
      currentAmount: formData.currentAmount,
      currency: formData.currency,
      targetDate: formData.targetDate ? new Date(formData.targetDate) : undefined,
      accountId: formData.accountId || undefined,
      color: formData.color,
      icon: formData.icon,
      updatedAt: now,
      createdAt: now,
    };

    if (editingGoal) {
      await db.goals.update(editingGoal.id!, { ...data, createdAt: editingGoal.createdAt });
    } else {
      await db.goals.add(data);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: 'Eliminar meta',
      message: '¿Estás seguro de eliminar esta meta de ahorro?',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (confirmed) {
      await db.goals.delete(id);
    }
  };

  const openAddMoney = (goalId: number) => {
    setSelectedGoalId(goalId);
    setAddAmount(0);
    setAddModalOpen(true);
  };

  const handleAddMoney = async () => {
    const goal = goals?.find(g => g.id === selectedGoalId);
    if (goal) {
      await db.goals.update(selectedGoalId, {
        currentAmount: goal.currentAmount + addAmount,
        updatedAt: new Date(),
      });
    }
    setAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('goals.title')}</h1>
        <Button onClick={openNewModal}>
          <Plus className="w-4 h-4" />
          {t('goals.newGoal')}
        </Button>
      </div>

      {!goals ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const percentage = calculatePercentage(goal.currentAmount, goal.targetAmount);
            const isAchieved = goal.currentAmount >= goal.targetAmount;
            const remaining = goal.targetAmount - goal.currentAmount;

            return (
              <Card key={goal.id} hover>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: goal.color || '#7c3aed' }}
                      >
                        {isAchieved ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <Target className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{goal.name}</p>
                        <p className="text-xs text-gray-400">
                          {goal.targetDate && (
                            <span className="flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {formatDate(goal.targetDate)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge variant={isAchieved ? 'success' : 'info'}>
                      {isAchieved ? t('goals.achieved') : `${percentage}%`}
                    </Badge>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(goal.currentAmount, goal.currency)}
                      </span>
                      <span className="text-gray-400">
                        {formatCurrency(goal.targetAmount, goal.currency)}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700 ease-out',
                          isAchieved ? 'bg-secondary' : 'bg-accent'
                        )}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </div>
                  </div>

                  {!isAchieved && (
                    <p className="text-xs text-gray-400 mt-2">
                      {t('goals.remainingToGoal', { amount: formatCurrency(remaining, goal.currency) })}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-50">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(goal)}>
                      {t('common.edit')}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => openAddMoney(goal.id!)}>
                      <TrendingUp className="w-4 h-4" />
                      {t('goals.addMoney')}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => handleDelete(goal.id!)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Target className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">{t('goals.title')}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openNewModal}>
              <Plus className="w-4 h-4" />
              {t('goals.newGoal')}
            </Button>
          </CardContent>
        </Card>
      )}

      {ConfirmDialog}

      {/* Goal Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGoal ? t('goals.editGoal') : t('goals.newGoal')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('goals.goalName')}
            value={formData.name}
            onChange={(e) => { setFormData(prev => ({ ...prev, name: e.target.value })); setFormErrors({}); }}
            placeholder="Ej: Viaje a Europa"
            error={formErrors.name}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('goals.targetAmount')}
              type="number"
              step="0.01"
              value={formData.targetAmount}
              onChange={(e) => { setFormData(prev => ({ ...prev, targetAmount: parseFloat(e.target.value) || 0 })); setFormErrors({}); }}
              error={formErrors.targetAmount}
            />
            <Input
              label={t('goals.currentAmount')}
              type="number"
              step="0.01"
              value={formData.currentAmount}
              onChange={(e) => { setFormData(prev => ({ ...prev, currentAmount: parseFloat(e.target.value) || 0 })); setFormErrors({}); }}
              error={formErrors.currentAmount}
            />
          </div>
          <Input
            label={t('goals.targetDate')}
            type="date"
            value={formData.targetDate}
            onChange={(e) => setFormData(prev => ({ ...prev, targetDate: e.target.value }))}
          />
          <Select
            label={t('common.account')}
            value={String(formData.accountId)}
            onChange={(e) => setFormData(prev => ({ ...prev, accountId: Number(e.target.value) }))}
            options={accounts?.map(a => ({ value: String(a.id), label: a.name })) || []}
          />
          <Input
            label="Color"
            type="color"
            value={formData.color}
            onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Add Money Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={t('goals.addMoney')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddMoney}>{t('common.save')}</Button>
          </>
        }
      >
        <Input
          label={t('common.amount')}
          type="number"
          step="0.01"
          value={addAmount}
          onChange={(e) => setAddAmount(parseFloat(e.target.value) || 0)}
          autoFocus
        />
      </Modal>
    </div>
  );
}
