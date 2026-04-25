import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Trash2, RefreshCw, X, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { AdminLayout } from '@/components/layout/AdminLayout';

interface UserRow {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

import { API_BASE as BASE } from '@/lib/api-base';

const ROLE_STYLES: Record<string, string> = {
  Admin: 'bg-[#141A24]/8 text-[#1B2A4A] border-[#1B2A4A]/15',
  User:  'bg-[#4A6FA5]/10 text-[#141A24] border-[#4A6FA5]/20',
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
      <div className="min-h-screen bg-[#F4F2EB]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

          {/* Header */}
          <div className={`flex items-center justify-between gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="p-2 rounded-xl bg-[#4A6FA5]/10">
                <Users className="w-5 h-5 text-[#141A24]" />
              </div>
              <div className={isRtl ? 'text-right' : ''}>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('users_title')}</h1>
                <p className="text-sm text-slate-500 mt-0.5">Wathbat Aluminum · wathbat.sa</p>
              </div>
            </div>
            <button
              onClick={() => { setShowCreate(true); setFormError(''); setForm({ username: '', password: '', role: 'User' }); }}
              className={`flex items-center gap-1.5 text-sm font-semibold bg-[#141A24] hover:bg-[#0B1019] text-white px-3.5 py-2 rounded-xl transition-colors shadow-sm ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              <Plus className="w-4 h-4" />
              {t('users_new')}
            </button>
          </div>

          {/* Table */}
          <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="border-b border-[#ECEAE2] bg-[#F4F2EB]">
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
                        className="hover:bg-[#F4F2EB] transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-400">#{u.id}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-800">
                          <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <div className="w-7 h-7 rounded-full bg-[#141A24]/8 flex items-center justify-center text-[#1B2A4A] text-xs font-bold shrink-0">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <span>{u.username}</span>
                            {u.id === me?.userId && (
                              <span className="text-xs text-slate-400 font-normal">({t('users_you')})</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${ROLE_STYLES[u.role] ?? 'bg-[#ECEAE2] text-slate-600 border-[#ECEAE2]'}`}>
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

        </div>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-[#FAFAF7] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-[#ECEAE2]"
            dir={isRtl ? 'rtl' : 'ltr'}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b border-[#ECEAE2] ${isRtl ? 'flex-row-reverse' : ''}`}>
              <h3 className="font-semibold text-slate-900">{t('users_create_title')}</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-[#ECEAE2]">
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
                  placeholder={t('ph_username')}
                  className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('login_password')} *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={t('ph_password')}
                  className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('users_role')} *</label>
                <div className="relative">
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40 pr-8"
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
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-[#ECEAE2] rounded-xl hover:bg-[#F4F2EB] transition-colors">
                  {t('admin_cancel')}
                </button>
                <button
                  onClick={createUser}
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold bg-[#141A24] hover:bg-[#0B1019] disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm"
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
