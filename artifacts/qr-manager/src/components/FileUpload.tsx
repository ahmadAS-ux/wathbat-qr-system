import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, X, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { cn, formatBytes } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export function FileUpload({ onFileSelect, isLoading }: FileUploadProps) {
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    if (rejectedFiles.length > 0) {
      setError(t('error_file_type'));
      return;
    }
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  const { onDrag: _onDrag, ...safeRootProps } = getRootProps() as any;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative group overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-500 ease-out cursor-pointer",
          isDragActive
            ? "border-[#4A6FA5] bg-[#4A6FA5]/5 scale-[1.02] shadow-xl shadow-[#4A6FA5]/10"
            : "border-[#1B2A4A]/20 bg-white hover:border-[#1B2A4A]/40 hover:bg-[#1B2A4A]/[0.02] hover:shadow-xl hover:shadow-[#1B2A4A]/5",
          isLoading && "opacity-50 pointer-events-none"
        )}
        {...safeRootProps}
      >
        <input {...getInputProps()} />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm rounded-3xl">
            <Loader2 className="w-10 h-10 text-[#1B2A4A] animate-spin" />
            <p className="text-sm font-semibold text-[#1B2A4A]">{t('processing')}</p>
          </div>
        )}

        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#4A6FA5]/[0.03] via-transparent to-[#1B2A4A]/[0.03] pointer-events-none" />

        <div className="relative px-8 py-20 flex flex-col items-center justify-center text-center">
          {/* Icon */}
          <div className="relative mb-8">
            <div className={cn(
              "absolute inset-0 rounded-full blur-2xl transition-all duration-500",
              isDragActive ? "bg-[#4A6FA5]/40 scale-125" : "bg-[#1B2A4A]/15 group-hover:bg-[#1B2A4A]/25"
            )} />
            <motion.div
              animate={isDragActive ? { scale: 1.12, rotate: -3 } : { scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={cn(
                "relative flex items-center justify-center w-28 h-28 rounded-3xl shadow-xl transition-all duration-300",
                isDragActive
                  ? "bg-[#4A6FA5] text-white"
                  : "bg-white text-[#1B2A4A] group-hover:bg-[#1B2A4A] group-hover:text-white"
              )}
            >
              <UploadCloud className="w-14 h-14" strokeWidth={1.5} />
            </motion.div>
          </div>

          <h3 className="text-2xl md:text-3xl font-bold text-[#1B2A4A] mb-3">
            {isDragActive ? t('drop_active') : t('upload_title')}
          </h3>

          <p className="text-muted-foreground mb-8 max-w-sm text-base leading-relaxed">
            {t('upload_desc')}
          </p>

          <div className="flex items-center justify-center gap-3">
            <div className="px-8 py-3.5 bg-[#1B2A4A] text-white font-bold text-base rounded-2xl shadow-lg shadow-[#1B2A4A]/20 group-hover:bg-[#4A6FA5] transition-colors duration-300">
              {t('browse_btn')}
            </div>
          </div>

          <p className="mt-7 text-sm font-medium text-[#1B2A4A]/50 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('file_type_hint')}
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ms-auto p-1 hover:bg-destructive/20 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
