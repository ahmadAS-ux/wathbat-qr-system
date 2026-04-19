import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { ArrowRight, ArrowLeft, Upload, Download, CheckCircle2, Circle, FileText, QrCode, ExternalLink, AlertTriangle, X, Loader2, Trash2, Plus } from 'lucide-react';
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
  new:           { bg: 'bg-slate-100',  text: 'text-slate-600',  border: 'border-slate-200',  dot: 'bg-slate-400'   },
  in_study:      { bg: 'bg-blue-50',    text: 'text-[#185FA5]',  border: 'border-blue-200',   dot: 'bg-[#185FA5]'   },
  in_production: { bg: 'bg-amber-50',   text: 'text-[#B8860B]',  border: 'border-amber-200',  dot: 'bg-[#B8860B]'   },
  complete:      { bg: 'bg-teal-50',    text: 'text-[#0F6E56]',  border: 'border-teal-200',   dot: 'bg-[#0F6E56]'   },
};

const INTERNAL_STAGES = [
  { n: 0,  labelAr: 'عميل محتمل',        labelEn: 'Lead'              },
  { n: 1,  labelAr: 'استفسار',            labelEn: 'Inquiry'           },
  { n: 2,  labelAr: 'دراسة فنية',         labelEn: 'Tech Study'        },
  { n: 3,  labelAr: 'عرض السعر',          labelEn: 'Quotation'         },
  { n: 4,  labelAr: 'العقد',              labelEn: 'Contract'          },
  { n: 5,  labelAr: 'الدفعة الأولى',      labelEn: 'Deposit'           },
  { n: 6,  labelAr: 'المشتريات',          labelEn: 'Procurement'       },
  { n: 7,  labelAr: 'استلام المواد',      labelEn: 'Receiving'         },
  { n: 8,  labelAr: 'التصنيع',            labelEn: 'Manufacturing'     },
  { n: 9,  labelAr: 'التسليم',            labelEn: 'Delivery'          },
  { n: 10, labelAr: 'التركيب',            labelEn: 'Installation'      },
  { n: 11, labelAr: 'السداد',             labelEn: 'Payment'           },
  { n: 12, labelAr: 'الضمان',             labelEn: 'Warranty'          },
  { n: 13, labelAr: 'مكتمل',              labelEn: 'Done'              },
];

