import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardWidgetProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  onVisibilityToggle?: () => void;
  visible?: boolean;
}

export function DashboardWidget({ id, children, className, onVisibilityToggle, visible }: DashboardWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group',
        isDragging && 'opacity-50 z-50',
        className
      )}
    >
      {/* Drag handle + visibility toggle — visible on hover */}
      <div
        className={cn(
          'absolute -top-2 -left-2 z-10 flex items-center gap-1',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
          isDragging && 'opacity-100'
        )}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm cursor-grab active:cursor-grabbing hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {/* Visibility toggle (only in customizer mode) */}
        {onVisibilityToggle && (
          <button
            onClick={onVisibilityToggle}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title={visible ? 'Hide widget' : 'Show widget'}
          >
            {visible ? (
              <EyeOff className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
        )}
      </div>

      {children}
    </div>
  );
}
