import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Plus, Loader2, Trash2, Edit2, ArrowRight, ArrowLeft, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { API_BASE } from '@/lib/api-base';

interface Vendor {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  category: string;
  contactPerson: string | null;
  notes: string | null;
  createdAt: string;
}

interface PoSummary {
  id: number;
  project_name: string;
  status: string;
  total_amount: number | null;
  created_at: string;
}

const VENDOR_CATEGORIES = ['Aluminum', 'Glass', 'Accessories', 'Services', 'Other'];

function categoryLabel(cat: string, isRtl: boolean, t: (k: string) => string): string {
  const map: Record<string, string> = {
    Aluminum: t('vendor_cat_aluminum'),
    Glass: t('vendor_cat_glass'),
    Accessories: t('vendor_cat_accessories'),
    Services: t('vendor_cat_services'),
    Other: t('vendor_cat_other'),
  };
  return map[cat] ?? cat;
}

function poStatusColor(status: string): string {
  if (status === 'received') return 'bg-teal-50 text-teal-700 border-teal-200';
  if (status === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'sent') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-[#ECEAE2] text-slate-600 border-[#ECEAE2]';
}

export default function ErpVendors() {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', category: 'Other', contactPerson: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteBlockedId, setDeleteBlockedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [vendorPos, setVendorPos] = useState<Record<number, PoSummary[]>>({});
  const [loadingPos, setLoadingPos] = useState<number | null>(null);

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const canEdit = user?.role === 'Admin' || user?.role === 'FactoryManager' || user?.role === 'Employee';
  const canDelete = user?.role === 'Admin' || user?.role === 'FactoryManager';

  const loadVendors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/vendors`);
      if (res.ok) setVendors(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVendors(); }, []);

  const openAdd = () => {
    setEditVendor(null);
    setForm({ name: '', phone: '', email: '', category: 'Other', contactPerson: '', notes: '' });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (v: Vendor) => {
    setEditVendor(v);
    setForm({ name: v.name, phone: v.phone ?? '', email: v.email ?? '', category: v.category, contactPerson: v.contactPerson ?? '', notes: v.notes ?? '' });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError(t('erp_required_fields')); return; }
    setSaving(true);
    setFormError('');
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        category: form.category,
        contactPerson: form.contactPerson.trim() || null,
        notes: form.notes.trim() || null,
      };
      const res = editVendor
        ? await fetch(`${API_BASE}/api/erp/vendors/${editVendor.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(`${API_BASE}/api/erp/vendors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        setShowForm(false);
        await loadVendors();
      } else {
        setFormError(t('toast_error'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/erp/vendors/${id}`, { method: 'DELETE' });
      if (res.status === 409) {
        setDeleteBlockedId(id);
      } else if (res.ok) {
        setVendors(prev => prev.filter(v => v.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpand = async (vendorId: number) => {
    if (expandedId === vendorId) { setExpandedId(null); return; }
    setExpandedId(vendorId);
    if (!vendorPos[vendorId]) {
      setLoadingPos(vendorId);
      try {
        const res = await fetch(`${API_BASE}/api/erp/vendors/${vendorId}/purchase-orders`);
        if (res.ok) { const data = await res.json(); setVendorPos(prev => ({ ...prev, [vendorId]: data })); }
      } finally {
        setLoadingPos(null);
      }
    }
  };

  const filtered = vendors.filter(v => {
    const q = searchQ.toLowerCase();
    const nameMatch = !q || v.name.toLowerCase().includes(q) || (v.contactPerson ?? '').toLowerCase().includes(q);
    const catMatch = !filterCat || v.category === filterCat;
    return nameMatch && catMatch;
  });

  const poStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: t('po_status_pending'),
      sent: t('po_status_sent'),
      partial: t('po_status_partial'),
      received: t('po_status_received'),
    };
    return map[s] ?? s;
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto px-4 py-6" dir={isRtl ? 'rtl' : 'ltr'}>

        {/* Header */}
        <div className={`flex items-center gap-3 mb-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={() => navigate('/erp/projects')}
            className="p-2 rounded-xl text-slate-500 hover:text-[#1B2A4A] hover:bg-[#ECEAE2] transition-colors"
          >
            <BackIcon className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className={`text-xl font-bold text-[#1B2A4A] ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('vendors')}
            </h1>
          </div>
          {canEdit && (
            <button
              onClick={openAdd}
              className={`flex items-center gap-2 px-4 py-2 bg-[#141A24] text-white text-sm font-semibold rounded-xl hover:bg-[#0B1019] transition-colors ${isRtl ? 'font-[Tajawal] flex-row-reverse' : ''}`}
            >
              <Plus className="w-4 h-4" />
              {t('add_vendor')}
            </button>
          )}
        </div>

        {/* Filters */}
        <div className={`flex gap-2 mb-4 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
          <input
            type="text"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder={t('ph_search')}
            className={`flex-1 min-w-[180px] px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl bg-[#FAFAF7] focus:outline-none focus:border-[#141A24]/40 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}
          />
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className={`px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl bg-[#FAFAF7] focus:outline-none focus:border-[#141A24]/40 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}
          >
            <option value="">{t('admin_filter_all')}</option>
            {VENDOR_CATEGORIES.map(c => (
              <option key={c} value={c}>{categoryLabel(c, isRtl, t)}</option>
            ))}
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className={`text-sm text-slate-400 ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {searchQ || filterCat ? t('search_no_results') : t('vendors_empty')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(v => (
              <div key={v.id} className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
                {/* Vendor Row */}
                <div className={`flex items-center gap-3 p-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-[#141A24]/8 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-[#1B2A4A]/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-[#1B2A4A] text-sm ${isRtl ? 'font-[Tajawal]' : ''}`}>{v.name}</p>
                    <div className={`flex items-center gap-2 mt-0.5 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-[#ECEAE2] text-slate-600 border border-[#ECEAE2] ${isRtl ? 'font-[Tajawal]' : ''}`}>
                        {categoryLabel(v.category, isRtl, t)}
                      </span>
                      {v.contactPerson && <span className={`text-xs text-slate-400 ${isRtl ? 'font-[Tajawal]' : ''}`}>{v.contactPerson}</span>}
                      {v.phone && <span className="text-xs text-slate-400" dir="ltr">{v.phone}</span>}
                    </div>
                    {deleteBlockedId === v.id && (
                      <p className={`text-xs text-red-500 mt-1 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('vendor_delete_blocked')}</p>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 shrink-0 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <button
                      onClick={() => toggleExpand(v.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-[#1B2A4A] hover:bg-[#ECEAE2] transition-colors text-xs flex items-center gap-1"
                    >
                      {t('vendor_pos_title')}
                      {expandedId === v.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => openEdit(v)}
                        className="p-2 rounded-lg text-slate-400 hover:text-[#1B2A4A] hover:bg-[#ECEAE2] transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => { setDeleteBlockedId(null); handleDelete(v.id); }}
                        disabled={deletingId === v.id}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {deletingId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* PO Expansion */}
                {expandedId === v.id && (
                  <div className="border-t border-[#ECEAE2] px-4 py-3 bg-[#F4F2EB]">
                    {loadingPos === v.id ? (
                      <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                    ) : !vendorPos[v.id] || vendorPos[v.id].length === 0 ? (
                      <p className={`text-xs text-slate-400 text-center py-2 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('po_no_pos')}</p>
                    ) : (
                      <div className="space-y-2">
                        {vendorPos[v.id].map(po => (
                          <div key={po.id} className={`flex items-center gap-3 text-xs ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <span className={`font-medium text-[#1B2A4A] truncate flex-1 ${isRtl ? 'font-[Tajawal]' : ''}`}>{po.project_name}</span>
                            {po.total_amount != null && (
                              <span className="text-slate-500 shrink-0" dir="ltr">{po.total_amount.toLocaleString()} {t('erp_payment_sar')}</span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${poStatusColor(po.status)}`}>
                              {poStatusLabel(po.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#FAFAF7] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className={`font-bold text-[#1B2A4A] ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {editVendor ? t('vendor_edit_title') : t('vendor_add_title')}
            </h2>

            <div className="space-y-3">
              <div>
                <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('vendor_name')} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={`w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('vendor_category')}</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className={`w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40 bg-[#FAFAF7] ${isRtl ? 'font-[Tajawal] text-end' : ''}`}
                >
                  {VENDOR_CATEGORIES.map(c => (
                    <option key={c} value={c}>{categoryLabel(c, isRtl, t)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('vendor_phone')}</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('vendor_email')}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('vendor_contact_person')}</label>
                <input
                  type="text"
                  value={form.contactPerson}
                  onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))}
                  className={`w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('vendor_notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className={`w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40 resize-none ${isRtl ? 'font-[Tajawal] text-end' : ''}`}
                />
              </div>
            </div>

            {formError && (
              <p className={`text-xs text-red-500 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{formError}</p>
            )}

            <div className={`flex gap-3 justify-end ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => setShowForm(false)}
                className={`px-4 py-2 text-sm text-slate-600 hover:bg-[#ECEAE2] rounded-xl transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
              >
                {t('erp_cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-4 py-2 text-sm font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] disabled:opacity-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (editVendor ? t('vendor_update') : t('vendor_save'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
