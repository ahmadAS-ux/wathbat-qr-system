import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { ArrowRight, ArrowLeft, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { API_BASE } from '@/lib/api-base';

interface LeadLog {
  id: number;
  leadId: number;
  note: string;
  nextFollowupDate: string | null;
  createdAt: string;
  createdBy: number;
}

interface Lead {
  id: number;
  customerName: string;
  phone: string;
  source: string;
  productInterest: string;
  buildingType: string;
  location: string | null;
  assignedTo: number | null;
  budgetRange: string | null;
  estimatedValue: number | null;
  firstFollowupDate: string;
  status: string;
  lostReason: string | null;
  convertedProjectId: number | null;
  createdAt: string;
  logs: LeadLog[];
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  followup: 'bg-amber-100 text-amber-700',
  converted: 'bg-teal-100 text-teal-700',
  lost: 'bg-red-100 text-red-700',
};

export default function ErpLeadDetail() {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams() as { id: string };
  const id = Number(params.id);

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [savingLog, setSavingLog] = useState(false);
  const [showLoseModal, setShowLoseModal] = useState(false);
  const [loseReason, setLoseReason] = useState('');
  const [converting, setConverting] = useState(false);
  const [losing, setLosing] = useState(false);

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const canConvert = user?.role === 'Admin' || user?.role === 'FactoryManager' || user?.role === 'Employee';

  const loadLead = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/leads/${id}`);
      if (res.ok) setLead(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLead(); }, [id]);

  const addLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSavingLog(true);
    try {
      await fetch(`${API_BASE}/api/erp/leads/${id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, nextFollowupDate: nextDate || undefined }),
      });
      setNote(''); setNextDate('');
      await loadLead();
    } finally {
      setSavingLog(false);
    }
  };

  const convertToProject = async () => {
    setConverting(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/leads/${id}/convert`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        navigate(`/erp/projects/${data.projectId}`);
      }
    } finally {
      setConverting(false);
    }
  };

  const markLost = async () => {
    setLosing(true);
    try {
      await fetch(`${API_BASE}/api/erp/leads/${id}/lose`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: loseReason }),
      });
      setShowLoseModal(false);
      await loadLead();
    } finally {
      setLosing(false);
    }
  };

  const statusLabel: Record<string, string> = {
    new: t('erp_lead_status_new'),
    followup: t('erp_lead_status_followup'),
    converted: t('erp_lead_status_converted'),
    lost: t('erp_lead_status_lost'),
  };

  if (loading) {
    return <AdminLayout><div className="p-6 text-center text-slate-400">{t('processing')}</div></AdminLayout>;
  }

  if (!lead) {
    return <AdminLayout><div className="p-6 text-center text-slate-400">404</div></AdminLayout>;
  }

  const isActive = lead.status === 'new' || lead.status === 'followup';

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Back */}
        <button
          onClick={() => navigate('/erp/leads')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#1B2A4A] mb-4 transition-colors"
        >
          <BackIcon className="w-4 h-4" />
          {t('erp_leads_title')}
        </button>

        {/* Lead Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl font-bold text-[#1B2A4A]">{lead.customerName}</h1>
              <p className="text-slate-500 text-sm mt-0.5" dir="ltr">{lead.phone}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[lead.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {statusLabel[lead.status] ?? lead.status}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-slate-400">{t('erp_lead_source')}</dt>
              <dd className="font-medium text-slate-700 mt-0.5">{lead.source}</dd>
            </div>
            <div>
              <dt className="text-slate-400">{t('erp_lead_product')}</dt>
              <dd className="font-medium text-slate-700 mt-0.5">{lead.productInterest}</dd>
            </div>
            <div>
              <dt className="text-slate-400">{t('erp_lead_building')}</dt>
              <dd className="font-medium text-slate-700 mt-0.5">{lead.buildingType}</dd>
            </div>
            {lead.location && (
              <div>
                <dt className="text-slate-400">{t('erp_lead_location')}</dt>
                <dd className="font-medium text-slate-700 mt-0.5">{lead.location}</dd>
              </div>
            )}
            {lead.estimatedValue && (
              <div>
                <dt className="text-slate-400">{t('erp_lead_value')}</dt>
                <dd className="font-medium text-slate-700 mt-0.5" dir="ltr">{lead.estimatedValue.toLocaleString()} <span className="text-slate-400">SAR</span></dd>
              </div>
            )}
            <div>
              <dt className="text-slate-400">{t('erp_lead_next_followup')}</dt>
              <dd className="font-medium mt-0.5" dir="ltr">
                <span className={lead.firstFollowupDate < new Date().toISOString().split('T')[0] && isActive ? 'text-red-600' : 'text-slate-700'}>
                  {lead.firstFollowupDate}
                </span>
              </dd>
            </div>
            {lead.lostReason && (
              <div className="col-span-2">
                <dt className="text-slate-400">{t('erp_lost_reason_label')}</dt>
                <dd className="font-medium text-red-600 mt-0.5">{lead.lostReason}</dd>
              </div>
            )}
            {lead.convertedProjectId && (
              <div className="col-span-2">
                <dt className="text-slate-400">{t('erp_from_lead')}</dt>
                <dd className="mt-0.5">
                  <button
                    onClick={() => navigate(`/erp/projects/${lead.convertedProjectId}`)}
                    className="text-[#1B2A4A] font-semibold underline underline-offset-2 text-sm"
                  >
                    {t('erp_projects_title')} #{lead.convertedProjectId}
                  </button>
                </dd>
              </div>
            )}
          </dl>

          {/* Action Buttons */}
          {isActive && (
            <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
              {canConvert && (
                <button
                  onClick={convertToProject}
                  disabled={converting}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {converting ? '...' : t('erp_convert_btn')}
                </button>
              )}
              <button
                onClick={() => setShowLoseModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                {t('erp_lose_btn')}
              </button>
            </div>
          )}
        </div>

        {/* Add Log Form */}
        {isActive && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
            <h2 className="font-semibold text-[#1B2A4A] mb-3">{t('erp_add_log')}</h2>
            <form onSubmit={addLog} className="space-y-3">
              <textarea
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                rows={3}
                placeholder={t('erp_log_note')}
                value={note}
                onChange={e => setNote(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">{t('erp_log_next_date')}</label>
                  <input
                    type="date"
                    dir="ltr"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                    value={nextDate}
                    onChange={e => setNextDate(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingLog || !note.trim()}
                  className="px-5 py-2 bg-[#1B2A4A] text-white rounded-xl text-sm font-semibold hover:bg-[#1B2A4A]/90 disabled:opacity-50 transition-colors mt-4"
                >
                  {savingLog ? '...' : t('erp_log_save')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Contact Log Timeline */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-[#1B2A4A] mb-4">{t('erp_contact_log')}</h2>
          {lead.logs.length === 0 ? (
            <p className="text-slate-400 text-sm">{t('erp_no_leads')}</p>
          ) : (
            <ol className="relative border-s border-slate-200 space-y-4 ms-3">
              {[...lead.logs].reverse().map(log => (
                <li key={log.id} className="ms-4">
                  <span className="absolute -start-1.5 mt-1 w-3 h-3 rounded-full bg-[#1B2A4A]/20 border-2 border-[#1B2A4A]/40" />
                  <p className="text-sm text-slate-700 leading-relaxed">{log.note}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    <span dir="ltr">{new Date(log.createdAt).toLocaleDateString()}</span>
                    {log.nextFollowupDate && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Clock className="w-3 h-3" />
                        <span dir="ltr">{log.nextFollowupDate}</span>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Lose Modal */}
      {showLoseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="font-bold text-[#1B2A4A]">{t('erp_lose_btn')}</h2>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-slate-600 mb-2">{t('erp_lose_reason')}</label>
              <textarea
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                rows={3}
                value={loseReason}
                onChange={e => setLoseReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowLoseModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                {t('erp_cancel')}
              </button>
              <button
                onClick={markLost}
                disabled={losing}
                className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {losing ? '...' : t('erp_lose_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
