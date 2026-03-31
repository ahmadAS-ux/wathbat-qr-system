import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowLeft, ArrowRight, Plus, Trash2, RefreshCw, X, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';

interface UserRow {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const ROLE_COLORS: Record<string, string> = {
  Admin: 'bg-[#1B2A4A]/10 text-[#1B2A4A] border-[#1B2A4A]/20',
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
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">

        {/* Header */}
        <div className={`flex items-center justify-between gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Users className="w-6 h-6 text-[#4A6FA5]" />
            <div className={isRtl ? 'text-right' : ''}>
              <h1 className="text-2xl font-extrabold text-[#1B2A4A] tracking-tight">{t('users_title')}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Wathbat Aluminum · wathbat.sa</p>
            </div>
          </div>
          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={() => { setShowCreate(true); setFormError(''); setForm({ username: '', password: '', role: 'User' }); }}
              className={`flex items-center gap-1.5 text-sm font-semibold bg-[#1B2A4A] hover:bg-[#142240] text-white px-3 py-1.5 rounded-lg transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              <Plus className="w-4 h-4" />
              {t('users_new')}
            </button>
            <Link href="/admin">
              <button className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border text-[#1B2A4A] border-[#1B2A4A]/20 hover:bg-[#1B2A4A]/5 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                {t('back_to_admin')}
              </button>
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
              <thead className="bg-[#F8F9FB] border-b border-border/40">
                <tr>
                  {[t('admin_col_id'), t('login_username'), t('users_role'), t('admin_col_date'), ''].map(h => (
                    <th key={h} className="px-4 py-3 font-semibold text-[#1B2A4A] whitespace-nowrap text-start">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center"><RefreshCw className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{t('users_empty')}</td></tr>
                ) : (
                  users.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`border-b border-border/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FB]/60'} hover:bg-[#4A6FA5]/[0.06]`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{u.id}</td>
                      <td className="px-4 py-3 font-semibold text-[#1B2A4A]">
                        {u.username}
                        {u.id === me?.userId && (
                          <span className="ms-2 text-xs text-muted-foreground font-normal">({t('users_you')})</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteUser(u.id, u.username)}
                          disabled={deletingId === u.id || u.id === me?.userId}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            dir={isRtl ? 'rtl' : 'ltr'}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b border-border/40 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <h3 className="font-bold text-lg text-[#1B2A4A]">{t('users_create_title')}</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-[#1B2A4A] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#1B2A4A] mb-1.5">{t('login_username')} *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1B2A4A] mb-1.5">{t('login_password')} *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1B2A4A] mb-1.5">{t('users_role')} *</label>
                <div className="relative">
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30 pr-8"
                  >
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                  </select>
                  <ChevronDown className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRtl ? 'left-3' : 'right-3'}`} />
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{formError}</p>
              )}

              <div className={`flex items-center justify-end gap-3 pt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-[#1B2A4A] border border-[#1B2A4A]/20 rounded-xl hover:bg-[#1B2A4A]/5 transition-colors">
                  {t('admin_cancel')}
                </button>
                <button
                  onClick={createUser}
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold bg-[#1B2A4A] hover:bg-[#142240] disabled:opacity-50 text-white rounded-xl transition-colors"
                >
                  {submitting ? t('admin_creating') : t('users_create_btn')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
