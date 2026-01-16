import { useContext, createContext } from 'react';

// Types
export type ToastType = 'success' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export interface ShowToastOptions {
  type: ToastType;
  message: string;
}

export interface ToastContextValue {
  showToast: (options: ShowToastOptions) => void;
}

// Context - exported for provider to use
export const ToastContext = createContext<ToastContextValue | null>(null);

// Hook to use toast
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
