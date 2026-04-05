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
  const { t, isRtl } = useLanguage();
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
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className={cn(
          "relative group overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-500 ease-out cursor-pointer select-none",
          isDragActive
            ? "border-[#4A6FA5] bg-[#4A6FA5]/5 scale-[1.01] shadow-2xl shadow-[#4A6FA5]/15"
            : "border-[#1B2A4A]/25 bg-white hover:border-[#1B2A4A]/50 hover:shadow-xl hover:shadow-[#1B2A4A]/8",
          isLoading && "opacity-50 pointer-events-none"
        )}
        {...safeRootProps}
      >
        <input {...getInputProps()} />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm rounded-3xl">
            <Loader2 className="w-10 h-10 text-[#1B2A4A] animate-spin" />
            <p className={`text-sm font-semibold text-[#1B2A4A] ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('processing')}
            </p>
          </div>
        )}

        {/* Subtle inner gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#4A6FA5]/[0.025] via-transparent to-[#1B2A4A]/[0.025] pointer-events-none rounded-3xl" />

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-[#C89B3C]/30 rounded-tl-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-[#C89B3C]/30 rounded-br-3xl pointer-events-none" />

        <div
          className={`relative px-6 py-8 sm:py-10 flex flex-col items-center justify-center text-center gap-0 ${isRtl ? 'font-[Tajawal]' : ''}`}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          {/* Upload icon with pulse ring */}
          <div className="relative mb-5">
            {/* Pulse rings */}
            {!isDragActive && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-[#1B2A4A]/8"
                  animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-[#1B2A4A]/5"
                  animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                />
              </>
            )}

            {/* Drag active glow */}
            {isDragActive && (
              <div className="absolute inset-0 rounded-2xl bg-[#4A6FA5]/30 blur-xl scale-125" />
            )}

            <motion.div
              animate={isDragActive ? { scale: 1.1, rotate: -4 } : { scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              className={cn(
                "relative flex items-center justify-center w-20 h-20 rounded-2xl shadow-xl transition-colors duration-300",
                isDragActive
                  ? "bg-[#4A6FA5] text-white shadow-[#4A6FA5]/30"
                  : "bg-[#1B2A4A] text-white group-hover:bg-[#2c3e6b] shadow-[#1B2A4A]/20"
              )}
            >
              <UploadCloud className="w-10 h-10" strokeWidth={1.5} />
            </motion.div>
          </div>

          {/* Heading */}
          <h3 className="text-xl sm:text-2xl font-extrabold text-[#1B2A4A] mb-2 leading-snug">
            {isDragActive ? t('drop_active') : t('upload_title')}
          </h3>

          {/* Description */}
          <p className="text-[#1B2A4A]/50 mb-5 max-w-sm text-sm leading-relaxed">
            {t('upload_desc')}
          </p>

          {/* CTA button */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="px-8 py-2.5 bg-[#1B2A4A] text-white font-bold text-sm rounded-xl shadow-lg shadow-[#1B2A4A]/25 group-hover:bg-[#4A6FA5] transition-colors duration-300 cursor-pointer"
          >
            {t('browse_btn')}
          </motion.div>

          {/* File type hint */}
          <p className="mt-4 text-xs font-medium text-[#1B2A4A]/35 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            {t('file_type_hint')}
          </p>
        </div>
      </motion.div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-destructive/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
