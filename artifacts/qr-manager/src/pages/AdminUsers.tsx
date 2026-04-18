import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Trash2, RefreshCw, X, ChevronDown, List, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { AdminLayout } from '@/components/layout/AdminLayout';

interface UserRow {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

interface DropdownOption {
  id: number;
  category: string;
  value: string;
  labelAr: string;
  labelEn: string;
  sortOrder: number | null;
  active: boolean | null;
}

const DROPDOWN_CATEGORIES = [
  { key: 'lead_source',       labelKey: 'dropdown_cat_lead_source'       },
  { key: 'product_interest',  labelKey: 'dropdown_cat_product_interest'  },
  { key: 'building_type',     labelKey: 'dropdown_cat_building_type'     },
  { key: 'budget_range',      labelKey: 'dropdown_cat_budget_range'      },
] as const;

import { API_BASE as BASE } from '@/lib/api-base';

const ROLE_STYLES: Record<string, string> = {
  Admin: 'bg-[#1B2A4A]/8 text-[#1B2A4A] border-[#1B2A4A]/15',
  User:  'bg-[#4A6FA5]/10 text-[#4A6FA5] border-[#4A6FA5]/20',
};

export default function AdminUsers() {
  const { t, isRtl } = useLanguage();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'User' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Dropdown editor state
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [addForms, setAddForms] = useState<Record<string, { labelAr: string; labelEn: string }>>({});
  const [deletingOptId, setDeletingOptId] = useState<number | null>(null);
  const [addingCat, setAddingCat] = useState<string | null>(null);

  const loadOptions = () => {
    fetch(`${BASE}/api/erp/options`)
      .then(r => r.ok ? r.json() : [])
      .then(setOptions)
      .catch(() => {});
  };

  useEffect(() => { loadOptions(); }, []);

  const optionsFor = (cat: string) => options.filter(o => o.category === cat);

  const deleteOption = async (id: number) => {
    if (!window.confirm(t('dropdown_delete_confirm'))) return;
    setDeletingOptId(id);
    try {
      await fetch(`${BASE}/api/erp/options/${id}`, { method: 'DELETE' });
      setOptions(prev => prev.filter(o => o.id !== id));
    } finally {
      setDeletingOptId(null);
    }
  };

  const addOption = async (cat: string) => {
    const f = addForms[cat];
    if (!f?.labelAr?.trim() || !f?.labelEn?.trim()) return;
    setAddingCat(cat);
    try {
      const existing = optionsFor(cat);
      const value = f.labelEn.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const res = await fetch(`${BASE}/api/erp/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: cat,
          value,
          labelAr: f.labelAr.trim(),
          labelEn: f.labelEn.trim(),
          sortOrder: existing.length + 1,
        }),
      });
      if (res.ok) {
        const row = await res.json();
        setOptions(prev => [...prev, row]);
        setAddForms(prev => ({ ...prev, [cat]: { labelAr: '', labelEn: '' } }));
      }
    } finally {
      setAddingCat(null);
    }
  };

  const fetchUsers = () => {
    setLoading(true);
    fetch(`${BASE}/api/admin/users`)
      .then(r => r.ok ? r.json() : [])
      .then(setUsers)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const deleteUser = async (id: number, username: string) => {
    if (!window.confirm(`${t('users_delete_confirm')} "${username}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${BASE}/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(u => u.filter(x => x.id !== id));
      } else {
        const data = await res.json();
        alert(data.message || t('users_delete_error'));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const createUser = async () => {
    setFormError('');
    if (!form.username.trim() || !form.password.trim()) {
      setFormError(t('users_form_required'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || t('users_create_error'));
        return;
      }
      setUsers(u => [...u, data]);
      setShowCreate(false);
      setForm({ username: '', password: '', role: 'User' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#F0F2F5]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

          {/* Header */}
          <div className={`flex items-center justify-between gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="p-2 rounded-xl bg-[#4A6FA5]/10">
                <Users className="w-5 h-5 text-[#4A6FA5]" />
              </div>
              <div className={isRtl ? 'text-right' : ''}>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('users_title')}</h1>
                <p className="text-sm text-slate-500 mt-0.5">Wathbat Aluminum · wathbat.sa</p>
              </div>
            </div>
            <button
              onClick={() => { setShowCreate(true); setFormError(''); setForm({ username: '', password: '', role: 'User' }); }}
              className={`flex items-center gap-1.5 text-sm font-semibold bg-[#1B2A4A] hover:bg-[#142240] text-white px-3.5 py-2 rounded-xl transition-colors shadow-sm ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              <Plus className="w-4 h-4" />
              {t('users_new')}
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    {[t('admin_col_id'), t('login_username'), t('users_role'), t('admin_col_date'), ''].map((h, idx) => (
                      <th key={idx} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-start whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center"><RefreshCw className="w-4 h-4 animate-spin mx-auto text-slate-400" /></td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm">{t('users_empty')}</td></tr>
                  ) : (
                    users.map((u, i) => (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-400">#{u.id}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-800">
                          <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <div className="w-7 h-7 rounded-full bg-[#1B2A4A]/8 flex items-center justify-center text-[#1B2A4A] text-xs font-bold shrink-0">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <span>{u.username}</span>
                            {u.id === me?.userId && (
                              <span className="text-xs text-slate-400 font-normal">({t('users_you')})</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${ROLE_STYLES[u.role] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => deleteUser(u.id, u.username)}
                            disabled={deletingId === u.id || u.id === me?.userId}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={t('users_delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Dropdown Editor ───────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50">
                <List className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-base">{t('dropdown_editor_title')}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{t('dropdown_editor_desc')}</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {DROPDOWN_CATEGORIES.map(({ key, labelKey }) => {
                const catOptions = optionsFor(key);
                const isOpen = expandedCat === key;
                const addForm = addForms[key] ?? { labelAr: '', labelEn: '' };
                return (
                  <div key={key}>
                    <button
                      onClick={() => setExpandedCat(isOpen ? null : key)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-700 text-sm">{t(labelKey)}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{catOptions.length}</span>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-4 space-y-2" dir={isRtl ? 'rtl' : 'ltr'}>
                        {catOptions.length > 0 && (
                          <div className="rounded-xl border border-slate-100 overflow-hidden mb-3">
                            {catOptions.map((opt, idx) => (
                              <div key={opt.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${idx !== 0 ? 'border-t border-slate-50' : ''}`}>
                                <span className="flex-1 font-medium text-slate-700">{opt.labelAr}</span>
                                <span className="text-slate-400 text-xs" dir="ltr">{opt.labelEn}</span>
                                <button
                                  onClick={() => deleteOption(opt.id)}
                                  disabled={deletingOptId === opt.id}
                                  className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20"
                            placeholder={t('dropdown_label_ar')}
                            dir="rtl"
                            value={addForm.labelAr}
                            onChange={e => setAddForms(p => ({ ...p, [key]: { ...addForm, labelAr: e.target.value } }))}
                          />
                          <input
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20"
                            placeholder={t('dropdown_label_en')}
                            dir="ltr"
                            value={addForm.labelEn}
                            onChange={e => setAddForms(p => ({ ...p, [key]: { ...addForm, labelEn: e.target.value } }))}
                          />
                          <button
                            onClick={() => addOption(key)}
                            disabled={addingCat === key || !addForm.labelAr.trim() || !addForm.labelEn.trim()}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1B2A4A] text-white text-sm font-semibold rounded-xl hover:bg-[#142240] disabled:opacity-40 transition-colors shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {addingCat === key ? '...' : t('dropdown_add_btn')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            dir={isRtl ? 'rtl' : 'ltr'}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <h3 className="font-semibold text-slate-900">{t('users_create_title')}</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('login_username')} *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/25 focus:border-[#4A6FA5]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('login_password')} *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/25 focus:border-[#4A6FA5]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('users_role')} *</label>
                <div className="relative">
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/25 focus:border-[#4A6FA5]/50 pr-8"
                  >
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                  </select>
                  <ChevronDown className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none ${isRtl ? 'left-3' : 'right-3'}`} />
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{formError}</p>
              )}

              <div className={`flex items-center justify-end gap-3 pt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  {t('admin_cancel')}
                </button>
                <button
                  onClick={createUser}
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold bg-[#1B2A4A] hover:bg-[#142240] disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm"
                >
                  {submitting ? t('admin_creating') : t('users_create_btn')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AdminLayout>
  );
}
