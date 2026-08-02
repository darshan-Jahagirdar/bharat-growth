import { WhatsAppIcon } from './WhatsAppIcon';

interface ReminderSuccessToastProps {
  message: string | null;
}

export function ReminderSuccessToast({ message }: ReminderSuccessToastProps) {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 border border-emerald-700 rounded-lg px-4 py-3 shadow-xl">
      <div className="flex items-center gap-2 text-sm text-emerald-300">
        <WhatsAppIcon className="w-4 h-4" />
        {message}
      </div>
    </div>
  );
}
