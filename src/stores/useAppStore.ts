import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TransactionFilterState {
  searchTerm: string;
  filterType: string;
  filterAccount: string;
  filterCategory: string;
  filterRecurring: string;
  filterAmountMin: string;
  filterAmountMax: string;
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
  pinLength: number;
  setPinLength: (length: number) => void;
  lockEnabled: boolean;
  setLockEnabled: (enabled: boolean) => void;
  biometricEnabled: boolean;
  setBiometricEnabled: (enabled: boolean) => void;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  // Dark mode
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  // Security questions for PIN recovery
  securityQuestions: { question: string; answerHash: string }[];
  setSecurityQuestions: (questions: { question: string; answerHash: string }[]) => void;
}

const defaultTransactionFilters: TransactionFilterState = {
  searchTerm: '',
  filterType: '',
  filterAccount: '',
  filterCategory: '',
  filterRecurring: '',
  filterAmountMin: '',
  filterAmountMax: '',
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
      pinLength: 4,
      lockEnabled: false,
      biometricEnabled: false,
      isLocked: false,
      securityQuestions: [],
      darkMode: false,

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
        pinLength: 4,
        lockEnabled: false,
        biometricEnabled: false,
        isLocked: false,
        securityQuestions: [],
        darkMode: false,
      }),
      setUserName: (name) => set({ userName: name }),
      setPinHash: (hash) => set({ pinHash: hash }),
      setPinLength: (length) => set({ pinLength: length }),
      setLockEnabled: (enabled) => set({ lockEnabled: enabled }),
      setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
      setIsLocked: (locked) => set({ isLocked: locked }),
      setDarkMode: (dark) => set({ darkMode: dark }),
      setSecurityQuestions: (questions) => set({ securityQuestions: questions }),
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
