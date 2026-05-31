import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, Eye, EyeOff, X, Settings2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { type WidgetConfig, type WidgetId, getWidgetLabel } from '@/lib/dashboardWidgets';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface WidgetCustomizerProps {
  widgets: WidgetConfig[];
  onSave: (widgets: WidgetConfig[]) => void;
  onClose: () => void;
}

function SortableWidgetItem({
  widget,
  onToggle,
}: {
  widget: WidgetConfig;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-shadow',
        isDragging && 'shadow-lg opacity-80 z-50'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing transition-colors"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </button>

      {/* Widget name */}
      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
        {getWidgetLabel(widget.id, t)}
      </span>

      {/* Visibility toggle */}
      <button
        onClick={onToggle}
        className={cn(
          'flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors',
          widget.visible
            ? 'bg-primary/10 text-primary hover:bg-primary/20'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
        )}
        title={widget.visible ? 'Hide' : 'Show'}
      >
        {widget.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function WidgetCustomizer({ widgets, onSave, onClose }: WidgetCustomizerProps) {
  const { t } = useTranslation();
  const [localWidgets, setLocalWidgets] = useState(() => [...widgets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalWidgets((prev) => {
      const oldIndex = prev.findIndex((w) => w.id === active.id);
      const newIndex = prev.findIndex((w) => w.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(oldIndex, 1);
      copy.splice(newIndex, 0, moved);
      return copy;
    });
  }

  function toggleVisibility(widgetId: WidgetId) {
    setLocalWidgets((prev) =>
      prev.map((w) =>
        w.id === widgetId ? { ...w, visible: !w.visible } : w
      )
    );
  }

  const visibleCount = localWidgets.filter((w) => w.visible).length;
  const hiddenCount = localWidgets.filter((w) => !w.visible).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md max-h-[80vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('dashboardWidgets.customize')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {/* Summary */}
          <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{visibleCount} visible</span>
            {hiddenCount > 0 && <span>{hiddenCount} hidden</span>}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localWidgets.map((w) => w.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {localWidgets.map((widget) => (
                  <SortableWidgetItem
                    key={widget.id}
                    widget={widget}
                    onToggle={() => toggleVisibility(widget.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100 dark:border-gray-700/50">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              onSave(localWidgets);
              onClose();
            }}
          >
            {t('common.save')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
