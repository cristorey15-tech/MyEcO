import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TransactionFilterState {
  searchTerm: string;
  filterType: string;
  filterAccount: string;
  filterCategory: string;
  filterRecurring: string;
  showFilters: boolean;
  currentPage: number;
}

interface AppState {
  defaultCurrency: string;
  setDefaultCurrency: (currency: string) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  isHydrated: boolean;
  setHydrated: () => void;
  tourCompleted: boolean;
  completeTour: () => void;
  resetTour: () => void;
  setupCompleted: boolean;
  completeSetup: () => void;
  resetSetup: () => void;
  // Persisted transaction filters
  transactionFilters: TransactionFilterState;
  setTransactionFilters: (filters: Partial<TransactionFilterState>) => void;
  resetTransactionFilters: () => void;
}

const defaultTransactionFilters: TransactionFilterState = {
  searchTerm: '',
  filterType: '',
  filterAccount: '',
  filterCategory: '',
  filterRecurring: '',
  showFilters: false,
  currentPage: 1,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      defaultCurrency: 'USD',
      sidebarOpen: true,
      isHydrated: false,
      tourCompleted: false,
      setupCompleted: false,
      transactionFilters: { ...defaultTransactionFilters },

      setDefaultCurrency: (currency) => set({ defaultCurrency: currency }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setHydrated: () => set({ isHydrated: true }),
      completeTour: () => set({ tourCompleted: true }),
      resetTour: () => set({ tourCompleted: false }),
      completeSetup: () => set({ setupCompleted: true }),
      resetSetup: () => set({ setupCompleted: false }),
      setTransactionFilters: (filters) => set((state) => ({
        transactionFilters: { ...state.transactionFilters, ...filters },
      })),
      resetTransactionFilters: () => set({ transactionFilters: { ...defaultTransactionFilters } }),
    }),
    {
      name: 'myeco-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
