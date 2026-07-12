import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import type { OrdersToast as OrdersToastState } from '@/lib/orders/orderPresentation';

interface OrdersToastProps {
  toast: OrdersToastState | null;
  onClose: () => void;
}

export function OrdersToast({ toast, onClose }: OrdersToastProps) {
  if (!toast) return null;

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3 rounded-xl
        border shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300
        ${toast.type === 'success'
          ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
          : 'bg-red-950/90 border-red-500/30 text-red-300'
        }
      `}
    >
      {toast.type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={onClose}
        className="ml-2 p-0.5 rounded hover:bg-white/10 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
