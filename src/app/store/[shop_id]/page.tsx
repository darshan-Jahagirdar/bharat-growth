// =============================================================================
// BharatGrowth — Public Digital Storefront (Server Shell)
// Route: /store/[shop_id]
// Passes shop_id to a client component that fetches via browser Supabase client
// (Node.js server-side fetch times out on this machine — browser fetch works)
// =============================================================================

import { StorefrontLoader } from './StorefrontLoader';

interface PageProps {
  params: Promise<{ shop_id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { shop_id } = await params;
  return {
    title: 'Store | BharatGrowth',
    description: `Browse products and order on WhatsApp`,
    openGraph: {
      title: 'BharatGrowth Store',
      description: 'Browse products and order on WhatsApp',
    },
    // shop_id passed to client component which will update <title> dynamically
    other: { shop_id },
  };
}

export default async function StorefrontPage({ params }: PageProps) {
  const { shop_id } = await params;

  // UUID validation — reject garbage before rendering
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(shop_id)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-300 mb-2">404</h1>
          <p className="text-gray-500">Store not found.</p>
        </div>
      </div>
    );
  }

  return <StorefrontLoader shopId={shop_id} />;
}
