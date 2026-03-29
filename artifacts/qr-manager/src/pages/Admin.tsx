import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, QrCode, Calendar, TrendingUp, Download, RefreshCw, Archive, Wrench, ArrowRight, ArrowLeft, X, Plus, ChevronDown, Trash2 } from 'lucide-react';
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
  projectName: string | null;
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
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);

  const deleteDoc = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingDocId(id);
    try {
      await fetch(`${BASE}/api/qr/${id}`, { method: 'DELETE' });
      setHistory(h => h.filter(r => r.id !== id));
    } finally {
      setDeletingDocId(null);
    }
  };

  const [showNewReq, setShowNewReq] = useState(false);
  const [projects, setProjects] = useState<string[]>([]);
  const [newReq, setNewReq] = useState({ projectName: '', positionId: '', requestType: '', customerPhone: '', invoiceNumber: '', message: '' });
  const [newReqSubmitting, setNewReqSubmitting] = useState(false);
  const [newReqSuccess, setNewReqSuccess] = useState(false);

  const archiveRef = useRef<HTMLDivElement>(null);

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
      const res = await fetch(`${BASE}/api/admin/history`, { cache: 'no-store' });
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

  useEffect(() => {
    fetchData();
    fetchHistory();
    const params = new URLSearchParams(window.location.search);
    const project = params.get('project');
    if (project) {
      setProjectFilter(project);
    }
  }, []);

  useEffect(() => {
    if (projectFilter && archiveRef.current) {
      setTimeout(() => {
        archiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [projectFilter]);

  const handleProjectClick = (name: string) => {
    setProjectFilter(name);
    setHistoryVisible(PREVIEW_COUNT);
  };

  const openNewReq = async () => {
    setNewReq({ projectName: '', positionId: '', requestType: '', customerPhone: '', invoiceNumber: '', message: '' });
    setNewReqSuccess(false);
    setShowNewReq(true);
    if (projects.length === 0) {
      const res = await fetch(`${BASE}/api/admin/projects`);
      if (res.ok) setProjects(await res.json());
    }
  };

  const submitNewReq = async () => {
    if (!newReq.projectName || !newReq.positionId || !newReq.requestType) return;
    setNewReqSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/admin/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: newReq.projectName,
          positionId: newReq.positionId,
          requestType: newReq.requestType,
          customerPhone: newReq.customerPhone || undefined,
          invoiceNumber: newReq.invoiceNumber || undefined,
          message: newReq.message || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setRequests(prev => [created, ...prev]);
        setNewReqSuccess(true);
        setTimeout(() => setShowNewReq(false), 1200);
      }
    } finally {
      setNewReqSubmitting(false);
    }
  };

  const clearProjectFilter = () => {
    setProjectFilter(null);
    setHistoryVisible(PREVIEW_COUNT);
    window.history.replaceState({}, '', window.location.pathname);
  };

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

  const filteredHistory = projectFilter
    ? history.filter(row => row.projectName === projectFilter)
    : history;

  const shownHistory = filteredHistory.slice(0, historyVisible);
  const shownRequests = requests.slice(0, requestsVisible);

  return (
    <>
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
        <div ref={archiveRef} className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
          {/* Section header */}
          <div className={`flex items-center justify-between p-5 border-b border-border/40 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-2.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <Archive className="w-5 h-5 text-[#4A6FA5]" />
              <h2 className="font-bold text-lg text-[#1B2A4A]">{t('archive_title')}</h2>
              {projectFilter && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#4A6FA5]/10 text-[#4A6FA5] border border-[#4A6FA5]/20 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {projectFilter}
                  <button
                    onClick={clearProjectFilter}
                    className="hover:text-[#1B2A4A] transition-colors"
                    aria-label="Clear filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
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
                  {[t('admin_history_project'), t('admin_history_filename'), t('admin_history_date'), t('admin_history_positions'), t('download_report'), t('download_original'), ''].map(h => (
                    <th key={h} className="px-4 py-3 font-semibold text-[#1B2A4A] whitespace-nowrap text-start">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><RefreshCw className="w-4 h-4 animate-spin mx-auto" /></td></tr>
                ) : filteredHistory.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{projectFilter ? t('admin_history_no_match') : t('admin_history_empty')}</td></tr>
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
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteDoc(row.id, row.originalFilename)}
                          disabled={deletingDocId === row.id}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
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

          {/* Show More / View All footer */}
          {filteredHistory.length > historyVisible && (
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
            <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={openNewReq}
                className={`flex items-center gap-1.5 text-sm font-semibold bg-[#1B2A4A] hover:bg-[#142240] text-white px-3 py-1.5 rounded-lg transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}
              >
                <Plus className="w-4 h-4" />
                {t('admin_new_request')}
              </button>
              <Link href="/admin/requests">
                <button className={`flex items-center gap-1.5 text-sm font-semibold text-[#4A6FA5] hover:text-[#3d5f94] transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {t('view_all')}
                  {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
              <thead className="bg-[#F8F9FB] border-b border-border/40">
                <tr>
                  {[t('admin_col_id'), t('admin_col_position'), t('admin_col_type'), t('admin_col_phone'), t('admin_history_project'), t('admin_col_date'), t('admin_col_status')].map(h => (
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
                      <td className="px-4 py-3">
                        {row.projectName ? (
                          <button
                            onClick={() => handleProjectClick(row.projectName!)}
                            className="text-[#4A6FA5] underline underline-offset-2 hover:text-[#3d5f94] font-medium transition-colors cursor-pointer"
                          >
                            {row.projectName}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
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

    {/* ── New Request Modal ── */}
    {showNewReq && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowNewReq(false)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
          dir={isRtl ? 'rtl' : 'ltr'}
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b border-border/40 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <h3 className="font-bold text-lg text-[#1B2A4A]">{t('admin_create_request_title')}</h3>
            <button onClick={() => setShowNewReq(false)} className="text-muted-foreground hover:text-[#1B2A4A] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {newReqSuccess ? (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="font-semibold text-[#1B2A4A]">{t('admin_request_created')}</p>
            </div>
          ) : (
            <div className="px-6 py-5 space-y-4">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-semibold text-[#1B2A4A] mb-1.5">{t('admin_history_project')} *</label>
                <div className="relative">
                  <select
                    value={newReq.projectName}
                    onChange={e => setNewReq(p => ({ ...p, projectName: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30 pr-8"
                  >
                    <option value="">{t('admin_select_project')}</option>
                    {projects.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <ChevronDown className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRtl ? 'left-3' : 'right-3'}`} />
                </div>
              </div>

              {/* Position ID */}
              <div>
                <label className="block text-sm font-semibold text-[#1B2A4A] mb-1.5">{t('admin_col_position')} *</label>
                <input
                  type="text"
                  value={newReq.positionId}
                  onChange={e => setNewReq(p => ({ ...p, positionId: e.target.value }))}
                  placeholder={t('admin_position_placeholder')}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30"
                />
              </div>

              {/* Request Type */}
              <div>
                <label className="block text-sm font-semibold text-[#1B2A4A] mb-1.5">{t('admin_col_type')} *</label>
                <div className="relative">
                  <select
                    value={newReq.requestType}
                    onChange={e => setNewReq(p => ({ ...p, requestType: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30 pr-8"
                  >
                    <option value="">{t('scan_reason_placeholder')}</option>
                    <option value={t('scan_reason_received')}>{t('scan_reason_received')}</option>
                    <option value={t('scan_reason_defect')}>{t('scan_reason_defect')}</option>
                    <option value={t('scan_reason_maintenance')}>{t('scan_reason_maintenance')}</option>
                    <option value={t('scan_reason_replacement')}>{t('scan_reason_replacement')}</option>
                    <option value={t('scan_reason_inquiry')}>{t('scan_reason_inquiry')}</option>
                  </select>
                  <ChevronDown className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRtl ? 'left-3' : 'right-3'}`} />
                </div>
              </div>

              {/* Phone & Invoice (side by side) */}
              <div className={`grid grid-cols-2 gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div>
                  <label className="block text-sm font-semibold text-[#1B2A4A] mb-1.5">{t('admin_col_phone')}</label>
                  <input
                    type="text"
                    value={newReq.customerPhone}
                    onChange={e => setNewReq(p => ({ ...p, customerPhone: e.target.value }))}
                    placeholder="05XXXXXXXX"
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1B2A4A] mb-1.5">{t('admin_col_invoice')}</label>
                  <input
                    type="text"
                    value={newReq.invoiceNumber}
                    onChange={e => setNewReq(p => ({ ...p, invoiceNumber: e.target.value }))}
                    placeholder="INV-2025-001"
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-[#1B2A4A] mb-1.5">{t('admin_col_message')}</label>
                <textarea
                  value={newReq.message}
                  onChange={e => setNewReq(p => ({ ...p, message: e.target.value }))}
                  rows={2}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30"
                />
              </div>

              {/* Actions */}
              <div className={`flex items-center justify-end gap-3 pt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={() => setShowNewReq(false)}
                  className="px-4 py-2 text-sm font-medium text-[#1B2A4A] border border-[#1B2A4A]/20 rounded-xl hover:bg-[#1B2A4A]/5 transition-colors"
                >
                  {t('admin_cancel')}
                </button>
                <button
                  onClick={submitNewReq}
                  disabled={newReqSubmitting || !newReq.projectName || !newReq.positionId || !newReq.requestType}
                  className="px-5 py-2 text-sm font-semibold bg-[#1B2A4A] hover:bg-[#142240] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                >
                  {newReqSubmitting ? t('admin_creating') : t('admin_submit_btn')}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    )}
    </>
  );
}
