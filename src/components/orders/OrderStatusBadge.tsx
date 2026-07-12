import {
  Ban,
  CheckCircle2,
  Clipboard,
  Clock,
  Send,
} from 'lucide-react';
import {
  PO_STATUS_CONFIG,
  SO_STATUS_CONFIG,
} from '@/lib/orders/orderPresentation';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Clipboard className="w-3 h-3" />,
  reserved: <Clock className="w-3 h-3" />,
  sent: <Send className="w-3 h-3" />,
  fulfilled: <CheckCircle2 className="w-3 h-3" />,
  cancelled: <Ban className="w-3 h-3" />,
};

interface OrderStatusBadgeProps {
  status: string;
  type: 'so' | 'po';
}

export function OrderStatusBadge({ status, type }: OrderStatusBadgeProps) {
  const statusConfig = type === 'so' ? SO_STATUS_CONFIG : PO_STATUS_CONFIG;
  const config = statusConfig[status] ?? statusConfig.draft;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${config.color}`}
    >
      {STATUS_ICONS[status]}
      {config.label}
    </span>
  );
}
