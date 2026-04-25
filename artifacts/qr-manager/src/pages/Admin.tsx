import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, QrCode, Calendar, Download, RefreshCw,
  ArrowRight, ArrowLeft, X, Plus, ChevronDown,
  Trash2, Users, FolderOpen, CreditCard, AlertCircle, Clock, Search,
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

interface StageDist {
  new: number;
  in_study: number;
  in_production: number;
  complete: number;
}

// ─── Design-system stage pill config ────────────────────────────────────────
const STAGE_DESIGN: Record<string, { num: string; cls: string }> = {
  new:           { num: '01', cls: 'bg-[#F1EFE7] text-[#3a3a3a] ring-1 ring-inset ring-[#E2E0D6]' },
  in_study:      { num: '04', cls: 'bg-[#FBF0D6] text-[#9A6B0E] ring-1 ring-inset ring-[#EEDDB0]' },
  in_production: { num: '07', cls: 'bg-[#E1ECF7] text-[#1E508C] ring-1 ring-inset ring-[#CFDEEF]' },
  complete:      { num: '13', cls: 'bg-[#E4F1E8] text-[#1F7A4D] ring-1 ring-inset ring-[#CFE4D6]' },
};

const REQ_STATUS: Record<string, string> = {
  New: 'bg-blue-50 text-[#1E508C] border border-blue-100',
  'In Progress': 'bg-amber-50 text-[#9A6B0E] border border-amber-100',
  Pending: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
  Done: 'bg-[#E4F1E8] text-[#1F7A4D] border border-[#CFE4D6]',
};

const FUNNEL_STAGES = [
  { key: 'new' as const,           num: '01' },
  { key: 'in_study' as const,      num: '04' },
  { key: 'in_production' as const, num: '07' },
  { key: 'complete' as const,      num: '13' },
];

const PREVIEW_COUNT = 5;

