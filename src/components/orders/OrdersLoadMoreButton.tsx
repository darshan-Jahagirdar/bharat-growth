interface OrdersLoadMoreButtonProps {
  visible: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

export function OrdersLoadMoreButton({
  visible,
  loading,
  onLoadMore,
}: OrdersLoadMoreButtonProps) {
  if (!visible) return null;

  return (
    <div className="flex justify-center pt-4">
      <button
        onClick={onLoadMore}
        disabled={loading}
        className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium
                   text-gray-400 border border-white/5 hover:bg-white/5 hover:text-gray-300
                   transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin" />
            Loading...
          </>
        ) : (
          'Load More Orders'
        )}
      </button>
    </div>
  );
}
