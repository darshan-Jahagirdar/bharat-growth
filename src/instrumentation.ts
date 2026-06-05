// =============================================================================
// BharatGrowth — Next.js Instrumentation (runs once on server startup)
//
// Fixes Windows Node.js 18+ DNS bug where undici (built-in fetch) resolves
// IPv6 addresses first, causing UND_ERR_CONNECT_TIMEOUT on Supabase calls.
//
// Two-layer fix:
//   1. dns.setDefaultResultOrder('ipv4first') — affects Node dns.resolve()
//   2. Patching global fetch via undici Agent with connect.lookup override —
//      forces the built-in fetch (undici) to also use IPv4-first resolution
// =============================================================================

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Layer 1: Node-level DNS default
    const dns = await import('node:dns');
    dns.setDefaultResultOrder('ipv4first');

    // Layer 2: Patch global fetch's underlying undici dispatcher
    // undici's connect phase uses its own DNS lookup, bypassing dns.setDefaultResultOrder
    const { Agent, setGlobalDispatcher } = await import('undici');
    const agent = new Agent({
      connect: {
        lookup: (hostname, options, callback) => {
          // Force family=4 (IPv4) for all connections
          dns.lookup(hostname, { ...options, family: 4 }, callback);
        },
      },
    });
    setGlobalDispatcher(agent);

    console.log('[Instrumentation] DNS forced to IPv4 (dns + undici agent)');
  }
}
