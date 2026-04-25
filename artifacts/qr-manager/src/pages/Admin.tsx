import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, QrCode, Calendar, TrendingUp, Download, RefreshCw,
  Archive, Wrench, ArrowRight, ArrowLeft, X, Plus, ChevronDown,
  Trash2, Users, FolderOpen, CreditCard, AlertCircle, Clock,
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { API_BASE as BASE } from '@/lib/api-base';

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

interface Project {
  id: number;
  name: string;
  customerName: string;
  estimatedValue: number | null;
  stageDisplay: string;
  stageInternal: number;
  createdAt: string;
}

interface Lead {
  id: number;
  customerName: string;
  phone: string;
  status: string;
  firstFollowupDate: string;
  productInterest: string;
  createdAt: string;
}

const STAGE_PILL: Record<string, { bg: string; text: string }> = {
  new:           { bg: 'bg-slate-100',  text: 'text-slate-600' },
  in_study:      { bg: 'bg-blue-50',    text: 'text-[#185FA5]' },
  in_production: { bg: 'bg-amber-50',   text: 'text-[#9A6B0E]' },
  complete:      { bg: 'bg-teal-50',    text: 'text-[#0E6E6A]' },
};

const REQ_STATUS: Record<string, string> = {
  New: 'bg-blue-50 text-[#1E508C] border border-blue-100',
  'In Progress': 'bg-amber-50 text-[#9A6B0E] border border-amber-100',
  Pending: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
  Done: 'bg-[#E4F1E8] text-[#1F7A4D] border border-[#CFE4D6]',
};

const PREVIEW_COUNT = 5;

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`dash-card overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({
  eyebrow, title, action, isRtl,
}: { eyebrow: string; title: string; action?: React.ReactNode; isRtl: boolean }) {
  return (
    <div className={`flex items-center justify-between px-5 py-4 border-b border-[#ECEAE2] ${isRtl ? 'flex-row-reverse' : ''}`}>
      <div className={isRtl ? 'text-end' : ''}>
        <div className="eyebrow">{eyebrow}</div>
        <h3 className="text-[15px] font-bold text-[#0F1020] mt-0.5">{title}</h3>
      </div>
      {action}
    </div>
  );
}

