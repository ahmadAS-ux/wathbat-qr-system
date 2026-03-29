import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw, ArrowLeft, ArrowRight, Search, Archive } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { Link } from 'wouter';

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
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">

        {/* Page header */}
        <div className={`flex items-center justify-between gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Archive className="w-6 h-6 text-[#4A6FA5]" />
            <div className={isRtl ? 'text-right' : ''}>
              <h1 className="text-2xl font-extrabold text-[#1B2A4A] tracking-tight">{t('archive_title')}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Wathbat Aluminum · wathbat.sa</p>
            </div>
          </div>
          <Link href="/admin">
            <button className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border text-[#1B2A4A] border-[#1B2A4A]/20 hover:bg-[#1B2A4A]/5 transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
              {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              {t('back_to_admin')}
            </button>
          </Link>
        </div>

        {/* Search bar */}
        <div className={`relative flex items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
          <Search className={`absolute w-4 h-4 text-muted-foreground ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setVisible(PAGE_SIZE); }}
            placeholder={t('search_placeholder')}
            dir={isRtl ? 'rtl' : 'ltr'}
            className={`w-full max-w-md border border-border rounded-xl py-2.5 text-sm text-foreground bg-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30 ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'}`}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
              <thead className="bg-[#F8F9FB] border-b border-border/40">
                <tr>
                  {[
                    t('admin_history_project'),
                    t('admin_history_filename'),
                    t('admin_history_date'),
                    t('admin_history_positions'),
                    t('download_report'),
                    t('download_original'),
                  ].map(h => (
                    <th key={h} className="px-4 py-3 font-semibold text-[#1B2A4A] whitespace-nowrap text-start">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    </td>
                  </tr>
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">{t('admin_history_empty')}</td>
                  </tr>
                ) : (
                  shown.map((row, i) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.01 }}
                      className={`border-b border-border/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FB]/60'} hover:bg-[#1B2A4A]/[0.02]`}
                    >
                      <td className="px-4 py-3 font-semibold text-[#1B2A4A]">{row.projectName || '—'}</td>
                      <td className="px-4 py-3 text-foreground font-mono text-xs">{row.originalFilename}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString()} {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-[#1B2A4A]">{row.positionCount}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`${BASE}/api/qr/download/${row.id}`}
                          download={row.reportFilename}
                          className="inline-flex items-center gap-1.5 bg-[#1B2A4A] hover:bg-[#142240] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {t('download_report')}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`${BASE}/api/qr/download/${row.id}/original`}
                          download={row.originalFilename}
                          className="inline-flex items-center gap-1.5 bg-[#4A6FA5] hover:bg-[#3d5f94] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {t('download_original')}
                        </a>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Show More */}
          {hasMore && (
            <div className="flex justify-center p-4 border-t border-border/30">
              <button
                onClick={() => setVisible(v => v + PAGE_SIZE)}
                className="px-6 py-2 text-sm font-semibold text-[#1B2A4A] border border-[#1B2A4A]/20 rounded-full hover:bg-[#1B2A4A]/5 transition-colors"
              >
                {t('show_more')}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
