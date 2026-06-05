// =============================================================================
// BharatGrowth — Digital Receipt (Public, Mobile-Optimized)
// Route: /receipt/[id]
// Public page — no auth required. Customer receives link via WhatsApp.
// Server shell renders a client loader (avoids Node.js fetch timeout).
// =============================================================================

import { ReceiptLoader } from './ReceiptLoader';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Your Receipt | BharatGrowth',
    description: 'View your digital receipt',
  };
}

export default async function ReceiptPage({ params }: PageProps) {
  const { id } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Invalid receipt link.</p>
      </div>
    );
  }

  return <ReceiptLoader invoiceId={id} />;
}
