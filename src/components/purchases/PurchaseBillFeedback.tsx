interface PurchaseBillFeedbackProps {
  saveError: string;
  saveSuccess: string;
  scanError: string;
}

export function PurchaseBillFeedback({
  saveError,
  saveSuccess,
  scanError,
}: PurchaseBillFeedbackProps) {
  return (
    <>
      {scanError && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {scanError}
        </div>
      )}
      {saveError && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          {saveSuccess}
        </div>
      )}
    </>
  );
}
