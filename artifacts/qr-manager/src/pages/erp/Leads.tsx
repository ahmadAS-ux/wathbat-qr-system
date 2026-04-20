import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Plus, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { API_BASE } from '@/lib/api-base';

interface Lead {
  id: number;
  customerName: string;
  phone: string;
  source: string;
  productInterest: string;
  buildingType: string;
  location: string | null;
  assignedTo: number | null;
  budgetRange: string | null;
  estimatedValue: number | null;
  firstFollowupDate: string;
  status: string;
  lostReason: string | null;
  convertedProjectId: number | null;
  createdAt: string;
  createdBy: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  followup: 'bg-amber-100 text-amber-700',
  converted: 'bg-teal-100 text-teal-700',
  lost: 'bg-red-100 text-red-700',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  new: <CheckCircle2 className="w-3.5 h-3.5" />,
  followup: <Clock className="w-3.5 h-3.5" />,
  converted: <CheckCircle2 className="w-3.5 h-3.5" />,
  lost: <XCircle className="w-3.5 h-3.5" />,
};

interface SearchLead {
  id: number;
  customerName: string;
  phone: string;
  status: string;
  buildingType: string | null;
  convertedProjectId: number | null;
}

const SEARCH_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  followup: 'bg-amber-100 text-amber-700',
  converted: 'bg-teal-100 text-teal-700',
  lost: 'bg-red-100 text-red-700',
};