export default function Admin() {
  const { t, isRtl, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isErpUser = user?.role !== 'Accountant';
  const isPaymentsUser = user?.role === 'Admin' || user?.role === 'Accountant';

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [overdueLeads, setOverdueLeads] = useState<Lead[]>([]);
  const [overdueLeadsCount, setOverdueLeadsCount] = useState(0);
  const [overduePaymentsCount, setOverduePaymentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erpLoading, setErpLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [deletingReqId, setDeletingReqId] = useState<number | null>(null);

  const [showNewReq, setShowNewReq] = useState(false);
  const [projects, setProjects] = useState<string[]>([]);
  const [newReq, setNewReq] = useState({ projectName: '', positionId: '', customerPhone: '', invoiceNumber: '', message: '' });
  const [newReqSubmitting, setNewReqSubmitting] = useState(false);
  const [newReqSuccess, setNewReqSuccess] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, rRes, hRes] = await Promise.all([
        fetch(`${BASE}/api/admin/metrics`),
        fetch(`${BASE}/api/admin/requests`),
        fetch(`${BASE}/api/admin/history`, { cache: 'no-store' }),
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (rRes.ok) setRequests(await rRes.json());
      if (hRes.ok) setHistory(await hRes.json());
    } finally {
      setLoading(false);
    }
  };

  const fetchErpData = async () => {
    if (!isErpUser) return;
    setErpLoading(true);
    try {
      const [projRes, leadsRes, overdueLeadsRes, overduePayRes] = await Promise.all([
        fetch(`${BASE}/api/erp/projects`),
        fetch(`${BASE}/api/erp/leads`),
        fetch(`${BASE}/api/erp/leads/overdue-count`),
        isPaymentsUser ? fetch(`${BASE}/api/erp/payments/overdue-count`) : Promise.resolve(null),
      ]);
      if (projRes.ok) {
        const all: Project[] = await projRes.json();
        setRecentProjects(all.slice(0, PREVIEW_COUNT));
      }
      if (leadsRes.ok) {
        const all: Lead[] = await leadsRes.json();
        const overdue = all.filter(l =>
          l.status !== 'converted' && l.status !== 'lost' && l.firstFollowupDate && l.firstFollowupDate <= today
        );
        setOverdueLeads(overdue.slice(0, PREVIEW_COUNT));
      }
      if (overdueLeadsRes.ok) {
        const d = await overdueLeadsRes.json();
        setOverdueLeadsCount(d.count ?? 0);
      }
      if (overduePayRes && overduePayRes.ok) {
        const d = await overduePayRes.json();
        setOverduePaymentsCount(d.count ?? 0);
      }
    } finally {
      setErpLoading(false);
    }
  };

  const refreshAll = () => {
    fetchData();
    fetchErpData();
  };

  useEffect(() => {
    fetchData();
    fetchErpData();
  }, []);

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

  const downloadFile = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(objUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const deleteRequest = async (id: number) => {
    if (!window.confirm(t('confirm_delete_request'))) return;
    setDeletingReqId(id);
    try {
      await fetch(`${BASE}/api/admin/requests/${id}`, { method: 'DELETE' });
      setRequests(r => r.filter(x => x.id !== id));
    } finally {
      setDeletingReqId(null);
    }
  };

  const openNewReq = async () => {
    setNewReq({ projectName: '', positionId: '', customerPhone: '', invoiceNumber: '', message: '' });
    setNewReqSuccess(false);
    setShowNewReq(true);
    if (projects.length === 0) {
      const res = await fetch(`${BASE}/api/admin/projects`);
      if (res.ok) setProjects(await res.json());
    }
  };

  const submitNewReq = async () => {
    if (!newReq.projectName || !newReq.positionId) return;
    setNewReqSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/admin/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: newReq.projectName,
          positionId: newReq.positionId,
          requestType: 'Customer Request',
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

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: 'short' });
  const fmtValue = (v: number | null) => v ? v.toLocaleString() : '—';

  const statusOptions = ['New', 'In Progress', 'Done'];

  const kpiCards = [
    ...(isErpUser ? [{
      label: t('dash_active_projects'),
      value: recentProjects.length > 0 || !erpLoading ? String(recentProjects.length) : '…',
      icon: FolderOpen,
      tone: 'ink',
      loading: erpLoading,
    }] : []),
    ...(isErpUser ? [{
      label: t('dash_overdue_leads'),
      value: erpLoading ? '…' : String(overdueLeadsCount),
      icon: AlertCircle,
      tone: overdueLeadsCount > 0 ? 'danger' : 'ok',
      loading: erpLoading,
    }] : []),
    ...(isPaymentsUser ? [{
      label: t('dash_pending_payments'),
      value: erpLoading ? '…' : String(overduePaymentsCount),
      icon: CreditCard,
      tone: overduePaymentsCount > 0 ? 'danger' : 'ok',
      loading: erpLoading,
    }] : []),
    {
      label: t('dash_docs_processed'),
      value: loading ? '…' : String(metrics?.totalDocsProcessed ?? 0),
      icon: FileText,
      tone: 'ink',
      loading,
    },
  ];

  const TONE_ICON: Record<string, string> = {
    ink: 'text-[#141A24]',
    ok: 'text-[#1F7A4D]',
    danger: 'text-[#A0312A]',
  };
  const TONE_BG: Record<string, string> = {
    ink: 'bg-[#F4F2EB]',
    ok: 'bg-[#E4F1E8]',
    danger: 'bg-[#F7E2DF]',
  };

  return (
    <AdminLayout>
      <div className="min-h-screen" style={{ background: '#F4F2EB' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

          {/* ── Page Header ── */}
          <div className={`flex items-end justify-between gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="eyebrow mb-1">
                {isRtl ? 'لوحة التحكم · 2026' : 'DASHBOARD · 2026'}
              </div>
              <h1 className="text-[22px] font-extrabold text-[#0F1020] leading-tight">{t('admin_title')}</h1>
              <div className={`flex items-center gap-2 mt-1 text-[12.5px] text-[#6B6A60] ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-[#1F7A4D] shrink-0" />
                <span>{t('dash_system_ok')}</span>
                <span className="text-[#ECEAE2]">·</span>
                <span className="num" dir="ltr">wathbat.sa</span>
              </div>
            </div>
            <button
              onClick={refreshAll}
              className="flex items-center gap-2 text-sm font-medium text-[#6B6A60] hover:text-[#0F1020] transition-colors px-3 py-2 rounded-xl hover:bg-[#ECEAE2] border border-[#ECEAE2] shrink-0"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${(loading || erpLoading) ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* ── KPI Cards ── */}
          <div className={`grid gap-4 ${kpiCards.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : kpiCards.length === 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2'}`}>
            {kpiCards.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.28 }}
                className="dash-card p-5"
              >
                <div className={`flex items-start justify-between mb-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className={isRtl ? 'text-end' : ''}>
                    <div className="eyebrow">{card.label}</div>
                  </div>
                  <div className={`p-2 rounded-lg ${TONE_BG[card.tone]} shrink-0`}>
                    <card.icon className={`w-4 h-4 ${TONE_ICON[card.tone]}`} />
                  </div>
                </div>
                <div className="num text-[28px] font-bold text-[#0F1020] leading-none tabular-nums">
                  {card.loading ? <span className="inline-block w-10 h-7 bg-[#ECEAE2] rounded animate-pulse" /> : card.value}
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Main grid ── */}
          <div className={`grid gap-5 ${isErpUser ? 'grid-cols-12' : 'grid-cols-1'}`}>

            {/* Left column */}
            <div className={`space-y-5 ${isErpUser ? 'col-span-12 lg:col-span-8' : 'col-span-1'}`}>

              {/* Recent Projects */}
              {isErpUser && (
                <SectionCard>
                  <SectionHeader
                    eyebrow={isRtl ? 'المشاريع' : 'RECENT PROJECTS'}
                    title={t('dash_recent_projects')}
                    isRtl={isRtl}
                    action={
                      <Link href="/erp/projects">
                        <button className={`flex items-center gap-1 text-[12.5px] font-medium text-[#141A24] hover:underline underline-offset-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          {t('view_all')}
                          {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                        </button>
                      </Link>
                    }
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]" dir={isRtl ? 'rtl' : 'ltr'}>
                      <thead>
                        <tr className="border-b border-[#ECEAE2] bg-[#F4F2EB]">
                          {[t('dash_customer'), t('admin_history_project'), t('dash_stage'), t('dash_value'), ''].map((h, idx) => (
                            <th key={idx} className="px-5 py-2.5 text-[11px] font-semibold text-[#6B6A60] uppercase tracking-wider text-start whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {erpLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i} className="border-b border-[#ECEAE2]">
                              {Array.from({ length: 5 }).map((__, j) => (
                                <td key={j} className="px-5 py-3.5">
                                  <div className="h-3.5 bg-[#ECEAE2] rounded animate-pulse w-24" />
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : recentProjects.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-5 py-10 text-center text-[#6B6A60] text-sm">
                              {t('dash_no_recent_projects')}
                            </td>
                          </tr>
                        ) : (
                          recentProjects.map((p, i) => {
                            const stagePill = STAGE_PILL[p.stageDisplay] ?? STAGE_PILL.new;
                            return (
                              <motion.tr
                                key={p.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.03 }}
                                className="border-b border-[#ECEAE2] hover:bg-[#F4F2EB] transition-colors"
                              >
                                <td className="px-5 py-3.5 font-medium text-[#0F1020]">{p.customerName}</td>
                                <td className="px-5 py-3.5 text-[#6B6A60] max-w-[160px] truncate">{p.name}</td>
                                <td className="px-5 py-3.5">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium ${stagePill.bg} ${stagePill.text}`}>
                                    {p.stageDisplay}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 num text-[#0F1020] font-medium whitespace-nowrap">
                                  {fmtValue(p.estimatedValue)}
                                </td>
                                <td className="px-5 py-3.5">
                                  <Link href={`/erp/projects/${p.id}`}>
                                    <button className="p-1.5 rounded-lg text-[#6B6A60] hover:text-[#0F1020] hover:bg-[#ECEAE2] transition-colors">
                                      {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                                    </button>
                                  </Link>
                                </td>
                              </motion.tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              )}

              {/* Service Requests */}
              <SectionCard>
                <SectionHeader
                  eyebrow={isRtl ? 'طلبات الصيانة' : 'SERVICE REQUESTS'}
                  title={t('dash_recent_requests')}
                  isRtl={isRtl}
                  action={
                    <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <button
                        onClick={openNewReq}
                        className={`flex items-center gap-1.5 text-[12.5px] font-semibold bg-[#141A24] hover:bg-[#0B1019] text-white px-3 py-1.5 rounded-lg transition-colors ${isRtl ? 'flex-row-reverse' : ''}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t('admin_new_request')}
                      </button>
                      <Link href="/admin/requests">
                        <button className={`flex items-center gap-1 text-[12.5px] font-medium text-[#141A24] hover:underline underline-offset-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          {t('view_all')}
                          {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                        </button>
                      </Link>
                    </div>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]" dir={isRtl ? 'rtl' : 'ltr'}>
                    <thead>
                      <tr className="border-b border-[#ECEAE2] bg-[#F4F2EB]">
                        {[t('admin_col_id'), t('admin_col_position'), t('admin_history_project'), t('admin_col_message'), t('admin_col_date'), t('admin_col_status'), ...(isAdmin ? [''] : [])].map((h, idx) => (
                          <th key={idx} className="px-5 py-2.5 text-[11px] font-semibold text-[#6B6A60] uppercase tracking-wider text-start whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={isAdmin ? 7 : 6} className="px-5 py-10 text-center text-[#6B6A60]"><RefreshCw className="w-4 h-4 animate-spin mx-auto" /></td></tr>
                      ) : requests.length === 0 ? (
                        <tr><td colSpan={isAdmin ? 7 : 6} className="px-5 py-10 text-center text-[#6B6A60] text-sm">{t('admin_no_requests')}</td></tr>
                      ) : (
                        requests.slice(0, PREVIEW_COUNT).map((row, i) => (
                          <motion.tr
                            key={row.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-b border-[#ECEAE2] hover:bg-[#F4F2EB] transition-colors"
                          >
                            <td className="px-5 py-3.5 num text-[11px] text-[#6B6A60]">#{row.id}</td>
                            <td className="px-5 py-3.5 font-semibold text-[#0F1020]">{row.positionId}</td>
                            <td className="px-5 py-3.5 text-[#6B6A60]">{row.projectName || '—'}</td>
                            <td className="px-5 py-3.5 text-[#0F1020] max-w-[160px]">
                              {row.message ? (
                                <span className="block truncate" title={row.message}>{row.message}</span>
                              ) : <span className="text-[#6B6A60]">—</span>}
                            </td>
                            <td className="px-5 py-3.5 num text-[#6B6A60] whitespace-nowrap text-[12px]">{fmtDate(row.createdAt)}</td>
                            <td className="px-5 py-3.5">
                              <select
                                value={row.status}
                                disabled={updatingId === row.id}
                                onChange={e => updateStatus(row.id, e.target.value)}
                                className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full cursor-pointer outline-none transition-all border ${REQ_STATUS[row.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}
                              >
                                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            {isAdmin && (
                              <td className="px-5 py-3.5">
                                <button
                                  onClick={() => deleteRequest(row.id)}
                                  disabled={deletingReqId === row.id}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[#6B6A60] hover:text-[#A0312A] hover:bg-[#F7E2DF] disabled:opacity-40 transition-colors"
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
                {requests.length > PREVIEW_COUNT && (
                  <div className={`px-5 py-3 border-t border-[#ECEAE2] bg-[#F4F2EB]`}>
                    <Link href="/admin/requests">
                      <button className="text-[12.5px] font-medium text-[#141A24] hover:underline underline-offset-2">
                        {t('view_all')} ({requests.length})
                      </button>
                    </Link>
                  </div>
                )}
              </SectionCard>

            </div>

            {/* Right column */}
            {isErpUser && (
              <div className="col-span-12 lg:col-span-4 space-y-5">

                {/* Follow-ups Needed */}
                <SectionCard>
                  <SectionHeader
                    eyebrow={isRtl ? 'متابعات' : 'NEEDS ATTENTION'}
                    title={t('dash_followups_title')}
                    isRtl={isRtl}
                    action={
                      overdueLeadsCount > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#F7E2DF] text-[#A0312A] text-[11px] font-bold">
                          {overdueLeadsCount}
                        </span>
                      ) : undefined
                    }
                  />
                  <ul className="divide-y divide-[#ECEAE2]">
                    {erpLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <li key={i} className="px-5 py-3.5 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#ECEAE2] animate-pulse shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-[#ECEAE2] rounded animate-pulse w-3/4" />
                            <div className="h-2.5 bg-[#ECEAE2] rounded animate-pulse w-1/2" />
                          </div>
                        </li>
                      ))
                    ) : overdueLeads.length === 0 ? (
                      <li className="px-5 py-8 text-center text-[#6B6A60] text-sm">{t('dash_no_followups')}</li>
                    ) : (
                      overdueLeads.map((lead, i) => (
                        <li key={lead.id} className="hover:bg-[#F4F2EB] transition-colors">
                          <Link href={`/erp/leads/${lead.id}`}>
                            <div className={`px-5 py-3.5 flex items-start gap-3 cursor-pointer ${isRtl ? 'flex-row-reverse' : ''}`}>
                              <div className="w-8 h-8 rounded-full bg-[#F7E2DF] flex items-center justify-center shrink-0">
                                <Clock className="w-3.5 h-3.5 text-[#A0312A]" />
                              </div>
                              <div className={`flex-1 min-w-0 ${isRtl ? 'text-end' : ''}`}>
                                <p className="text-[13px] font-medium text-[#0F1020] truncate">{lead.customerName}</p>
                                <p className="text-[11.5px] text-[#6B6A60] mt-0.5 num" dir="ltr">
                                  {lead.firstFollowupDate ? new Date(lead.firstFollowupDate).toLocaleDateString() : '—'}
                                </p>
                              </div>
                              {isRtl ? <ArrowRight className="w-3.5 h-3.5 text-[#6B6A60] mt-1 shrink-0" /> : <ArrowRight className="w-3.5 h-3.5 text-[#6B6A60] mt-1 shrink-0" />}
                            </div>
                          </Link>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="px-5 py-3 border-t border-[#ECEAE2] bg-[#F4F2EB]">
                    <Link href="/erp/leads">
                      <button className="text-[12.5px] font-medium text-[#141A24] hover:underline underline-offset-2">
                        {t('view_all')}
                      </button>
                    </Link>
                  </div>
                </SectionCard>

                {/* Document Archive preview */}
                <SectionCard>
                  <SectionHeader
                    eyebrow={isRtl ? 'مستندات' : 'DOCUMENTS'}
                    title={t('dash_archive_preview')}
                    isRtl={isRtl}
                    action={
                      <Link href="/admin/history">
                        <button className={`flex items-center gap-1 text-[12.5px] font-medium text-[#141A24] hover:underline underline-offset-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          {t('view_all')}
                          {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                        </button>
                      </Link>
                    }
                  />
                  <ul className="divide-y divide-[#ECEAE2]">
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <li key={i} className="px-5 py-3.5 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#ECEAE2] animate-pulse shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-[#ECEAE2] rounded animate-pulse w-full" />
                            <div className="h-2.5 bg-[#ECEAE2] rounded animate-pulse w-2/3" />
                          </div>
                        </li>
                      ))
                    ) : history.length === 0 ? (
                      <li className="px-5 py-8 text-center text-[#6B6A60] text-sm">{t('dash_no_recent_history')}</li>
                    ) : (
                      history.slice(0, 4).map((row, i) => (
                        <li key={row.id} className="px-5 py-3.5 hover:bg-[#F4F2EB] transition-colors">
                          <div className={`flex items-start gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <div className="w-8 h-8 rounded-lg bg-[#F4F2EB] border border-[#ECEAE2] flex items-center justify-center shrink-0">
                              <FileText className="w-3.5 h-3.5 text-[#6B6A60]" />
                            </div>
                            <div className={`flex-1 min-w-0 ${isRtl ? 'text-end' : ''}`}>
                              <p className="text-[12.5px] font-medium text-[#0F1020] truncate">{row.projectName || row.originalFilename}</p>
                              <div className={`flex items-center gap-2 mt-0.5 ${isRtl ? 'justify-end flex-row-reverse' : ''}`}>
                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-[#ECEAE2] text-[#6B6A60] text-[10px] font-bold num">{row.positionCount}</span>
                                <span className="text-[11px] text-[#6B6A60] num" dir="ltr">{fmtDate(row.createdAt)}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => downloadFile(`${BASE}/api/qr/download/${row.id}`, row.reportFilename)}
                              className="p-1.5 rounded-lg text-[#6B6A60] hover:text-[#141A24] hover:bg-[#ECEAE2] transition-colors shrink-0"
                              title={t('download_report')}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </SectionCard>

                {/* User management (Admin only) */}
                {isAdmin && (
                  <Link href="/admin/users">
                    <div className={`dash-card p-5 flex items-center gap-4 cursor-pointer hover:bg-[#F4F2EB] transition-colors group ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div className="p-2.5 rounded-xl bg-[#F4F2EB] border border-[#ECEAE2] shrink-0">
                        <Users className="w-5 h-5 text-[#141A24]" />
                      </div>
                      <div className={`flex-1 ${isRtl ? 'text-end' : ''}`}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6A60]">{t('users_nav')}</p>
                        <p className="text-[14px] font-bold text-[#0F1020] mt-0.5">{t('users_title')}</p>
                      </div>
                      <div>
                        {isRtl
                          ? <ArrowLeft className="w-4 h-4 text-[#6B6A60] group-hover:text-[#141A24] transition-colors" />
                          : <ArrowRight className="w-4 h-4 text-[#6B6A60] group-hover:text-[#141A24] transition-colors" />}
                      </div>
                    </div>
                  </Link>
                )}

              </div>
            )}

          </div>

          {/* Non-ERP users: show document archive in full */}
          {!isErpUser && (
            <SectionCard>
              <SectionHeader
                eyebrow={isRtl ? 'أرشيف' : 'ARCHIVE'}
                title={t('archive_title')}
                isRtl={isRtl}
                action={
                  <Link href="/admin/history">
                    <button className={`flex items-center gap-1 text-[12.5px] font-medium text-[#141A24] hover:underline underline-offset-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      {t('view_all')}
                      {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </Link>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
                  <thead>
                    <tr className="border-b border-[#ECEAE2] bg-[#F4F2EB]">
                      {[t('admin_history_project'), t('admin_history_filename'), t('admin_history_date'), t('admin_history_positions'), t('download_report'), ''].map((h, idx) => (
                        <th key={idx} className="px-5 py-2.5 text-[11px] font-semibold text-[#6B6A60] uppercase tracking-wider text-start whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-[#6B6A60]"><RefreshCw className="w-4 h-4 animate-spin mx-auto" /></td></tr>
                    ) : history.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-[#6B6A60] text-sm">{t('admin_history_empty')}</td></tr>
                    ) : (
                      history.slice(0, PREVIEW_COUNT).map((row, i) => (
                        <tr key={row.id} className="border-b border-[#ECEAE2] hover:bg-[#F4F2EB] transition-colors">
                          <td className="px-5 py-3.5 font-medium text-[#0F1020]">{row.projectName || '—'}</td>
                          <td className="px-5 py-3.5 font-mono text-xs text-[#6B6A60] max-w-[200px] truncate">{row.originalFilename}</td>
                          <td className="px-5 py-3.5 num text-[#6B6A60] whitespace-nowrap text-xs">{fmtDate(row.createdAt)}</td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-[#ECEAE2] text-[#0F1020] text-xs font-bold num">{row.positionCount}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => downloadFile(`${BASE}/api/qr/download/${row.id}`, row.reportFilename)}
                              className="inline-flex items-center gap-1.5 bg-[#141A24] hover:bg-[#0B1019] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                              <Download className="w-3 h-3" />{t('download_report')}
                            </button>
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => deleteDoc(row.id, row.originalFilename)}
                              disabled={deletingDocId === row.id}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[#6B6A60] hover:text-[#A0312A] hover:bg-[#F7E2DF] disabled:opacity-40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

        </div>
      </div>

      {/* ── New Request Modal ── */}
      {showNewReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowNewReq(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#ECEAE2]"
            dir={isRtl ? 'rtl' : 'ltr'}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b border-[#ECEAE2] ${isRtl ? 'flex-row-reverse' : ''}`}>
              <h3 className="font-semibold text-[#0F1020]">{t('admin_create_request_title')}</h3>
              <button onClick={() => setShowNewReq(false)} className="text-[#6B6A60] hover:text-[#0F1020] transition-colors p-1 rounded-lg hover:bg-[#F4F2EB]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {newReqSuccess ? (
              <div className="px-6 py-14 text-center">
                <div className="w-12 h-12 rounded-full bg-[#E4F1E8] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-[#1F7A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="font-semibold text-[#0F1020]">{t('admin_request_created')}</p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#0F1020] mb-1.5">{t('admin_history_project')} *</label>
                  <div className="relative">
                    <select
                      value={newReq.projectName}
                      onChange={e => setNewReq(p => ({ ...p, projectName: e.target.value }))}
                      className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40"
                    >
                      <option value="">{t('admin_select_project')}</option>
                      {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6A60] pointer-events-none ${isRtl ? 'left-3' : 'right-3'}`} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F1020] mb-1.5">{t('admin_col_position')} *</label>
                  <input
                    type="text"
                    value={newReq.positionId}
                    onChange={e => setNewReq(p => ({ ...p, positionId: e.target.value }))}
                    placeholder={t('admin_position_placeholder')}
                    className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#0F1020] mb-1.5">{t('admin_col_phone')}</label>
                    <input type="text" value={newReq.customerPhone} onChange={e => setNewReq(p => ({ ...p, customerPhone: e.target.value }))} placeholder="05XXXXXXXX" className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#0F1020] mb-1.5">{t('admin_col_invoice')}</label>
                    <input type="text" value={newReq.invoiceNumber} onChange={e => setNewReq(p => ({ ...p, invoiceNumber: e.target.value }))} placeholder="INV-2025-001" className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0F1020] mb-1.5">{t('admin_col_message')}</label>
                  <textarea value={newReq.message} onChange={e => setNewReq(p => ({ ...p, message: e.target.value }))} rows={2} className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40" />
                </div>
                <div className={`flex items-center justify-end gap-3 pt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <button onClick={() => setShowNewReq(false)} className="px-4 py-2 text-sm font-medium text-[#6B6A60] border border-[#ECEAE2] rounded-xl hover:bg-[#F4F2EB] transition-colors">
                    {t('admin_cancel')}
                  </button>
                  <button
                    onClick={submitNewReq}
                    disabled={newReqSubmitting || !newReq.projectName || !newReq.positionId}
                    className="px-5 py-2 text-sm font-semibold bg-[#141A24] hover:bg-[#0B1019] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                  >
                    {newReqSubmitting ? t('admin_creating') : t('admin_submit_btn')}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AdminLayout>
  );
}