// ─── Sparkline SVG (decorative, static data) ────────────────────────────────
function Sparkline({ points = [4,6,5,8,7,9,11,10,12,14], tone = 'ok' }: { points?: number[]; tone?: 'ok' | 'danger' | 'mute' }) {
  const w = 88, h = 32;
  const min = Math.min(...points), max = Math.max(...points);
  const norm = points.map((p, i) => [
    (i / (points.length - 1)) * w,
    h - ((p - min) / (max - min || 1)) * h,
  ]);
  const d = norm.map((pt, i) => `${i ? 'L' : 'M'}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' ');
  const color = tone === 'ok' ? '#1F7A4D' : tone === 'danger' ? '#A0312A' : '#28303F';
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={norm[norm.length - 1][0]} cy={norm[norm.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function relativeTime(isoDate: string, isRtl: boolean): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (isRtl) {
    if (mins < 60) return `قبل ${mins} د`;
    if (hours < 24) return `قبل ${hours} س`;
    if (days === 1) return 'أمس';
    return `قبل ${days} يوم`;
  }
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function projectCode(id: number): string {
  return `WT-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#FAFAF7] border border-[#ECEAE2] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden ${className}`}>{children}</div>;
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

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Admin() {
  const { t, isRtl, language } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isErpUser = user?.role !== 'Accountant';
  const isPaymentsUser = user?.role === 'Admin' || user?.role === 'Accountant';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests'>('dashboard');

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [totalProjectsCount, setTotalProjectsCount] = useState(0);
  const [overdueLeads, setOverdueLeads] = useState<Lead[]>([]);
  const [overdueLeadsCount, setOverdueLeadsCount] = useState(0);
  const [overduePaymentsCount, setOverduePaymentsCount] = useState(0);
  const [stageDist, setStageDist] = useState<StageDist>({ new: 0, in_study: 0, in_production: 0, complete: 0 });

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
      const [projRes, leadsRes, overdueLeadsRes, overduePayRes, stageRes] = await Promise.all([
        fetch(`${BASE}/api/erp/projects`),
        fetch(`${BASE}/api/erp/leads`),
        fetch(`${BASE}/api/erp/leads/overdue-count`),
        isPaymentsUser ? fetch(`${BASE}/api/erp/payments/overdue-count`) : Promise.resolve(null),
        fetch(`${BASE}/api/erp/projects/stage-distribution`),
      ]);
      if (projRes.ok) {
        const all: Project[] = await projRes.json();
        setTotalProjectsCount(all.length);
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
      if (stageRes.ok) {
        setStageDist(await stageRes.json());
      }
    } finally {
      setErpLoading(false);
    }
  };

  const refreshAll = () => { fetchData(); fetchErpData(); };

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
      a.href = objUrl; a.download = filename;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(objUrl); document.body.removeChild(a);
    } catch (err) { console.error('Download failed', err); }
  };

  const deleteRequest = async (id: number) => {
    if (!window.confirm(t('confirm_delete_request'))) return;
    setDeletingReqId(id);
    try {
      await fetch(`${BASE}/api/admin/requests/${id}`, { method: 'DELETE' });
      setRequests(r => r.filter(x => x.id !== id));
    } finally { setDeletingReqId(null); }
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
    } finally { setNewReqSubmitting(false); }
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
    } finally { setUpdatingId(null); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB', { day: '2-digit', month: 'short' });
  const fmtValue = (v: number | null) => v ? v.toLocaleString() : '—';
  const statusOptions = ['New', 'In Progress', 'Done'];

  // ── KPI card definitions ──
  const kpiCards = [
    ...(isErpUser ? [{
      eyebrow: 'ACTIVE PROJECTS',
      label: t('dash_active_projects'),
      value: totalProjectsCount > 0 || !erpLoading ? String(totalProjectsCount) : '…',
      unit: isRtl ? 'مشروع' : 'projects',
      delta: null as string | null,
      deltaTone: 'ok' as 'ok' | 'danger' | 'mute',
      sparkPoints: [4,6,5,8,7,9,11,10,12,14],
      sparkTone: 'ok' as 'ok' | 'danger' | 'mute',
      loading: erpLoading,
    }] : []),
    ...(isErpUser ? [{
      eyebrow: 'OVERDUE FOLLOW-UPS',
      label: t('dash_overdue_leads'),
      value: erpLoading ? '…' : String(overdueLeadsCount),
      unit: isRtl ? 'متابعة' : 'leads',
      delta: overdueLeadsCount > 0 ? `+${overdueLeadsCount}` : null,
      deltaTone: (overdueLeadsCount > 0 ? 'danger' : 'ok') as 'ok' | 'danger' | 'mute',
      sparkPoints: overdueLeadsCount > 0 ? [3,5,4,7,6,8,9,10,11,12] : [8,7,6,5,6,4,3,2,2,1],
      sparkTone: (overdueLeadsCount > 0 ? 'danger' : 'ok') as 'ok' | 'danger' | 'mute',
      loading: erpLoading,
    }] : []),
    ...(isPaymentsUser ? [{
      eyebrow: 'OVERDUE PAYMENTS',
      label: t('dash_pending_payments'),
      value: erpLoading ? '…' : String(overduePaymentsCount),
      unit: isRtl ? 'دفعة' : 'payments',
      delta: overduePaymentsCount > 0 ? `+${overduePaymentsCount}` : null,
      deltaTone: (overduePaymentsCount > 0 ? 'danger' : 'ok') as 'ok' | 'danger' | 'mute',
      sparkPoints: [14,13,12,11,12,10,9,8,8,7],
      sparkTone: (overduePaymentsCount > 0 ? 'danger' : 'ok') as 'ok' | 'danger' | 'mute',
      loading: erpLoading,
    }] : []),
    {
      eyebrow: 'DOCUMENTS PROCESSED',
      label: t('dash_docs_processed'),
      value: loading ? '…' : String(metrics?.totalDocsProcessed ?? 0),
      unit: isRtl ? 'مستند' : 'docs',
      delta: null as string | null,
      deltaTone: 'ok' as 'ok' | 'danger' | 'mute',
      sparkPoints: [2,3,4,5,4,6,7,8,9,11],
      sparkTone: 'ok' as 'ok' | 'danger' | 'mute',
      loading,
    },
  ];

  // ── Stage funnel label helper ──
  const stageFunnelLabel = (key: string) => {
    if (isRtl) {
      const map: Record<string, string> = { new: t('dash_stage_new'), in_study: t('dash_stage_in_study'), in_production: t('dash_stage_in_production'), complete: t('dash_stage_complete') };
      return map[key] ?? key;
    }
    const map: Record<string, string> = { new: 'New Lead', in_study: 'Study & Quote', in_production: 'Production', complete: 'Complete' };
    return map[key] ?? key;
  };

  const funnelMax = Math.max(1, ...FUNNEL_STAGES.map(s => stageDist[s.key] ?? 0));
  const funnelTotal = FUNNEL_STAGES.reduce((a, s) => a + (stageDist[s.key] ?? 0), 0);

  // ── Stage pill label helper ──
  const stagePillLabel = (stageDisplay: string) => {
    if (isRtl) {
      const map: Record<string, string> = { new: t('dash_stage_new'), in_study: t('dash_stage_in_study'), in_production: t('dash_stage_in_production'), complete: t('dash_stage_complete') };
      return map[stageDisplay] ?? stageDisplay;
    }
    const map: Record<string, string> = { new: 'New', in_study: 'Study', in_production: 'Production', complete: 'Complete' };
    return map[stageDisplay] ?? stageDisplay;
  };

  return (
    <AdminLayout>
      <div className="min-h-screen" style={{ background: '#F4F2EB' }}>

        {/* ── Page Header ── */}
        <header className="bg-white border-b border-[#ECEAE2]">
          <div className={`px-6 py-5 max-w-[1400px] mx-auto flex items-end justify-between gap-6 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="eyebrow mb-1">
                {isRtl ? `لوحة التحكم · 2026 · Q2` : 'DASHBOARD · 2026 · Q2'}
              </div>
              <h1 className="text-[24px] font-extrabold text-[#0F1020] leading-tight">{t('admin_title')}</h1>
              <div className={`flex items-center gap-3 mt-1.5 text-[12.5px] text-[#6B6A60] ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1F7A4D]" />
                  {t('dash_system_ok')}
                </span>
                <span className="text-[#ECEAE2]">·</span>
                <span className="num" dir="ltr">wathbat.sa</span>
              </div>
            </div>
            <div className={`flex items-center gap-2 shrink-0 ${isRtl ? 'flex-row-reverse' : ''}`}>
              {/* Quick Actions */}
              <button
                className="h-8 px-3 text-[13px] inline-flex items-center gap-1.5 bg-white text-[#141A24] ring-1 ring-inset ring-[#E2E0D6] rounded-lg hover:bg-[#FBFAF4] transition-colors"
                onClick={() => {}}
              >
                <Search className="w-3.5 h-3.5" />
                {t('dash_quick_search')}
              </button>
              <button
                className="h-8 px-3 text-[13px] inline-flex items-center gap-1.5 bg-white text-[#141A24] ring-1 ring-inset ring-[#E2E0D6] rounded-lg hover:bg-[#FBFAF4] transition-colors"
                onClick={() => window.print()}
              >
                <Calendar className="w-3.5 h-3.5" />
                {t('dash_today_report')}
              </button>
              {isErpUser && (
                <Link href="/erp/projects">
                  <button className="h-8 px-3 text-[13px] inline-flex items-center gap-1.5 bg-[#141A24] text-white rounded-lg hover:bg-[#0B1019] transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    {t('dash_new_project')}
                  </button>
                </Link>
              )}
              <button
                onClick={refreshAll}
                className="h-8 w-8 inline-flex items-center justify-center text-[#6B6A60] hover:text-[#0F1020] transition-colors rounded-lg hover:bg-[#ECEAE2] border border-[#ECEAE2]"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${(loading || erpLoading) ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </header>

        {/* ── Tabs ── */}
        <div className="bg-white border-b border-[#ECEAE2]" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="max-w-[1400px] mx-auto px-6 flex items-center gap-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-5 py-3.5 text-[13.5px] font-medium border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-[#141A24] text-[#141A24]' : 'border-transparent text-[#6B6A60] hover:text-[#141A24]'}`}
            >
              {t('dash_tab_dashboard')}
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-5 py-3.5 text-[13.5px] font-medium border-b-2 transition-colors inline-flex items-center gap-2 ${activeTab === 'requests' ? 'border-[#141A24] text-[#141A24]' : 'border-transparent text-[#6B6A60] hover:text-[#141A24]'}`}
            >
              {t('dash_tab_requests')}
              {requests.length > 0 && (
                <span className="num text-[11px] bg-[#ECEAE2] text-[#6B6A60] px-1.5 py-0.5 rounded-full">
                  {requests.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

          {activeTab === 'dashboard' && (
            <>
              {/* ── KPI Row ── */}
              <div className={`grid gap-5 ${kpiCards.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : kpiCards.length === 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2'}`}>
                {kpiCards.map((card, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.28 }}
                    className="bg-[#FAFAF7] border border-[#ECEAE2] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5"
                  >
                    <div className={`flex items-start justify-between mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div className={isRtl ? 'text-end' : ''}>
                        <div className="eyebrow">{card.eyebrow}</div>
                        <div className="text-[13px] text-[#6B6A60]">{card.label}</div>
                      </div>
                      <Sparkline points={card.sparkPoints} tone={card.sparkTone} />
                    </div>
                    <div className={`flex items-baseline gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div className="num text-[30px] font-bold text-[#0F1020] leading-none tabular-nums">
                        {card.loading
                          ? <span className="inline-block w-10 h-7 bg-[#ECEAE2] rounded animate-pulse" />
                          : card.value}
                      </div>
                      {card.unit && !card.loading && (
                        <div className="text-[13px] text-[#6B6A60] num">{card.unit}</div>
                      )}
                    </div>
                    {card.delta && !card.loading && (
                      <div className={`mt-3 inline-flex items-center gap-1 text-[12px] font-medium ${card.deltaTone === 'ok' ? 'text-[#1F7A4D]' : card.deltaTone === 'danger' ? 'text-[#A0312A]' : 'text-[#6B6A60]'} ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <span className="num">{card.delta}</span>
                        <span className="text-[#6B6A60]">{t('dash_trend_last_month')}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* ── Main grid ── */}
              <div className={`grid gap-6 ${isErpUser ? 'grid-cols-12' : 'grid-cols-1'}`}>

                {/* Left: 8 cols */}
                <div className={`space-y-6 ${isErpUser ? 'col-span-12 lg:col-span-8' : 'col-span-1'}`}>

                  {/* Recent Projects */}
                  {isErpUser && (
                    <SectionCard>
                      <SectionHeader
                        eyebrow="RECENT PROJECTS"
                        title={t('dash_recent_projects')}
                        isRtl={isRtl}
                        action={
                          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <Link href="/erp/projects">
                              <button className={`flex items-center gap-1 text-[12.5px] font-medium text-[#141A24] hover:underline underline-offset-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                {t('view_all')}
                                {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                              </button>
                            </Link>
                          </div>
                        }
                      />
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]" dir={isRtl ? 'rtl' : 'ltr'}>
                          <thead>
                            <tr className="border-b border-[#ECEAE2]">
                              {[t('dash_customer'), t('dash_stage'), t('dash_value'), t('dash_last_updated'), ''].map((h, idx) => (
                                <th key={idx} className="px-5 py-2.5 font-medium text-[#6B6A60] text-start whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {erpLoading ? (
                              Array.from({ length: 4 }).map((_, i) => (
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
                                const pill = STAGE_DESIGN[p.stageDisplay] ?? STAGE_DESIGN.new;
                                return (
                                  <motion.tr
                                    key={p.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.04 }}
                                    className="border-b border-[#ECEAE2] hover:bg-[#F4F2EB] transition-colors"
                                  >
                                    {/* Client + subtitle + code */}
                                    <td className="px-5 py-3.5">
                                      <div className="font-medium text-[#0F1020]">{p.customerName}</div>
                                      <div className="text-[12px] text-[#6B6A60] mt-0.5 truncate max-w-[180px]">{p.name}</div>
                                      <div className="num text-[10.5px] text-[#6B6A60] mt-0.5" dir="ltr">{projectCode(p.id)}</div>
                                    </td>
                                    {/* Stage pill */}
                                    <td className="px-3 py-3.5">
                                      <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${pill.cls}`}>
                                        <span className="num text-[10.5px] opacity-70">{pill.num}</span>
                                        {stagePillLabel(p.stageDisplay)}
                                      </span>
                                    </td>
                                    {/* Value */}
                                    <td className="px-3 py-3.5 num text-[#0F1020] font-medium whitespace-nowrap">
                                      {fmtValue(p.estimatedValue)}
                                    </td>
                                    {/* Relative time */}
                                    <td className="px-3 py-3.5 text-[#6B6A60] text-[12.5px] whitespace-nowrap">
                                      {relativeTime(p.createdAt, isRtl)}
                                    </td>
                                    {/* Arrow */}
                                    <td className="px-3 py-3.5">
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

                  {/* Non-ERP archive (full table) */}
                  {!isErpUser && (
                    <SectionCard>
                      <SectionHeader
                        eyebrow="ARCHIVE"
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
                              history.slice(0, PREVIEW_COUNT).map((row) => (
                                <tr key={row.id} className="border-b border-[#ECEAE2] hover:bg-[#F4F2EB] transition-colors">
                                  <td className="px-5 py-3.5 font-medium text-[#0F1020]">{row.projectName || '—'}</td>
                                  <td className="px-5 py-3.5 font-mono text-xs text-[#6B6A60] max-w-[200px] truncate">{row.originalFilename}</td>
                                  <td className="px-5 py-3.5 num text-[#6B6A60] whitespace-nowrap text-xs">{fmtDate(row.createdAt)}</td>
                                  <td className="px-5 py-3.5 text-center">
                                    <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-[#ECEAE2] text-[#0F1020] text-xs font-bold num">{row.positionCount}</span>
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <button onClick={() => downloadFile(`${BASE}/api/qr/download/${row.id}`, row.reportFilename)} className="inline-flex items-center gap-1.5 bg-[#141A24] hover:bg-[#0B1019] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                                      <Download className="w-3 h-3" />{t('download_report')}
                                    </button>
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <button onClick={() => deleteDoc(row.id, row.originalFilename)} disabled={deletingDocId === row.id} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[#6B6A60] hover:text-[#A0312A] hover:bg-[#F7E2DF] disabled:opacity-40 transition-colors">
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

                {/* Right: 4 cols */}
                {isErpUser && (
                  <div className="col-span-12 lg:col-span-4 space-y-6">

                    {/* Stage Funnel */}
                    <SectionCard>
                      <div className="px-5 py-4 border-b border-[#ECEAE2]" dir={isRtl ? 'rtl' : 'ltr'}>
                        <div className="eyebrow">STAGE FUNNEL</div>
                        <h3 className="text-[15px] font-bold text-[#0F1020] mt-0.5">{t('dash_funnel_title')}</h3>
                        <div className="text-[12px] text-[#6B6A60] mt-0.5">
                          {erpLoading ? (
                            <span className="inline-block w-24 h-3 bg-[#ECEAE2] rounded animate-pulse" />
                          ) : (
                            <span className="num">{funnelTotal}</span>
                          )}{isRtl ? ` مشروع على ${FUNNEL_STAGES.length} مراحل` : ` projects across ${FUNNEL_STAGES.length} stages`}
                        </div>
                      </div>
                      <div className="px-5 py-4 space-y-2.5" dir={isRtl ? 'rtl' : 'ltr'}>
                        {FUNNEL_STAGES.map(s => {
                          const count = stageDist[s.key] ?? 0;
                          const pct = erpLoading ? 0 : funnelMax ? (count / funnelMax) * 100 : 0;
                          return (
                            <div key={s.key} className={`flex items-center gap-3 text-[12.5px] ${isRtl ? 'flex-row-reverse' : ''}`}>
                              <span className="num text-[10.5px] text-[#6B6A60] w-5 text-start tabular-nums shrink-0">{s.num}</span>
                              <span className="text-[#0F1020] flex-1 truncate">{stageFunnelLabel(s.key)}</span>
                              <div className="w-20 h-1.5 rounded-full bg-[#F1EFE7] overflow-hidden shrink-0">
                                {!erpLoading && (
                                  <div className="h-full rounded-full bg-[#141A24]" style={{ width: `${pct}%` }} />
                                )}
                                {erpLoading && <div className="h-full w-full bg-[#ECEAE2] animate-pulse rounded-full" />}
                              </div>
                              <span className="num text-[#0F1020] font-medium w-4 text-start tabular-nums shrink-0">
                                {erpLoading ? <span className="inline-block w-3 h-3 bg-[#ECEAE2] rounded animate-pulse" /> : count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </SectionCard>

                    {/* Needs Attention (overdue leads) */}
                    <SectionCard>
                      <SectionHeader
                        eyebrow="NEEDS ATTENTION"
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
                          overdueLeads.map((lead) => (
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
                                  {isRtl ? <ArrowLeft className="w-3.5 h-3.5 text-[#6B6A60] mt-1 shrink-0" /> : <ArrowRight className="w-3.5 h-3.5 text-[#6B6A60] mt-1 shrink-0" />}
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
                        eyebrow="DOCUMENTS"
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
                          history.slice(0, 4).map((row) => (
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
                                <button onClick={() => downloadFile(`${BASE}/api/qr/download/${row.id}`, row.reportFilename)} className="p-1.5 rounded-lg text-[#6B6A60] hover:text-[#141A24] hover:bg-[#ECEAE2] transition-colors shrink-0" title={t('download_report')}>
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
                        <div className={`bg-[#FAFAF7] border border-[#ECEAE2] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 flex items-center gap-4 cursor-pointer hover:bg-[#F4F2EB] transition-colors group ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <div className="p-2.5 rounded-xl bg-[#F4F2EB] border border-[#ECEAE2] shrink-0">
                            <Users className="w-5 h-5 text-[#141A24]" />
                          </div>
                          <div className={`flex-1 ${isRtl ? 'text-end' : ''}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6A60]">{t('users_nav')}</p>
                            <p className="text-[14px] font-bold text-[#0F1020] mt-0.5">{t('users_title')}</p>
                          </div>
                          {isRtl
                            ? <ArrowLeft className="w-4 h-4 text-[#6B6A60] group-hover:text-[#141A24] transition-colors" />
                            : <ArrowRight className="w-4 h-4 text-[#6B6A60] group-hover:text-[#141A24] transition-colors" />}
                        </div>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Tab 2: Maintenance Requests ── */}
          {activeTab === 'requests' && (
            <SectionCard>
              <SectionHeader
                eyebrow="MAINTENANCE REQUESTS"
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
                      requests.map((row, i) => (
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
                            {row.message ? <span className="block truncate" title={row.message}>{row.message}</span> : <span className="text-[#6B6A60]">—</span>}
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
                              <button onClick={() => deleteRequest(row.id)} disabled={deletingReqId === row.id} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[#6B6A60] hover:text-[#A0312A] hover:bg-[#F7E2DF] disabled:opacity-40 transition-colors" title="Delete">
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
            </SectionCard>
          )}

        </div>

        {/* ── New Request Modal ── */}
        {showNewReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowNewReq(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-[#FAFAF7] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] w-full max-w-lg overflow-hidden border border-[#ECEAE2]"
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
                      <select value={newReq.projectName} onChange={e => setNewReq(p => ({ ...p, projectName: e.target.value }))} className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40">
                        <option value="">{t('admin_select_project')}</option>
                        {projects.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <ChevronDown className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6A60] pointer-events-none ${isRtl ? 'left-3' : 'right-3'}`} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#0F1020] mb-1.5">{t('admin_col_position')} *</label>
                    <input type="text" value={newReq.positionId} onChange={e => setNewReq(p => ({ ...p, positionId: e.target.value }))} placeholder={t('admin_position_placeholder')} className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 focus:border-[#141A24]/40" />
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
                    <button onClick={submitNewReq} disabled={newReqSubmitting || !newReq.projectName || !newReq.positionId} className="px-5 py-2 text-sm font-semibold bg-[#141A24] hover:bg-[#0B1019] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors">
                      {newReqSubmitting ? t('admin_creating') : t('admin_submit_btn')}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
