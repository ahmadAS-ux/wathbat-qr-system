import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { ArrowRight, ArrowLeft, Upload, Download, CheckCircle2, Circle, FileText, QrCode, ExternalLink, AlertTriangle, X, Loader2, Trash2, Plus, RotateCcw, ArrowLeftRight, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react';
import { API_BASE } from '@/lib/api-base';
import { NameMismatchModal, type NameMismatchChoice } from '@/components/erp/NameMismatchModal';

interface ProjectFile {
  id: number;
  projectId: number;
  fileType: string;
  originalFilename: string;
  uploadedAt: string;
  uploadedBy: number;
  uploadedByName?: string | null;
  isActive?: boolean;
}

interface DetectionItem {
  filename: string;
  size: number;
  file: File;
  detectedType: string | null;
  confidence: 'high' | 'low';
  assignedType: string;
}

interface QROrder {
  id: number;
  originalFilename: string;
  projectName: string | null;
  processingDate: string | null;
  positionCount: number;
  createdAt: string;
  reportFileId: number;
}

interface AssemblyGlassItem {
  quantity: number;
  widthMm: number;
  heightMm: number;
  areaSqm: number;
  description: string;
}

interface AssemblyPosition {
  positionCode: string;
  quantity: number;
  system: string | null;
  widthMm: number | null;
  heightMm: number | null;
  glassItems: AssemblyGlassItem[];
}

interface ParsedAssemblyList {
  positionCount: number;
  projectNameInFile: string | null;
  positions: AssemblyPosition[];
}

interface CutProfile {
  number: string;
  description: string;
  colour: string;
  quantity: number;
  lengthMm: number;
  wastageMm: number;
  wastagePercent: number;
}

interface ParsedCutOptimisation {
  profileCount: number;
  projectNameInFile: string | null;
  profiles: CutProfile[];
}

interface PaymentMilestone {
  id: number;
  projectId: number;
  label: string;
  percentage: number | null;
  amount: number | null;
  paidAmount: number | null;
  dueDate: string | null;
  status: string;
  paidAt: string | null;
  qoyodDocFileId: number | null;
  notes: string | null;
}

interface GlassDetectResult {
  orgadataName: string;
  orgadataPerson: string | null;
  pendingFile: File;
  nameMatches: boolean;
}

interface NameMismatchData {
  nameInFile: string;
  nameInSystem: string;
  pendingFile: File;
  fileType: string;
}

interface Project {
  id: number;
  name: string;
  customerName: string;
  phone: string | null;
  location: string | null;
  buildingType: string | null;
  productInterest: string | null;
  estimatedValue: number | null;
  stageDisplay: string;
  stageInternal: number;
  fromLeadId: number | null;
  assignedTo: number | null;
  deliveryDeadline: string | null;
  warrantyMonths: number | null;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  notes: string | null;
  createdAt: string;
  files: ProjectFile[];
}

const STAGE_DISPLAY_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  new:           { bg: 'bg-[#ECEAE2]',  text: 'text-slate-600',  border: 'border-[#ECEAE2]',  dot: 'bg-slate-400'   },
  in_study:      { bg: 'bg-blue-50',    text: 'text-[#185FA5]',  border: 'border-blue-200',   dot: 'bg-[#185FA5]'   },
  in_production: { bg: 'bg-amber-50',   text: 'text-[#B8860B]',  border: 'border-amber-200',  dot: 'bg-[#B8860B]'   },
  complete:      { bg: 'bg-teal-50',    text: 'text-[#0F6E56]',  border: 'border-teal-200',   dot: 'bg-[#0F6E56]'   },
};

type StageType = 'linear' | 'iterative' | 'parallel' | 'per_phase' | 'continuous';

const INTERNAL_STAGES: { n: number; labelAr: string; labelEn: string; type: StageType }[] = [
  { n: 0,  labelAr: 'عميل محتمل',   labelEn: 'Lead',           type: 'linear'     },
  { n: 1,  labelAr: 'استفسار',       labelEn: 'Inquiry',        type: 'linear'     },
  { n: 2,  labelAr: 'دراسة فنية',    labelEn: 'Tech Study',     type: 'iterative'  },
  { n: 3,  labelAr: 'مشتريات',       labelEn: 'Procurement',    type: 'iterative'  },
  { n: 4,  labelAr: 'عرض سعر',       labelEn: 'Quotation',      type: 'iterative'  },
  { n: 5,  labelAr: 'العقد',         labelEn: 'Contract',       type: 'linear'     },
  { n: 6,  labelAr: 'الدفعة الأولى', labelEn: 'Deposit',        type: 'linear'     },
  { n: 7,  labelAr: 'التصنيع',       labelEn: 'Manufacturing',  type: 'parallel'   },
  { n: 8,  labelAr: 'استلام المواد', labelEn: 'Receiving',      type: 'parallel'   },
  { n: 9,  labelAr: 'التوصيل',       labelEn: 'Delivery',       type: 'per_phase'  },
  { n: 10, labelAr: 'التركيب',       labelEn: 'Installation',   type: 'per_phase'  },
  { n: 11, labelAr: 'التسليم',       labelEn: 'Sign-off',       type: 'per_phase'  },
  { n: 12, labelAr: 'المدفوعات',     labelEn: 'Payment',        type: 'continuous' },
  { n: 13, labelAr: 'الضمان',        labelEn: 'Warranty',       type: 'linear'     },
  { n: 14, labelAr: 'مكتمل',         labelEn: 'Done',           type: 'linear'     },
];

const FILE_SLOTS = [
  { fileType: 'glass_order',       labelAr: 'طلبية زجاج / ألواح', labelEn: 'Glass / Panel Order',  multiFile: false },
  { fileType: 'quotation',         labelAr: 'عرض السعر',           labelEn: 'Quotation',             multiFile: false },
  { fileType: 'section',           labelAr: 'المقاطع',             labelEn: 'Section',               multiFile: false },
  { fileType: 'assembly_list',     labelAr: 'قائمة التجميع',       labelEn: 'Assembly List',         multiFile: false },
  { fileType: 'cut_optimisation',  labelAr: 'تحسين القص',          labelEn: 'Cut Optimisation',      multiFile: false },
  { fileType: 'material_analysis', labelAr: 'تحليل المواد',        labelEn: 'Material Analysis',     multiFile: false },
  { fileType: 'vendor_order',      labelAr: 'أمر مورد',            labelEn: 'Vendor Order',          multiFile: true  },
  { fileType: 'qoyod',             labelAr: 'قيود',                labelEn: 'Qoyod',                 multiFile: true  },
  { fileType: 'other',             labelAr: 'أخرى',               labelEn: 'Other',                 multiFile: true  },
];

interface Phase {
  id: number;
  projectId: number;
  phaseNumber: number;
  label: string | null;
  status: string;
  deliveredAt: string | null;
  installedAt: string | null;
  signedOffAt: string | null;
  customerConfirmed: boolean;
  customerConfirmedAt: string | null;
  notes: string | null;
  createdAt: string;
}

function phaseStatusColor(s: string): string {
  if (s === 'signed_off') return 'bg-teal-50 text-teal-700 border-teal-200';
  if (s === 'installed') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (s === 'delivered') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s === 'manufacturing') return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-[#ECEAE2] text-slate-600 border-[#ECEAE2]';
}