// Modal for creating a new lead
function CreateLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const [form, setForm] = useState({
    customerName: '', phone: '', source: '', productInterest: '',
    buildingType: '', location: '', firstFollowupDate: '', estimatedValue: '',
  });
  const [sources, setSources] = useState<{ value: string; labelAr: string; labelEn: string }[]>([]);
  const [products, setProducts] = useState<{ value: string; labelAr: string; labelEn: string }[]>([]);
  const [buildings, setBuildings] = useState<{ value: string; labelAr: string; labelEn: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [optionsError, setOptionsError] = useState(false);
  const [nameResults, setNameResults] = useState<SearchLead[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [phoneDuplicate, setPhoneDuplicate] = useState<string | null>(null);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const statusLabel: Record<string, string> = {
    new: t('erp_lead_status_new'),
    followup: t('erp_lead_status_followup'),
    converted: t('erp_lead_status_converted'),
    lost: t('erp_lead_status_lost'),
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/erp/options/lead_source`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(`${API_BASE}/api/erp/options/product_interest`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(`${API_BASE}/api/erp/options/building_type`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    ]).then(([s, p, b]) => {
      setSources(Array.isArray(s) ? s : []);
      setProducts(Array.isArray(p) ? p : []);
      setBuildings(Array.isArray(b) ? b : []);
    }).catch(() => { setOptionsError(true); });
  }, []);

  const label = (item: { labelAr: string; labelEn: string }) =>
    (isRtl ? item.labelAr : item.labelEn) || item.labelAr || item.labelEn;

  const handleNameChange = (value: string) => {
    setForm(f => ({ ...f, customerName: value }));
    if (nameTimer.current) clearTimeout(nameTimer.current);
    if (value.length >= 3) {
      nameTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/erp/leads/search?q=${encodeURIComponent(value)}`);
          if (res.ok) {
            const data = await res.json();
            setNameResults(data);
            setShowNameSuggestions(data.length > 0);
          }
        } catch {}
      }, 300);
    } else {
      setNameResults([]);
      setShowNameSuggestions(false);
    }
  };

  const handlePhoneChange = (raw: string) => {
    const value = raw.replace(/\D/g, '');
    setForm(f => ({ ...f, phone: value }));
    setPhoneDuplicate(null);
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    if (value.length === 10) {
      phoneTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/erp/leads/search?q=${encodeURIComponent(value)}`);
          if (res.ok) {
            const data: SearchLead[] = await res.json();
            const exact = data.find(d => d.phone === value);
            if (exact) setPhoneDuplicate(exact.customerName);
          }
        } catch {}
      }, 300);
    }
  };

  const doSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined }),
      });
      if (!res.ok) throw new Error('Failed');
      onCreated();
    } catch {
      setError(t('erp_required_fields'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.phone || !form.source || !form.productInterest || !form.buildingType || !form.firstFollowupDate) {
      setError(t('erp_required_fields'));
      return;
    }
    if (!/^05\d{8}$/.test(form.phone)) {
      setError(t('erp_phone_error'));
      return;
    }
    if (nameResults.length > 0) {
      setShowDuplicateConfirm(true);
      return;
    }
    await doSubmit();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-[#1B2A4A] text-lg">{t('erp_lead_new')}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {optionsError && <p className="text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{t('erp_options_load_error')}</p>}
            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_customer')} *</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                value={form.customerName}
                onChange={e => handleNameChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                autoComplete="off"
              />
              {showNameSuggestions && nameResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-3 pt-2 pb-1">{t('erp_similar_customers')}</p>
                  {nameResults.map(lead => (
                    <button
                      key={lead.id}
                      type="button"
                      onMouseDown={() => {
                        setForm(f => ({ ...f, customerName: lead.customerName, phone: lead.phone ?? f.phone }));
                        setShowNameSuggestions(false);
                        setNameResults([]);
                      }}
                      className="w-full text-start px-3 py-2.5 hover:bg-slate-50 transition-colors border-t border-slate-50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#1B2A4A]">{lead.customerName}</p>
                        <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{lead.phone}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${SEARCH_STATUS_COLORS[lead.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusLabel[lead.status] ?? lead.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_phone')} *</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="05XXXXXXXX"
                className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 ${phoneDuplicate ? 'border-amber-400' : 'border-slate-200'}`}
                dir="ltr"
                value={form.phone}
                onChange={e => handlePhoneChange(e.target.value)}
              />
              {phoneDuplicate && (
                <p className="text-amber-700 text-xs mt-1">
                  {t('erp_phone_duplicate')} <span className="font-semibold">{phoneDuplicate}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_source')} *</label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 bg-white"
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                >
                  <option value="">—</option>
                  {sources.map(s => <option key={s.value} value={s.value}>{label(s)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_building')} *</label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 bg-white"
                  value={form.buildingType}
                  onChange={e => setForm(f => ({ ...f, buildingType: e.target.value }))}
                >
                  <option value="">—</option>
                  {buildings.map(b => <option key={b.value} value={b.value}>{label(b)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_product')} *</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 bg-white"
                value={form.productInterest}
                onChange={e => setForm(f => ({ ...f, productInterest: e.target.value }))}
              >
                <option value="">—</option>
                {products.map(p => <option key={p.value} value={p.value}>{label(p)}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_location')}</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_followup')} *</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                  dir="ltr"
                  value={form.firstFollowupDate}
                  onChange={e => setForm(f => ({ ...f, firstFollowupDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_value')}</label>
                <input
                  type="number"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                  dir="ltr"
                  value={form.estimatedValue}
                  onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                {t('erp_cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#1B2A4A] text-white hover:bg-[#1B2A4A]/90 disabled:opacity-50 transition-colors"
              >
                {saving ? '...' : t('erp_create')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showDuplicateConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-[#1B2A4A] mb-2">{t('erp_duplicate_confirm_title')}</h3>
            <p className="text-sm text-slate-600 mb-4">{t('erp_duplicate_confirm_msg')}</p>
            <div className="space-y-2 mb-5 max-h-36 overflow-y-auto">
              {nameResults.map(lead => (
                <div key={lead.id} className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-sm font-medium text-[#1B2A4A]">{lead.customerName}</p>
                  <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{lead.phone}</p>
                </div>
              ))}
            </div>
            <div className={`flex gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => { setShowDuplicateConfirm(false); doSubmit(); }}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#1B2A4A] text-white rounded-xl hover:bg-[#243860] disabled:opacity-50 transition-colors"
              >
                {t('erp_duplicate_create_new')}
              </button>
              <button
                onClick={() => setShowDuplicateConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
              >
                {t('erp_duplicate_select_existing')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ErpLeads() {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<'active' | 'all'>('active');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/leads`);
      if (res.ok) setLeads(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLeads(); }, []);

  const activeLeads = leads.filter(l => l.status === 'new' || l.status === 'followup');
  const display = tab === 'active' ? activeLeads : leads;

  const isOverdue = (lead: Lead) =>
    (lead.status === 'new' || lead.status === 'followup') && lead.firstFollowupDate < today;

  const statusLabel: Record<string, string> = {
    new: t('erp_lead_status_new'),
    followup: t('erp_lead_status_followup'),
    converted: t('erp_lead_status_converted'),
    lost: t('erp_lead_status_lost'),
  };

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1B2A4A]">{t('erp_leads_title')}</h1>
            <p className="text-slate-500 text-sm mt-1">
              {activeLeads.length} {t('erp_leads_active')}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1B2A4A]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('erp_lead_new')}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('active')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white text-[#1B2A4A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t('erp_leads_active')}
            {activeLeads.length > 0 && (
              <span className="ms-2 bg-[#1B2A4A] text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold">{activeLeads.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'all' ? 'bg-white text-[#1B2A4A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t('erp_leads_all')}
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">{t('processing')}</div>
        ) : display.length === 0 ? (
          <div className="text-center py-16 text-slate-400">{t('erp_no_leads')}</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-start px-4 py-3 font-semibold text-slate-600">{t('erp_lead_customer')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-600">{t('erp_lead_product')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">{t('erp_lead_building')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">{t('erp_lead_next_followup')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-600">{t('erp_lead_status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {display.map(lead => {
                  const overdue = isOverdue(lead);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/erp/leads/${lead.id}`)}
                      className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1B2A4A]">{lead.customerName}</div>
                        <div className="text-slate-400 text-xs mt-0.5" dir="ltr">{lead.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lead.productInterest}</td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{lead.buildingType}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`text-sm ${overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`} dir="ltr">
                          {lead.firstFollowupDate}
                          {overdue && (
                            <span className="inline-flex items-center gap-1 ms-2 text-red-600">
                              <AlertCircle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${overdue ? 'bg-red-100 text-red-700' : STATUS_COLORS[lead.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_ICONS[lead.status]}
                          {overdue ? t('erp_lead_overdue') : (statusLabel[lead.status] ?? lead.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <ChevronIcon className="w-4 h-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateLeadModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadLeads(); }}
        />
      )}
    </AdminLayout>
  );
}
