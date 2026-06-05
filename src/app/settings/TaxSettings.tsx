'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { GstType } from '@/lib/types/database';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/;

interface TaxSettingsProps {
  shopId: string;
}

interface ShopTaxData {
  gstin: string | null;
  gst_type: GstType;
}

export default function TaxSettings({ shopId }: TaxSettingsProps) {
  const [gstin, setGstin] = useState('');
  const [gstType, setGstType] = useState<GstType>('regular');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!shopId) return;
    const supabase = createClient();
    supabase
      .from('shops')
      .select('gstin, gst_type')
      .eq('id', shopId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const shop = data as ShopTaxData;
          setGstin(shop.gstin ?? '');
          setGstType(shop.gst_type);
        }
        setLoading(false);
      });
  }, [shopId]);

  const handleSave = async () => {
    const trimmed = gstin.trim().toUpperCase();

    if (trimmed.length > 0 && !GSTIN_REGEX.test(trimmed)) {
      setMessage({ type: 'error', text: 'Invalid GSTIN format. Expected 15 chars like 27AAPFU0939F1ZV' });
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from('shops')
      .update({
        gstin: trimmed.length === 15 ? trimmed : null,
        gst_type: gstType,
      })
      .eq('id', shopId);

    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: `Save failed: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Tax settings saved.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-6">
        <div className="h-4 w-32 bg-white/10 rounded" />
        <div className="h-10 w-full bg-white/10 rounded" />
        <div className="h-4 w-24 bg-white/10 rounded" />
        <div className="h-10 w-full bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Shop GSTIN</label>
        <input
          type="text"
          maxLength={15}
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          placeholder="e.g. 27AAPFU0939F1ZV"
          className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10
                     text-sm font-mono text-white placeholder:text-gray-600
                     focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30
                     transition-colors"
        />
        <p className="mt-1 text-[11px] text-gray-600">
          15-character GST Identification Number. Leave blank if unregistered.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">GST Type</label>
        <div className="flex gap-3">
          {(['regular', 'composition'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setGstType(type)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all
                ${gstType === type
                  ? 'bg-orange-500/15 border-orange-500/50 text-orange-400'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300'
                }`}
            >
              {type === 'regular' ? 'Regular' : 'Composition'}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-gray-600">
          {gstType === 'composition'
            ? 'Composition dealers charge a flat rate, no input tax credit.'
            : 'Regular dealers charge standard GST rates with input tax credit.'}
        </p>
      </div>

      {message && (
        <div
          className={`px-3 py-2 rounded-lg text-xs font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/15 border border-red-500/30 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold
                   bg-orange-500 hover:bg-orange-600 text-white
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {saving ? 'Saving...' : 'Save Tax Settings'}
      </button>
    </div>
  );
}
