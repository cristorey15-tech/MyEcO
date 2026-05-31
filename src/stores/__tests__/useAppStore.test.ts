import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      defaultCurrency: 'USD',
      sidebarOpen: true,
      isHydrated: false,
      tourCompleted: false,
      setupCompleted: false,        transactionFilters: {
        searchTerm: '',
        filterType: '',
        filterAccount: '',
        filterCategory: '',
        filterRecurring: '',
        filterAmountMin: '',
        filterAmountMax: '',
        filterTag: '',
        showFilters: false,
        currentPage: 1,
      },
    });
  });

  describe('initial state', () => {
    it('should initialize with default values', () => {
      const state = useAppStore.getState();
      expect(state.defaultCurrency).toBe('USD');
      expect(state.sidebarOpen).toBe(true);
      expect(state.isHydrated).toBe(false);
      expect(state.tourCompleted).toBe(false);
      expect(state.setupCompleted).toBe(false);
    });
  });

  describe('setDefaultCurrency', () => {
    it('should update the default currency', () => {
      useAppStore.getState().setDefaultCurrency('MXN');
      expect(useAppStore.getState().defaultCurrency).toBe('MXN');
    });

    it('should accept any currency string', () => {
      useAppStore.getState().setDefaultCurrency('EUR');
      expect(useAppStore.getState().defaultCurrency).toBe('EUR');
    });
  });

  describe('toggleSidebar', () => {
    it('should toggle sidebar from true to false', () => {
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarOpen).toBe(false);
    });

    it('should toggle sidebar from false to true', () => {
      useAppStore.setState({ sidebarOpen: false });
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe('setHydrated', () => {
    it('should set isHydrated to true', () => {
      expect(useAppStore.getState().isHydrated).toBe(false);
      useAppStore.getState().setHydrated();
      expect(useAppStore.getState().isHydrated).toBe(true);
    });

    it('should remain true after multiple calls', () => {
      useAppStore.getState().setHydrated();
      useAppStore.getState().setHydrated();
      expect(useAppStore.getState().isHydrated).toBe(true);
    });
  });

  describe('tour', () => {
    it('should complete the tour', () => {
      useAppStore.getState().completeTour();
      expect(useAppStore.getState().tourCompleted).toBe(true);
    });

    it('should reset the tour', () => {
      useAppStore.getState().completeTour();
      expect(useAppStore.getState().tourCompleted).toBe(true);

      useAppStore.getState().resetTour();
      expect(useAppStore.getState().tourCompleted).toBe(false);
    });
  });

  describe('setup', () => {
    it('should complete the setup', () => {
      useAppStore.getState().completeSetup();
      expect(useAppStore.getState().setupCompleted).toBe(true);
    });

    it('should reset the setup', () => {
      useAppStore.getState().completeSetup();
      useAppStore.getState().resetSetup();
      expect(useAppStore.getState().setupCompleted).toBe(false);
    });
  });

  describe('transactionFilters', () => {
    it('should initialize with default filter values', () => {
      const filters = useAppStore.getState().transactionFilters;
      expect(filters.searchTerm).toBe('');
      expect(filters.filterType).toBe('');
      expect(filters.filterAccount).toBe('');
      expect(filters.filterCategory).toBe('');
      expect(filters.filterRecurring).toBe('');
      expect(filters.showFilters).toBe(false);
      expect(filters.currentPage).toBe(1);
    });

    it('should set partial filters and keep existing ones', () => {
      useAppStore.getState().setTransactionFilters({ searchTerm: 'food', filterType: 'expense' });
      const filters = useAppStore.getState().transactionFilters;
      expect(filters.searchTerm).toBe('food');
      expect(filters.filterType).toBe('expense');
      expect(filters.filterAccount).toBe(''); // unchanged
      expect(filters.currentPage).toBe(1); // unchanged
    });

    it('should set showFilters', () => {
      useAppStore.getState().setTransactionFilters({ showFilters: true });
      expect(useAppStore.getState().transactionFilters.showFilters).toBe(true);
    });

    it('should set currentPage', () => {
      useAppStore.getState().setTransactionFilters({ currentPage: 5 });
      expect(useAppStore.getState().transactionFilters.currentPage).toBe(5);
    });

    it('should reset filters to defaults', () => {
      useAppStore.getState().setTransactionFilters({
        searchTerm: 'test',
        filterType: 'income',
        showFilters: true,
        currentPage: 3,
      });
      useAppStore.getState().resetTransactionFilters();

      const filters = useAppStore.getState().transactionFilters;
      expect(filters.searchTerm).toBe('');
      expect(filters.filterType).toBe('');
      expect(filters.showFilters).toBe(false);
      expect(filters.currentPage).toBe(1);
    });
  });

  describe('resetAllState', () => {
    it('should reset all state properties to defaults', () => {
      // Change some state
      useAppStore.getState().setDefaultCurrency('MXN');
      useAppStore.getState().completeTour();
      useAppStore.getState().completeSetup();
      useAppStore.getState().setTransactionFilters({ searchTerm: 'test', showFilters: true });

      // Reset everything
      useAppStore.getState().resetAllState();

      const state = useAppStore.getState();
      expect(state.defaultCurrency).toBe('USD');
      expect(state.tourCompleted).toBe(false);
      expect(state.setupCompleted).toBe(false);
      expect(state.transactionFilters.searchTerm).toBe('');
      expect(state.transactionFilters.showFilters).toBe(false);
      expect(state.transactionFilters.currentPage).toBe(1);
    });

    it('should preserve sidebar state', () => {
      useAppStore.setState({ sidebarOpen: false });
      useAppStore.getState().resetAllState();
      // sidebarOpen is NOT reset by resetAllState
      expect(useAppStore.getState().sidebarOpen).toBe(false);
    });
  });
});
