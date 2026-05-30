import { useState, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    message: '',
  });
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      setResolveRef(() => resolve);
    });
  }, []);

  const handleConfirm = () => {
    resolveRef?.(true);
    setIsOpen(false);
  };

  const handleCancel = () => {
    resolveRef?.(false);
    setIsOpen(false);
  };

  const ConfirmDialog = (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={options.title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleCancel}>
            {options.cancelLabel || 'Cancelar'}
          </Button>
          <Button
            variant={options.variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
          >
            {options.confirmLabel || 'Confirmar'}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${options.variant === 'danger' ? 'bg-red-50' : 'bg-blue-50'}`}>
          <AlertTriangle className={`w-5 h-5 ${options.variant === 'danger' ? 'text-danger' : 'text-primary'}`} />
        </div>
        <p className="text-sm text-gray-600 pt-1">{options.message}</p>
      </div>
    </Modal>
  );

  return { confirm, ConfirmDialog };
}
