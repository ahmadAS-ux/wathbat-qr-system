import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, QrCode, Calendar, TrendingUp, Download, RefreshCw, History } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import * as XLSX from 'xlsx';

interface Metrics {
  totalDocsProcessed: number;
  totalQRsGenerated: number;
  requestsThisMonth: number;
  successRate: number;
}

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

interface HistoryRow {
  id: number;
  originalFilename: string;
  reportFilename: string;
  projectName: string | null;
  processingDate: string | null;
  positionCount: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700 border-blue-200',
  'In Progress': 'bg-amber-100 text-amber-700 border-amber-200',
  Done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function Admin() {
  const { t, isRtl } = useLanguage();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [filter, setFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, rRes] = await Promise.all([
        fetch(`${BASE}/api/admin/metrics`),
        fetch(`${BASE}/api/admin/requests?status=${filter}`),
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (rRes.ok) setRequests(await rRes.json());
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/history`);
      if (res.ok) setHistory(await res.json());
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshAll = () => { fetchData(); fetchHistory(); };

  useEffect(() => { fetchData(); }, [filter]);
  useEffect(() => { fetchHistory(); }, []);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${BASE}/api/admin/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const exportExcel = () => {
    const data = requests.map(r => ({
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

  const statCards = [
    { label: t('admin_total_docs'), value: metrics?.totalDocsProcessed ?? 0, icon: FileText, color: 'text-[#1B2A4A]', bg: 'bg-[#1B2A4A]/5' },
    { label: t('admin_total_qr'), value: metrics?.totalQRsGenerated ?? 0, icon: QrCode, color: 'text-[#C89B3C]', bg: 'bg-[#C89B3C]/10' },
    { label: t('admin_requests_month'), value: metrics?.requestsThisMonth ?? 0, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: t('admin_success_rate'), value: `${metrics?.successRate ?? 100}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const filters = [
    { key: 'All', label: t('admin_filter_all') },
    { key: 'New', label: t('admin_filter_new') },
    { key: 'In Progress', label: t('admin_filter_progress') },
    { key: 'Done', label: t('admin_filter_done') },
  ];

  const statusOptions = ['New', 'In Progress', 'Done'];

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Page header */}
        <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className={isRtl ? 'text-right' : ''}>
            <h1 className="text-3xl font-extrabold text-[#1B2A4A] tracking-tight">{t('admin_title')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">Wathbat · wathbat.sa</p>
          </div>
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 text-sm font-medium text-[#1B2A4A] hover:text-[#C89B3C] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || historyLoading) ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`bg-white rounded-2xl border border-border/50 shadow-sm p-5 flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              <div className={`p-3 rounded-xl shrink-0 ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className={isRtl ? 'text-right' : ''}>
                <p className="text-xs font-medium text-muted-foreground leading-tight">{card.label}</p>
                <p className="text-2xl font-bold text-[#1B2A4A] mt-0.5">{card.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Processing History ── */}
        <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
          <div className={`flex items-center gap-3 p-5 border-b border-border/40 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <History className="w-5 h-5 text-[#C89B3C]" />
            <h2 className={`font-bold text-lg text-[#1B2A4A] ${isRtl ? 'text-right' : ''}`}>{t('admin_history_title')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
              <thead className="bg-[#F8F9FB] border-b border-border/40">
                <tr>
                  {[
                    t('admin_history_project'),
                    t('admin_history_filename'),
                    t('admin_history_date'),
                    t('admin_history_positions'),
                    t('admin_history_dl_report'),
                    t('admin_history_dl_original'),
                  ].map(h => (
                    <th key={h} className="px-4 py-3 font-semibold text-[#1B2A4A] whitespace-nowrap text-start">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">{t('admin_history_empty')}</td>
                  </tr>
                ) : (
                  history.map((row, i) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
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
                          {t('admin_history_dl_report')}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`${BASE}/api/qr/download/${row.id}/original`}
                          download={row.originalFilename}
                          className="inline-flex items-center gap-1.5 bg-[#C89B3C] hover:bg-[#b8871a] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {t('admin_history_dl_original')}
                        </a>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Customer Requests ── */}
        <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
          <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-b border-border/40 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
            <h2 className={`font-bold text-lg text-[#1B2A4A] ${isRtl ? 'text-right' : ''}`}>{t('admin_requests_table')}</h2>
            <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                {filters.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      filter === f.key
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
                className="flex items-center gap-2 bg-[#C89B3C] hover:bg-[#b8871a] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                {t('admin_export')}
              </button>
            </div>
          </div>

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
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{t('admin_no_requests')}</td>
                  </tr>
                ) : (
                  requests.map((row, i) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
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
        </div>

      </div>
    </div>
  );
}
