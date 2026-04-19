import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { API_BASE } from '@/lib/api-base';
import { Save, Info } from 'lucide-react';

const CONTRACT_KEYS = [
  'contract_cover_intro_ar',
  'contract_cover_intro_en',
  'contract_terms_ar',
  'contract_terms_en',
  'contract_signature_block_ar',
  'contract_signature_block_en',
] as const;
type ContractKey = typeof CONTRACT_KEYS[number];

const PLACEHOLDERS = [
  '{{customerName}}', '{{projectName}}', '{{quotationNumber}}',
  '{{quotationDate}}', '{{deliveryDeadline}}', '{{grandTotal}}',
  '{{subtotalNet}}', '{{taxRate}}', '{{taxAmount}}',
  '{{today}}', '{{companyName}}',
];

export default function AdminSettings() {
  const { t, isRtl } = useLanguage();
  const [fields, setFields] = useState<Record<ContractKey, string>>({
    contract_cover_intro_ar: '',
    contract_cover_intro_en: '',
    contract_terms_ar: '',
    contract_terms_en: '',
    contract_signature_block_ar: '',
    contract_signature_block_en: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/erp/settings/contract-template`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((data: Record<string, string>) => {
        setFields(prev => ({ ...prev, ...data }));
        setLoading(false);
      })
      .catch(() => {
        setError(isRtl ? 'تعذر تحميل الإعدادات' : 'Failed to load settings');
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/erp/settings/contract-template`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError(isRtl ? 'تعذر الحفظ' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const textareaClass = (dir: 'rtl' | 'ltr') =>
    `w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]/40 transition-colors bg-white ${
      dir === 'rtl' ? 'font-[Tajawal]' : 'font-[DM_Sans,sans-serif]'
    }`;

  const labelConfigs: Array<{ key: ContractKey; labelKey: string; rows: number; dir: 'rtl' | 'ltr' }> = [
    { key: 'contract_cover_intro_ar',      labelKey: 'contract_cover_intro_ar_label',     rows: 10, dir: 'rtl' },
    { key: 'contract_cover_intro_en',      labelKey: 'contract_cover_intro_en_label',     rows: 10, dir: 'ltr' },
    { key: 'contract_terms_ar',            labelKey: 'contract_terms_ar_label',           rows: 12, dir: 'rtl' },
    { key: 'contract_terms_en',            labelKey: 'contract_terms_en_label',           rows: 12, dir: 'ltr' },
    { key: 'contract_signature_block_ar',  labelKey: 'contract_signature_block_ar_label', rows: 6,  dir: 'rtl' },
    { key: 'contract_signature_block_en',  labelKey: 'contract_signature_block_en_label', rows: 6,  dir: 'ltr' },
  ];

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
        <h1 className={`text-xl font-bold text-[#1B2A4A] mb-6 ${isRtl ? 'font-[Tajawal]' : ''}`}>
          {t('contract_settings_title')}
        </h1>

        {/* Placeholder reference card */}
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <div className={`flex items-center gap-2 mb-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span className={`text-sm font-semibold text-amber-800 ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('contract_settings_placeholders')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2" dir="ltr">
            {PLACEHOLDERS.map(ph => (
              <code
                key={ph}
                className="text-xs bg-white border border-amber-200 rounded px-2 py-0.5 text-amber-700 font-mono cursor-pointer select-all hover:bg-amber-100 transition-colors"
                title="Click to select"
              >
                {ph}
              </code>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            {isRtl ? 'جاري التحميل...' : 'Loading...'}
          </div>
        ) : (
          <div className="space-y-5">
            {labelConfigs.map(({ key, labelKey, rows, dir }) => (
              <div key={key}>
                <label
                  className={`block text-sm font-medium text-slate-700 mb-1.5 ${dir === 'rtl' ? 'font-[Tajawal]' : ''}`}
                  dir={dir}
                >
                  {t(labelKey as any)}
                </label>
                <textarea
                  dir={dir}
                  rows={rows}
                  className={textareaClass(dir)}
                  value={fields[key]}
                  onChange={e => setFields(prev => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}

            {error && (
              <p className={`text-sm text-red-600 ${isRtl ? 'font-[Tajawal]' : ''}`}>{error}</p>
            )}

            <div className={`flex items-center gap-3 pt-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex items-center gap-2 px-5 py-2.5 bg-[#1B2A4A] text-white text-sm font-semibold rounded-xl hover:bg-[#243860] disabled:opacity-50 transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
              >
                <Save className="w-4 h-4" />
                {saving ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : t('contract_settings_save')}
              </button>
              {saved && (
                <span className={`text-sm text-green-600 font-medium ${isRtl ? 'font-[Tajawal]' : ''}`}>
                  {t('contract_settings_saved')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
