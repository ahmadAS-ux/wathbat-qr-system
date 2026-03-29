import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, QrCode, Calendar, TrendingUp, Download, RefreshCw, Archive, Wrench, ArrowRight, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { Link } from 'wouter';

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
  'In Progress': 'bg-[#4A6FA5]/10 text-[#4A6FA5] border-[#4A6FA5]/20',
  Done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const PREVIEW_COUNT = 3;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function Admin() {
  const { t, isRtl } = useLanguage();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [historyVisible, setHistoryVisible] = useState(PREVIEW_COUNT);
  const [requestsVisible, setRequestsVisible] = useState(PREVIEW_COUNT);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, rRes] = await Promise.all([
        fetch(`${BASE}/api/admin/metrics`),
        fetch(`${BASE}/api/admin/requests`),
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

  const refreshAll = () => {
    setHistoryVisible(PREVIEW_COUNT);
    setRequestsVisible(PREVIEW_COUNT);
    fetchData();
    fetchHistory();
  };

  useEffect(() => { fetchData(); fetchHistory(); }, []);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${BASE}/api/admin/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } finally {
      setUpdatingId(null);
    }
  };

  const statCards = [
    { label: t('admin_total_docs'), value: metrics?.totalDocsProcessed ?? 0, icon: FileText, color: 'text-[#1B2A4A]', bg: 'bg-[#1B2A4A]/5' },
    { label: t('admin_total_qr'), value: metrics?.totalQRsGenerated ?? 0, icon: QrCode, color: 'text-[#4A6FA5]', bg: 'bg-[#4A6FA5]/10' },
    { label: t('admin_requests_month'), value: metrics?.requestsThisMonth ?? 0, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: t('admin_success_rate'), value: `${metrics?.successRate ?? 100}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const statusOptions = ['New', 'In Progress', 'Done'];
  const shownHistory = history.slice(0, historyVisible);
  const shownRequests = requests.slice(0, requestsVisible);

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Page header */}
        <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className={isRtl ? 'text-right' : ''}>
            <h1 className="text-3xl font-extrabold text-[#1B2A4A] tracking-tight">{t('admin_title')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">Wathbat Aluminum · wathbat.sa</p>
          </div>
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 text-sm font-medium text-[#1B2A4A] hover:text-[#4A6FA5] transition-colors"
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

        {/* ── Document Archive ── */}
        <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
          {/* Section header */}
          <div className={`flex items-center justify-between p-5 border-b border-border/40 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <Archive className="w-5 h-5 text-[#4A6FA5]" />
              <h2 className="font-bold text-lg text-[#1B2A4A]">{t('archive_title')}</h2>
            </div>
            <Link href="/admin/history">
              <button className={`flex items-center gap-1.5 text-sm font-semibold text-[#4A6FA5] hover:text-[#3d5f94] transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                {t('view_all')}
                {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
              <thead className="bg-[#F8F9FB] border-b border-border/40">
                <tr>
                  {[t('admin_history_project'), t('admin_history_filename'), t('admin_history_date'), t('admin_history_positions'), t('download_report'), t('download_original')].map(h => (
                    <th key={h} className="px-4 py-3 font-semibold text-[#1B2A4A] whitespace-nowrap text-start">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><RefreshCw className="w-4 h-4 animate-spin mx-auto" /></td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{t('admin_history_empty')}</td></tr>
                ) : (
                  shownHistory.map((row, i) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className={`border-b border-border/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FB]/60'} hover:bg-[#1B2A4A]/[0.02]`}
                    >
                      <td className="px-4 py-3 font-semibold text-[#1B2A4A]">{row.projectName || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{row.originalFilename}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString()} {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-[#1B2A4A]">{row.positionCount}</td>
                      <td className="px-4 py-3">
                        <a href={`${BASE}/api/qr/download/${row.id}`} download={row.reportFilename}
                          className="inline-flex items-center gap-1.5 bg-[#1B2A4A] hover:bg-[#142240] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          <Download className="w-3.5 h-3.5" />{t('download_report')}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`${BASE}/api/qr/download/${row.id}/original`} download={row.originalFilename}
                          className="inline-flex items-center gap-1.5 bg-[#4A6FA5] hover:bg-[#3d5f94] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          <Download className="w-3.5 h-3.5" />{t('download_original')}
                        </a>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Show More / View All footer */}
          {history.length > historyVisible && (
            <div className={`flex items-center justify-between px-5 py-3 border-t border-border/30 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => setHistoryVisible(v => v + 20)}
                className="text-sm font-semibold text-[#1B2A4A] hover:text-[#4A6FA5] transition-colors"
              >
                {t('show_more')}
              </button>
              <Link href="/admin/history">
                <button className={`flex items-center gap-1 text-sm text-[#4A6FA5] hover:text-[#3d5f94] font-medium transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {t('view_all')} {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* ── Service Requests ── */}
        <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
          <div className={`flex items-center justify-between p-5 border-b border-border/40 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <Wrench className="w-5 h-5 text-[#4A6FA5]" />
              <h2 className="font-bold text-lg text-[#1B2A4A]">{t('requests_title')}</h2>
            </div>
            <Link href="/admin/requests">
              <button className={`flex items-center gap-1.5 text-sm font-semibold text-[#4A6FA5] hover:text-[#3d5f94] transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                {t('view_all')}
                {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
              <thead className="bg-[#F8F9FB] border-b border-border/40">
                <tr>
                  {[t('admin_col_id'), t('admin_col_position'), t('admin_col_type'), t('admin_col_phone'), t('admin_col_invoice'), t('admin_col_date'), t('admin_col_status')].map(h => (
                    <th key={h} className="px-4 py-3 font-semibold text-[#1B2A4A] whitespace-nowrap text-start">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><RefreshCw className="w-4 h-4 animate-spin mx-auto" /></td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{t('admin_no_requests')}</td></tr>
                ) : (
                  shownRequests.map((row, i) => (
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
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(row.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <select
                          value={row.status}
                          disabled={updatingId === row.id}
                          onChange={e => updateStatus(row.id, e.target.value)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer outline-none transition-all ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
                        >
                          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Show More / View All footer */}
          {requests.length > requestsVisible && (
            <div className={`flex items-center justify-between px-5 py-3 border-t border-border/30 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => setRequestsVisible(v => v + 20)}
                className="text-sm font-semibold text-[#1B2A4A] hover:text-[#4A6FA5] transition-colors"
              >
                {t('show_more')}
              </button>
              <Link href="/admin/requests">
                <button className={`flex items-center gap-1 text-sm text-[#4A6FA5] hover:text-[#3d5f94] font-medium transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {t('view_all')} {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
