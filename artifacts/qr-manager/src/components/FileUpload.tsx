import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, X, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { cn, formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    disabled: isLoading
  });

  // Separate onDrag from root props to avoid framer-motion type conflict
  const { onDrag: _onDrag, ...safeRootProps } = getRootProps() as any;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative group overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-500 ease-out",
          isDragActive ? "border-accent bg-accent/5 scale-[1.02]" : "border-primary/20 bg-white hover:border-primary/50 hover:bg-primary/5",
          isLoading && "opacity-50 pointer-events-none"
        )}
        {...safeRootProps}
      >
        <input {...getInputProps()} />
        
        <div className="px-6 py-20 flex flex-col items-center justify-center text-center">
          <div className="relative mb-6">
            <div className={cn(
              "absolute inset-0 rounded-full blur-xl transition-all duration-500",
              isDragActive ? "bg-accent/40" : "bg-primary/20 group-hover:bg-primary/30"
            )}></div>
            <div className={cn(
              "relative flex items-center justify-center w-20 h-20 rounded-2xl shadow-lg transition-transform duration-500",
              isDragActive ? "bg-accent text-white scale-110" : "bg-white text-primary group-hover:scale-110"
            )}>
              <UploadCloud className="w-10 h-10" />
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-foreground mb-3">
            {isDragActive ? t('drop_active') : t('drop_idle')}
          </h3>
          
          <p className="text-muted-foreground mb-8 max-w-md">
            {t('upload_desc')}
          </p>
          
          <Button variant="default" size="lg" className="pointer-events-none rounded-full px-8">
            {t('browse_files')}
          </Button>

          <p className="mt-6 text-sm font-medium text-primary/60 flex items-center gap-2">
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
            className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ms-auto p-1 hover:bg-destructive/20 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
