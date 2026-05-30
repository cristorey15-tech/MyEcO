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
  resetAllState: () => void;
  // Persisted transaction filters
  transactionFilters: TransactionFilterState;
  setTransactionFilters: (filters: Partial<TransactionFilterState>) => void;
  resetTransactionFilters: () => void;
  // Profile & Security
  userName: string;
  setUserName: (name: string) => void;
  pinHash: string;
  setPinHash: (hash: string) => void;
  lockEnabled: boolean;
  setLockEnabled: (enabled: boolean) => void;
  biometricEnabled: boolean;
  setBiometricEnabled: (enabled: boolean) => void;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
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
      userName: '',
      pinHash: '',
      lockEnabled: false,
      biometricEnabled: false,
      isLocked: false,

      setDefaultCurrency: (currency) => set({ defaultCurrency: currency }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setHydrated: () => set({ isHydrated: true }),
      completeTour: () => set({ tourCompleted: true }),
      resetTour: () => set({ tourCompleted: false }),
      completeSetup: () => set({ setupCompleted: true }),
      resetSetup: () => set({ setupCompleted: false }),
      resetAllState: () => set({
        defaultCurrency: 'USD',
        tourCompleted: false,
        setupCompleted: false,
        transactionFilters: { ...defaultTransactionFilters },
        userName: '',
        pinHash: '',
        lockEnabled: false,
        biometricEnabled: false,
        isLocked: false,
      }),
      setUserName: (name) => set({ userName: name }),
      setPinHash: (hash) => set({ pinHash: hash }),
      setLockEnabled: (enabled) => set({ lockEnabled: enabled }),
      setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
      setIsLocked: (locked) => set({ isLocked: locked }),
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
