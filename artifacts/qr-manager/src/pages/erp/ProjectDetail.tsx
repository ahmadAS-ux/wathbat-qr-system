import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { ArrowRight, ArrowLeft, Upload, Download, CheckCircle2, Circle, FileText } from 'lucide-react';

interface ProjectFile {
  id: number;
  projectId: number;
  fileType: string;
  originalFilename: string;
  uploadedAt: string;
  uploadedBy: number;
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

const FILE_TYPES = [
  { value: 'glass_order',      labelAr: 'طلب الزجاج / الألواح', labelEn: 'Glass / Panel Order'   },
  { value: 'technical_doc',    labelAr: 'الوثيقة الفنية',        labelEn: 'Technical Document'    },
  { value: 'price_quotation',  labelAr: 'عرض السعر',             labelEn: 'Price Quotation'       },
  { value: 'qoyod_deposit',    labelAr: 'مستند دفعة قيود',       labelEn: 'Qoyod Deposit'         },
  { value: 'qoyod_payment',    labelAr: 'مستند سداد قيود',       labelEn: 'Qoyod Payment'         },
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

  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const canUpload = user?.role !== 'SalesAgent' && user?.role !== 'Accountant';

  const loadProject = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        setNotes(data.notes ?? '');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProject(); }, [id]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await fetch(`/api/erp/projects/${id}`, {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingFileType) return;
    setUploadingFor(pendingFileType);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fileType', pendingFileType);
      await fetch(`/api/erp/projects/${id}/files`, { method: 'POST', body: fd });
      await loadProject();
    } finally {
      setUploadingFor(null);
      setPendingFileType('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadFile = (fileId: number, filename: string) => {
    const a = document.createElement('a');
    a.href = `/api/erp/projects/${id}/files/${fileId}`;
    a.download = filename;
    a.click();
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="font-semibold text-[#1B2A4A] mb-4">{t('erp_project_files')}</h2>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="space-y-3">
            {FILE_TYPES.map(ft => {
              const existing = fileFor(ft.value);
              const isUploading = uploadingFor === ft.value;
              return (
                <div key={ft.value} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{isRtl ? ft.labelAr : ft.labelEn}</p>
                    {existing ? (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{existing.originalFilename}</p>
                    ) : (
                      <p className="text-xs text-slate-300 mt-0.5">{t('erp_file_none')}</p>
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
                        onClick={() => triggerUpload(ft.value)}
                        disabled={isUploading}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#1B2A4A] hover:bg-white transition-colors disabled:opacity-40"
                        title={existing ? t('erp_file_replace') : t('erp_file_upload')}
                      >
                        {isUploading ? (
                          <span className="text-xs">...</span>
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
      </div>
    </AdminLayout>
  );
}
