import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Plus } from 'lucide-react';
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
  createdAt: string;
}

const STAGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  new:           { bg: 'bg-slate-100',  text: 'text-slate-600',  border: 'border-slate-200' },
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

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', customerName: '', phone: '', location: '', buildingType: '', productInterest: '', estimatedValue: '' });
  const [products, setProducts] = useState<{ value: string; labelAr: string; labelEn: string }[]>([]);
  const [buildings, setBuildings] = useState<{ value: string; labelAr: string; labelEn: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const label = (item: { labelAr: string; labelEn: string }) => isRtl ? item.labelAr : item.labelEn;

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/erp/options/product_interest`).then(r => r.json()),
      fetch(`${API_BASE}/api/erp/options/building_type`).then(r => r.json()),
    ]).then(([p, b]) => { setProducts(p); setBuildings(b); }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.customerName) { setError(t('erp_required_fields')); return; }
    if (form.phone && !/^05\d{8}$/.test(form.phone)) { setPhoneError(t('erp_phone_error')); return; }
    setPhoneError('');
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined }),
      });
      if (!res.ok) throw new Error();
      onCreated();
    } catch {
      setError(t('erp_required_fields'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-[#1B2A4A] text-lg">{t('erp_project_new')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_project_name')} *</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_project_customer')} *</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_phone')}</label>
              <input type="tel" maxLength={10} className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 ${phoneError ? 'border-red-400' : 'border-slate-200'}`} dir="ltr" value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setPhoneError(''); }} />
              {phoneError && <p className="text-red-600 text-xs mt-1">{phoneError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_value')}</label>
              <input type="number" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30" dir="ltr" value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_product')}</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 bg-white" value={form.productInterest} onChange={e => setForm(f => ({ ...f, productInterest: e.target.value }))}>
                <option value="">—</option>
                {products.map(p => <option key={p.value} value={p.value}>{label(p)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_building')}</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30 bg-white" value={form.buildingType} onChange={e => setForm(f => ({ ...f, buildingType: e.target.value }))}>
                <option value="">—</option>
                {buildings.map(b => <option key={b.value} value={b.value}>{label(b)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('erp_lead_location')}</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors">{t('erp_cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#1B2A4A] text-white hover:bg-[#1B2A4A]/90 disabled:opacity-50 transition-colors">
              {saving ? '...' : t('erp_create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ErpProjects() {
  const { t, isRtl } = useLanguage();
  const [, navigate] = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);

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

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1B2A4A]">{t('erp_projects_title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{projects.length} {t('erp_projects_title').toLowerCase()}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#1B2A4A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1B2A4A]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('erp_project_new')}
          </button>
        </div>

        {/* Stage Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                filter === f
                  ? 'bg-[#1B2A4A] text-white border-[#1B2A4A]'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {stageLabel[f]}
            </button>
          ))}
        </div>

        {/* Project Cards */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">{t('processing')}</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 text-slate-400">{t('erp_no_projects')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => {
              const style = STAGE_STYLES[project.stageDisplay] ?? STAGE_STYLES.new;
              const dot = STAGE_DOT[project.stageDisplay] ?? STAGE_DOT.new;
              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/erp/projects/${project.id}`)}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 cursor-pointer transition-all p-5 flex flex-col gap-3"
                >
                  {/* Stage Badge */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                      {stageLabel[project.stageDisplay] ?? project.stageDisplay}
                    </span>
                    {project.fromLeadId && (
                      <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                        {t('erp_from_lead')}
                      </span>
                    )}
                  </div>

                  {/* Project Name */}
                  <div>
                    <h3 className="font-bold text-[#1B2A4A] text-base leading-tight">{project.name}</h3>
                    <p className="text-slate-500 text-sm mt-0.5">{project.customerName}</p>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-auto pt-2 border-t border-slate-50">
                    {project.productInterest && <span>{project.productInterest}</span>}
                    {project.buildingType && <span>· {project.buildingType}</span>}
                    {project.estimatedValue && (
                      <span className="ms-auto font-medium text-slate-600" dir="ltr">
                        {project.estimatedValue.toLocaleString()} SAR
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
