import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE } from '@/lib/api-base';

interface Project {
  id: number;
  name: string;
  customerName: string;
  phone: string | null;
  location: string | null;
  buildingType: string | null;
  productInterest: string | null;
  estimatedValue: number | null;
  stageDisplay: string;
  stageInternal: number;
  fromLeadId: number | null;
  assignedTo: number | null;
  deliveryDeadline: string | null;
  notes: string | null;
  code: string | null;
  createdAt: string;
}

const STAGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  new:           { bg: 'bg-[#ECEAE2]',  text: 'text-slate-600',  border: 'border-[#ECEAE2]' },
  in_study:      { bg: 'bg-blue-50',    text: 'text-[#185FA5]',  border: 'border-blue-200'  },
  in_production: { bg: 'bg-amber-50',   text: 'text-[#B8860B]',  border: 'border-amber-200' },
  complete:      { bg: 'bg-teal-50',    text: 'text-[#0F6E56]',  border: 'border-teal-200'  },
};

const STAGE_DOT: Record<string, string> = {
  new:           'bg-slate-400',
  in_study:      'bg-[#185FA5]',
  in_production: 'bg-[#B8860B]',
  complete:      'bg-[#0F6E56]',
};

interface SearchLead {
  id: number;
  customerName: string;
  phone: string;
  status: string;
  buildingType: string | null;
  convertedProjectId: number | null;
}

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: 'bg-[#E1ECF7] text-[#1E508C]',
  followup: 'bg-[#FBF0D6] text-[#9A6B0E]',
  converted: 'bg-[#DCEFEC] text-[#0E6E6A]',
  lost: 'bg-[#F7E2DF] text-[#A0312A]',
};

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', customerName: '', phone: '', location: '', buildingType: '', productInterest: '', estimatedValue: '' });
  const [products, setProducts] = useState<{ value: string; labelAr: string; labelEn: string }[]>([]);
  const [buildings, setBuildings] = useState<{ value: string; labelAr: string; labelEn: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [searchResults, setSearchResults] = useState<SearchLead[]>([]);
  const [fromLeadId, setFromLeadId] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = (item: { labelAr: string; labelEn: string }) => isRtl ? item.labelAr : item.labelEn;

  const statusLabel: Record<string, string> = {
    new: t('erp_lead_status_new'),
    followup: t('erp_lead_status_followup'),
    converted: t('erp_lead_status_converted'),
    lost: t('erp_lead_status_lost'),
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/erp/options/product_interest`).then(r => r.json()),
      fetch(`${API_BASE}/api/erp/options/building_type`).then(r => r.json()),
    ]).then(([p, b]) => { setProducts(p); setBuildings(b); }).catch(() => {});
  }, []);

  const handleCustomerNameChange = (value: string) => {
    setForm(f => ({ ...f, customerName: value }));
    setFromLeadId(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.length >= 3) {
      searchTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/erp/leads/search?q=${encodeURIComponent(value)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data);
            setShowSuggestions(data.length > 0);
          }
        } catch {}
      }, 300);
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  const selectLead = (lead: SearchLead) => {
    setFromLeadId(lead.id);
    setForm(f => ({
      ...f,
      customerName: lead.customerName,
      phone: lead.phone ?? '',
      buildingType: lead.buildingType ?? f.buildingType,
    }));
    setShowSuggestions(false);
    setSearchResults([]);
  };

  const doSubmit = async (overrideFromLeadId?: number | null) => {
    setSaving(true);
    try {
      const leadId = overrideFromLeadId !== undefined ? overrideFromLeadId : fromLeadId;
      const res = await fetch(`${API_BASE}/api/erp/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
          fromLeadId: leadId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error();
      onCreated();
    } catch {
      setError(t('erp_required_fields'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.customerName) { setError(t('erp_required_fields')); return; }
    if (form.phone && !/^05\d{8}$/.test(form.phone)) { setPhoneError(t('erp_phone_error')); return; }
    setPhoneError('');
    if (searchResults.length > 0 && !fromLeadId) {
      setShowDuplicateConfirm(true);
      return;
    }
    await doSubmit();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-[#FAFAF7] rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-[#ECEAE2] flex items-center justify-between">
            <h2 className="font-bold text-[#1B2A4A] text-lg">{t('erp_project_new')}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_project_name')} *</label>
              <input className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20" placeholder={t('ph_project_name')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_project_customer')} *</label>
              <input
                className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
                placeholder={t('ph_customer_name')}
                value={form.customerName}
                onChange={e => handleCustomerNameChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                autoComplete="off"
              />
              {fromLeadId && (
                <p className="text-xs text-teal-600 mt-1">✓ {t('erp_from_lead')} #{fromLeadId}</p>
              )}
              {showSuggestions && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-[#FAFAF7] border border-[#ECEAE2] rounded-xl shadow-lg overflow-hidden">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-3 pt-2 pb-1">{t('erp_similar_customers')}</p>
                  {searchResults.map(lead => (
                    <button
                      key={lead.id}
                      type="button"
                      onMouseDown={() => selectLead(lead)}
                      className="w-full text-start px-3 py-2.5 hover:bg-[#F4F2EB] transition-colors border-t border-slate-50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#1B2A4A]">{lead.customerName}</p>
                        <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{lead.phone}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {lead.convertedProjectId && (
                          <span className="text-[10px] text-slate-400">{t('erp_lead_already_converted')}</span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${LEAD_STATUS_COLORS[lead.status] ?? 'bg-[#ECEAE2] text-slate-600'}`}>
                          {statusLabel[lead.status] ?? lead.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_phone')}</label>
                <input type="tel" maxLength={10} placeholder={t('ph_phone')} className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 ${phoneError ? 'border-red-400' : 'border-[#ECEAE2]'}`} dir="ltr" value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setPhoneError(''); }} />
                {phoneError && <p className="text-red-600 text-xs mt-1">{phoneError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_value')}</label>
                <input type="number" placeholder={t('ph_estimated_value')} className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20" dir="ltr" value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_product')}</label>
                <select className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 bg-[#FAFAF7]" value={form.productInterest} onChange={e => setForm(f => ({ ...f, productInterest: e.target.value }))}>
                  <option value="">—</option>
                  {products.map(p => <option key={p.value} value={p.value}>{label(p)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_building')}</label>
                <select className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 bg-[#FAFAF7]" value={form.buildingType} onChange={e => setForm(f => ({ ...f, buildingType: e.target.value }))}>
                  <option value="">—</option>
                  {buildings.map(b => <option key={b.value} value={b.value}>{label(b)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_location')}</label>
              <input className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20" placeholder={t('ph_location')} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-[#ECEAE2] transition-colors">{t('erp_cancel')}</button>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#141A24] text-white hover:bg-[#0B1019] disabled:opacity-50 transition-colors">
                {saving ? '...' : t('erp_create')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showDuplicateConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#FAFAF7] rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-[#1B2A4A] mb-2">{t('erp_duplicate_confirm_title')}</h3>
            <p className="text-sm text-slate-600 mb-4">{t('erp_duplicate_confirm_msg')}</p>
            <div className="space-y-2 mb-5 max-h-36 overflow-y-auto">
              {searchResults.map(lead => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => { selectLead(lead); setShowDuplicateConfirm(false); }}
                  className="w-full text-start px-3 py-2 rounded-xl border border-[#ECEAE2] hover:bg-[#F4F2EB] transition-colors"
                >
                  <p className="text-sm font-medium text-[#1B2A4A]">{lead.customerName}</p>
                  <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{lead.phone}</p>
                </button>
              ))}
            </div>
            <div className={`flex gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => { setShowDuplicateConfirm(false); doSubmit(null); }}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] disabled:opacity-50 transition-colors"
              >
                {t('erp_duplicate_create_new')}
              </button>
              <button
                onClick={() => setShowDuplicateConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold border border-[#ECEAE2] text-slate-700 rounded-xl hover:bg-[#F4F2EB] transition-colors"
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

export default function ErpProjects() {
  const { t, isRtl } = useLanguage();
  const [, navigate] = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const loadProjects = async () => {
    setLoading(true);
    try {
      const url = filter !== 'all' ? `${API_BASE}/api/erp/projects?stageDisplay=${filter}` : `${API_BASE}/api/erp/projects`;
      const res = await fetch(url);
      if (res.ok) setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, [filter]);

  const stageLabel: Record<string, string> = {
    all:           t('admin_filter_all'),
    new:           t('erp_project_stage_new'),
    in_study:      t('erp_project_stage_study'),
    in_production: t('erp_project_stage_production'),
    complete:      t('erp_project_stage_complete'),
  };

  const filters = ['all', 'new', 'in_study', 'in_production', 'complete'];

  const filteredProjects = search.trim()
    ? projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.customerName.toLowerCase().includes(search.toLowerCase())
      )
    : projects;

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1B2A4A]">{t('erp_projects_title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{filteredProjects.length} {t('erp_projects_title').toLowerCase()}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#141A24] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0B1019] transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('erp_project_new')}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute inset-y-0 start-3 my-auto w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('erp_projects_search')}
            className="w-72 h-9 ps-9 pe-3 rounded-lg border border-[#ECEAE2] ring-1 ring-transparent focus:ring-[#141A24] bg-white text-sm outline-none"
          />
        </div>

        {/* Stage Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                filter === f
                  ? 'bg-[#141A24] text-white border-[#1B2A4A]'
                  : 'bg-[#FAFAF7] text-slate-500 border-[#ECEAE2] hover:border-slate-300'
              }`}
            >
              {stageLabel[f]}
            </button>
          ))}
        </div>

        {/* Projects Table */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">{t('processing')}</div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-16 text-slate-400">{t('erp_no_projects')}</div>
        ) : (
          <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#ECEAE2] bg-white">
                  <th className="text-start px-4 py-3 font-semibold text-[#6B6A60] text-xs uppercase tracking-wide">{t('erp_projects_col_project')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-[#6B6A60] text-xs uppercase tracking-wide">{t('erp_projects_col_client')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-[#6B6A60] text-xs uppercase tracking-wide">{t('erp_projects_col_stage')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-[#6B6A60] text-xs uppercase tracking-wide">{t('erp_projects_col_progress')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-[#6B6A60] text-xs uppercase tracking-wide">{t('erp_projects_col_value')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-[#6B6A60] text-xs uppercase tracking-wide">{t('erp_projects_col_delivery')}</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEAE2]">
                {filteredProjects.map(project => {
                  const style = STAGE_STYLES[project.stageDisplay] ?? STAGE_STYLES.new;
                  const dot   = STAGE_DOT[project.stageDisplay]   ?? STAGE_DOT.new;
                  const pct   = Math.round((project.stageInternal + 1) / 15 * 100);
                  const isOverdue = project.deliveryDeadline
                    && new Date(project.deliveryDeadline) < new Date()
                    && project.stageDisplay !== 'complete';
                  const deliveryStr = project.deliveryDeadline
                    ? (() => { const d = new Date(project.deliveryDeadline!); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })()
                    : '—';
                  return (
                    <tr
                      key={project.id}
                      onClick={() => navigate(`/erp/projects/${project.id}`)}
                      className="cursor-pointer hover:bg-[#F4F2EB] transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-[#1B2A4A]">{project.name}</div>
                        {project.code && (
                          <div className="text-xs text-[#9B9A91] mt-0.5" dir="ltr">{project.code}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[#4A4940]">{project.customerName}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                          {stageLabel[project.stageDisplay] ?? project.stageDisplay}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-[#ECEAE2] overflow-hidden">
                            <div className="h-full rounded-full bg-[#141A24]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-[#6B6A60]" dir="ltr">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[#4A4940]" dir="ltr">
                        {project.estimatedValue ? `${project.estimatedValue.toLocaleString()} SAR` : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span dir="ltr">{deliveryStr}</span>
                          {isOverdue && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                              {t('erp_projects_overdue')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[#9B9A91]">
                        {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadProjects(); }}
        />
      )}
    </AdminLayout>
  );
}
