import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUpload } from '@/components/FileUpload';
import { ResultsView } from '@/components/ResultsView';
import { useProcessDocument, ProcessResult } from '@workspace/api-client-react';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { Loader2, QrCode, AlertTriangle } from 'lucide-react';

export default function Home() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [duplicateProjectName, setDuplicateProjectName] = useState<string | null>(null);

  const { mutate: processDoc, isPending } = useProcessDocument({
    mutation: {
      onSuccess: (data) => {
        setDuplicateProjectName(null);
        setResult(data);
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
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute top-0 inset-x-0 h-[60vh] bg-gradient-to-b from-[#1B2A4A]/[0.04] to-transparent pointer-events-none -z-10" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#4A6FA5]/[0.07] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#1B2A4A]/[0.04] rounded-full blur-3xl pointer-events-none -z-10" />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex flex-col items-center justify-center">

        <AnimatePresence mode="wait">
          {!result && !isPending && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full text-center space-y-10"
            >
              <div className="max-w-2xl mx-auto space-y-5">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1B2A4A]/5 border border-[#1B2A4A]/10 text-[#1B2A4A] text-sm font-medium mb-2">
                  <QrCode className="w-4 h-4 text-[#4A6FA5]" />
                  Wathbat Aluminum · wathbat.sa
                </div>
                <h1 className="text-5xl md:text-6xl font-extrabold text-[#1B2A4A] tracking-tight leading-tight">
                  {t('page_title')}
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto">
                  {t('page_subtitle')}
                </p>
              </div>

              <FileUpload onFileSelect={handleFileSelect} isLoading={isPending} />

              <AnimatePresence>
                {duplicateProjectName && (
                  <motion.div
                    key="dup-warning"
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-start max-w-3xl mx-auto w-full"
                  >
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium leading-relaxed">
                      {t('duplicate_project_error').replace('{name}', duplicateProjectName)}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {isPending && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col items-center justify-center py-24"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-[#4A6FA5]/20 blur-3xl rounded-full animate-pulse" />
                <div className="w-28 h-28 bg-white rounded-3xl shadow-2xl shadow-[#1B2A4A]/10 flex items-center justify-center relative z-10 border border-[#1B2A4A]/10">
                  <Loader2 className="w-12 h-12 text-[#1B2A4A] animate-spin" />
                </div>
              </div>
              <h2 className="mt-10 text-2xl font-bold text-[#1B2A4A]">{t('processing')}</h2>
              <p className="mt-2 text-muted-foreground text-center max-w-xs">{t('analyzing')}</p>
            </motion.div>
          )}

          {result && !isPending && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <ResultsView result={result} onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
