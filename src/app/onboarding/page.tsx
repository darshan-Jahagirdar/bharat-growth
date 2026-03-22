'use client';

// =============================================================================
// BharatGrowth — Onboarding Page
// Collects business_name and business_type after first OTP login
// Creates shops + users records via API route
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { BusinessType } from '@/lib/types/database';

const BUSINESS_TYPES: { value: BusinessType; label: string; icon: string; desc: string }[] = [
  { value: 'tyre_shop', label: 'Tyre Shop', icon: '🛞', desc: 'Brand search, tube inventory, vehicle type' },
  { value: 'sweet_stall', label: 'Sweet Stall', icon: '🍬', desc: 'Weight billing, batch expiry, perishables' },
  { value: 'garment_store', label: 'Garment Store', icon: '👗', desc: 'Size-color matrix, fabric, mixed GST' },
  { value: 'general', label: 'General Store', icon: '🏪', desc: 'Any retail business' },
];

const INDIAN_STATES: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [phone, setPhone] = useState<string>('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | ''>('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('27'); // Default: Maharashtra
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ── Check auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
        return;
      }
      setUserId(session.user.id);
      setPhone(session.user.phone ?? '');
    });
  }, [supabase, router]);

  const handleSubmit = async () => {
    if (!businessName.trim() || !businessType || !userId) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          phone,
          business_name: businessName.trim(),
          business_type: businessType,
          city: city.trim() || null,
          state_code: stateCode,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error ?? 'Failed to create account');
        setSubmitting(false);
        return;
      }

      // Success — go to billing
      router.replace('/billing');
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">
            <span className="text-orange-500">Bharat</span>
            <span className="text-gray-200">Growth</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Let&apos;s set up your business
          </p>
        </div>

        <div className="w-full max-w-sm space-y-5">
          {/* Business Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 ml-1">
              Business Name *
            </label>
            <input
              type="text"
              autoFocus
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Sharma Tyre House"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3
                         text-gray-100 placeholder:text-gray-600 outline-none
                         focus:border-orange-600 transition-colors"
            />
          </div>

          {/* Business Type */}
          <div>
            <label className="block text-xs text-gray-500 mb-2 ml-1">
              Business Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BUSINESS_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  onClick={() => setBusinessType(bt.value)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    businessType === bt.value
                      ? 'border-orange-500 bg-orange-950/40'
                      : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                  }`}
                >
                  <div className="text-lg mb-0.5">{bt.icon}</div>
                  <div className="text-sm font-medium text-gray-200">{bt.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{bt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* City */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 ml-1">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Pune"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3
                         text-gray-100 placeholder:text-gray-600 outline-none
                         focus:border-orange-600 transition-colors"
            />
          </div>

          {/* State */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 ml-1">
              State
            </label>
            <select
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3
                         text-gray-100 outline-none focus:border-orange-600 transition-colors
                         appearance-none"
            >
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-400 text-xs text-center bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!businessName.trim() || !businessType || submitting}
            className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500
                       disabled:bg-gray-800 disabled:text-gray-600
                       text-white font-semibold text-sm transition-colors"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating your shop...
              </span>
            ) : (
              'Start Billing'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