function PhasesSection({ projectId, isRtl, t, user }: { projectId: number; isRtl: boolean; t: (k: string) => string; user: { role: string } | null }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', phaseNumber: '' });
  const [adding, setAdding] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [notesVal, setNotesVal] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const canManage = user?.role === 'Admin' || user?.role === 'FactoryManager' || user?.role === 'Employee';
  const canDelete = user?.role === 'Admin' || user?.role === 'FactoryManager';

  const loadPhases = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${projectId}/phases`);
      if (res.ok) setPhases(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { loadPhases(); }, [projectId]);

  const handleAdd = async () => {
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${projectId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: addForm.label.trim() || null,
          phaseNumber: addForm.phaseNumber ? Number(addForm.phaseNumber) : (phases.length + 1),
        }),
      });
      if (res.ok) { setShowAdd(false); setAddForm({ label: '', phaseNumber: '' }); await loadPhases(); }
    } finally { setAdding(false); }
  };

  const doAction = async (phaseId: number, action: 'deliver' | 'install' | 'signoff') => {
    if (action === 'signoff' && !window.confirm(t('phase_sign_off_confirm'))) return;
    setActionLoading(`${phaseId}-${action}`);
    try {
      const res = await fetch(`${API_BASE}/api/erp/phases/${phaseId}/${action}`, { method: 'PATCH' });
      if (res.ok) await loadPhases();
    } finally { setActionLoading(null); }
  };

  const handleDelete = async (phaseId: number) => {
    if (!window.confirm(t('phase_delete_confirm'))) return;
    setDeletingId(phaseId);
    try {
      const res = await fetch(`${API_BASE}/api/erp/phases/${phaseId}`, { method: 'DELETE' });
      if (res.ok) setPhases(prev => prev.filter(p => p.id !== phaseId));
    } finally { setDeletingId(null); }
  };

  const copyLink = (phaseId: number) => {
    const link = `${window.location.origin}/confirm/${phaseId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(phaseId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const saveNotes = async (phaseId: number) => {
    setSavingNotes(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/phases/${phaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesVal }),
      });
      if (res.ok) { setEditingNotesId(null); await loadPhases(); }
    } finally { setSavingNotes(false); }
  };

  const phaseStatusLabel = (s: string) => ({
    pending: t('phase_status_pending'),
    manufacturing: t('phase_status_manufacturing'),
    delivered: t('phase_status_delivered'),
    installed: t('phase_status_installed'),
    signed_off: t('phase_status_signed_off'),
  }[s] ?? s);

  const isActing = (phaseId: number, action: string) => actionLoading === `${phaseId}-${action}`;

  return (
    <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 mb-4">
      <div className={`flex items-center justify-between gap-3 mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <h2 className={`font-semibold text-[#141A24] ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('phases_title')}</h2>
        {canManage && (
          <button onClick={() => setShowAdd(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}>
            <Plus className="w-3.5 h-3.5" /> {t('phases_add')}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4 p-4 rounded-xl border border-[#ECEAE2] bg-[#F4F2EB] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('phase_number')}</label>
              <input type="number" value={addForm.phaseNumber} onChange={e => setAddForm(f => ({ ...f, phaseNumber: e.target.value }))} placeholder={String(phases.length + 1)} min={1} className="w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40" dir="ltr" />
            </div>
            <div>
              <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('phase_label')}</label>
              <input type="text" value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} className={`w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40 ${isRtl ? 'font-[Tajawal] text-end' : ''}`} />
            </div>
          </div>
          <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button onClick={handleAdd} disabled={adding} className={`px-4 py-2 text-xs font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] disabled:opacity-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {adding ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('erp_create')}
            </button>
            <button onClick={() => setShowAdd(false)} className={`px-4 py-2 text-xs text-slate-400 hover:text-slate-600 rounded-xl hover:bg-[#FAFAF7] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('erp_cancel')}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : phases.length === 0 ? (
        <p className={`text-sm text-slate-400 text-center py-4 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('phases_empty')}</p>
      ) : (
        <div className="space-y-3">
          {phases.map(ph => (
            <div key={ph.id} className="rounded-xl border border-[#ECEAE2] overflow-hidden">
              {/* Phase header */}
              <div className={`flex items-start gap-3 px-4 py-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="w-8 h-8 rounded-lg bg-[#141A24]/8 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[#141A24] font-bold text-sm">{ph.phaseNumber}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`flex items-center gap-2 flex-wrap mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className={`font-semibold text-[#141A24] text-sm ${isRtl ? 'font-[Tajawal]' : ''}`}>
                      {ph.label || `${t('phase_label')} ${ph.phaseNumber}`}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${phaseStatusColor(ph.status)}`}>
                      {phaseStatusLabel(ph.status)}
                    </span>
                    {ph.customerConfirmed ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                        ✓ {t('phase_customer_confirmed')}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F4F2EB] text-slate-400 border border-[#ECEAE2]">
                        {t('phase_awaiting_confirmation')}
                      </span>
                    )}
                  </div>
                  {/* Timestamps */}
                  <div className={`flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    {ph.deliveredAt && <span dir="ltr">{t('phase_delivered_at')}: {new Date(ph.deliveredAt).toLocaleDateString()}</span>}
                    {ph.installedAt && <span dir="ltr">{t('phase_installed_at')}: {new Date(ph.installedAt).toLocaleDateString()}</span>}
                    {ph.signedOffAt && <span dir="ltr">{t('phase_signed_off_at')}: {new Date(ph.signedOffAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                {canDelete && (
                  <button onClick={() => handleDelete(ph.id)} disabled={deletingId === ph.id} className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors shrink-0 disabled:opacity-50">
                    {deletingId === ph.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* Action buttons */}
              {canManage && ph.status !== 'signed_off' && (
                <div className={`flex items-center gap-2 px-4 pb-3 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {ph.status === 'pending' || ph.status === 'manufacturing' ? (
                    <button onClick={() => doAction(ph.id, 'deliver')} disabled={!!actionLoading} className={`px-3 py-1.5 text-xs font-semibold border border-[#EEDDB0] text-[#9A6B0E] bg-[#FBF0D6] rounded-xl hover:bg-[#FBF0D6] disabled:opacity-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
                      {isActing(ph.id, 'deliver') ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('phase_mark_delivered')}
                    </button>
                  ) : null}
                  {ph.status === 'delivered' && (
                    <button onClick={() => doAction(ph.id, 'install')} disabled={!!actionLoading} className={`px-3 py-1.5 text-xs font-semibold border border-[#CFDEEF] text-[#1E508C] bg-[#E1ECF7] rounded-xl hover:bg-[#E1ECF7] disabled:opacity-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
                      {isActing(ph.id, 'install') ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('phase_mark_installed')}
                    </button>
                  )}
                  {ph.status === 'installed' && (
                    <button onClick={() => doAction(ph.id, 'signoff')} disabled={!!actionLoading} className={`px-3 py-1.5 text-xs font-semibold border border-[#BFDDD9] text-[#0E6E6A] bg-[#DCEFEC] rounded-xl hover:bg-[#DCEFEC] disabled:opacity-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
                      {isActing(ph.id, 'signoff') ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('phase_sign_off')}
                    </button>
                  )}
                </div>
              )}

              {/* Notes + Copy Link row */}
              <div className={`flex items-center gap-2 px-4 pb-3 border-t border-slate-50 pt-2 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
                {editingNotesId === ph.id ? (
                  <div className={`flex-1 flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <input
                      type="text"
                      value={notesVal}
                      onChange={e => setNotesVal(e.target.value)}
                      className={`flex-1 px-2 py-1 text-xs border border-[#ECEAE2] rounded-lg focus:outline-none focus:border-[#141A24]/40 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}
                    />
                    <button onClick={() => saveNotes(ph.id)} disabled={savingNotes} className="px-2 py-1 text-xs bg-[#141A24] text-white rounded-lg hover:bg-[#0B1019] disabled:opacity-50">
                      {savingNotes ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '✓'}
                    </button>
                    <button onClick={() => setEditingNotesId(null)} className="px-2 py-1 text-xs text-slate-400 rounded-lg hover:bg-[#ECEAE2]">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingNotesId(ph.id); setNotesVal(ph.notes ?? ''); }}
                    className={`text-xs text-slate-400 hover:text-slate-600 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
                  >
                    {ph.notes ? ph.notes : `+ ${t('phase_notes')}`}
                  </button>
                )}
                <button
                  onClick={() => copyLink(ph.id)}
                  className={`ms-auto flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-500 hover:text-[#141A24] border border-[#ECEAE2] rounded-lg hover:border-[#1B2A4A]/30 transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
                >
                  {copiedId === ph.id ? (
                    <CheckCircle2 className="w-3 h-3 text-teal-500" />
                  ) : (
                    <Circle className="w-3 h-3" />
                  )}
                  {copiedId === ph.id ? t('phase_link_copied') : t('phase_copy_link')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WarrantySection({ project, isRtl, t }: { project: { warrantyStartDate?: string | null; warrantyEndDate?: string | null; warrantyMonths?: number | null; stageInternal?: number } | null; isRtl: boolean; t: (k: string) => string }) {
  if (!project?.warrantyStartDate) return null;

  const today = new Date();
  const endDate = project.warrantyEndDate ? new Date(project.warrantyEndDate) : null;
  const isActive = endDate ? endDate >= today : true;

  let monthsRemaining: number | null = null;
  if (endDate && isActive) {
    const diff = (endDate.getFullYear() - today.getFullYear()) * 12 + (endDate.getMonth() - today.getMonth());
    monthsRemaining = Math.max(0, diff);
  }

  return (
    <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 mb-4">
      <h2 className={`font-semibold text-[#141A24] mb-3 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('warranty_title')}</h2>
      <div className="space-y-2">
        <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${isActive ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-[#ECEAE2] text-slate-500 border-[#ECEAE2]'}`}>
            {isActive ? t('warranty_active') : t('warranty_expired')}
          </span>
        </div>
        <div className={`grid grid-cols-2 gap-3 text-xs text-slate-600 mt-2 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
          <div>
            <p className="text-slate-400 mb-0.5">{t('warranty_start')}</p>
            <p className="font-medium" dir="ltr">{project.warrantyStartDate}</p>
          </div>
          {endDate && (
            <div>
              <p className="text-slate-400 mb-0.5">{t('warranty_end')}</p>
              <p className="font-medium" dir="ltr">{project.warrantyEndDate}</p>
            </div>
          )}
          {monthsRemaining !== null && (
            <div>
              <p className="text-slate-400 mb-0.5">{t('warranty_months_remaining')}</p>
              <p className="font-medium" dir="ltr">{monthsRemaining}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface PO {
  id: number;
  vendorId: number;
  vendorName?: string;
  status: string;
  totalAmount: number | null;
  amountPaid: number | null;
  notes: string | null;
  createdAt: string;
}

interface POItem {
  id: number;
  poId: number;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  receivedQuantity: number;
  status: string;
}

interface ManufacturingOrder {
  id: number;
  projectId: number;
  status: string;
  deliveryDeadline: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface VendorOption { id: number; name: string; }

function poStatusColor(s: string) {
  if (s === 'received') return 'bg-teal-50 text-teal-700 border-teal-200';
  if (s === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s === 'sent') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-[#ECEAE2] text-slate-600 border-[#ECEAE2]';
}
function mfgStatusColor(s: string) {
  if (s === 'ready') return 'bg-teal-50 text-teal-700 border-teal-200';
  if (s === 'in_progress') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-[#ECEAE2] text-slate-600 border-[#ECEAE2]';
}

function ProcurementSection({ projectId, isRtl, t, user }: { projectId: number; isRtl: boolean; t: (k: string) => string; user: { role: string } | null }) {
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ vendorId: '', notes: '' });
  const [creating, setCreating] = useState(false);
  const [expandedPo, setExpandedPo] = useState<number | null>(null);
  const [poItems, setPoItems] = useState<Record<number, POItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<number | null>(null);
  const [showAddItem, setShowAddItem] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState({ description: '', category: 'Aluminum', quantity: '1', unit: 'pcs', unitPrice: '' });
  const [addingItem, setAddingItem] = useState(false);
  const [receivingItem, setReceivingItem] = useState<number | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [deletingPoId, setDeletingPoId] = useState<number | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);

  const canManage = user?.role === 'Admin' || user?.role === 'FactoryManager' || user?.role === 'Employee';
  const canDelete = user?.role === 'Admin' || user?.role === 'FactoryManager';

  const loadPos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${projectId}/purchase-orders`);
      if (res.ok) setPos(await res.json());
    } finally { setLoading(false); }
  };

  const loadVendors = async () => {
    const res = await fetch(`${API_BASE}/api/erp/vendors`);
    if (res.ok) setVendors(await res.json());
  };

  useEffect(() => { loadPos(); loadVendors(); }, [projectId]);

  const handleCreate = async () => {
    if (!createForm.vendorId) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${projectId}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId: Number(createForm.vendorId), notes: createForm.notes || undefined }),
      });
      if (res.ok) { setShowCreate(false); setCreateForm({ vendorId: '', notes: '' }); await loadPos(); }
    } finally { setCreating(false); }
  };

  const toggleExpand = async (poId: number) => {
    if (expandedPo === poId) { setExpandedPo(null); return; }
    setExpandedPo(poId);
    if (!poItems[poId]) {
      setLoadingItems(poId);
      try {
        const res = await fetch(`${API_BASE}/api/erp/purchase-orders/${poId}`);
        if (res.ok) { const d = await res.json(); setPoItems(p => ({ ...p, [poId]: d.items ?? [] })); }
      } finally { setLoadingItems(null); }
    }
  };

  const refreshPo = async (poId: number) => {
    const res = await fetch(`${API_BASE}/api/erp/purchase-orders/${poId}`);
    if (res.ok) {
      const d = await res.json();
      setPoItems(p => ({ ...p, [poId]: d.items ?? [] }));
      setPos(prev => prev.map(po => po.id === poId ? { ...po, status: d.status, totalAmount: d.totalAmount, amountPaid: d.amountPaid } : po));
    }
  };

  const handleAddItem = async (poId: number) => {
    if (!itemForm.description.trim()) return;
    setAddingItem(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/purchase-orders/${poId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: itemForm.description,
          category: itemForm.category,
          quantity: Number(itemForm.quantity) || 1,
          unit: itemForm.unit,
          unitPrice: itemForm.unitPrice ? Number(itemForm.unitPrice) : undefined,
        }),
      });
      if (res.ok) { setShowAddItem(null); setItemForm({ description: '', category: 'Aluminum', quantity: '1', unit: 'pcs', unitPrice: '' }); await refreshPo(poId); }
    } finally { setAddingItem(false); }
  };

  const handleReceive = async (itemId: number, poId: number) => {
    const qty = Number(receiveQty);
    if (!qty || qty < 1) return;
    setReceivingItem(itemId);
    try {
      const res = await fetch(`${API_BASE}/api/erp/po-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedQuantity: qty }),
      });
      if (res.ok) { setReceivingItem(null); setReceiveQty(''); await refreshPo(poId); await loadPos(); }
    } finally { setReceivingItem(null); }
  };

  const handleDeletePo = async (poId: number) => {
    if (!window.confirm(t('po_delete_confirm'))) return;
    setDeletingPoId(poId);
    try {
      const res = await fetch(`${API_BASE}/api/erp/purchase-orders/${poId}`, { method: 'DELETE' });
      if (res.ok) { setPos(p => p.filter(po => po.id !== poId)); if (expandedPo === poId) setExpandedPo(null); }
    } finally { setDeletingPoId(null); }
  };

  const handleDeleteItem = async (itemId: number, poId: number) => {
    if (!window.confirm(t('po_item_delete_confirm'))) return;
    setDeletingItemId(itemId);
    try {
      const res = await fetch(`${API_BASE}/api/erp/po-items/${itemId}`, { method: 'DELETE' });
      if (res.ok) { await refreshPo(poId); }
    } finally { setDeletingItemId(null); }
  };

  const poStatusLabel = (s: string) => ({ pending: t('po_status_pending'), sent: t('po_status_sent'), partial: t('po_status_partial'), received: t('po_status_received') }[s] ?? s);

  return (
    <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 mb-4">
      <div className={`flex items-center justify-between gap-3 mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <h2 className={`font-semibold text-[#141A24] ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('procurement_title')}</h2>
        {canManage && vendors.length > 0 && (
          <button onClick={() => setShowCreate(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}>
            <Plus className="w-3.5 h-3.5" /> {t('po_create')}
          </button>
        )}
      </div>

      {/* Create PO form */}
      {showCreate && (
        <div className="mb-4 p-4 rounded-xl border border-[#ECEAE2] bg-[#F4F2EB] space-y-3">
          <div>
            <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('po_vendor')} *</label>
            <select
              value={createForm.vendorId}
              onChange={e => setCreateForm(f => ({ ...f, vendorId: e.target.value }))}
              className={`w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl bg-[#FAFAF7] focus:outline-none focus:border-[#141A24]/40 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}
            >
              <option value="">{t('po_select_vendor')}</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('po_notes')}</label>
            <input type="text" value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} className={`w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40 ${isRtl ? 'font-[Tajawal] text-end' : ''}`} />
          </div>
          <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button onClick={handleCreate} disabled={creating || !createForm.vendorId} className={`px-4 py-2 text-xs font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] disabled:opacity-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {creating ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('erp_create')}
            </button>
            <button onClick={() => setShowCreate(false)} className={`px-4 py-2 text-xs text-slate-400 hover:text-slate-600 rounded-xl hover:bg-[#FAFAF7] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('erp_cancel')}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : pos.length === 0 ? (
        <p className={`text-sm text-slate-400 text-center py-4 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('po_no_pos')}</p>
      ) : (
        <div className="space-y-3">
          {pos.map(po => (
            <div key={po.id} className="rounded-xl border border-[#ECEAE2] overflow-hidden">
              {/* PO header row */}
              <div className={`flex items-center gap-3 px-4 py-3 bg-[#F4F2EB] ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className={`flex items-center gap-2 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className={`text-sm font-semibold text-[#141A24] ${isRtl ? 'font-[Tajawal]' : ''}`}>{po.vendorName ?? `#${po.id}`}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${poStatusColor(po.status)}`}>{poStatusLabel(po.status)}</span>
                  </div>
                  {po.totalAmount != null && (
                    <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{po.totalAmount.toLocaleString()} {t('erp_payment_sar')}</p>
                  )}
                </div>
                <div className={`flex items-center gap-1 shrink-0 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <button onClick={() => toggleExpand(po.id)} className={`flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-[#141A24] hover:bg-[#FAFAF7] rounded-lg transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
                    {t('po_expand_items')} {expandedPo === po.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {canDelete && (
                    <button onClick={() => handleDeletePo(po.id)} disabled={deletingPoId === po.id} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                      {deletingPoId === po.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* PO items */}
              {expandedPo === po.id && (
                <div className="border-t border-[#ECEAE2] px-4 py-3 space-y-2">
                  {loadingItems === po.id ? (
                    <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                  ) : (poItems[po.id] ?? []).length === 0 ? (
                    <p className={`text-xs text-slate-400 text-center py-2 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('po_no_items')}</p>
                  ) : (
                    (poItems[po.id] ?? []).map(item => (
                      <div key={item.id} className={`flex items-start gap-3 py-2 border-b border-slate-50 last:border-0 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm text-slate-700 ${isRtl ? 'font-[Tajawal]' : ''}`}>{item.description}</p>
                          <p className="text-xs text-slate-400 mt-0.5" dir="ltr">
                            {item.quantity} {item.unit}
                            {item.unitPrice != null && ` · ${item.unitPrice.toLocaleString()} ${t('erp_payment_sar')}`}
                            {` · ${t('po_item_received_qty')}: ${item.receivedQuantity}/${item.quantity}`}
                          </p>
                        </div>
                        <div className={`flex items-center gap-1.5 shrink-0 ${isRtl ? 'flex-row-reverse' : ''}`}>
                          {item.status !== 'received' && canManage && (
                            receivingItem === item.id ? (
                              <div className={`flex items-center gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                <input
                                  type="number"
                                  value={receiveQty}
                                  onChange={e => setReceiveQty(e.target.value)}
                                  min={1}
                                  max={item.quantity - item.receivedQuantity}
                                  className="w-14 px-2 py-1 text-xs border border-[#ECEAE2] rounded-lg focus:outline-none focus:border-[#141A24]/40"
                                  dir="ltr"
                                />
                                <button onClick={() => handleReceive(item.id, po.id)} className="px-2 py-1 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                                  ✓
                                </button>
                                <button onClick={() => { setReceivingItem(null); setReceiveQty(''); }} className="px-2 py-1 text-xs text-slate-400 rounded-lg hover:bg-[#ECEAE2] transition-colors">
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => { setReceivingItem(item.id); setReceiveQty(String(item.quantity - item.receivedQuantity)); }} className={`px-2 py-1 text-xs font-semibold text-teal-600 hover:text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
                                {t('po_mark_received')}
                              </button>
                            )
                          )}
                          {canDelete && (
                            <button onClick={() => handleDeleteItem(item.id, po.id)} disabled={deletingItemId === item.id} className="p-1 text-slate-300 hover:text-red-400 rounded transition-colors disabled:opacity-50">
                              {deletingItemId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Add item form */}
                  {canManage && showAddItem === po.id ? (
                    <div className="mt-3 pt-3 border-t border-[#ECEAE2] space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder={t('po_item_description')} className={`col-span-2 px-3 py-2 text-xs border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40 ${isRtl ? 'font-[Tajawal] text-end' : ''}`} />
                        <select value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))} className={`px-3 py-2 text-xs border border-[#ECEAE2] rounded-xl bg-[#FAFAF7] focus:outline-none focus:border-[#141A24]/40 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
                          {['Aluminum','Glass','Accessories','Special Parts'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} className="px-3 py-2 text-xs border border-[#ECEAE2] rounded-xl bg-[#FAFAF7] focus:outline-none focus:border-[#141A24]/40" dir="ltr">
                          {['pcs','m²','kg','m'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input type="number" value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))} placeholder={t('po_item_qty')} min={1} className="px-3 py-2 text-xs border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40" dir="ltr" />
                        <input type="number" value={itemForm.unitPrice} onChange={e => setItemForm(f => ({ ...f, unitPrice: e.target.value }))} placeholder={t('po_item_unit_price')} className="px-3 py-2 text-xs border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40" dir="ltr" />
                      </div>
                      <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <button onClick={() => handleAddItem(po.id)} disabled={addingItem || !itemForm.description.trim()} className={`px-3 py-1.5 text-xs font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] disabled:opacity-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
                          {addingItem ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('erp_save')}
                        </button>
                        <button onClick={() => setShowAddItem(null)} className={`px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 rounded-xl hover:bg-[#ECEAE2] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('erp_cancel')}</button>
                      </div>
                    </div>
                  ) : canManage && (
                    <button onClick={() => setShowAddItem(po.id)} className={`mt-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#141A24] transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}>
                      <Plus className="w-3.5 h-3.5" /> {t('po_add_item')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ManufacturingSection({ projectId, isRtl, t, user }: { projectId: number; isRtl: boolean; t: (k: string) => string; user: { role: string } | null }) {
  const [order, setOrder] = useState<ManufacturingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendForm, setSendForm] = useState({ deliveryDeadline: '', notes: '' });
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const canManage = user?.role === 'Admin' || user?.role === 'FactoryManager';

  const loadOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${projectId}/manufacturing`);
      if (res.ok) { const d = await res.json(); setOrder(d.length ? d[0] : null); }
    } finally { setLoading(false); }
  };

  useEffect(() => { loadOrder(); }, [projectId]);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${projectId}/manufacturing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryDeadline: sendForm.deliveryDeadline || undefined, notes: sendForm.notes || undefined }),
      });
      if (res.ok) await loadOrder();
    } finally { setSending(false); }
  };

  const handleUpdate = async (status: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/manufacturing/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await loadOrder();
    } finally { setUpdating(false); }
  };

  const mfgStatusLabel = (s: string) => ({ pending: t('manufacturing_status_pending'), in_progress: t('manufacturing_status_in_progress'), ready: t('manufacturing_status_ready') }[s] ?? s);

  return (
    <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 mb-4">
      <h2 className={`font-semibold text-[#141A24] mb-4 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('manufacturing_title')}</h2>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : order ? (
        <div className="space-y-3">
          <div className={`flex items-center gap-3 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${mfgStatusColor(order.status)}`}>
              {mfgStatusLabel(order.status)}
            </span>
            {order.deliveryDeadline && (
              <span className="text-xs text-slate-400" dir="ltr">{t('manufacturing_deadline')}: {order.deliveryDeadline}</span>
            )}
            {order.updatedAt && (
              <span className="text-xs text-slate-400" dir="ltr">{t('manufacturing_updated_at')}: {new Date(order.updatedAt).toLocaleDateString()}</span>
            )}
          </div>
          {order.notes && (
            <p className={`text-sm text-slate-600 bg-[#F4F2EB] rounded-xl p-3 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{order.notes}</p>
          )}
          {canManage && (
            <div className={`flex gap-2 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
              {order.status === 'pending' && (
                <button onClick={() => handleUpdate('in_progress')} disabled={updating} className={`px-4 py-2 text-xs font-semibold bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
                  {updating ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('start_manufacturing')}
                </button>
              )}
              {order.status === 'in_progress' && (
                <button onClick={() => handleUpdate('ready')} disabled={updating} className={`px-4 py-2 text-xs font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
                  {updating ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('complete_manufacturing')}
                </button>
              )}
            </div>
          )}
        </div>
      ) : canManage ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('manufacturing_deadline')}</label>
              <input type="date" value={sendForm.deliveryDeadline} onChange={e => setSendForm(f => ({ ...f, deliveryDeadline: e.target.value }))} className="w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40" dir="ltr" />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-medium text-slate-600 mb-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{t('manufacturing_notes')}</label>
            <textarea value={sendForm.notes} onChange={e => setSendForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-xl focus:outline-none focus:border-[#141A24]/40 resize-none ${isRtl ? 'font-[Tajawal] text-end' : ''}`} />
          </div>
          <button onClick={handleSend} disabled={sending} className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] disabled:opacity-50 transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {t('send_to_manufacturing')}
          </button>
        </div>
      ) : (
        <p className={`text-sm text-slate-400 text-center py-4 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('manufacturing_no_order')}</p>
      )}
    </div>
  );
}

export default function ErpProjectDetail() {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams() as { id: string };
  const id = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFileType, setPendingFileType] = useState<string>('');
  const [glassDetect, setGlassDetect] = useState<GlassDetectResult | null>(null);
  const [qrOrders, setQrOrders] = useState<QROrder[]>([]);
  const [loadingQrOrders, setLoadingQrOrders] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [nameMismatch, setNameMismatch] = useState<NameMismatchData | null>(null);
  const [parsedAssemblyList, setParsedAssemblyList] = useState<ParsedAssemblyList | null>(null);
  const [parsedCutOptimisation, setParsedCutOptimisation] = useState<ParsedCutOptimisation | null>(null);
  const [milestones, setMilestones] = useState<PaymentMilestone[]>([]);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ label: '', percentage: '', amount: '', dueDate: '', notes: '' });
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [payingMilestoneId, setPayingMilestoneId] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ paidAmount: '', notes: '', file: null as File | null });
  const [markingPaid, setMarkingPaid] = useState(false);
  const payFileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState<number | null>(null);

  // Smart batch upload
  const batchInputRef = useRef<HTMLInputElement>(null);
  const [detectionItems, setDetectionItems] = useState<DetectionItem[]>([]);
  const [detectingBatch, setDetectingBatch] = useState(false);
  const [uploadingBatch, setUploadingBatch] = useState(false);

  // All files including inactive (for version history)
  const [allFiles, setAllFiles] = useState<ProjectFile[]>([]);

  // Which single-file slots have their version history expanded
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const canDelete = user?.role === 'Admin' || user?.role === 'FactoryManager';

  const canUpload = user?.role !== 'SalesAgent' && user?.role !== 'Accountant';
  const canManagePayments = user?.role === 'Admin' || user?.role === 'Accountant';
  const canCreateMilestone = user?.role === 'Admin' || user?.role === 'FactoryManager' || user?.role === 'SalesAgent';

  const loadProject = async () => {
    if (!project) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        setNotes(data.notes ?? '');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadQrOrders = async () => {
    setLoadingQrOrders(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${id}/qr-orders`);
      if (res.ok) setQrOrders(await res.json());
    } finally {
      setLoadingQrOrders(false);
    }
  };

  const loadParsedData = async () => {
    const [alRes, coRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/erp/projects/${id}/parsed-assembly-list`),
      fetch(`${API_BASE}/api/erp/projects/${id}/parsed-cut-optimisation`),
    ]);
    if (alRes.status === 'fulfilled' && alRes.value.ok) {
      setParsedAssemblyList(await alRes.value.json());
    } else {
      setParsedAssemblyList(null);
    }
    if (coRes.status === 'fulfilled' && coRes.value.ok) {
      setParsedCutOptimisation(await coRes.value.json());
    } else {
      setParsedCutOptimisation(null);
    }
  };

  const loadMilestones = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${id}/payments`);
      if (res.ok) setMilestones(await res.json());
    } catch {}
  };

  useEffect(() => { loadProject(); loadQrOrders(); loadParsedData(); loadMilestones(); loadAllFiles(); }, [id]);

  const completionPct = (m: PaymentMilestone): number | null => {
    if (!m.paidAmount || !m.amount || m.amount === 0) return null;
    return Math.min(100, Math.round((m.paidAmount / m.amount) * 100));
  };

  const handleAddMilestone = async () => {
    if (!milestoneForm.label.trim()) return;
    setSavingMilestone(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: milestoneForm.label,
          percentage: milestoneForm.percentage ? Number(milestoneForm.percentage) : undefined,
          amount: milestoneForm.amount ? Number(milestoneForm.amount) : undefined,
          dueDate: milestoneForm.dueDate || undefined,
          notes: milestoneForm.notes || undefined,
        }),
      });
      if (res.ok) {
        setShowAddMilestone(false);
        setMilestoneForm({ label: '', percentage: '', amount: '', dueDate: '', notes: '' });
        await loadMilestones();
      }
    } finally {
      setSavingMilestone(false);
    }
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
        setPayingMilestoneId(null);
        setPayForm({ paidAmount: '', notes: '', file: null });
        await loadMilestones();
        await loadProject();
      }
    } finally {
      setMarkingPaid(false);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await fetch(`${API_BASE}/api/erp/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      setEditingNotes(false);
      await loadProject();
    } finally {
      setSavingNotes(false);
    }
  };

  const triggerUpload = (fileType: string) => {
    if (fileInputRef.current) {
      const isMulti = ['vendor_order', 'qoyod', 'other'].includes(fileType);
      fileInputRef.current.accept = isMulti ? '*/*' : '.docx';
    }
    setPendingFileType(fileType);
    fileInputRef.current?.click();
  };

  const uploadFile = async (file: File, fileType: string, extraQuery = '') => {
    setUploadingFor(fileType);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fileType', fileType);
      const res = await fetch(
        `${API_BASE}/api/erp/projects/${id}/files${extraQuery}`,
        { method: 'POST', body: fd }
      );
      if (res.status === 409 && (fileType === 'price_quotation' || fileType === 'quotation')) {
        const conflict = await res.json();
        setNameMismatch({ nameInFile: conflict.nameInFile, nameInSystem: conflict.nameInSystem, pendingFile: file, fileType });
        return;
      }
      if (res.status === 409 && fileType === 'glass_order') {
        const conflict = await res.json();
        setGlassDetect({ orgadataName: conflict.orgadataName ?? '', orgadataPerson: null, pendingFile: file, nameMatches: false });
        return;
      }
      const scrollY = window.scrollY;
      if (fileType === 'glass_order') {
        await loadQrOrders();
        await loadProject();
      } else {
        await loadProject();
        if (fileType === 'assembly_list' || fileType === 'cut_optimisation') {
          await loadParsedData();
        }
      }
      await loadAllFiles();
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    } finally {
      setUploadingFor(null);
      setPendingFileType('');
    }
  };

  const handleNameMismatchChoice = async (choice: NameMismatchChoice) => {
    if (!nameMismatch) return;
    const { pendingFile } = nameMismatch;
    setNameMismatch(null);
    if (choice === 'cancel') return;
    const params = choice === 'proceedAndUpdate'
      ? '?confirmNameMismatch=true&updateProjectName=true'
      : '?confirmNameMismatch=true';
    await uploadFile(pendingFile, nameMismatch.fileType, params);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingFileType) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Always use the slot's fileType directly — never auto-detect from filename
    await uploadFile(file, pendingFileType);
  };

  const handleGlassConfirm = async (updateName: boolean) => {
    if (!glassDetect) return;
    const { pendingFile } = glassDetect;
    setGlassDetect(null);
    await uploadFile(pendingFile, 'glass_order', `?confirm=true&updateName=${updateName}`);
    if (updateName) {
      const scrollY = window.scrollY;
      await loadProject();
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    }
  };

  const downloadFile = (fileId: number, filename: string) => {
    const a = document.createElement('a');
    a.href = `${API_BASE}/api/erp/projects/${id}/files/${fileId}`;
    a.download = filename;
    a.click();
  };

  const deleteFile = async (fileId: number) => {
    setConfirmDeleteFileId(null);
    setDeletingFileId(fileId);
    try {
      await fetch(`${API_BASE}/api/erp/projects/${id}/files/${fileId}`, { method: 'DELETE' });
      const scrollY = window.scrollY;
      await loadProject();
      await loadAllFiles();
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleDeleteProject = async () => {
    setDeletingProject(true);
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${id}`, { method: 'DELETE' });
      if (res.ok) navigate('/erp/projects');
    } finally {
      setDeletingProject(false);
    }
  };

  const loadAllFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/erp/projects/${id}/files?includeInactive=true`);
      if (res.ok) setAllFiles(await res.json());
    } catch {}
  };

  const handleBatchSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (batchInputRef.current) batchInputRef.current.value = '';
    setDetectingBatch(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      const res = await fetch(`${API_BASE}/api/erp/projects/${id}/files/detect`, {
        method: 'POST',
        body: fd,
      });
      if (res.ok) {
        const results: { filename: string; size: number; detectedType: string | null; confidence: 'high' | 'low' }[] = await res.json();
        const items: DetectionItem[] = results.map((r, i) => ({
          filename: r.filename,
          size: r.size,
          file: files[i],
          detectedType: r.detectedType,
          confidence: r.confidence,
          assignedType: r.detectedType ?? 'other',
        }));
        setDetectionItems(items);
      }
    } finally {
      setDetectingBatch(false);
    }
  };

  const updateDetectionItem = (idx: number, assignedType: string) => {
    setDetectionItems(prev => prev.map((item, i) => i === idx ? { ...item, assignedType } : item));
  };

  const handleUploadAll = async () => {
    if (!detectionItems.length) return;
    setUploadingBatch(true);
    const scrollY = window.scrollY;
    try {
      for (const item of detectionItems) {
        await uploadFile(item.file, item.assignedType);
      }
      setDetectionItems([]);
      await loadAllFiles();
      requestAnimationFrame(() => window.scrollTo(0, scrollY));
    } finally {
      setUploadingBatch(false);
    }
  };

  const inactiveFor = (fileType: string): ProjectFile[] =>
    allFiles.filter(f => f.fileType === fileType && f.isActive === false);

  const labelForType = (fileType: string): string => {
    const slot = FILE_SLOTS.find(s => s.fileType === fileType);
    if (!slot) return fileType;
    return isRtl ? slot.labelAr : slot.labelEn;
  };

  const fileFor = (fileType: string) =>
    project?.files.find(f => f.fileType === fileType || (fileType === 'quotation' && f.fileType === 'price_quotation')) ?? null;

  const stageStyle = STAGE_DISPLAY_STYLES[project?.stageDisplay ?? 'new'] ?? STAGE_DISPLAY_STYLES.new;

  const stageDisplayLabel: Record<string, string> = {
    new:           t('erp_project_stage_new'),
    in_study:      t('erp_project_stage_study'),
    in_production: t('erp_project_stage_production'),
    complete:      t('erp_project_stage_complete'),
  };

  if (loading) {
    return <AdminLayout><div className="p-6 text-center text-slate-400">{t('processing')}</div></AdminLayout>;
  }
  if (!project) {
    return <AdminLayout><div className="p-6 text-center text-slate-400">404</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>

        {/* Back */}
        <button
          onClick={() => navigate('/erp/projects')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#141A24] mb-4 transition-colors"
        >
          <BackIcon className="w-4 h-4" />
          {t('erp_projects_title')}
        </button>

        {/* Project Header Card */}
        <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 mb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl font-bold text-[#141A24]">{project.name}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{project.customerName}</p>
              {project.phone && <p className="text-slate-400 text-xs mt-0.5" dir="ltr">{project.phone}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                {stageDisplayLabel[project.stageDisplay] ?? project.stageDisplay}
              </span>
              {canDelete && (
                <button
                  onClick={() => setShowDeleteProject(true)}
                  className="p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title={t('del_btn')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {project.productInterest && (
              <div>
                <dt className="text-slate-400">{t('erp_lead_product')}</dt>
                <dd className="font-medium text-slate-700 mt-0.5">{project.productInterest}</dd>
              </div>
            )}
            {project.buildingType && (
              <div>
                <dt className="text-slate-400">{t('erp_lead_building')}</dt>
                <dd className="font-medium text-slate-700 mt-0.5">{project.buildingType}</dd>
              </div>
            )}
            {project.location && (
              <div>
                <dt className="text-slate-400">{t('erp_lead_location')}</dt>
                <dd className="font-medium text-slate-700 mt-0.5">{project.location}</dd>
              </div>
            )}
            {project.estimatedValue && (
              <div>
                <dt className="text-slate-400">{t('erp_lead_value')}</dt>
                <dd className="font-medium text-slate-700 mt-0.5" dir="ltr">{project.estimatedValue.toLocaleString()} SAR</dd>
              </div>
            )}
            {project.deliveryDeadline && (
              <div>
                <dt className="text-slate-400">{t('erp_project_deadline')}</dt>
                <dd className="font-medium text-slate-700 mt-0.5" dir="ltr">{project.deliveryDeadline}</dd>
              </div>
            )}
            {project.fromLeadId && (
              <div>
                <dt className="text-slate-400 mb-0.5">{t('erp_from_lead')}</dt>
                <dd>
                  <button
                    onClick={() => navigate(`/erp/leads/${project.fromLeadId}`)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-800 hover:underline underline-offset-2 transition-colors"
                  >
                    {t('erp_view_lead')}
                  </button>
                </dd>
              </div>
            )}
          </dl>

          {/* Notes */}
          <div className="mt-4 pt-4 border-t border-[#ECEAE2]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">{t('erp_project_notes')}</span>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="text-xs text-[#141A24] hover:underline">
                  {t('erp_save')}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setEditingNotes(false); setNotes(project.notes ?? ''); }} className="px-3 py-1.5 text-sm text-slate-500 hover:bg-[#ECEAE2] rounded-lg">{t('erp_cancel')}</button>
                  <button onClick={saveNotes} disabled={savingNotes} className="px-4 py-1.5 text-sm font-semibold bg-[#141A24] text-white rounded-lg hover:bg-[#0B1019] disabled:opacity-50">{savingNotes ? '...' : t('erp_save')}</button>
                </div>
              </div>
            ) : (
              <p
                className="text-sm text-slate-600 cursor-pointer hover:text-slate-800 min-h-[2rem]"
                onClick={() => setEditingNotes(true)}
              >
                {project.notes || <span className="text-slate-300 italic">{t('erp_project_notes')}...</span>}
              </p>
            )}
          </div>
        </div>

        {/* Stage Timeline */}
        <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 mb-4">
          <h2 className="font-semibold text-[#141A24] mb-4">{t('erp_stage_timeline')}</h2>
          <ol className="space-y-2">
            {INTERNAL_STAGES.map(stage => {
              const done = project.stageInternal > stage.n;
              const current = project.stageInternal === stage.n;
              return (
                <li key={stage.n} className={`flex items-center gap-3 text-sm py-1.5 px-3 rounded-xl transition-colors ${current ? 'bg-[#141A24]/5 font-semibold' : ''}`}>
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                  ) : current ? (
                    <div className="w-4 h-4 rounded-full border-2 border-[#C89B3C] bg-[#C89B3C]/20 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-200 shrink-0" />
                  )}
                  <span className={done ? 'text-slate-400 line-through' : current ? 'text-[#141A24]' : 'text-slate-400'}>
                    {isRtl ? stage.labelAr : stage.labelEn}
                  </span>
                  {stage.type === 'iterative' && (
                    <RotateCcw className="w-3 h-3 text-amber-400 shrink-0" />
                  )}
                  {stage.type === 'parallel' && (
                    <ArrowLeftRight className="w-3 h-3 text-blue-400 shrink-0" />
                  )}
                  {stage.type === 'continuous' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-500 border border-purple-100 shrink-0">مستمر</span>
                  )}
                  <span className="ms-auto text-slate-300 text-xs">{stage.n}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Files Section */}
        <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#141A24]">{t('erp_project_files')}</h2>
            {canUpload && (
              <button
                onClick={() => batchInputRef.current?.click()}
                disabled={detectingBatch || uploadingBatch}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#141A24] border border-[#ECEAE2] hover:bg-[#F4F2EB] transition-colors disabled:opacity-40"
              >
                {detectingBatch ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderOpen className="w-3 h-3" />}
                {t('files_batch_select')}
              </button>
            )}
          </div>

          {/* Hidden file inputs */}
          <input ref={fileInputRef} type="file" className="hidden" accept=".docx" onChange={handleFileChange} />
          <input ref={batchInputRef} type="file" className="hidden" accept=".docx" multiple onChange={handleBatchSelect} />

          {/* Batch detection summary */}
          {detectionItems.length > 0 && (
            <div className="mb-4 rounded-xl border border-[#ECEAE2] bg-[#F4F2EB] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#ECEAE2]">
                <span className="text-sm font-semibold text-[#141A24]">
                  {t('files_detect_summary').replace('{count}', String(detectionItems.length))}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setDetectionItems([])} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-[#FAFAF7] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleUploadAll}
                    disabled={uploadingBatch}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#141A24] text-white hover:bg-[#0B1019] disabled:opacity-40 transition-colors"
                  >
                    {uploadingBatch ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {t('files_upload_all')}
                  </button>
                </div>
              </div>
              <div className="divide-y divide-[#ECEAE2]">
                {detectionItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5 bg-[#FAFAF7]">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="flex-1 min-w-0 text-xs text-slate-700 truncate" dir="ltr">{item.filename}</span>
                    {item.confidence === 'high' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-600 border border-teal-100 shrink-0">
                        {t('files_detect_high')}
                      </span>
                    )}
                    <select
                      value={item.assignedType}
                      onChange={e => updateDetectionItem(idx, e.target.value)}
                      className="text-xs border border-[#ECEAE2] rounded-lg px-2 py-1 bg-[#FAFAF7] focus:outline-none focus:ring-1 focus:ring-[#141A24]/20 shrink-0"
                      dir="ltr"
                    >
                      {FILE_SLOTS.map(s => (
                        <option key={s.fileType} value={s.fileType}>{isRtl ? s.labelAr : s.labelEn}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {FILE_SLOTS.map(slot => {
              const isUploading = uploadingFor === slot.fileType;
              const label = isRtl ? slot.labelAr : slot.labelEn;
              const inactive = inactiveFor(slot.fileType);
              const versionsExpanded = expandedVersions.has(slot.fileType);

              const toggleVersions = () => setExpandedVersions(prev => {
                const next = new Set(prev);
                if (next.has(slot.fileType)) next.delete(slot.fileType); else next.add(slot.fileType);
                return next;
              });

              if (slot.multiFile) {
                const slotFiles = project?.files.filter(f => f.fileType === slot.fileType) ?? [];
                return (
                  <div key={slot.fileType} className="rounded-xl border border-[#ECEAE2] bg-[#F4F2EB] overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <p className="flex-1 text-sm font-medium text-slate-700">{label}</p>
                      {slotFiles.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#141A24]/8 text-[#141A24]">{slotFiles.length}</span>
                      )}
                      {canUpload && (
                        <button
                          onClick={() => triggerUpload(slot.fileType)}
                          disabled={isUploading}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#141A24] hover:bg-[#FAFAF7] border border-[#ECEAE2] transition-colors disabled:opacity-40 shrink-0"
                        >
                          {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          {t('project_file_add_file')}
                        </button>
                      )}
                    </div>
                    {slotFiles.length > 0 ? (
                      <div className="border-t border-[#ECEAE2] divide-y divide-slate-100">
                        {slotFiles.map(f => (
                          <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 bg-[#FAFAF7]">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate" dir="ltr">{f.originalFilename}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {f.uploadedByName && <span>{isRtl ? t('project_file_uploaded_by') : 'By'} <span dir="ltr">{f.uploadedByName}</span> · </span>}
                                <span dir="ltr">{new Date(f.uploadedAt).toLocaleDateString()}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => downloadFile(f.id, f.originalFilename)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#141A24] hover:bg-[#ECEAE2] transition-colors" title={t('erp_file_download')}>
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              {canDelete && (
                                <button onClick={() => setConfirmDeleteFileId(f.id)} disabled={deletingFileId === f.id} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40" title={t('project_file_delete')}>
                                  {deletingFileId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border-t border-[#ECEAE2] px-3 py-4 text-center bg-[#FAFAF7]">
                        <p className="text-xs text-slate-300 mb-2">{t('project_file_no_files')}</p>
                        {canUpload && (
                          <button onClick={() => triggerUpload(slot.fileType)} disabled={isUploading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#141A24] text-white hover:bg-[#0B1019] transition-colors disabled:opacity-40">
                            {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                            {t('erp_file_upload')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // ── Glass Order: dual display ─────────────────────────────────
              if (slot.fileType === 'glass_order') {
                const existing = fileFor('glass_order');
                const hasOriginal = !!existing;
                const hasQr = qrOrders.length > 0;
                return (
                  <div key="glass_order" className="space-y-1">
                    <div className="rounded-xl border border-[#ECEAE2] bg-[#F4F2EB] overflow-hidden">
                      <div className="flex items-center gap-3 p-3">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <p className="flex-1 text-sm font-medium text-slate-700">{label}</p>
                        {canUpload && (
                          <button onClick={() => triggerUpload('glass_order')} disabled={isUploading} className="p-1.5 rounded-lg text-slate-400 hover:text-[#141A24] hover:bg-[#FAFAF7] transition-colors disabled:opacity-40" title={existing ? t('erp_file_replace') : t('erp_file_upload')}>
                            {(isUploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                      {(hasOriginal || hasQr) && (
                        <div className={`border-t border-[#ECEAE2] p-3 bg-[#FAFAF7] ${hasOriginal && hasQr ? 'grid grid-cols-2 gap-3' : ''}`}>
                          {hasOriginal && (
                            <div className="rounded-lg border border-[#ECEAE2] p-2.5">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#141A24]/8 text-[#141A24] border border-[#1B2A4A]/10">{t('files_glass_original')}</span>
                              </div>
                              <p className="text-xs text-slate-600 truncate" dir="ltr">{existing!.originalFilename}</p>
                              <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{new Date(existing!.uploadedAt).toLocaleDateString()}</p>
                              <button onClick={() => downloadFile(existing!.id, existing!.originalFilename)} className="mt-1.5 flex items-center gap-1 text-xs text-slate-400 hover:text-[#141A24] transition-colors">
                                <Download className="w-3 h-3" />{t('erp_file_download')}
                              </button>
                            </div>
                          )}
                          {hasQr && (
                            <div className="rounded-lg border border-amber-100 bg-amber-50/30 p-2.5">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <QrCode className="w-3 h-3 text-amber-500 shrink-0" />
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100">{t('files_glass_qr')}</span>
                              </div>
                              <p className="text-xs text-slate-600 truncate" dir="ltr">{qrOrders[0].originalFilename}</p>
                              <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{new Date(qrOrders[0].createdAt).toLocaleDateString()} · {qrOrders[0].positionCount} {t('qr_orders_positions')}</p>
                              <a href={`${API_BASE}/api/qr/download/${qrOrders[0].reportFileId}`} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 transition-colors">
                                <ExternalLink className="w-3 h-3" />{t('qr_orders_view_report')}
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                      {!hasOriginal && !hasQr && (
                        <div className="border-t border-[#ECEAE2] px-3 py-2 bg-[#FAFAF7]">
                          <p className="text-xs text-slate-300">{t('project_file_no_upload')}</p>
                        </div>
                      )}
                    </div>
                    {inactive.length > 0 && (
                      <button onClick={toggleVersions} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 px-1 py-0.5 transition-colors">
                        {versionsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {t('files_prev_versions').replace('{n}', String(inactive.length))}
                      </button>
                    )}
                    {versionsExpanded && inactive.length > 0 && (
                      <div className="rounded-xl border border-[#ECEAE2] divide-y divide-slate-50 overflow-hidden">
                        {inactive.map(f => (
                          <div key={f.id} className="flex items-center gap-3 px-3 py-2 bg-[#F4F2EB]">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500 truncate" dir="ltr">{f.originalFilename}</p>
                              <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{new Date(f.uploadedAt).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => downloadFile(f.id, f.originalFilename)} className="p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-[#ECEAE2] transition-colors">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // ── Standard single-file slot ─────────────────────────────────
              const existing = fileFor(slot.fileType);
              const parsedBadge = slot.fileType === 'assembly_list' && parsedAssemblyList
                ? t('assembly_list_parsed_positions').replace('{count}', String(parsedAssemblyList.positionCount))
                : slot.fileType === 'cut_optimisation' && parsedCutOptimisation
                ? t('cut_opt_parsed_profiles').replace('{count}', String(parsedCutOptimisation.profileCount))
                : null;

              return (
                <div key={slot.fileType} className="space-y-1">
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-[#ECEAE2] bg-[#F4F2EB]">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700">{label}</p>
                        {parsedBadge && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-600 border border-teal-100">{parsedBadge}</span>
                        )}
                      </div>
                      {existing ? (
                        <p className="text-xs text-slate-400 truncate mt-0.5" dir="ltr">{existing.originalFilename}</p>
                      ) : (
                        <p className="text-xs text-slate-300 mt-0.5">{t('project_file_no_upload')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {existing && (
                        <button onClick={() => downloadFile(existing.id, existing.originalFilename)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#141A24] hover:bg-[#FAFAF7] transition-colors" title={t('erp_file_download')}>
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {existing && canDelete && (
                        <button onClick={() => setConfirmDeleteFileId(existing.id)} disabled={deletingFileId === existing.id} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40" title={t('project_file_delete')}>
                          {deletingFileId === existing.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                      {canUpload && (
                        <button onClick={() => triggerUpload(slot.fileType)} disabled={isUploading} className="p-1.5 rounded-lg text-slate-400 hover:text-[#141A24] hover:bg-[#FAFAF7] transition-colors disabled:opacity-40" title={existing ? t('erp_file_replace') : t('erp_file_upload')}>
                          {(isUploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Version history */}
                  {inactive.length > 0 && (
                    <button onClick={toggleVersions} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 px-1 py-0.5 transition-colors">
                      {versionsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {t('files_prev_versions').replace('{n}', String(inactive.length))}
                    </button>
                  )}
                  {versionsExpanded && inactive.length > 0 && (
                    <div className="rounded-xl border border-[#ECEAE2] divide-y divide-slate-50 overflow-hidden">
                      {inactive.map(f => (
                        <div key={f.id} className="flex items-center gap-3 px-3 py-2 bg-[#F4F2EB]">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500 truncate" dir="ltr">{f.originalFilename}</p>
                            <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{new Date(f.uploadedAt).toLocaleDateString()}</p>
                          </div>
                          <button onClick={() => downloadFile(f.id, f.originalFilename)} className="p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-[#ECEAE2] transition-colors">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Assembly List parsed data panel */}
                  {slot.fileType === 'assembly_list' && parsedAssemblyList && parsedAssemblyList.positionCount > 0 && (
                    <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3 text-sm">
                      <p className="text-xs font-semibold text-teal-700 mb-2">{t('assembly_list_parsed_positions').replace('{count}', String(parsedAssemblyList.positionCount))}</p>
                      <div className="space-y-1.5">
                        {parsedAssemblyList.positions.map((pos, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                            <span className="font-semibold text-[#141A24] shrink-0" dir="ltr">{pos.positionCode}</span>
                            <span className="text-slate-400 shrink-0">{pos.quantity} {t('assembly_list_pcs')}</span>
                            {pos.widthMm && pos.heightMm && (
                              <span className="text-slate-400 shrink-0" dir="ltr">{pos.widthMm} × {pos.heightMm} mm</span>
                            )}
                            {pos.glassItems.length > 0 && (
                              <span className="text-slate-400 truncate">{pos.glassItems[0].description}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cut Optimisation parsed data panel */}
                  {slot.fileType === 'cut_optimisation' && parsedCutOptimisation && parsedCutOptimisation.profileCount > 0 && (
                    <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3 text-sm">
                      <p className="text-xs font-semibold text-teal-700 mb-2">{t('cut_opt_parsed_profiles').replace('{count}', String(parsedCutOptimisation.profileCount))}</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-slate-600" dir="ltr">
                          <thead>
                            <tr className="text-slate-400 border-b border-teal-100">
                              <th className="text-start pb-1 font-medium">{t('cut_opt_number')}</th>
                              <th className="text-start pb-1 font-medium">{t('cut_opt_description')}</th>
                              <th className="text-end pb-1 font-medium">{t('cut_opt_qty')}</th>
                              <th className="text-end pb-1 font-medium">{t('cut_opt_wastage_pct')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedCutOptimisation.profiles.slice(0, 10).map((p, i) => (
                              <tr key={i} className="border-b border-teal-50 last:border-0">
                                <td className="py-0.5 font-medium text-[#141A24]">{p.number}</td>
                                <td className="py-0.5 truncate max-w-[120px]">{p.description}</td>
                                <td className="py-0.5 text-end">{p.quantity}</td>
                                <td className="py-0.5 text-end">{p.wastagePercent}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {parsedCutOptimisation.profileCount > 10 && (
                          <p className="text-xs text-slate-400 mt-1">+{parsedCutOptimisation.profileCount - 10} {t('cut_opt_more_profiles')}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Required files checklist — reads from same state as the slots above */}
          <div className="mt-4 pt-4 border-t border-[#ECEAE2]">
            <p className="text-xs font-semibold text-[#6B6A60] mb-2">{t('files_expected_title')}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {FILE_SLOTS.map(slot => {
                let checked: boolean;
                if (slot.fileType === 'glass_order') {
                  checked = fileFor('glass_order') !== null || qrOrders.length > 0;
                } else if (slot.multiFile) {
                  checked = allFiles.some(f => f.fileType === slot.fileType && f.isActive);
                } else {
                  checked = fileFor(slot.fileType) !== null;
                }
                return (
                  <div key={slot.fileType} className={`flex items-center gap-2 text-xs py-0.5 ${checked ? 'text-teal-600' : 'text-[#6B6A60]'}`}>
                    {checked
                      ? <CheckCircle2 className="w-3 h-3 text-teal-500 shrink-0" />
                      : <Circle className="w-3 h-3 text-[#ECEAE2] shrink-0" />}
                    <span>{isRtl ? slot.labelAr : slot.labelEn}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Generate Contract — Stage 4 — visible to Admin, FactoryManager, SalesAgent */}
        {(user?.role === 'Admin' || user?.role === 'FactoryManager' || user?.role === 'SalesAgent') && (
          <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 mb-4">
            <div className={`flex items-center justify-between gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div>
                <h2 className={`font-semibold text-[#141A24] ${isRtl ? 'font-[Tajawal]' : ''}`}>
                  {t('contract_stage_label')}
                </h2>
                {!project?.files?.some(f => f.fileType === 'price_quotation' || f.fileType === 'quotation') && (
                  <p className={`text-xs text-slate-400 mt-0.5 ${isRtl ? 'font-[Tajawal]' : ''}`}>
                    {t('contract_generate_disabled_tooltip')}
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate(`/erp/projects/${id}/contract`)}
                disabled={!project?.files?.some(f => f.fileType === 'price_quotation' || f.fileType === 'quotation')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
              >
                <FileText className="w-4 h-4" />
                {t('contract_generate_button')}
              </button>
            </div>
          </div>
        )}

        {/* Payment Milestones Section */}
        <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 mb-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-[#141A24]">{t('erp_payment_milestones_title')}</h2>
            {canCreateMilestone && (
              <button
                onClick={() => setShowAddMilestone(v => !v)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#141A24] border border-[#ECEAE2] hover:bg-[#F4F2EB] transition-colors"
              >
                <Plus className="w-3 h-3" />
                {t('erp_payment_add')}
              </button>
            )}
          </div>

          {/* Add Milestone Form */}
          {showAddMilestone && canCreateMilestone && (
            <div className="mb-4 p-4 rounded-xl border border-[#ECEAE2] bg-[#F4F2EB] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('erp_payment_label')} *</label>
                  <input
                    className="w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
                    value={milestoneForm.label}
                    onChange={e => setMilestoneForm(f => ({ ...f, label: e.target.value }))}
                    placeholder={t('erp_payment_label_placeholder')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('erp_payment_percentage')}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
                    value={milestoneForm.percentage}
                    onChange={e => setMilestoneForm(f => ({ ...f, percentage: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('erp_payment_amount')}</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
                    value={milestoneForm.amount}
                    onChange={e => setMilestoneForm(f => ({ ...f, amount: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('erp_payment_due_date')}</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
                    value={milestoneForm.dueDate}
                    onChange={e => setMilestoneForm(f => ({ ...f, dueDate: e.target.value }))}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('erp_payment_notes')}</label>
                  <input
                    className="w-full px-3 py-2 text-sm border border-[#ECEAE2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#141A24]/20"
                    value={milestoneForm.notes}
                    onChange={e => setMilestoneForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddMilestone}
                  disabled={savingMilestone || !milestoneForm.label.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-[#141A24] text-white rounded-lg hover:bg-[#0B1019] disabled:opacity-40 transition-colors"
                >
                  {savingMilestone ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('erp_create')}
                </button>
                <button
                  onClick={() => setShowAddMilestone(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-600 rounded-lg hover:bg-[#ECEAE2] transition-colors"
                >
                  {t('erp_cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Milestones List */}
          {milestones.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">{t('erp_payment_no_milestones')}</p>
          ) : (
            <div className="space-y-3">
              {milestones.map(m => {
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
                  <div key={m.id} className={`rounded-xl border p-4 space-y-3 ${m.status === 'overdue' ? 'border-red-100 bg-red-50/30' : 'border-[#ECEAE2] bg-[#F4F2EB]/30'}`}>
                    {/* Milestone header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[#141A24] flex-1 min-w-0">{m.label}</span>
                      {m.percentage != null && (
                        <span className="text-xs text-slate-400 shrink-0" dir="ltr">{m.percentage}%</span>
                      )}
                      {m.amount != null && (
                        <span className="text-xs font-semibold text-slate-600 shrink-0" dir="ltr">
                          {m.amount.toLocaleString()} {t('erp_payment_sar')}
                        </span>
                      )}
                      {m.dueDate && (
                        <span className="text-xs text-slate-400 shrink-0" dir="ltr">{m.dueDate}</span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${statusStyle}`}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Qoyod attachment row — shows completion badge */}
                    {m.qoyodDocFileId != null && (() => {
                      const attachedFile = project?.files.find(f => f.id === m.qoyodDocFileId);
                      return attachedFile ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FAFAF7] border border-[#ECEAE2]">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-600 truncate flex-1 min-w-0" dir="ltr">{attachedFile.originalFilename}</span>
                          {pct !== null && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${pct >= 100 ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                              {pct >= 100 ? t('erp_payment_completion_full') : t('erp_payment_completion_partial').replace('{pct}', String(pct))}
                            </span>
                          )}
                          <button
                            onClick={() => downloadFile(attachedFile.id, attachedFile.originalFilename)}
                            className="p-1 rounded text-slate-400 hover:text-[#141A24] hover:bg-[#ECEAE2] transition-colors shrink-0"
                            title={t('erp_file_download')}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : null;
                    })()}

                    {/* Mark Paid button */}
                    {canManagePayments && m.status !== 'paid' && (
                      payingMilestoneId === m.id ? (
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
                              ref={payFileInputRef}
                              type="file"
                              className="hidden"
                              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                              onChange={e => setPayForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
                            />
                            <button
                              onClick={() => payFileInputRef.current?.click()}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-[#1B2A4A]/40 hover:text-[#141A24] transition-colors"
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
                              onClick={() => { setPayingMilestoneId(null); setPayForm({ paidAmount: '', notes: '', file: null }); }}
                              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-600 rounded-lg hover:bg-[#ECEAE2] transition-colors"
                            >
                              {t('erp_cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPayingMilestoneId(m.id)}
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
          )}
        </div>

        {/* Procurement Section */}
        <ProcurementSection projectId={id} isRtl={isRtl} t={t} user={user} />

        {/* Manufacturing Section */}
        <ManufacturingSection projectId={id} isRtl={isRtl} t={t} user={user} />

        {/* Phases Section */}
        <PhasesSection projectId={id} isRtl={isRtl} t={t} user={user} />

        {/* Warranty Section */}
        <WarrantySection project={project} isRtl={isRtl} t={t} />

        {/* QR Orders Section */}
        <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="w-4 h-4 text-[#C89B3C]" />
            <h2 className="font-semibold text-[#141A24]">{t('qr_orders_title')}</h2>
          </div>
          {loadingQrOrders ? (
            <div className="text-center py-6 text-slate-400 text-sm">...</div>
          ) : qrOrders.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">{t('qr_orders_empty')}</p>
          ) : (
            <div className="space-y-2">
              {qrOrders.map(order => (
                <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#ECEAE2] bg-[#F4F2EB]">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{order.originalFilename}</p>
                    <p className="text-xs text-slate-400 mt-0.5" dir="ltr">
                      {order.processingDate && <span>{order.processingDate} · </span>}
                      {order.positionCount} {t('qr_orders_positions')} · {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={`${API_BASE}/api/qr/download/${order.reportFileId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#141A24] hover:bg-[#141A24]/8 transition-colors shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('qr_orders_view_report')}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Quotation Name Mismatch Modal */}
      {nameMismatch && (
        <NameMismatchModal
          nameInFile={nameMismatch.nameInFile}
          nameInSystem={nameMismatch.nameInSystem}
          onChoice={handleNameMismatchChoice}
        />
      )}

      {/* Glass Order Confirmation Dialog */}
      {glassDetect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setGlassDetect(null)}
        >
          <div
            className="bg-[#FAFAF7] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] w-full max-w-md border border-[#ECEAE2] overflow-hidden"
            dir={isRtl ? 'rtl' : 'ltr'}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b border-[#ECEAE2] ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                {glassDetect.nameMatches ? (
                  <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <h3 className={`font-semibold text-slate-900 text-sm ${isRtl ? 'font-[Tajawal]' : ''}`}>
                  {glassDetect.nameMatches ? t('glass_confirm_title') : t('qr_conflict_title')}
                </h3>
              </div>
              <button
                onClick={() => setGlassDetect(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-[#ECEAE2] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Orgadata name pill */}
              <div className={`flex items-center gap-2 flex-wrap ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className={`text-xs text-slate-400 ${isRtl ? 'font-[Tajawal]' : ''}`}>
                  {t('detect_orgadata_label')}:
                </span>
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#141A24]/8 border border-[#1B2A4A]/12 text-[#141A24] text-xs font-semibold"
                  dir="ltr"
                >
                  {glassDetect.orgadataName}
                </span>
                {glassDetect.orgadataPerson && (
                  <span className="text-xs text-slate-400" dir="ltr">{glassDetect.orgadataPerson}</span>
                )}
              </div>

              {/* Name comparison (only when names differ) */}
              {!glassDetect.nameMatches && (
                <div className="rounded-xl bg-[#F4F2EB] border border-[#ECEAE2] p-4 space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">{t('qr_conflict_system_name')}</p>
                    <p className="font-semibold text-[#141A24]">"{project.name}"</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">{t('qr_conflict_orgadata_name')}</p>
                    <p className="font-semibold text-slate-700" dir="ltr">"{glassDetect.orgadataName}"</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className={`flex flex-wrap gap-2 pt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                {glassDetect.nameMatches ? (
                  <>
                    <button
                      onClick={() => handleGlassConfirm(false)}
                      className={`flex-1 px-4 py-2 text-sm font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
                    >
                      {t('glass_confirm_upload')}
                    </button>
                    <button
                      onClick={() => setGlassDetect(null)}
                      className={`px-4 py-2 text-sm text-slate-400 hover:text-slate-600 rounded-xl hover:bg-[#F4F2EB] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
                    >
                      {t('detect_cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleGlassConfirm(true)}
                      className={`flex-1 px-4 py-2 text-sm font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
                    >
                      {t('qr_conflict_update')}
                    </button>
                    <button
                      onClick={() => handleGlassConfirm(false)}
                      className={`flex-1 px-4 py-2 text-sm font-semibold border border-[#ECEAE2] text-slate-700 rounded-xl hover:bg-[#F4F2EB] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
                    >
                      {t('qr_conflict_keep')}
                    </button>
                    <button
                      onClick={() => setGlassDetect(null)}
                      className={`px-4 py-2 text-sm text-slate-400 hover:text-slate-600 rounded-xl hover:bg-[#F4F2EB] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
                    >
                      {t('qr_conflict_cancel')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Modal */}
      {showDeleteProject && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#FAFAF7] rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-[#F7E2DF] flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-[#A0312A]" />
              </div>
              <h2 className={`font-bold text-[#141A24] ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('del_project_title')}</h2>
            </div>
            <div className="mb-1 ms-12">
              <p className={`font-semibold text-slate-800 text-sm ${isRtl ? 'font-[Tajawal]' : ''}`}>{project.name}</p>
              <p className={`text-slate-500 text-sm ${isRtl ? 'font-[Tajawal]' : ''}`}>{project.customerName}</p>
            </div>
            <p className={`text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mt-3 mb-4 ms-0 ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('del_project_warning')}
            </p>
            <div className={`flex gap-3 justify-end ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button onClick={() => setShowDeleteProject(false)} className={`px-4 py-2 text-sm text-slate-600 hover:bg-[#ECEAE2] rounded-xl transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
                {t('erp_cancel')}
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={deletingProject}
                className={`px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
              >
                {deletingProject ? t('del_deleting') : t('del_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete File Modal */}
      {confirmDeleteFileId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#FAFAF7] rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#F7E2DF] flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-[#A0312A]" />
              </div>
              <h2 className={`font-bold text-[#141A24] ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('del_file_title')}</h2>
            </div>
            <div className={`flex gap-3 justify-end ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button onClick={() => setConfirmDeleteFileId(null)} className={`px-4 py-2 text-sm text-slate-600 hover:bg-[#ECEAE2] rounded-xl transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}>
                {t('erp_cancel')}
              </button>
              <button
                onClick={() => deleteFile(confirmDeleteFileId)}
                className={`px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
              >
                {t('del_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
