import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore } from '../useToastStore';

describe('useToastStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with an empty toast list', () => {
    const state = useToastStore.getState();
    expect(state.toasts).toEqual([]);
  });

  it('should add a toast and return its id', () => {
    const { addToast } = useToastStore.getState();
    const id = addToast({ title: 'Test toast', variant: 'success' });
    expect(id).toBeDefined();
    expect(id).toContain('toast-');

    const state = useToastStore.getState();
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].title).toBe('Test toast');
    expect(state.toasts[0].variant).toBe('success');
  });

  it('should add a toast with message', () => {
    const { addToast } = useToastStore.getState();
    addToast({ title: 'Test', message: 'Detail message', variant: 'info' });

    const state = useToastStore.getState();
    expect(state.toasts[0].message).toBe('Detail message');
  });

  it('should remove a toast by id', () => {
    const { addToast, removeToast } = useToastStore.getState();
    const id = addToast({ title: 'Toast to remove', variant: 'warning' });
    expect(useToastStore.getState().toasts).toHaveLength(1);

    removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('should auto-dismiss toasts after default duration', () => {
    const { addToast } = useToastStore.getState();
    addToast({ title: 'Auto dismiss', variant: 'success' });

    expect(useToastStore.getState().toasts).toHaveLength(1);

    // Fast-forward past the default timeout (5000ms)
    vi.advanceTimersByTime(5100);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('should not auto-dismiss persistent toasts (duration=0)', () => {
    const { addToast } = useToastStore.getState();
    addToast({ title: 'Persistent', variant: 'error', duration: 0 });

    vi.advanceTimersByTime(10000);

    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('should clear all toasts', () => {
    const { addToast, clearToasts } = useToastStore.getState();
    addToast({ title: 'Toast 1', variant: 'info' });
    addToast({ title: 'Toast 2', variant: 'success' });

    expect(useToastStore.getState().toasts).toHaveLength(2);

    clearToasts();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('should accept all toast variants', () => {
    const { addToast } = useToastStore.getState();
    const variants = ['success', 'error', 'info', 'warning'] as const;
    
    for (const variant of variants) {
      addToast({ title: `Variant ${variant}`, variant });
    }

    expect(useToastStore.getState().toasts).toHaveLength(4);
  });
});
