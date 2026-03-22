export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold text-white mb-4">
          Bharat<span className="text-orange-500">Growth</span>
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          Speed Billing &amp; WhatsApp Loyalty for Indian SMBs
        </p>

        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { icon: "🛞", title: "Tyre Shops", desc: "Brand + size search, tube inventory" },
            { icon: "🍬", title: "Sweet Stalls", desc: "Weight billing, batch expiry tracking" },
            { icon: "👗", title: "Garment Stores", desc: "Size-color matrix, mixed GST slabs" },
          ].map((v) => (
            <div key={v.title} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-3xl mb-2">{v.icon}</div>
              <h3 className="text-white font-semibold text-sm">{v.title}</h3>
              <p className="text-gray-500 text-xs mt-1">{v.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-left">
          <h2 className="text-white font-semibold mb-3">Phase 1 — Foundation Ready</h2>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Multi-tenant Postgres schema with RLS
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> GST billing engine (Regular + Composition)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> DPDP Act 2026 consent logs + anonymization
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Loyalty points ledger (earn/redeem/expire)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-500">→</span> Speed-billing UI — coming next
            </li>
          </ul>
        </div>

        <p className="text-gray-600 text-xs mt-8">
          Stack: Next.js + Supabase + WhatsApp Business API
        </p>
      </div>
    </main>
  );
}
