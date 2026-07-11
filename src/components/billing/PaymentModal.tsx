'use client';

// =============================================================================
// BharatGrowth — UPI Payment Modal
// Shows a dynamic, amount-locked UPI QR code for digital payments
// Shopkeeper clicks "Confirm Payment Received" after verifying on their phone
// =============================================================================

import { QRCodeSVG } from 'qrcode.react';

interface PaymentModalProps {
  isOpen: boolean;
  totalPaise: number;
  shopName: string;
  shopUpiId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

export function PaymentModal({
  isOpen,
  totalPaise,
  shopName,
  shopUpiId,
  onConfirm,
  onCancel,
}: PaymentModalProps) {
  if (!isOpen) return null;

  const amountRupees = (totalPaise / 100).toFixed(2);

  // UPI intent URI — amount-locked, non-editable by customer
  const upiUri = `upi://pay?pa=${encodeURIComponent(shopUpiId)}&pn=${encodeURIComponent(shopName)}&am=${amountRupees}&cu=INR`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close payment dialog"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div role="dialog" aria-modal="true" aria-labelledby="upi-payment-title" className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-purple-900/40 border-b border-purple-800/50 px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-2xl">📱</span>
            <h2 id="upi-payment-title" className="text-lg font-bold text-white">UPI Payment</h2>
          </div>
          <p className="text-purple-300 text-xs">
            Customer scans QR to pay — amount is locked
          </p>
        </div>

        {/* Amount */}
        <div className="text-center py-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Amount to Pay</p>
          <p className="text-4xl font-bold text-white font-mono">
            {formatINR(totalPaise)}
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center pb-4">
          <div className="bg-white rounded-xl p-4 shadow-inner">
            <QRCodeSVG
              value={upiUri}
              size={200}
              level="M"
              includeMargin={false}
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
          </div>
        </div>

        {/* UPI ID display */}
        <div className="text-center pb-4">
          <p className="text-gray-500 text-[11px]">Pay to</p>
          <p className="text-gray-300 text-sm font-mono">{shopUpiId}</p>
        </div>

        {/* Action Buttons */}
        <div className="px-5 pb-5 space-y-2.5">
          <button
            onClick={onConfirm}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500
                       text-white text-sm font-bold
                       transition-all active:scale-[0.98] shadow-lg shadow-emerald-900/30"
          >
            ✓ Confirm Payment Received
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700
                       text-gray-400 text-sm font-medium
                       transition-colors border border-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
