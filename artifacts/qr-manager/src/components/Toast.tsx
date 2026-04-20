import { useState, useCallback, createContext, useContext, useRef } from 'react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useSimpleToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const bgColor = (type: ToastItem['type']) => {
    if (type === 'success') return '#0F6E56';
    if (type === 'error') return '#DC2626';
    return '#1B2A4A';
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-4 z-[200] flex flex-col gap-2 pointer-events-none"
        style={{ insetInlineEnd: '1rem' }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white pointer-events-auto transition-all duration-300"
            style={{ backgroundColor: bgColor(toast.type), minWidth: '220px' }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
