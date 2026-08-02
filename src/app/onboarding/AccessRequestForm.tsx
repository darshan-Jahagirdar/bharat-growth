'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { BusinessType } from '@/lib/types/database';

const BUSINESS_TYPES: Array<{ value: BusinessType; label: string }> = [
  { value: 'tyre_shop', label: 'Tyre Shop' },
  { value: 'sweet_stall', label: 'Sweet Stall' },
  { value: 'garment_store', label: 'Garment Store' },
  { value: 'grocery', label: 'Grocery / Kirana' },
  { value: 'general', label: 'General Store' },
];

interface AccessRequestFormProps {
  defaultEmail: string;
  userId: string;
}

export default function AccessRequestForm({
  defaultEmail,
  userId,
}: AccessRequestFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('general');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const { error: insertError } = await supabase
      .from('access_requests')
      .insert({
        user_id: userId,
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        business_type: businessType,
        city: city.trim(),
        email: email.trim().toLowerCase(),
      });

    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'Your request has already been received.'
          : 'We could not submit your request. Please try again.'
      );
      setSubmitting(false);
      return;
    }

    router.refresh();
  };

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-12 text-gray-100">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-400">
            Early access
          </p>
          <h1 className="mt-3 text-3xl font-bold text-white">
            Request your BharatGrowth workspace
          </h1>
          <p className="mt-3 text-gray-400">
            Tell us about your shop. Darshan reviews each request personally.
          </p>
        </div>

        <form
          className="space-y-5 rounded-3xl border border-gray-800 bg-gray-900 p-7 shadow-2xl"
          onSubmit={handleSubmit}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-300">
              Full name
            </span>
            <input
              autoComplete="name"
              autoFocus
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none transition-colors focus:border-orange-500"
              onChange={(event) => setFullName(event.target.value)}
              required
              type="text"
              value={fullName}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-300">
              Business name
            </span>
            <input
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none transition-colors focus:border-orange-500"
              onChange={(event) => setBusinessName(event.target.value)}
              required
              type="text"
              value={businessName}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-300">
              Business type
            </span>
            <select
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none transition-colors focus:border-orange-500"
              onChange={(event) =>
                setBusinessType(event.target.value as BusinessType)
              }
              value={businessType}
            >
              {BUSINESS_TYPES.map((businessTypeOption) => (
                <option
                  key={businessTypeOption.value}
                  value={businessTypeOption.value}
                >
                  {businessTypeOption.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-300">
              City
            </span>
            <input
              autoComplete="address-level2"
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none transition-colors focus:border-orange-500"
              onChange={(event) => setCity(event.target.value)}
              required
              type="text"
              value={city}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-300">
              Email
            </span>
            <input
              autoComplete="email"
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 outline-none transition-colors focus:border-orange-500"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            <span className="mt-2 block text-xs leading-5 text-gray-500">
              We&apos;ll use this address only to tell you when your workspace is
              ready.
            </span>
          </label>

          {error && (
            <p className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            className="w-full rounded-xl bg-orange-500 px-4 py-3 font-semibold text-gray-950 transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? 'Submitting…' : 'Request early access'}
          </button>
        </form>
      </div>
    </main>
  );
}
