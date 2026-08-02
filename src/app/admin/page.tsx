import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  approveAccessRequest,
  dismissAccessRequest,
} from './actions';
import { getPlatformAdminIdentity } from '@/lib/access/platformAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AccessRequest } from '@/lib/types/database';

export const metadata: Metadata = {
  title: 'Access requests | BharatGrowth',
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const identity = await getPlatformAdminIdentity();

  if (!identity.ok) {
    if (identity.reason === 'unauthenticated') {
      redirect('/login?next=/admin');
    }

    if (identity.reason === 'forbidden') {
      notFound();
    }

    throw new Error('Platform admin is not configured');
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('access_requests')
    .select(
      'id, user_id, full_name, business_name, business_type, city, email, status, requested_at, reviewed_at'
    )
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });

  if (error) {
    throw new Error('Unable to load access requests');
  }

  const requests = (data ?? []) as AccessRequest[];

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-12 text-gray-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">
            Platform administration
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            Early-access requests
          </h1>
          <p className="mt-2 text-gray-400">
            {requests.length} pending {requests.length === 1 ? 'request' : 'requests'}
          </p>
        </header>

        {requests.length === 0 ? (
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center text-gray-400">
            No pending requests.
          </section>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <article
                className="rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl"
                key={request.id}
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {request.business_name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-300">
                      {request.full_name} · {request.email}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      {request.business_type.replaceAll('_', ' ')} · {request.city}
                    </p>
                    <p className="mt-2 text-xs text-gray-600">
                      Requested{' '}
                      {new Date(request.requested_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Asia/Kolkata',
                      })}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <form action={dismissAccessRequest}>
                      <input
                        name="requestId"
                        type="hidden"
                        value={request.id}
                      />
                      <button
                        className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
                        type="submit"
                      >
                        Dismiss
                      </button>
                    </form>
                    <form action={approveAccessRequest}>
                      <input
                        name="requestId"
                        type="hidden"
                        value={request.id}
                      />
                      <button
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-orange-400"
                        type="submit"
                      >
                        Approve
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
