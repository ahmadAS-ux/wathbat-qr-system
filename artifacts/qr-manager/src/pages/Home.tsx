import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUpload } from '@/components/FileUpload';
import { ResultsView } from '@/components/ResultsView';
import { useProcessDocument, ProcessResult } from '@workspace/api-client-react';
import { useLanguage } from '@/hooks/use-language';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { t } = useLanguage();
  const [result, setResult] = useState<ProcessResult | null>(null);

  const { mutate: processDoc, isPending } = useProcessDocument({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
      },
      onError: (error) => {
        console.error("Processing failed:", error);
      }
    }
  });

  const handleFileSelect = (file: File) => {
    processDoc({ data: { file } });
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pattern-bg flex flex-col relative">
      {/* Decorative ambient background */}
      <div className="absolute top-0 inset-x-0 h-[50vh] bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none -z-10"></div>
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex flex-col items-center justify-center">
        
        <AnimatePresence mode="wait">
          {!result && !isPending && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full text-center space-y-12"
            >
              <div className="max-w-2xl mx-auto space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-primary tracking-tight">
                  {t('app_title')}
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                  {t('app_subtitle')}
                </p>
              </div>

              <FileUpload onFileSelect={handleFileSelect} isLoading={isPending} />
            </motion.div>
          )}

          {isPending && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full animate-pulse"></div>
                <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center relative z-10 border border-primary/10">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
              </div>
              <h2 className="mt-8 text-2xl font-bold text-foreground">{t('processing')}</h2>
              <p className="mt-2 text-muted-foreground">{t('analyzing')}</p>
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
