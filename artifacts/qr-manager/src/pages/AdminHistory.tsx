import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw, Search, Archive, Trash2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { AdminLayout } from '@/components/layout/AdminLayout';

interface HistoryRow {
  id: number;
  originalFilename: string;
  reportFilename: string;
  projectName: string | null;
  processingDate: string | null;
  positionCount: number;
  createdAt: string;
}

const PAGE_SIZE = 20;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function AdminHistory() {
  const { t, isRtl } = useLanguage();
  const [all, setAll] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);

  const deleteDoc = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingDocId(id);
    try {
      await fetch(`${BASE}/api/qr/${id}`, { method: 'DELETE' });
      setAll(prev => prev.filter(r => r.id !== id));
    } finally {
      setDeletingDocId(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/admin/history`)
      .then(r => r.ok ? r.json() : [])
      .then(setAll)
      .finally(() => setLoading(false));
  }, []);

  const filtered = all.filter(r => {
    const q = search.toLowerCase();
    return (
      (r.projectName || '').toLowerCase().includes(q) ||
      r.originalFilename.toLowerCase().includes(q)
    );
  });

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#F0F2F5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

          {/* Page header */}
          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="p-2 rounded-xl bg-[#4A6FA5]/10">
              <Archive className="w-5 h-5 text-[#4A6FA5]" />
            </div>
            <div className={isRtl ? 'text-right' : ''}>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('archive_title')}</h1>
              <p className="text-sm text-slate-500 mt-0.5">Wathbat Aluminum · wathbat.sa</p>
            </div>
          </div>

          {/* Search bar */}
          <div className={`relative flex items-center max-w-sm ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Search className={`absolute w-4 h-4 text-slate-400 ${isRtl ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setVisible(PAGE_SIZE); }}
              placeholder={t('search_placeholder')}
              dir={isRtl ? 'rtl' : 'ltr'}
              className={`w-full border border-slate-200 rounded-xl py-2.5 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/25 focus:border-[#4A6FA5]/50 shadow-sm ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'}`}
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    {[
                      t('admin_history_project'),
                      t('admin_history_filename'),
                      t('admin_history_date'),
                      t('admin_history_positions'),
                      t('download_report'),
                      t('download_original'),
                      '',
                    ].map((h, idx) => (
                      <th key={idx} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-start whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      </td>
                    </tr>
                  ) : shown.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-slate-400 text-sm">{t('admin_history_empty')}</td>
                    </tr>
                  ) : (
                    shown.map((row, i) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-medium text-slate-800">{row.projectName || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-600 font-mono text-xs max-w-[220px] truncate">{row.originalFilename}</td>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                          {new Date(row.createdAt).toLocaleDateString()} {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">{row.positionCount}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <a
                            href={`${BASE}/api/qr/download/${row.id}`}
                            download={row.reportFilename}
                            className="inline-flex items-center gap-1.5 bg-[#1B2A4A] hover:bg-[#142240] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                          >
                            <Download className="w-3 h-3" />
                            {t('download_report')}
                          </a>
                        </td>
                        <td className="px-5 py-3.5">
                          <a
                            href={`${BASE}/api/qr/download/${row.id}/original`}
                            download={row.originalFilename}
                            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-[#4A6FA5] border border-[#4A6FA5]/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            {t('download_original')}
                          </a>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => deleteDoc(row.id, row.originalFilename)}
                            disabled={deletingDocId === row.id}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                            title="Delete"
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

            {hasMore && (
              <div className="flex justify-center p-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  onClick={() => setVisible(v => v + PAGE_SIZE)}
                  className="px-6 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-full hover:bg-white hover:border-slate-300 transition-colors shadow-sm"
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
