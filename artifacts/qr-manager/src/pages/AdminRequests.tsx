import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, ArrowLeft, ArrowRight, Search, Wrench, Download } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { Link } from 'wouter';
import * as XLSX from 'xlsx';

interface RequestRow {
  id: number;
  positionId: string;
  requestType: string;
  customerPhone: string | null;
  invoiceNumber: string | null;
  message: string | null;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700 border-blue-200',
  'In Progress': 'bg-[#4A6FA5]/10 text-[#4A6FA5] border-[#4A6FA5]/20',
  Done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const PAGE_SIZE = 20;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function AdminRequests() {
  const { t, isRtl } = useLanguage();
  const [all, setAll] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

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

  const filtered = all.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = (r.positionId || '').toLowerCase().includes(q) ||
      (r.customerPhone || '').includes(q) ||
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
      [t('admin_col_invoice')]: r.invoiceNumber || '',
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

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">

        {/* Page header */}
        <div className={`flex items-center justify-between gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Wrench className="w-6 h-6 text-[#4A6FA5]" />
            <div className={isRtl ? 'text-right' : ''}>
              <h1 className="text-2xl font-extrabold text-[#1B2A4A] tracking-tight">{t('requests_title')}</h1>
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

        {/* Toolbar */}
        <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
          {/* Search */}
          <div className={`relative flex items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Search className={`absolute w-4 h-4 text-muted-foreground ${isRtl ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setVisible(PAGE_SIZE); }}
              placeholder={t('search_placeholder')}
              dir={isRtl ? 'rtl' : 'ltr'}
              className={`w-72 border border-border rounded-xl py-2.5 text-sm bg-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30 ${isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'}`}
            />
          </div>

          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            {/* Status filters */}
            <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setStatusFilter(f.key); setVisible(PAGE_SIZE); }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    statusFilter === f.key
                      ? 'bg-[#1B2A4A] text-white border-[#1B2A4A]'
                      : 'text-[#1B2A4A] border-[#1B2A4A]/20 hover:border-[#1B2A4A]/50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 bg-[#4A6FA5] hover:bg-[#3d5f94] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              {t('admin_export')}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
              <thead className="bg-[#F8F9FB] border-b border-border/40">
                <tr>
                  {[
                    t('admin_col_id'),
                    t('admin_col_position'),
                    t('admin_col_type'),
                    t('admin_col_phone'),
                    t('admin_col_invoice'),
                    t('admin_col_date'),
                    t('admin_col_status'),
                  ].map(h => (
                    <th key={h} className="px-4 py-3 font-semibold text-[#1B2A4A] whitespace-nowrap text-start">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    </td>
                  </tr>
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">{t('admin_no_requests')}</td>
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
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{row.id}</td>
                      <td className="px-4 py-3 font-semibold text-[#1B2A4A]">{row.positionId}</td>
                      <td className="px-4 py-3 text-foreground">{row.requestType}</td>
                      <td className="px-4 py-3 text-foreground">{row.customerPhone || '—'}</td>
                      <td className="px-4 py-3 text-foreground">{row.invoiceNumber || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.status}
                          disabled={updatingId === row.id}
                          onChange={e => updateStatus(row.id, e.target.value)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer outline-none transition-all ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
                        >
                          {statusOptions.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
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
