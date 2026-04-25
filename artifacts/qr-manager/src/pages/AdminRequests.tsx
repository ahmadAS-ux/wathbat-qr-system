import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Search, Wrench, Download, Trash2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import * as XLSX from 'xlsx';
import { AdminLayout } from '@/components/layout/AdminLayout';

interface RequestRow {
  id: number;
  positionId: string;
  requestType: string;
  customerPhone: string | null;
  projectName: string | null;
  invoiceNumber: string | null;
  message: string | null;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-blue-50 text-blue-700 border-blue-200',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
  Done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const PAGE_SIZE = 20;
import { API_BASE as BASE } from '@/lib/api-base';

export default function AdminRequests() {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [, navigate] = useLocation();
  const [all, setAll] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/admin/requests`)
      .then(r => r.ok ? r.json() : [])
      .then(setAll)
      .finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${BASE}/api/admin/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setAll(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteRequest = async (id: number) => {
    if (!window.confirm(t('confirm_delete_request'))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${BASE}/api/admin/requests/${id}`, { method: 'DELETE' });
      if (res.ok) setAll(prev => prev.filter(r => r.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = all.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = (r.positionId || '').toLowerCase().includes(q) ||
      (r.customerPhone || '').includes(q) ||
      (r.projectName || '').toLowerCase().includes(q) ||
      (r.invoiceNumber || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  const exportExcel = () => {
    const data = all.map(r => ({
      [t('admin_col_id')]: r.id,
      [t('admin_col_position')]: r.positionId,
      [t('admin_col_type')]: r.requestType,
      [t('admin_col_phone')]: r.customerPhone || '',
      [t('admin_col_message')]: r.message || '',
      [t('admin_col_date')]: new Date(r.createdAt).toLocaleDateString(),
      [t('admin_col_status')]: r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Requests');
    XLSX.writeFile(wb, 'Wathbat_Requests.xlsx');
  };

  const filters = [
    { key: 'All', label: t('admin_filter_all') },
    { key: 'New', label: t('admin_filter_new') },
    { key: 'In Progress', label: t('admin_filter_progress') },
    { key: 'Done', label: t('admin_filter_done') },
  ];

  const statusOptions = ['New', 'In Progress', 'Done'];

  const statusCounts = {
    All: all.length,
    New: all.filter(r => r.status === 'New').length,
    'In Progress': all.filter(r => r.status === 'In Progress').length,
    Done: all.filter(r => r.status === 'Done').length,
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#F4F2EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

          {/* Page header */}
          <div className={`flex items-center justify-between gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className="p-2 rounded-xl bg-[#4A6FA5]/10">
                <Wrench className="w-5 h-5 text-[#141A24]" />
              </div>
              <div className={isRtl ? 'text-right' : ''}>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('requests_title')}</h1>
                <p className="text-sm text-slate-500 mt-0.5">Wathbat Aluminum · wathbat.sa</p>
              </div>
            </div>
            <button
              onClick={exportExcel}
              className={`flex items-center gap-2 bg-[#141A24] hover:bg-[#0B1019] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              <Download className="w-4 h-4" />
              {t('admin_export')}
            </button>
          </div>

          {/* Toolbar */}
          <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
            {/* Search */}
            <div className={`relative flex items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
              <Search className={`absolute w-4 h-4 text-slate-400 ${isRtl ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setVisible(PAGE_SIZE); }}
                placeholder={t('search_placeholder')}
                dir={isRtl ? 'rtl' : 'ltr'}
                className={`w-72 border border-[#ECEAE2] rounded-xl py-2.5 text-sm bg-[#FAFAF7] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'}`}
              />
            </div>

            {/* Status filter tabs */}
            <div className={`flex gap-1.5 bg-[#ECEAE2] p-1 rounded-xl ${isRtl ? 'flex-row-reverse' : ''}`}>
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setStatusFilter(f.key); setVisible(PAGE_SIZE); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === f.key
                      ? 'bg-[#FAFAF7] text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    statusFilter === f.key ? 'bg-[#141A24]/10 text-[#1B2A4A]' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {statusCounts[f.key as keyof typeof statusCounts] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="border-b border-[#ECEAE2] bg-[#F4F2EB]">
                    {[
                      t('admin_col_id'),
                      t('admin_col_position'),
                      t('admin_col_phone'),
                      t('admin_history_project'),
                      t('admin_col_message'),
                      t('admin_col_date'),
                      t('admin_col_status'),
                      ...(isAdmin ? [''] : []),
                    ].map((h, i) => (
                      <th key={i} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-start whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-5 py-16 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      </td>
                    </tr>
                  ) : shown.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="px-5 py-16 text-center text-slate-400 text-sm">{t('admin_no_requests')}</td>
                    </tr>
                  ) : (
                    shown.map((row, i) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className="hover:bg-[#F4F2EB] transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-400">#{row.id}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{row.positionId}</td>
                        <td className="px-5 py-3.5 text-slate-600">{row.customerPhone || '—'}</td>
                        <td className="px-5 py-3.5">
                          {row.projectName ? (
                            <button
                              onClick={() => navigate(`/admin?project=${encodeURIComponent(row.projectName!)}`)}
                              className="text-[#141A24] hover:text-[#0B1019] font-medium hover:underline underline-offset-2 transition-colors"
                            >
                              {row.projectName}
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 max-w-[180px]">
                          {row.message ? (
                            <span className="block truncate" title={row.message}>{row.message}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                          {new Date(row.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <select
                            value={row.status}
                            disabled={updatingId === row.id}
                            onChange={e => updateStatus(row.id, e.target.value)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer outline-none transition-all ${STATUS_COLORS[row.status] ?? 'bg-[#ECEAE2] text-slate-600 border-[#ECEAE2]'}`}
                          >
                            {statusOptions.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => deleteRequest(row.id)}
                              disabled={deletingId === row.id}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="flex justify-center p-4 border-t border-[#ECEAE2] bg-[#F4F2EB]">
                <button
                  onClick={() => setVisible(v => v + PAGE_SIZE)}
                  className="px-6 py-2 text-sm font-medium text-slate-600 border border-[#ECEAE2] rounded-full hover:bg-[#FAFAF7] hover:border-slate-300 transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                >
                  {t('show_more')}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}
