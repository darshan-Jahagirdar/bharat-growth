'use client';

// =============================================================================
// BharatGrowth — Onboarding Page
// Collects business_name and business_type after first OTP login
// Creates shops + users records via API route
// Magic Pincode Autofill: 6-digit pincode → City + State via India Post API
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { BusinessType } from '@/lib/types/database';

const BUSINESS_TYPES: { value: BusinessType; label: string; icon: string; desc: string }[] = [
  { value: 'tyre_shop', label: 'Tyre Shop', icon: '\u{1F6DE}', desc: 'Brand search, tube inventory, vehicle type' },
  { value: 'sweet_stall', label: 'Sweet Stall', icon: '\u{1F36C}', desc: 'Weight billing, batch expiry, perishables' },
  { value: 'garment_store', label: 'Garment Store', icon: '\u{1F457}', desc: 'Size-color matrix, fabric, mixed GST' },
  { value: 'grocery', label: 'Grocery / Kirana', icon: '\u{1F6D2}', desc: 'Staples, household essentials, daily needs' },
  { value: 'general', label: 'General Store', icon: '\u{1F3EA}', desc: 'Any retail business' },
];

// ── Official GST State Codes (State Name → 2-digit code) ──
// Maps India Post API state names to GST state codes used in CGST/SGST/IGST calculations
const STATE_NAME_TO_GST_CODE: Record<string, string> = {
  'Jammu and Kashmir': '01',
  'Jammu & Kashmir': '01',
  'Himachal Pradesh': '02',
  'Punjab': '03',
  'Chandigarh': '04',
  'Uttarakhand': '05',
  'Uttaranchal': '05',
  'Haryana': '06',
  'Delhi': '07',
  'New Delhi': '07',
  'Rajasthan': '08',
  'Uttar Pradesh': '09',
  'Bihar': '10',
  'Sikkim': '11',
  'Arunachal Pradesh': '12',
  'Nagaland': '13',
  'Manipur': '14',
  'Mizoram': '15',
  'Tripura': '16',
  'Meghalaya': '17',
  'Assam': '18',
  'West Bengal': '19',
  'Jharkhand': '20',
  'Odisha': '21',
  'Orissa': '21',
  'Chhattisgarh': '22',
  'Chattisgarh': '22',
  'Madhya Pradesh': '23',
  'Gujarat': '24',
  'Dadra and Nagar Haveli': '26',
  'Dadra & Nagar Haveli': '26',
  'Dadra and Nagar Haveli and Daman and Diu': '26',
  'Dadra & Nagar Haveli and Daman & Diu': '26',
  'Daman and Diu': '26',
  'Daman & Diu': '26',
  'Maharashtra': '27',
  'Andhra Pradesh': '28',
  'Karnataka': '29',
  'Goa': '30',
  'Lakshadweep': '31',
  'Kerala': '32',
  'Tamil Nadu': '33',
  'Puducherry': '34',
  'Pondicherry': '34',
  'Andaman and Nicobar Islands': '35',
  'Andaman & Nicobar Islands': '35',
  'Andaman and Nicobar': '35',
  'Telangana': '36',
  'Andhra Pradesh (New)': '37',
  'Ladakh': '38',
};

// Note: Andhra Pradesh post-bifurcation uses '37', but India Post API may return
// just "Andhra Pradesh" — we map it to '28' (old unified code) by default.
// The state dropdown remains available for manual correction if needed.

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

// ── India Post API response types ──
interface PostOffice {
  District: string;
  State: string;
  Pincode: string;
}

interface PincodeResponse {
  Status: string;
  PostOffice: PostOffice[] | null;
}

export default function ShopOnboardingForm() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | ''>('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('27'); // Default: Maharashtra
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeStatus, setPincodeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [autoFilled, setAutoFilled] = useState(false);
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
    });
  }, [supabase, router]);

  // ── Magic Pincode Autofill ──
  const lookupPincode = useCallback(async (pin: string) => {
    if (pin.length !== 6) return;

    setPincodeLoading(true);
    setPincodeStatus('idle');

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data: PincodeResponse[] = await res.json();

      if (data[0]?.Status === 'Success' && data[0].PostOffice?.length) {
        const po = data[0].PostOffice[0];
        setCity(po.District);

        // Map state name → GST code
        const gstCode = STATE_NAME_TO_GST_CODE[po.State];
        if (gstCode) {
          setStateCode(gstCode);
        }

        setAutoFilled(true);
        setPincodeStatus('success');
      } else {
        setPincodeStatus('error');
      }
    } catch {
      setPincodeStatus('error');
    }

    setPincodeLoading(false);
  }, []);

  // ── Trigger lookup when pincode reaches 6 digits ──
  useEffect(() => {
    if (pincode.length === 6) {
      lookupPincode(pincode);
    } else {
      setPincodeStatus('idle');
    }
  }, [pincode, lookupPincode]);

  // ── Pincode input handler ──
  const handlePincodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setPincode(digits);
    if (digits.length < 6) {
      setAutoFilled(false);
    }
  };

  const handleSubmit = async () => {
    if (!businessName.trim() || !businessType || !userId) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

          {/* ── Pincode (Magic Autofill) ── */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 ml-1">
              Pincode
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={pincode}
                onChange={(e) => handlePincodeChange(e.target.value)}
                placeholder="e.g. 411001"
                maxLength={6}
                className={`w-full bg-gray-900 border rounded-xl px-4 py-3
                           text-gray-100 placeholder:text-gray-600 outline-none
                           transition-colors font-mono tracking-wider
                           ${pincodeStatus === 'success'
                             ? 'border-emerald-600'
                             : pincodeStatus === 'error'
                               ? 'border-red-600'
                               : 'border-gray-700 focus:border-orange-600'
                           }`}
              />
              {/* Loading / status indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {pincodeLoading && (
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                )}
                {pincodeStatus === 'success' && !pincodeLoading && (
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {pincodeStatus === 'error' && !pincodeLoading && (
                  <span className="text-[10px] text-red-400">Invalid</span>
                )}
              </div>
            </div>
            {pincodeStatus === 'success' && (
              <p className="text-[10px] text-emerald-500/70 mt-1 ml-1">
                City & State auto-filled from Pincode
              </p>
            )}
          </div>

          {/* ── City & State (side by side) ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* City */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 ml-1">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  if (autoFilled) setAutoFilled(false);
                }}
                placeholder="e.g. Pune"
                className={`w-full bg-gray-900 border rounded-xl px-4 py-3
                           text-gray-100 placeholder:text-gray-600 outline-none
                           transition-colors text-sm
                           ${autoFilled
                             ? 'border-emerald-700/50 bg-emerald-950/20'
                             : 'border-gray-700 focus:border-orange-600'
                           }`}
              />
            </div>

            {/* State */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 ml-1">
                State
              </label>
              <select
                value={stateCode}
                onChange={(e) => {
                  setStateCode(e.target.value);
                  if (autoFilled) setAutoFilled(false);
                }}
                className={`w-full bg-gray-900 border rounded-xl px-3 py-3
                           text-gray-100 outline-none transition-colors
                           appearance-none text-sm
                           ${autoFilled
                             ? 'border-emerald-700/50 bg-emerald-950/20'
                             : 'border-gray-700 focus:border-orange-600'
                           }`}
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
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
