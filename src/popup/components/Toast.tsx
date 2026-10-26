import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { ToastContext, type ToastMessage, type ShowToastOptions } from '../hooks/useToast';

// Individual Toast Component
interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss after 3 seconds
    const dismissTimer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 3000);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(dismissTimer);
    };
  }, [toast.id, onDismiss]);

  const handleManualDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const isSuccess = toast.type === 'success';
  const Icon = isSuccess ? CheckCircle : XCircle;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`pointer-events-auto flex max-w-[350px] min-w-[200px] items-center gap-2.5 rounded-lg px-4 py-3 text-[13px] font-medium text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] [transition:opacity_0.3s_ease,transform_0.3s_ease] ${
        isSuccess ? 'bg-success' : 'bg-error'
      } ${isVisible && !isLeaving ? 'opacity-100 [transform:translateX(0)]' : 'opacity-0 [transform:translateX(100%)]'}`}
    >
      <Icon size={18} className="shrink-0" />
      <span className="flex-1 leading-[1.4]">{toast.message}</span>
      <button
        onClick={handleManualDismiss}
        aria-label="Dismiss notification"
        className="flex shrink-0 cursor-pointer items-center justify-center bg-transparent p-0.5 text-white opacity-80 [transition:opacity_0.2s] hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Toast Container (displays all toasts)
interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div aria-label="Notifications" className="pointer-events-none fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// Toast Provider
interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(({ type, message }: ShowToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastMessage = { id, type, message };

    setToasts((prev) => [...prev, newToast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// Default export for convenience
export default ToastProvider;
