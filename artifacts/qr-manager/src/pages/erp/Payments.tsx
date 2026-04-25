import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { FileText, Upload, Download, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { API_BASE } from '@/lib/api-base';

interface MilestoneRow {
  id: number;
  project_id: number;
  project_name: string;
  customer_name: string;
  label: string;
  percentage: number | null;
  amount: number | null;
  paid_amount: number | null;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  qoyod_doc_file_id: number | null;
  notes: string | null;
}

export default function ErpPayments() {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ paidAmount: '', notes: '', file: null as File | null });
  const [markingPaid, setMarkingPaid] = useState(false);
  const payFileRef = useRef<HTMLInputElement>(null);

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const canManagePayments = user?.role === 'Admin' || user?.role === 'Accountant';

  const loadMilestones = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/payments/all`);
      if (res.ok) setMilestones(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMilestones(); }, []);

  const completionPct = (m: MilestoneRow): number | null => {
    if (!m.paid_amount || !m.amount || m.amount === 0) return null;
    return Math.min(100, Math.round((m.paid_amount / m.amount) * 100));
  };

  const handleMarkPaid = async (milestoneId: number) => {
    setMarkingPaid(true);
    try {
      const fd = new FormData();
      if (payForm.paidAmount) fd.append('paidAmount', payForm.paidAmount);
      if (payForm.notes) fd.append('notes', payForm.notes);
      if (payForm.file) fd.append('file', payForm.file);
      const res = await fetch(`${API_BASE}/api/erp/payments/${milestoneId}`, {
        method: 'PATCH',
        body: fd,
      });
      if (res.ok) {
        setPayingId(null);
        setPayForm({ paidAmount: '', notes: '', file: null });
        await loadMilestones();
      }
    } finally {
      setMarkingPaid(false);
    }
  };

  // Group milestones by project
  const grouped = milestones.reduce<Record<number, { projectName: string; customerName: string; items: MilestoneRow[] }>>((acc, m) => {
    if (!acc[m.project_id]) {
      acc[m.project_id] = { projectName: m.project_name, customerName: m.customer_name, items: [] };
    }
    acc[m.project_id].items.push(m);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto px-4 py-8" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/erp/projects')}
            className="p-2 rounded-xl text-slate-400 hover:text-[#1B2A4A] hover:bg-white transition-colors"
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#1B2A4A]">{t('erp_payments_page_title')}</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : milestones.length === 0 ? (
          <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8 text-center">
            <p className="text-sm text-slate-400">{t('erp_payments_no_data')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([projectId, group]) => (
              <div key={projectId} className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
                {/* Project header */}
                <div
                  className="px-5 py-3 bg-[#141A24]/3 border-b border-[#ECEAE2] flex items-center justify-between gap-2 cursor-pointer hover:bg-[#141A24]/5 transition-colors"
                  onClick={() => navigate(`/erp/projects/${projectId}`)}
                >
                  <div>
                    <p className="font-semibold text-sm text-[#1B2A4A]">{group.projectName}</p>
                    <p className="text-xs text-slate-400">{group.customerName}</p>
                  </div>
                  <span className="text-xs text-slate-300">{group.items.length}</span>
                </div>

                {/* Milestones */}
                <div className="divide-y divide-slate-50">
                  {group.items.map(m => {
                    const pct = completionPct(m);
                    const statusStyle = m.status === 'paid'
                      ? 'bg-teal-50 text-teal-600 border-teal-100'
                      : m.status === 'overdue'
                      ? 'bg-red-50 text-red-600 border-red-100'
                      : 'bg-[#ECEAE2] text-slate-500 border-[#ECEAE2]';
                    const statusLabel = m.status === 'paid'
                      ? t('erp_payment_status_paid')
                      : m.status === 'overdue'
                      ? t('erp_payment_status_overdue')
                      : t('erp_payment_status_pending');

                    return (
                      <div key={m.id} className={`px-5 py-4 space-y-3 ${m.status === 'overdue' ? 'bg-red-50/20' : ''}`}>
                        {/* Milestone header row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-[#1B2A4A] flex-1 min-w-0">{m.label}</span>
                          {m.percentage != null && (
                            <span className="text-xs text-slate-400 shrink-0" dir="ltr">{m.percentage}%</span>
                          )}
                          {m.amount != null && (
                            <span className="text-xs font-semibold text-slate-600 shrink-0" dir="ltr">
                              {m.amount.toLocaleString()} {t('erp_payment_sar')}
                            </span>
                          )}
                          {m.due_date && (
                            <span className="text-xs text-slate-400 shrink-0" dir="ltr">{m.due_date}</span>
                          )}
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${statusStyle}`}>
                            {statusLabel}
                          </span>
                        </div>

                        {/* Attachment row with completion badge */}
                        {m.qoyod_doc_file_id != null && pct !== null && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F4F2EB] border border-[#ECEAE2]">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-500 flex-1">{t('erp_payment_proof')}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${pct >= 100 ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                              {pct >= 100 ? t('erp_payment_completion_full') : t('erp_payment_completion_partial').replace('{pct}', String(pct))}
                            </span>
                            <a
                              href={`${API_BASE}/api/erp/projects/${m.project_id}/files/${m.qoyod_doc_file_id}`}
                              className="p-1 rounded text-slate-400 hover:text-[#1B2A4A] hover:bg-white transition-colors shrink-0"
                              title={t('erp_file_download')}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}

                        {/* Mark Paid */}
                        {canManagePayments && m.status !== 'paid' && (
                          payingId === m.id ? (
                            <div className="space-y-2 pt-1">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('erp_payment_paid_amount')} *</label>
                                  <input
                                    type="number"
                                    min="0"
                                    className="w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
                                    value={payForm.paidAmount}
                                    onChange={e => setPayForm(f => ({ ...f, paidAmount: e.target.value }))}
                                    dir="ltr"
                                    autoFocus
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('erp_payment_notes')}</label>
                                  <input
                                    className="w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
                                    value={payForm.notes}
                                    onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">{t('erp_payment_upload_proof')}</label>
                                <input
                                  ref={payFileRef}
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                                  onChange={e => setPayForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
                                />
                                <button
                                  onClick={() => payFileRef.current?.click()}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-[#1B2A4A]/40 hover:text-[#1B2A4A] transition-colors"
                                >
                                  <Upload className="w-3 h-3" />
                                  {payForm.file ? <span dir="ltr" className="ltr truncate max-w-[120px]">{payForm.file.name}</span> : t('choose_file')}
                                </button>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleMarkPaid(m.id)}
                                  disabled={markingPaid || !payForm.paidAmount}
                                  className="px-4 py-2 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-40 transition-colors"
                                >
                                  {markingPaid ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('erp_payment_confirm_paid')}
                                </button>
                                <button
                                  onClick={() => { setPayingId(null); setPayForm({ paidAmount: '', notes: '', file: null }); }}
                                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-600 rounded-lg hover:bg-[#ECEAE2] transition-colors"
                                >
                                  {t('erp_cancel')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setPayingId(m.id)}
                              className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                            >
                              {t('erp_payment_mark_paid')}
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
