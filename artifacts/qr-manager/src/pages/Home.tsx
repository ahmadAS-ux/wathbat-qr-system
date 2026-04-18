import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUpload } from '@/components/FileUpload';
import { ResultsView } from '@/components/ResultsView';
import { useProcessDocument, ProcessResult } from '@workspace/api-client-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, QrCode, AlertTriangle, CheckCircle2, UploadCloud, Download, XCircle, Info } from 'lucide-react';

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
  const [duplicateProjectName, setDuplicateProjectName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const { mutate: processDoc, isPending } = useProcessDocument({
    mutation: {
      onSuccess: (data) => {
        setDuplicateProjectName(null);
        setUploadError(null);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setResult(data);
        }, 1200);
      },
      onError: (error: any) => {
        const errData = error?.data as Record<string, unknown> | null | undefined;
        if (errData?.error === 'DuplicateProject' && typeof errData?.projectName === 'string') {
          setDuplicateProjectName(errData.projectName as string);
          setUploadError(null);
        } else {
          setDuplicateProjectName(null);
          setUploadError(
            isRtl
              ? 'حدث خطأ أثناء معالجة الملف. تأكد من أن الملف هو ملف طلبية Orgadata صحيح بصيغة .docx'
              : 'An error occurred while processing the file. Please ensure it is a valid Orgadata order file (.docx).'
          );
        }
      },
    },
  });

  const handleFileSelect = (file: File) => {
    setDuplicateProjectName(null);
    setUploadError(null);
    setShowSuccess(false);
    processDoc({ data: { file } });
  };

  const handleReset = () => {
    setResult(null);
    setDuplicateProjectName(null);
    setUploadError(null);
    setShowSuccess(false);
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

                {/* Dropzone — hidden while processing or showing success flash */}
                {!isPending && !showSuccess && (
                  <FileUpload onFileSelect={handleFileSelect} isLoading={false} />
                )}

                {/* 🔄 Processing */}
                <AnimatePresence>
                  {isPending && (
                    <motion.div
                      key="processing"
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
                  {uploadError && !isPending && (
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

                {/* ⚠️ Duplicate project warning */}
                <AnimatePresence>
                  {duplicateProjectName && (
                    <motion.div
                      key="dup-warning"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 ${isRtl ? 'flex-row-reverse' : ''}`}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    >
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <p className={`text-sm font-medium leading-relaxed ${isRtl ? 'font-[Tajawal]' : ''}`}>
                        {t('duplicate_project_error').replace('{name}', duplicateProjectName)}
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
