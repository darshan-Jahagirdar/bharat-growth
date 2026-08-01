interface BillingHeaderProps {
  shopName: string;
  isComposition: boolean;
  pendingOnlineCount: number;
  visitDisabled: boolean;
  onOpenVisit: () => void;
  onOpenOnlineOrders: () => void;
}

export function BillingHeader({
  shopName,
  isComposition,
  pendingOnlineCount,
  visitDisabled,
  onOpenVisit,
  onOpenOnlineOrders,
}: BillingHeaderProps) {
  return (
    <header className="h-10 min-h-[40px] bg-gray-900 border-b border-gray-800 flex items-center px-4 justify-between">
      <div className="flex items-center gap-3">
        <span className="text-gray-400 text-xs font-medium">
          {shopName || 'Loading...'}
        </span>
        {isComposition && (
          <span className="bg-yellow-900/50 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded font-semibold">
            BILL OF SUPPLY
          </span>
        )}
        {!isComposition && (
          <span className="bg-blue-900/50 text-blue-400 text-[10px] px-1.5 py-0.5 rounded font-semibold">
            TAX INVOICE
          </span>
        )}
        <button
          type="button"
          disabled={visitDisabled}
          onClick={onOpenVisit}
          className="rounded border border-emerald-800 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-400
                     transition-colors hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Visit <kbd className="ml-1 rounded bg-gray-800 px-1">F6</kbd>
        </button>
        {pendingOnlineCount > 0 && (
          <button
            onClick={onOpenOnlineOrders}
            className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse
                       hover:bg-orange-500 transition-colors cursor-pointer"
          >
            {pendingOnlineCount} Online {pendingOnlineCount === 1 ? 'Order' : 'Orders'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-600">
        <kbd className="bg-gray-800 px-1 rounded">F2</kbd> Customer
        <kbd className="bg-gray-800 px-1 rounded">F3</kbd> Add Item
        <kbd className="bg-gray-800 px-1 rounded">F4</kbd> New Bill
        <kbd className="bg-gray-800 px-1 rounded">F5</kbd> Save
        <kbd className="bg-gray-800 px-1 rounded">F6</kbd> Visit
        <kbd className="bg-gray-800 px-1 rounded">F8</kbd> Payment
        <kbd className="bg-gray-800 px-1 rounded">+/-</kbd> Qty
        <kbd className="bg-gray-800 px-1 rounded">Del</kbd> Remove
      </div>
    </header>
  );
}
