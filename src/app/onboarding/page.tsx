import { redirect } from 'next/navigation';
import AccessRequestForm from './AccessRequestForm';
import ShopOnboardingForm from './ShopOnboardingForm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AccessRequestStatus } from '@/lib/types/database';

function PendingAccessMessage() {
  return (
    <main className="min-h-screen bg-gray-950 px-6 py-16 text-gray-100">
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center">
        <section className="w-full rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-2xl">
            ✓
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">
            Request received
          </p>
          <h1 className="mt-3 text-2xl font-bold text-white">
            Thanks for your interest
          </h1>
          <p className="mt-4 leading-7 text-gray-400">
            We&apos;re onboarding shops one at a time. We&apos;ll email you when
            your shop is ready.
          </p>
        </section>
      </div>
    </main>
  );
}

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?next=/onboarding');
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('shop_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error('Unable to verify shop access');
  }

  if (profile?.shop_id) {
    redirect('/billing');
  }

  // RLS plus UNIQUE(user_id) scopes this to at most the caller's row. Do not
  // filter on user_id: authenticated receives SELECT on status only.
  const { data: request, error: requestError } = await supabase
    .from('access_requests')
    .select('status')
    .maybeSingle();

  if (requestError) {
    throw new Error('Unable to verify access request status');
  }

  const status = request?.status as AccessRequestStatus | undefined;

  if (!status) {
    return (
      <AccessRequestForm
        defaultEmail={user.email ?? ''}
        userId={user.id}
      />
    );
  }

  if (status === 'pending' || status === 'dismissed') {
    return <PendingAccessMessage />;
  }

  if (status === 'approved') {
    return <ShopOnboardingForm />;
  }

  throw new Error('Unknown access request status');
}
