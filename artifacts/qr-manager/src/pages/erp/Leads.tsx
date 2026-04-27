import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Plus, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { API_BASE } from '@/lib/api-base';
import { CustomerPicker, CustomerOption } from '@/components/erp/CustomerPicker';
import { PhoneInput } from '@/components/erp/PhoneInput';

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
  new: 'bg-[#E1ECF7] text-[#1E508C]',
  followup: 'bg-[#FBF0D6] text-[#9A6B0E]',
  converted: 'bg-[#DCEFEC] text-[#0E6E6A]',
  lost: 'bg-[#F7E2DF] text-[#A0312A]',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  new: <CheckCircle2 className="w-3.5 h-3.5" />,
  followup: <Clock className="w-3.5 h-3.5" />,
  converted: <CheckCircle2 className="w-3.5 h-3.5" />,
  lost: <XCircle className="w-3.5 h-3.5" />,
};

// Modal for creating a new lead
function CreateLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t, isRtl } = useLanguage();
  const [form, setForm] = useState({
    source: '', productInterest: '', buildingType: '',
    location: '', firstFollowupDate: '', estimatedValue: '',
  });
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhoneE164, setNewPhoneE164] = useState('');
  const [sources, setSources] = useState<{ value: string; labelAr: string; labelEn: string }[]>([]);
  const [products, setProducts] = useState<{ value: string; labelAr: string; labelEn: string }[]>([]);
  const [buildings, setBuildings] = useState<{ value: string; labelAr: string; labelEn: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [optionsError, setOptionsError] = useState(false);

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

  const doSubmit = async () => {
    setSaving(true);
    try {
      const customerPayload = selectedCustomer
        ? { customerId: selectedCustomer.id }
        : { customerName: newName, phone: newPhoneE164 };
      const res = await fetch(`${API_BASE}/api/erp/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...customerPayload,
          ...form,
          estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        }),
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
    if (!selectedCustomer && (!newName.trim() || !newPhoneE164)) {
      setError(t('erp_required_fields'));
      return;
    }
    if (!form.source || !form.productInterest || !form.buildingType || !form.firstFollowupDate) {
      setError(t('erp_required_fields'));
      return;
    }
    await doSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-[#FAFAF7] rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[#ECEAE2] flex items-center justify-between">
          <h2 className="font-bold text-[#1B2A4A] text-lg">{t('erp_lead_new')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {optionsError && <p className="text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{t('erp_options_load_error')}</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_customer')} *</label>
            <CustomerPicker value={selectedCustomer} onChange={setSelectedCustomer} onSearchChange={q => { if (!selectedCustomer) setNewName(q); }} />
          </div>

          {!selectedCustomer && (
            <div className="border border-dashed border-[#ECEAE2] rounded-xl p-4 space-y-3 bg-[#F4F2EB]/40">
              <p className="text-xs text-slate-500">{t('erp_new_customer_hint')}</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_customer')} *</label>
                <input
                  className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 bg-[#FAFAF7]"
                  placeholder={t('ph_customer_name')}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_phone')} *</label>
                <PhoneInput value={newPhoneE164} onChange={setNewPhoneE164} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_source')} *</label>
              <select
                className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 bg-[#FAFAF7]"
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
                className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 bg-[#FAFAF7]"
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
              className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 bg-[#FAFAF7]"
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
              className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
              placeholder={t('ph_location')}
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_followup')} *</label>
              <input
                type="date"
                className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
                dir="ltr"
                value={form.firstFollowupDate}
                onChange={e => setForm(f => ({ ...f, firstFollowupDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_value')}</label>
              <input
                type="number"
                className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
                placeholder={t('ph_estimated_value')}
                dir="ltr"
                value={form.estimatedValue}
                onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-[#ECEAE2] transition-colors">
              {t('erp_cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#141A24] text-white hover:bg-[#0B1019] disabled:opacity-50 transition-colors"
            >
              {saving ? '...' : t('erp_create')}
            </button>
          </div>
        </form>
      </div>
    </div>
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
            className="flex items-center gap-2 bg-[#141A24] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0B1019] transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('erp_lead_new')}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-[#ECEAE2] rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('active')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'active' ? 'bg-[#FAFAF7] text-[#1B2A4A] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t('erp_leads_active')}
            {activeLeads.length > 0 && (
              <span className="ms-2 bg-[#141A24] text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold">{activeLeads.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'all' ? 'bg-[#FAFAF7] text-[#1B2A4A] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'}`}
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
          <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#ECEAE2] bg-[#F4F2EB]">
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
                      className="border-b border-slate-50 hover:bg-[#F4F2EB] cursor-pointer transition-colors last:border-0"
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
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${overdue ? 'bg-[#F7E2DF] text-[#A0312A]' : STATUS_COLORS[lead.status] ?? 'bg-[#ECEAE2] text-slate-600'}`}>
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
