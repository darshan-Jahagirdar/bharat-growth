import type { CreditCustomer } from '@/lib/dashboard/dashboardQueries';
import { formatINR } from '@/lib/types/database';
import { WhatsAppIcon } from './WhatsAppIcon';

interface KhataReminderDialogProps {
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
  target: CreditCustomer | null;
}

export function KhataReminderDialog({
  onClose,
  onSend,
  sending,
  target,
}: KhataReminderDialogProps) {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-xs p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-900/50 border border-emerald-800
                         flex items-center justify-center">
            <WhatsAppIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-200">Send Reminder?</div>
            <div className="text-[11px] text-gray-500">via WhatsApp</div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg px-3 py-3 mb-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Customer</span>
            <span className="text-gray-200 font-medium">
              {target.name ?? target.phone_number}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Outstanding</span>
            <span className="text-red-400 font-bold">
              {formatINR(target.credit_balance_paise)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Phone</span>
            <span className="text-gray-300 font-mono text-xs">
              {target.phone_number}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onSend}
            disabled={sending}
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                       text-white text-sm font-semibold rounded-lg transition-colors
                       flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <WhatsAppIcon className="w-4 h-4" />
                Send Reminder
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400
                       text-sm rounded-lg transition-colors border border-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
