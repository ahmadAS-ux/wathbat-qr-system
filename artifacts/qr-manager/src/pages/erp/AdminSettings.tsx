import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { API_BASE } from '@/lib/api-base';
import { Save, Info, Upload } from 'lucide-react';

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

  // Company Information state — v4.3.0
  const [companyInfo, setCompanyInfo] = useState({ name: '', address: '', cr: '', vat: '', phone: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoMeta, setLogoMeta] = useState<{ filename: string; mime_type: string; uploaded_at: string } | null>(null);
  const [companyInfoLoading, setCompanyInfoLoading] = useState(true);
  const [companyInfoSaving, setCompanyInfoSaving] = useState(false);
  const [companyInfoSaved, setCompanyInfoSaved] = useState(false);
  const [companyInfoError, setCompanyInfoError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/erp/settings/contract-template`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((data: Record<string, string>) => {
        setFields(prev => ({ ...prev, ...data }));
        setLoading(false);
      })
      .catch(() => {
        setError(t('settings_load_error'));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/erp/settings/company-info`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((data: { name: string; address: string; cr: string; vat: string; phone: string; logo: { filename: string; mime_type: string; uploaded_at: string } | null }) => {
        setCompanyInfo({ name: data.name, address: data.address, cr: data.cr, vat: data.vat, phone: data.phone });
        setLogoMeta(data.logo);
        setCompanyInfoLoading(false);
      })
      .catch(() => {
        setCompanyInfoLoading(false);
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
      setError(t('settings_save_error'));
    } finally {
      setSaving(false);
    }
  };

  const saveCompanyInfo = async () => {
    setCompanyInfoSaving(true);
    setCompanyInfoError('');
    setCompanyInfoSaved(false);
    try {
      const putRes = await fetch(`${API_BASE}/api/erp/settings/company-info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyInfo),
      });
      if (!putRes.ok) {
        const body = await putRes.json().catch(() => ({}));
        throw new Error(body?.errors ? Object.values(body.errors).join(', ') : t('company_info_save_error'));
      }
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        const postRes = await fetch(`${API_BASE}/api/erp/settings/company-logo`, {
          method: 'POST',
          body: formData,
        });
        if (!postRes.ok) throw new Error(t('company_info_save_error'));
        const newMeta = await postRes.json();
        setLogoMeta(newMeta);
        setLogoFile(null);
      }
      setCompanyInfoSaved(true);
      setTimeout(() => setCompanyInfoSaved(false), 3000);
    } catch (err: unknown) {
      setCompanyInfoError(err instanceof Error ? err.message : t('company_info_save_error'));
    } finally {
      setCompanyInfoSaving(false);
    }
  };

  const canSaveCompanyInfo =
    companyInfo.name.trim() !== '' &&
    companyInfo.address.trim() !== '' &&
    companyInfo.cr.trim() !== '' &&
    companyInfo.vat.trim() !== '' &&
    companyInfo.phone.trim() !== '' &&
    (logoMeta !== null || logoFile !== null);

  const inputClass = `w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40 transition-colors bg-[#FAFAF7]`;

  const textareaClass = (dir: 'rtl' | 'ltr') =>
    `w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40 transition-colors bg-[#FAFAF7] ${dir === 'rtl' ? 'font-[Tajawal]' : 'font-[DM_Sans,sans-serif]'
    }`;

  const labelConfigs: Array<{ key: ContractKey; labelKey: string; rows: number; dir: 'rtl' | 'ltr' }> = [
    { key: 'contract_cover_intro_ar', labelKey: 'contract_cover_intro_ar_label', rows: 10, dir: 'rtl' },
    { key: 'contract_cover_intro_en', labelKey: 'contract_cover_intro_en_label', rows: 10, dir: 'ltr' },
    { key: 'contract_terms_ar', labelKey: 'contract_terms_ar_label', rows: 12, dir: 'rtl' },
    { key: 'contract_terms_en', labelKey: 'contract_terms_en_label', rows: 12, dir: 'ltr' },
    { key: 'contract_signature_block_ar', labelKey: 'contract_signature_block_ar_label', rows: 6, dir: 'rtl' },
    { key: 'contract_signature_block_en', labelKey: 'contract_signature_block_en_label', rows: 6, dir: 'ltr' },
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
                className="text-xs bg-[#FAFAF7] border border-amber-200 rounded px-2 py-0.5 text-amber-700 font-mono cursor-pointer select-all hover:bg-amber-100 transition-colors"
                title="Click to select"
              >
                {ph}
              </code>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            {t('loading_text')}
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
                className={`flex items-center gap-2 px-5 py-2.5 bg-[#141A24] text-white text-sm font-semibold rounded-xl hover:bg-[#0B1019] disabled:opacity-50 transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
              >
                <Save className="w-4 h-4" />
                {saving ? t('saving_text') : t('contract_settings_save')}
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
      {/* ── Company Information — v4.3.0 ─────────────────────────────── */}
      <div className="p-6 max-w-3xl mx-auto mt-2 border-t border-[#ECEAE2]" dir={isRtl ? 'rtl' : 'ltr'}>
        <h2 className={`text-xl font-bold text-[#1B2A4A] mb-6 ${isRtl ? 'font-[Tajawal]' : ''}`}>
          {t('company_info_title')}
        </h2>

        {companyInfoLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm">{t('loading_text')}</div>
        ) : (
          <div className="space-y-5">
            {/* Logo */}
            <div>
              <label className={`block text-sm font-medium text-slate-700 mb-1.5 ${isRtl ? 'font-[Tajawal]' : ''}`}>
                {t('company_logo_label')}
              </label>
              {logoMeta && (
                <div className="mb-3">
                  <p className={`text-xs text-slate-500 mb-1.5 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('company_logo_current_label')}</p>
                  <img
                    src={`${API_BASE}/api/erp/settings/company-logo`}
                    alt="Company logo"
                    className="max-h-20 border border-[#ECEAE2] rounded-xl p-1 bg-white"
                  />
                </div>
              )}
              <label className={`inline-flex items-center gap-2 cursor-pointer px-4 py-2 border border-[#ECEAE2] rounded-xl text-sm bg-[#FAFAF7] hover:bg-slate-50 transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}>
                <Upload className="w-4 h-4 text-slate-500" />
                {t('company_logo_upload_label')}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) { setCompanyInfoError(t('company_logo_size_error')); return; }
                    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) { setCompanyInfoError(t('company_logo_type_error')); return; }
                    setCompanyInfoError('');
                    setLogoFile(file);
                  }}
                />
              </label>
              {logoFile && (
                <p className="text-xs text-slate-500 mt-1.5" dir="ltr">{logoFile.name}</p>
              )}
            </div>

            {/* Company Name */}
            <div>
              <label className={`block text-sm font-medium text-slate-700 mb-1.5 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('company_name_label')}</label>
              <input type="text" className={inputClass} value={companyInfo.name} onChange={e => setCompanyInfo(p => ({ ...p, name: e.target.value }))} />
            </div>

            {/* Address */}
            <div>
              <label className={`block text-sm font-medium text-slate-700 mb-1.5 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('company_address_label')}</label>
              <textarea rows={2} className={textareaClass(isRtl ? 'rtl' : 'ltr')} value={companyInfo.address} onChange={e => setCompanyInfo(p => ({ ...p, address: e.target.value }))} />
            </div>

            {/* CR */}
            <div>
              <label className={`block text-sm font-medium text-slate-700 mb-1.5 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('company_cr_label')}</label>
              <input type="text" className={inputClass} dir="ltr" value={companyInfo.cr} onChange={e => setCompanyInfo(p => ({ ...p, cr: e.target.value }))} />
            </div>

            {/* VAT */}
            <div>
              <label className={`block text-sm font-medium text-slate-700 mb-1.5 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('company_vat_label')}</label>
              <input type="text" className={inputClass} dir="ltr" value={companyInfo.vat} onChange={e => setCompanyInfo(p => ({ ...p, vat: e.target.value }))} />
            </div>

            {/* Phone */}
            <div>
              <label className={`block text-sm font-medium text-slate-700 mb-1.5 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('company_phone_label')}</label>
              <input type="text" className={inputClass} dir="ltr" value={companyInfo.phone} onChange={e => setCompanyInfo(p => ({ ...p, phone: e.target.value }))} />
            </div>

            {companyInfoError && (
              <p className={`text-sm text-red-600 ${isRtl ? 'font-[Tajawal]' : ''}`}>{companyInfoError}</p>
            )}

            <div className={`flex items-center gap-3 pt-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={saveCompanyInfo}
                disabled={!canSaveCompanyInfo || companyInfoSaving}
                className={`flex items-center gap-2 px-5 py-2.5 bg-[#141A24] text-white text-sm font-semibold rounded-xl hover:bg-[#0B1019] disabled:opacity-50 transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
              >
                <Save className="w-4 h-4" />
                {companyInfoSaving ? t('company_info_saving') : t('company_info_save')}
              </button>
              {companyInfoSaved && (
                <span className={`text-sm text-green-600 font-medium ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('company_info_saved')}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
