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
import { Plus, HandshakeIcon, ArrowDownRight, Calendar, Percent } from 'lucide-react';
import type { Debt } from '@/types';

export function Debts() {
  const { t } = useTranslation();
  const { defaultCurrency } = useAppStore();
  const { confirm, ConfirmDialog } = useConfirm();

  const debts = useLiveQuery(() => db.debts.toArray());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    type: 'owed' as 'owed' | 'lent',
    totalAmount: 0,
    remainingAmount: 0,
    currency: defaultCurrency,
    interestRate: 0,
    installments: 0,
    paidInstallments: 0,
    dueDate: '',
    creditorName: '',
    notes: '',
  });

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payDebtId, setPayDebtId] = useState<number>(0);
  const [paymentAmount, setPaymentAmount] = useState(0);

  const openNewModal = () => {
    setEditingDebt(null);
    setFormErrors({});
    setFormData({
      name: '',
      type: 'owed',
      totalAmount: 0,
      remainingAmount: 0,
      currency: defaultCurrency,
      interestRate: 0,
      installments: 0,
      paidInstallments: 0,
      dueDate: '',
      creditorName: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (debt: Debt) => {
    setEditingDebt(debt);
    setFormErrors({});
    setFormData({
      name: debt.name,
      type: debt.type,
      totalAmount: debt.totalAmount,
      remainingAmount: debt.remainingAmount,
      currency: debt.currency,
      interestRate: debt.interestRate || 0,
      installments: debt.installments || 0,
      paidInstallments: debt.paidInstallments || 0,
      dueDate: debt.dueDate ? new Date(debt.dueDate).toISOString().split('T')[0] : '',
      creditorName: debt.creditorName || '',
      notes: debt.notes,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t('validation.required');
    if (formData.totalAmount <= 0) errors.totalAmount = t('validation.positiveAmount');
    if (formData.remainingAmount < 0) errors.remainingAmount = t('validation.invalidAmount');
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const now = new Date();
    const data = {
      name: formData.name,
      type: formData.type,
      totalAmount: formData.totalAmount,
      remainingAmount: formData.remainingAmount,
      currency: formData.currency,
      interestRate: formData.interestRate || undefined,
      installments: formData.installments || undefined,
      paidInstallments: formData.paidInstallments || undefined,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
      creditorName: formData.creditorName || undefined,
      notes: formData.notes,
      updatedAt: now,
      createdAt: now,
    };

    if (editingDebt) {
      await db.debts.update(editingDebt.id!, { ...data, createdAt: editingDebt.createdAt });
    } else {
      await db.debts.add(data);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: 'Eliminar deuda',
      message: '¿Estás seguro de eliminar esta deuda?',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (confirmed) {
      await db.debts.delete(id);
    }
  };

  const openPayModal = (debtId: number) => {
    const debt = debts?.find(d => d.id === debtId);
    setPayDebtId(debtId);
    setPaymentAmount(debt ? Math.min(debt.remainingAmount, debt.installments ? debt.totalAmount / debt.installments : debt.remainingAmount) : 0);
    setPayModalOpen(true);
  };

  const handlePay = async () => {
    const debt = debts?.find(d => d.id === payDebtId);
    if (debt) {
      const newRemaining = Math.max(0, debt.remainingAmount - paymentAmount);
      const newPaidInstallments = debt.installments ? (debt.paidInstallments || 0) + 1 : undefined;
      await db.debts.update(payDebtId, {
        remainingAmount: newRemaining,
        paidInstallments: newPaidInstallments,
        updatedAt: new Date(),
      });
    }
    setPayModalOpen(false);
  };

  const owedDebts = debts?.filter(d => d.type === 'owed') || [];
  const lentDebts = debts?.filter(d => d.type === 'lent') || [];
  const totalOwed = owedDebts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const totalLent = lentDebts.reduce((sum, d) => sum + d.remainingAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('debts.title')}</h1>
        <Button onClick={openNewModal}>
          <Plus className="w-4 h-4" />
          {t('debts.newDebt')}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-gray-500">{t('debts.iOwe')}</p>
            <p className="text-2xl font-bold text-danger mt-1">{formatCurrency(totalOwed, defaultCurrency)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{owedDebts.length} deudas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm font-medium text-gray-500">{t('debts.theyOweMe')}</p>
            <p className="text-2xl font-bold text-income mt-1">{formatCurrency(totalLent, defaultCurrency)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{lentDebts.length} personas</p>
          </CardContent>
        </Card>
      </div>

      {/* Debt list */}
      {!debts ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : debts.length > 0 ? (
        <div className="space-y-4">
          {owedDebts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('debts.iOwe')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {owedDebts.map(debt => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                    onPay={openPayModal}
                    defaultCurrency={defaultCurrency}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}

          {lentDebts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('debts.theyOweMe')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lentDebts.map(debt => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                    onPay={openPayModal}
                    defaultCurrency={defaultCurrency}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <HandshakeIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">{t('debts.title')}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openNewModal}>
              <Plus className="w-4 h-4" />
              {t('debts.newDebt')}
            </Button>
          </CardContent>
        </Card>
      )}

      {ConfirmDialog}

      {/* Debt Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDebt ? t('debts.editDebt') : t('debts.newDebt')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label={t('debts.debtName')} value={formData.name} onChange={(e) => { setFormData(prev => ({ ...prev, name: e.target.value })); setFormErrors({}); }} placeholder="Ej: Préstamo bancario" error={formErrors.name} />
          
          <Select
            label={t('common.type')}
            value={formData.type}
            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'owed' | 'lent' }))}
            options={[
              { value: 'owed', label: t('debts.iOwe') },
              { value: 'lent', label: t('debts.theyOweMe') },
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input label={t('debts.totalAmount')} type="number" step="0.01" value={formData.totalAmount} onChange={(e) => { setFormData(prev => ({ ...prev, totalAmount: parseFloat(e.target.value) || 0 })); setFormErrors({}); }} error={formErrors.totalAmount} />
            <Input label={t('debts.remainingAmount')} type="number" step="0.01" value={formData.remainingAmount} onChange={(e) => { setFormData(prev => ({ ...prev, remainingAmount: parseFloat(e.target.value) || 0 })); setFormErrors({}); }} error={formErrors.remainingAmount} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label={t('debts.interestRate')} type="number" step="0.01" value={formData.interestRate} onChange={(e) => setFormData(prev => ({ ...prev, interestRate: parseFloat(e.target.value) || 0 }))} />
            <Input label={t('debts.creditor')} value={formData.creditorName} onChange={(e) => setFormData(prev => ({ ...prev, creditorName: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Cuotas" type="number" value={formData.installments} onChange={(e) => setFormData(prev => ({ ...prev, installments: parseInt(e.target.value) || 0 }))} />
            <Input label={t('debts.paidInstallments')} type="number" value={formData.paidInstallments} onChange={(e) => setFormData(prev => ({ ...prev, paidInstallments: parseInt(e.target.value) || 0 }))} />
          </div>

          <Input label={t('debts.dueDate')} type="date" value={formData.dueDate} onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))} />
          <Input label={t('common.note')} value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} />
        </div>
      </Modal>

      {/* Pay Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={t('debts.makePayment')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handlePay}>{t('debts.payDebt')}</Button>
          </>
        }
      >
        <Input
          label={t('debts.paymentAmount')}
          type="number"
          step="0.01"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
          autoFocus
        />
      </Modal>
    </div>
  );
}

function DebtCard({ debt, onEdit, onDelete, onPay, defaultCurrency, t }: {
  debt: Debt;
  onEdit: (d: Debt) => void;
  onDelete: (id: number) => void;
  onPay: (id: number) => void;
  defaultCurrency: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const percentage = calculatePercentage(debt.remainingAmount, debt.totalAmount);
  const isPaid = debt.remainingAmount <= 0;

  return (
    <Card hover>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center',
              debt.type === 'owed' ? 'bg-red-50' : 'bg-green-50'
            )}>
              <ArrowDownRight className={cn(
                'w-5 h-5',
                debt.type === 'owed' ? 'text-red-600' : 'text-green-600'
              )} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{debt.name}</p>
              {debt.creditorName && (
                <p className="text-xs text-gray-400">{debt.creditorName}</p>
              )}
            </div>
          </div>
          {isPaid && <Badge variant="success">Pagado</Badge>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400">{t('debts.totalAmount')}</p>
            <p className="text-sm font-semibold text-gray-900">{formatCurrency(debt.totalAmount, debt.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">{t('debts.remainingAmount')}</p>
            <p className="text-sm font-semibold text-gray-900">{formatCurrency(debt.remainingAmount, debt.currency)}</p>
          </div>
        </div>

        {debt.installments && debt.installments > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Cuotas: {debt.paidInstallments || 0}/{debt.installments}</span>
              <span>{calculatePercentage(debt.paidInstallments || 0, debt.installments)}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${calculatePercentage(debt.paidInstallments || 0, debt.installments)}%` }}
              />
            </div>
          </div>
        )}

        {debt.interestRate && debt.interestRate > 0 && (
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
            <Percent className="w-3 h-3" />
            {debt.interestRate}% interés
          </div>
        )}

        {debt.dueDate && (
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
            <Calendar className="w-3 h-3" />
            Vence: {formatDate(debt.dueDate)}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-50">
          {!isPaid && (
            <Button variant="primary" size="sm" onClick={() => onPay(debt.id!)}>
              {t('debts.payDebt')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onEdit(debt)}>
            {t('common.edit')}
          </Button>
          <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => onDelete(debt.id!)}>
            {t('common.delete')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
