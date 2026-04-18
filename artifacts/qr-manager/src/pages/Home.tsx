import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUpload } from '@/components/FileUpload';
import { ResultsView } from '@/components/ResultsView';
import type { ProcessResult } from '@workspace/api-client-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { API_BASE } from '@/lib/api-base';
import { Loader2, QrCode, CheckCircle2, UploadCloud, Download, XCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DetectResult {
  orgadataName: string;
  orgadataPerson: string | null;
  matches: { id: number; name: string; customerName: string; score: number }[];
}

interface DropdownOption {
  value: string;
  labelAr: string;
  labelEn: string;
}

interface CreateProjectForm {
  name: string;
  customerName: string;
  phone: string;
  buildingType: string;
  productInterest: string;
}

// ── DetectDialog ───────────────────────────────────────────────────────────────

interface DetectDialogProps {
  orgadataName: string;
  orgadataPerson: string | null;
  matches: { id: number; name: string; customerName: string; score: number }[];
  onSelect: (projectId: number) => void;
  onCreateNew: (data: CreateProjectForm) => void;
  onCancel: () => void;
  isRtl: boolean;
  t: (key: string) => string;
}

function DetectDialog({ orgadataName, orgadataPerson, matches, onSelect, onCreateNew, onCancel, isRtl, t }: DetectDialogProps) {
  const [showCreate, setShowCreate] = useState(matches.length === 0);
  const [form, setForm] = useState<CreateProjectForm>({
    name: orgadataName,
    customerName: '',
    phone: '',
    buildingType: '',
    productInterest: '',
  });
  const [buildingTypes, setBuildingTypes] = useState<DropdownOption[]>([]);
  const [productInterests, setProductInterests] = useState<DropdownOption[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/erp/options/building_type`).then(r => r.json()),
      fetch(`${API_BASE}/api/erp/options/product_interest`).then(r => r.json()),
    ]).then(([b, p]) => {
      setBuildingTypes(b);
      setProductInterests(p);
    }).catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim() || !form.buildingType || !form.productInterest) {
      setFormError(isRtl ? 'يرجى تعبئة جميع الحقول المطلوبة.' : 'Please fill all required fields.');
      return;
    }
    setFormError(null);
    onCreateNew(form);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-[#1B2A4A]/[0.03]">
        <h2 className={`font-bold text-[#1B2A4A] text-base ${isRtl ? 'font-[Tajawal]' : ''}`}>
          {t('detect_dialog_title')}
        </h2>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className={`text-xs text-[#1B2A4A]/50 ${isRtl ? 'font-[Tajawal]' : ''}`}>
            {t('detect_orgadata_label')}:
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#1B2A4A]/8 border border-[#1B2A4A]/12 text-[#1B2A4A] text-xs font-semibold" dir="ltr">
            {orgadataName}
          </span>
          {orgadataPerson && (
            <span className="text-xs text-[#1B2A4A]/40" dir="ltr">{orgadataPerson}</span>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Match list */}
        {matches.length > 0 && (
          <div>
            <p className={`text-xs font-semibold text-[#1B2A4A]/50 uppercase tracking-wide mb-2 ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('detect_matches_heading')}
            </p>
            <div className="flex flex-col gap-2">
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelect(m.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border border-border hover:border-[#1B2A4A]/30 hover:bg-[#1B2A4A]/[0.03] transition-colors text-start ${isRtl ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex flex-col gap-0.5 ${isRtl ? 'items-end' : ''}`}>
                    <span className={`text-sm font-semibold text-[#1B2A4A] ${isRtl ? 'font-[Tajawal]' : ''}`}>{m.name}</span>
                    <span className={`text-xs text-[#1B2A4A]/50 ${isRtl ? 'font-[Tajawal]' : ''}`}>{m.customerName}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${m.score >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} dir="ltr">
                    {m.score}% {t('detect_score_label')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {matches.length === 0 && (
          <p className={`text-sm text-[#1B2A4A]/50 ${isRtl ? 'font-[Tajawal]' : ''}`}>
            {t('detect_no_matches')}
          </p>
        )}

        {/* Divider + Create new */}
        {matches.length > 0 && <div className="border-t border-border" />}

        <div>
          {matches.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowCreate(v => !v)}
              className={`flex items-center gap-2 text-sm font-semibold text-[#1B2A4A] hover:text-[#1B2A4A]/70 transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
            >
              {showCreate ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {t('detect_create_heading')}
            </button>
          ) : (
            <p className={`text-sm font-semibold text-[#1B2A4A] mb-2 ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('detect_create_heading')}
            </p>
          )}

          {showCreate && (
            <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
              {/* Project name */}
              <div className="flex flex-col gap-1">
                <label className={`text-xs font-medium text-[#1B2A4A]/60 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
                  {isRtl ? 'اسم المشروع' : 'Project name'}
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  dir="ltr"
                  className="rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20"
                />
              </div>

              {/* Customer name */}
              <div className="flex flex-col gap-1">
                <label className={`text-xs font-medium text-[#1B2A4A]/60 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
                  {t('detect_customer_name')} *
                </label>
                <input
                  value={form.customerName}
                  onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className={`rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 ${isRtl ? 'font-[Tajawal]' : ''}`}
                />
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1">
                <label className={`text-xs font-medium text-[#1B2A4A]/60 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
                  {isRtl ? 'الجوال (اختياري)' : 'Phone (optional)'}
                </label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  dir="ltr"
                  placeholder="05xxxxxxxx"
                  className="rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20"
                />
              </div>

              {/* Building type */}
              <div className="flex flex-col gap-1">
                <label className={`text-xs font-medium text-[#1B2A4A]/60 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
                  {isRtl ? 'نوع المبنى' : 'Building type'} *
                </label>
                <select
                  value={form.buildingType}
                  onChange={e => setForm(f => ({ ...f, buildingType: e.target.value }))}
                  className={`rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 bg-white ${isRtl ? 'font-[Tajawal]' : ''}`}
                >
                  <option value="">{isRtl ? '-- اختر --' : '-- Select --'}</option>
                  {buildingTypes.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {isRtl ? opt.labelAr : opt.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product interest */}
              <div className="flex flex-col gap-1">
                <label className={`text-xs font-medium text-[#1B2A4A]/60 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
                  {isRtl ? 'المنتج' : 'Product interest'} *
                </label>
                <select
                  value={form.productInterest}
                  onChange={e => setForm(f => ({ ...f, productInterest: e.target.value }))}
                  className={`rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 bg-white ${isRtl ? 'font-[Tajawal]' : ''}`}
                >
                  <option value="">{isRtl ? '-- اختر --' : '-- Select --'}</option>
                  {productInterests.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {isRtl ? opt.labelAr : opt.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <p className={`text-xs text-red-600 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>{formError}</p>
              )}

              <button
                type="submit"
                className={`mt-1 rounded-xl bg-[#1B2A4A] text-white text-sm font-semibold py-2.5 hover:bg-[#1B2A4A]/90 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
              >
                {t('detect_create_submit')}
              </button>
            </form>
          )}
        </div>

        {/* Cancel */}
        <button
          type="button"
          onClick={onCancel}
          className={`text-sm text-[#1B2A4A]/50 hover:text-[#1B2A4A] transition-colors text-start ${isRtl ? 'font-[Tajawal]' : ''}`}
        >
          {t('detect_cancel')}
        </button>
      </div>
    </motion.div>
  );
}

// ── Step guide ────────────────────────────────────────────────────────────────
function StepGuide() {
  const { t, isRtl } = useLanguage();

  const steps = [
    { num: isRtl ? '١' : '1', label: t('upload_step1'), icon: UploadCloud },
    { num: isRtl ? '٢' : '2', label: t('upload_step2'), icon: Loader2 },
    { num: isRtl ? '٣' : '3', label: t('upload_step3'), icon: Download },
  ];

  // RTL: reverse so reading right→left gives correct logical order
  const displayed = isRtl ? [...steps].reverse() : steps;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-[#1B2A4A]/40 mb-3">
        {t('upload_how')}
      </p>

      <div className="flex items-center justify-center gap-2">
        {displayed.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="flex items-center gap-2">
              {/* Step card */}
              <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-[#1B2A4A] text-white flex items-center justify-center shadow-md shadow-[#1B2A4A]/20">
                    <Icon className="w-4 h-4" strokeWidth={1.8} />
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#C89B3C] text-white flex items-center justify-center text-[10px] font-bold leading-none shadow">
                    {step.num}
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#1B2A4A] text-center leading-tight px-1">
                  {step.label}
                </span>
              </div>

              {/* Arrow — RTL uses ← so flow reads right→left correctly */}
              {i < displayed.length - 1 && (
                <div className="text-[#1B2A4A]/25 text-base shrink-0 mb-3">
                  {isRtl ? '←' : '→'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Detect-project flow state
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    setShowSuccess(false);
    setDetecting(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/erp/files/detect-project`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: DetectResult = await res.json();
      setPendingFile(file);
      setDetectResult(data);
    } catch {
      setUploadError(
        isRtl
          ? 'حدث خطأ أثناء تحليل الملف. تأكد من أنه ملف Orgadata صحيح بصيغة .docx'
          : 'Failed to analyze the file. Please ensure it is a valid Orgadata order file (.docx).'
      );
    } finally {
      setDetecting(false);
    }
  };

  const handleProjectSelected = async (projectId: number) => {
    if (!pendingFile) return;
    setDetectResult(null);
    setUploading(true);
    const fd = new FormData();
    fd.append('file', pendingFile);
    fd.append('fileType', 'glass_order');
    try {
      // Pass confirm=true — user explicitly chose this project, bypass name check
      const res = await fetch(`${API_BASE}/api/erp/projects/${projectId}/files?confirm=true`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setResult({ ...data, fileId: String(data.fileId) });
      }, 1200);
    } catch {
      setUploadError(
        isRtl
          ? 'حدث خطأ أثناء رفع الملف.'
          : 'An error occurred while uploading the file.'
      );
    } finally {
      setUploading(false);
      setPendingFile(null);
    }
  };

  const handleCreateAndUpload = async (formData: CreateProjectForm) => {
    try {
      const res = await fetch(`${API_BASE}/api/erp/files/create-project-from-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const project = await res.json();
      await handleProjectSelected(project.id);
    } catch {
      setDetectResult(null);
      setUploading(false);
      setPendingFile(null);
      setUploadError(
        isRtl
          ? 'حدث خطأ أثناء إنشاء المشروع.'
          : 'An error occurred while creating the project.'
      );
    }
  };

  const handleCancel = () => {
    setDetectResult(null);
    setPendingFile(null);
    setUploadError(null);
  };

  const handleReset = () => {
    setResult(null);
    setUploadError(null);
    setShowSuccess(false);
    setDetectResult(null);
    setPendingFile(null);
  };

  // Non-Admin users are auto-redirected to the ERP projects page
  useEffect(() => {
    if (user && user.role !== 'Admin') {
      navigate('/erp/projects');
    }
  }, [user]);

  // BiDi-safe Arabic subtitle — LTR brand names wrapped in explicit ltr spans
  const arabicSubtitle = (
    <>
      ارفع ملف الطلبية من{' '}
      <span dir="ltr" style={{ display: 'inline-block' }}>Orgadata</span>
      {' '}لإنشاء رموز{' '}
      <span dir="ltr" style={{ display: 'inline-block' }}>QR</span>
      {' '}تلقائياً
    </>
  );

  const isBusy = detecting || uploading;

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col relative overflow-hidden">
      <main className="flex-1 w-full flex flex-col">
        <AnimatePresence mode="wait">

          {/* ── Upload / feedback state ── */}
          {!result && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col"
            >
              {/* Compact hero */}
              <div className="relative pattern-bg overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[#1B2A4A]/[0.02] via-transparent to-[#F8F9FB] pointer-events-none" />

                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-4 flex flex-col items-center text-center gap-3">

                  {/* Brand pill */}
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B2A4A]/8 border border-[#1B2A4A]/12 text-[#1B2A4A] text-[11px] font-semibold tracking-wide"
                  >
                    <QrCode className="w-3 h-3 text-[#4A6FA5]" />
                    Wathbat Aluminum · wathbat.sa
                  </motion.div>

                  {/* Title */}
                  <motion.h1
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    dir={isRtl ? 'rtl' : 'ltr'}
                    className={`text-2xl sm:text-3xl font-extrabold text-[#1B2A4A] leading-tight tracking-tight ${isRtl ? 'font-[Tajawal]' : ''}`}
                  >
                    {t('page_title')}
                  </motion.h1>

                  {/* Subtitle — BiDi-safe for Arabic */}
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    dir={isRtl ? 'rtl' : 'ltr'}
                    className={`text-sm text-[#1B2A4A]/55 leading-relaxed max-w-md ${isRtl ? 'font-[Tajawal]' : ''}`}
                  >
                    {isRtl ? arabicSubtitle : t('page_subtitle')}
                  </motion.p>

                  {/* 3-step guide */}
                  <StepGuide />
                </div>
              </div>

              {/* Upload area */}
              <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pb-6 -mt-2 flex flex-col gap-3">

                {/* Admin-only banner */}
                <div
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium ${isRtl ? 'flex-row-reverse' : ''}`}
                  dir={isRtl ? 'rtl' : 'ltr'}
                >
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className={isRtl ? 'font-[Tajawal]' : ''}>{t('home_admin_only_banner')}</span>
                </div>

                {/* Dropzone — hidden while busy or showing dialog or showing success flash */}
                {!isBusy && !detectResult && !showSuccess && (
                  <FileUpload onFileSelect={handleFileSelect} isLoading={false} />
                )}

                {/* 🔍 Detecting */}
                <AnimatePresence>
                  {detecting && (
                    <motion.div
                      key="detecting"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`flex items-center gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 ${isRtl ? 'flex-row-reverse' : ''}`}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    >
                      <Loader2 className="w-5 h-5 text-blue-500 shrink-0 animate-spin" />
                      <p className={`text-sm font-semibold ${isRtl ? 'font-[Tajawal]' : ''}`}>
                        {isRtl ? 'جاري تحليل الملف...' : 'Analyzing file...'}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 🔄 Uploading */}
                <AnimatePresence>
                  {uploading && (
                    <motion.div
                      key="uploading"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`flex items-center gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 ${isRtl ? 'flex-row-reverse' : ''}`}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    >
                      <Loader2 className="w-5 h-5 text-blue-500 shrink-0 animate-spin" />
                      <p className={`text-sm font-semibold ${isRtl ? 'font-[Tajawal]' : ''}`}>
                        {isRtl ? 'جاري المعالجة...' : 'Processing...'}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 📋 Detect dialog */}
                <AnimatePresence>
                  {detectResult && (
                    <DetectDialog
                      orgadataName={detectResult.orgadataName}
                      orgadataPerson={detectResult.orgadataPerson}
                      matches={detectResult.matches}
                      onSelect={handleProjectSelected}
                      onCreateNew={handleCreateAndUpload}
                      onCancel={handleCancel}
                      isRtl={isRtl}
                      t={t}
                    />
                  )}
                </AnimatePresence>

                {/* ✅ Success flash */}
                <AnimatePresence>
                  {showSuccess && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className={`flex items-center gap-3 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 ${isRtl ? 'flex-row-reverse' : ''}`}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    >
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                      <p className={`text-sm font-semibold ${isRtl ? 'font-[Tajawal]' : ''}`}>
                        {isRtl ? 'تم بنجاح! جاري تحميل التقرير' : 'Success! Loading your report...'}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ❌ Error */}
                <AnimatePresence>
                  {uploadError && !isBusy && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 ${isRtl ? 'flex-row-reverse' : ''}`}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    >
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <p className={`text-sm font-medium leading-relaxed ${isRtl ? 'font-[Tajawal]' : ''}`}>
                        {uploadError}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </motion.div>
          )}

          {/* ── Results state ── */}
          {result && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8"
            >
              <ResultsView result={result} onReset={handleReset} />
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