const FILE_SLOTS = [
  { fileType: 'glass_order',      labelAr: 'طلبية زجاج / ألواح', labelEn: 'Glass / Panel Order', multiFile: false },
  { fileType: 'price_quotation',  labelAr: 'عرض السعر',          labelEn: 'Quotation',            multiFile: false },
  { fileType: 'section',          labelAr: 'المقاطع',            labelEn: 'Section',              multiFile: false },
  { fileType: 'assembly_list',    labelAr: 'قائمة التجميع',      labelEn: 'Assembly List',        multiFile: false },
  { fileType: 'cut_optimisation', labelAr: 'تحسين القص',         labelEn: 'Cut Optimisation',     multiFile: false },
  { fileType: 'qoyod',            labelAr: 'قيود',               labelEn: 'Qoyod',                multiFile: true  },
];

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
  const [detectingGlass, setDetectingGlass] = useState(false);
  const [glassDetect, setGlassDetect] = useState<GlassDetectResult | null>(null);
  const [qrOrders, setQrOrders] = useState<QROrder[]>([]);
  const [loadingQrOrders, setLoadingQrOrders] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [nameMismatch, setNameMismatch] = useState<NameMismatchData | null>(null);

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const canUpload = user?.role !== 'SalesAgent' && user?.role !== 'Accountant';

  const loadProject = async () => {
    setLoading(true);
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

  useEffect(() => { loadProject(); loadQrOrders(); }, [id]);

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
      if (res.status === 409 && fileType === 'price_quotation') {
        const conflict = await res.json();
        setNameMismatch({ nameInFile: conflict.nameInFile, nameInSystem: conflict.nameInSystem, pendingFile: file });
        return;
      }
      if (fileType === 'glass_order') {
        await loadQrOrders();
      } else {
        await loadProject();
      }
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
    await uploadFile(pendingFile, 'price_quotation', params);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingFileType) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (pendingFileType === 'glass_order') {
      setDetectingGlass(true);
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch(`${API_BASE}/api/erp/files/detect-project`, {
          method: 'POST',
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          const nameMatches =
            (data.orgadataName ?? '').toLowerCase().trim() ===
            (project?.name ?? '').toLowerCase().trim();
          setDetectingGlass(false);
          setGlassDetect({ orgadataName: data.orgadataName, orgadataPerson: data.orgadataPerson, pendingFile: file, nameMatches });
          return;
        }
      } catch {}
      setDetectingGlass(false);
      // Fallback: upload directly if detect fails
      await uploadFile(file, 'glass_order');
      return;
    }

    await uploadFile(file, pendingFileType);
  };

  const handleGlassConfirm = async (updateName: boolean) => {
    if (!glassDetect) return;
    const { pendingFile } = glassDetect;
    setGlassDetect(null);
    await uploadFile(pendingFile, 'glass_order', `?confirm=true&updateName=${updateName}`);
    if (updateName) await loadProject();
  };

  const downloadFile = (fileId: number, filename: string) => {
    const a = document.createElement('a');
    a.href = `${API_BASE}/api/erp/projects/${id}/files/${fileId}`;
    a.download = filename;
    a.click();
  };

  const deleteFile = async (fileId: number) => {
    if (!window.confirm(t('project_file_delete_confirm'))) return;
    setDeletingFileId(fileId);
    try {
      await fetch(`${API_BASE}/api/erp/projects/${id}/files/${fileId}`, { method: 'DELETE' });
      await loadProject();
    } finally {
      setDeletingFileId(null);
    }
  };

  const fileFor = (fileType: string) =>
    project?.files.find(f => f.fileType === fileType) ?? null;

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
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#1B2A4A] mb-4 transition-colors"
        >
          <BackIcon className="w-4 h-4" />
          {t('erp_projects_title')}
        </button>

        {/* Project Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl font-bold text-[#1B2A4A]">{project.name}</h1>
              <p className="text-slate-500 text-sm mt-0.5">{project.customerName}</p>
              {project.phone && <p className="text-slate-400 text-xs mt-0.5" dir="ltr">{project.phone}</p>}
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
              {stageDisplayLabel[project.stageDisplay] ?? project.stageDisplay}
            </span>
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
                <dt className="text-slate-400">{t('erp_from_lead')}</dt>
                <dd className="mt-0.5">
                  <button
                    onClick={() => navigate(`/erp/leads/${project.fromLeadId}`)}
                    className="text-[#1B2A4A] font-semibold underline underline-offset-2 text-sm"
                  >
                    Lead #{project.fromLeadId}
                  </button>
                </dd>
              </div>
            )}
          </dl>

          {/* Notes */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">{t('erp_project_notes')}</span>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="text-xs text-[#1B2A4A] hover:underline">
                  {t('erp_save')}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/30"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setEditingNotes(false); setNotes(project.notes ?? ''); }} className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">{t('erp_cancel')}</button>
                  <button onClick={saveNotes} disabled={savingNotes} className="px-4 py-1.5 text-sm font-semibold bg-[#1B2A4A] text-white rounded-lg hover:bg-[#1B2A4A]/90 disabled:opacity-50">{savingNotes ? '...' : t('erp_save')}</button>
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
          <h2 className="font-semibold text-[#1B2A4A] mb-4">{t('erp_stage_timeline')}</h2>
          <ol className="space-y-2">
            {INTERNAL_STAGES.map(stage => {
              const done = project.stageInternal > stage.n;
              const current = project.stageInternal === stage.n;
              return (
                <li key={stage.n} className={`flex items-center gap-3 text-sm py-1.5 px-3 rounded-xl transition-colors ${current ? 'bg-[#1B2A4A]/5 font-semibold' : ''}`}>
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                  ) : current ? (
                    <div className="w-4 h-4 rounded-full border-2 border-[#C89B3C] bg-[#C89B3C]/20 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-200 shrink-0" />
                  )}
                  <span className={done ? 'text-slate-400 line-through' : current ? 'text-[#1B2A4A]' : 'text-slate-400'}>
                    {isRtl ? stage.labelAr : stage.labelEn}
                  </span>
                  <span className="ms-auto text-slate-300 text-xs">{stage.n}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Files Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
          <h2 className="font-semibold text-[#1B2A4A] mb-4">{t('erp_project_files')}</h2>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="space-y-3">
            {FILE_SLOTS.map(slot => {
              const isUploading = uploadingFor === slot.fileType;
              const isDetecting = detectingGlass && pendingFileType === slot.fileType;
              const label = isRtl ? slot.labelAr : slot.labelEn;

              if (slot.multiFile) {
                // ── Qoyod multi-file slot ─────────────────────────────────────
                const slotFiles = project?.files.filter(f => f.fileType === slot.fileType) ?? [];
                return (
                  <div key={slot.fileType} className="rounded-xl border border-slate-100 bg-slate-50/50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-3 p-3">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <p className="flex-1 text-sm font-medium text-slate-700">{label}</p>
                      {slotFiles.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#1B2A4A]/8 text-[#1B2A4A]">
                          {slotFiles.length} {t('project_file_files_count').replace('{count}', String(slotFiles.length))}
                        </span>
                      )}
                      {canUpload && (
                        <button
                          onClick={() => triggerUpload(slot.fileType)}
                          disabled={isUploading}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#1B2A4A] hover:bg-white border border-slate-200 transition-colors disabled:opacity-40 shrink-0"
                        >
                          {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          {t('project_file_add_file')}
                        </button>
                      )}
                    </div>
                    {/* File list */}
                    {slotFiles.length > 0 ? (
                      <div className="border-t border-slate-100 divide-y divide-slate-100">
                        {slotFiles.map(f => (
                          <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 bg-white">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate" dir="ltr">{f.originalFilename}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {f.uploadedByName && <span>{isRtl ? t('project_file_uploaded_by') : 'By'} <span dir="ltr">{f.uploadedByName}</span> · </span>}
                                <span dir="ltr">{new Date(f.uploadedAt).toLocaleDateString()}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => downloadFile(f.id, f.originalFilename)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#1B2A4A] hover:bg-slate-100 transition-colors"
                                title={t('erp_file_download')}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              {(canUpload || true) && (
                                <button
                                  onClick={() => deleteFile(f.id)}
                                  disabled={deletingFileId === f.id}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                  title={t('project_file_delete')}
                                >
                                  {deletingFileId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border-t border-slate-100 px-3 py-4 text-center bg-white">
                        <p className="text-xs text-slate-300 mb-2">{t('project_file_no_files')}</p>
                        {canUpload && (
                          <button
                            onClick={() => triggerUpload(slot.fileType)}
                            disabled={isUploading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1B2A4A] text-white hover:bg-[#142240] transition-colors disabled:opacity-40"
                          >
                            {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                            {t('erp_file_upload')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // ── Single-file slot ──────────────────────────────────────────
              const existing = fileFor(slot.fileType);
              return (
                <div key={slot.fileType} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{label}</p>
                    {existing ? (
                      <p className="text-xs text-slate-400 truncate mt-0.5" dir="ltr">{existing.originalFilename}</p>
                    ) : (
                      <p className="text-xs text-slate-300 mt-0.5">{t('project_file_no_upload')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {existing && (
                      <button
                        onClick={() => downloadFile(existing.id, existing.originalFilename)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#1B2A4A] hover:bg-white transition-colors"
                        title={t('erp_file_download')}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    {canUpload && (
                      <button
                        onClick={() => triggerUpload(slot.fileType)}
                        disabled={isUploading || isDetecting}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#1B2A4A] hover:bg-white transition-colors disabled:opacity-40"
                        title={existing ? t('erp_file_replace') : t('erp_file_upload')}
                      >
                        {(isUploading || isDetecting) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Generate Contract — Stage 4 — visible to Admin, FactoryManager, SalesAgent */}
        {(user?.role === 'Admin' || user?.role === 'FactoryManager' || user?.role === 'SalesAgent') && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
            <div className={`flex items-center justify-between gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div>
                <h2 className={`font-semibold text-[#1B2A4A] ${isRtl ? 'font-[Tajawal]' : ''}`}>
                  {isRtl ? 'العقد — المرحلة 4' : 'Contract — Stage 4'}
                </h2>
                {!project?.files?.some(f => f.fileType === 'price_quotation') && (
                  <p className={`text-xs text-slate-400 mt-0.5 ${isRtl ? 'font-[Tajawal]' : ''}`}>
                    {t('contract_generate_disabled_tooltip')}
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate(`/erp/projects/${id}/contract`)}
                disabled={!project?.files?.some(f => f.fileType === 'price_quotation')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#1B2A4A] text-white rounded-xl hover:bg-[#243860] disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
              >
                <FileText className="w-4 h-4" />
                {t('contract_generate_button')}
              </button>
            </div>
          </div>
        )}

        {/* QR Orders Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="w-4 h-4 text-[#C89B3C]" />
            <h2 className="font-semibold text-[#1B2A4A]">{t('qr_orders_title')}</h2>
          </div>
          {loadingQrOrders ? (
            <div className="text-center py-6 text-slate-400 text-sm">...</div>
          ) : qrOrders.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">{t('qr_orders_empty')}</p>
          ) : (
            <div className="space-y-2">
              {qrOrders.map(order => (
                <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1B2A4A] hover:bg-[#1B2A4A]/8 transition-colors shrink-0"
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden"
            dir={isRtl ? 'rtl' : 'ltr'}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 ${isRtl ? 'flex-row-reverse' : ''}`}>
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
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
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
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#1B2A4A]/8 border border-[#1B2A4A]/12 text-[#1B2A4A] text-xs font-semibold"
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
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">{t('qr_conflict_system_name')}</p>
                    <p className="font-semibold text-[#1B2A4A]">"{project.name}"</p>
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
                      className={`flex-1 px-4 py-2 text-sm font-semibold bg-[#1B2A4A] text-white rounded-xl hover:bg-[#142240] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
                    >
                      {t('glass_confirm_upload')}
                    </button>
                    <button
                      onClick={() => setGlassDetect(null)}
                      className={`px-4 py-2 text-sm text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
                    >
                      {t('detect_cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleGlassConfirm(true)}
                      className={`flex-1 px-4 py-2 text-sm font-semibold bg-[#1B2A4A] text-white rounded-xl hover:bg-[#142240] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
                    >
                      {t('qr_conflict_update')}
                    </button>
                    <button
                      onClick={() => handleGlassConfirm(false)}
                      className={`flex-1 px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
                    >
                      {t('qr_conflict_keep')}
                    </button>
                    <button
                      onClick={() => setGlassDetect(null)}
                      className={`px-4 py-2 text-sm text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
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
    </AdminLayout>
  );
}
