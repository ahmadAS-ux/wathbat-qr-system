import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUpload } from '@/components/FileUpload';
import { ResultsView } from '@/components/ResultsView';
import { useProcessDocument, ProcessResult } from '@workspace/api-client-react';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { Loader2, QrCode, AlertTriangle, CheckCircle2, UploadCloud, Download } from 'lucide-react';

// ── Step guide shown above the upload zone ────────────────────────────────────
function StepGuide() {
  const { t, isRtl } = useLanguage();

  const steps = [
    { num: isRtl ? '١' : '1', label: t('upload_step1'), icon: UploadCloud },
    { num: isRtl ? '٢' : '2', label: t('upload_step2'), icon: Loader2      },
    { num: isRtl ? '٣' : '3', label: t('upload_step3'), icon: Download     },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="w-full max-w-xl mx-auto"
    >
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#1B2A4A]/40 mb-4">
        {t('upload_how')}
      </p>

      <div
        className={`flex items-start justify-center gap-2 sm:gap-4 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}
      >
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className={`flex items-start gap-2 sm:gap-4 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Step card */}
              <div className="flex flex-col items-center gap-2 min-w-[80px] sm:min-w-[96px]">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-[#1B2A4A] text-white flex items-center justify-center shadow-lg shadow-[#1B2A4A]/25">
                    <Icon className="w-5 h-5" strokeWidth={1.8} />
                  </div>
                  {/* Number badge */}
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#C89B3C] text-white flex items-center justify-center text-[11px] font-bold leading-none shadow">
                    {step.num}
                  </div>
                </div>
                <span className="text-[12px] sm:text-xs font-bold text-[#1B2A4A] text-center leading-snug px-1">
                  {step.label}
                </span>
              </div>

              {/* Connector arrow */}
              {i < steps.length - 1 && (
                <div className="mt-5 text-[#1B2A4A]/25 text-lg font-light select-none shrink-0">
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
  const { toast } = useToast();
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [duplicateProjectName, setDuplicateProjectName] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const { mutate: processDoc, isPending } = useProcessDocument({
    mutation: {
      onSuccess: (data) => {
        setDuplicateProjectName(null);
        setResult(data);
        setShowSuccess(true);
        toast({
          title: t('toast_success_title'),
          description: t('toast_success_desc'),
        });
      },
      onError: (error: any) => {
        console.error("Processing failed:", error);
        const data = error?.data as Record<string, unknown> | null | undefined;
        if (data?.error === 'DuplicateProject' && typeof data?.projectName === 'string') {
          setDuplicateProjectName(data.projectName);
        } else {
          setDuplicateProjectName(null);
          toast({
            title: 'Error',
            description: t('error_generic'),
            variant: 'destructive',
          });
        }
      }
    }
  });

  const handleFileSelect = (file: File) => {
    setDuplicateProjectName(null);
    processDoc({ data: { file } });
  };

  const handleReset = () => {
    setResult(null);
    setDuplicateProjectName(null);
    setShowSuccess(false);
  };

  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showSuccess]);

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col relative overflow-hidden">

      <main className="flex-1 w-full flex flex-col">

        <AnimatePresence mode="wait">

          {/* ── Upload state ── */}
          {!result && !isPending && (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="flex-1 flex flex-col"
            >
              {/* Hero section — dot-grid background */}
              <div className="relative pattern-bg overflow-hidden">
                {/* Gradient fade to page bg at bottom */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#1B2A4A]/[0.02] via-transparent to-[#F8F9FB] pointer-events-none" />
                {/* Subtle radial glow at center */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,#4A6FA5/0.07,transparent)] pointer-events-none" />

                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 flex flex-col items-center text-center gap-6">

                  {/* Brand pill */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1B2A4A]/8 border border-[#1B2A4A]/12 text-[#1B2A4A] text-xs font-semibold tracking-wide"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#4A6FA5]" />
                    Wathbat Aluminum &nbsp;·&nbsp; wathbat.sa
                  </motion.div>

                  {/* Main title */}
                  <motion.h1
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={`text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#1B2A4A] leading-tight tracking-tight ${isRtl ? 'font-[Tajawal]' : ''}`}
                  >
                    {t('page_title')}
                  </motion.h1>

                  {/* Subtitle */}
                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className={`text-base sm:text-lg text-[#1B2A4A]/55 leading-relaxed max-w-lg ${isRtl ? 'font-[Tajawal]' : ''}`}
                  >
                    {t('page_subtitle')}
                  </motion.p>

                  {/* 3-step guide */}
                  <StepGuide />
                </div>
              </div>

              {/* Upload area — below the hero */}
              <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16 -mt-4 flex flex-col gap-5">
                <FileUpload onFileSelect={handleFileSelect} isLoading={isPending} />

                {/* Duplicate project warning */}
                <AnimatePresence>
                  {duplicateProjectName && (
                    <motion.div
                      key="dup-warning"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-start"
                    >
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium leading-relaxed">
                        {t('duplicate_project_error').replace('{name}', duplicateProjectName)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ── Processing state ── */}
          {isPending && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex-1 flex flex-col items-center justify-center py-32 gap-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-[#4A6FA5]/20 blur-3xl rounded-full animate-pulse" />
                <div className="w-28 h-28 bg-white rounded-3xl shadow-2xl shadow-[#1B2A4A]/10 flex items-center justify-center relative z-10 border border-[#1B2A4A]/8">
                  <Loader2 className="w-12 h-12 text-[#1B2A4A] animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <h2 className={`text-2xl font-bold text-[#1B2A4A] ${isRtl ? 'font-[Tajawal]' : ''}`}>
                  {t('processing')}
                </h2>
                <p className="mt-2 text-[#1B2A4A]/50 max-w-xs">{t('analyzing')}</p>
              </div>
            </motion.div>
          )}

          {/* ── Results state ── */}
          {result && !isPending && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10"
            >
              <AnimatePresence>
                {showSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-3 mb-6 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 max-w-3xl mx-auto"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <p className="text-sm font-medium">{t('toast_success_title')} — {t('toast_success_desc')}</p>
                  </motion.div>
                )}
              </AnimatePresence>
              <ResultsView result={result} onReset={handleReset} />
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
