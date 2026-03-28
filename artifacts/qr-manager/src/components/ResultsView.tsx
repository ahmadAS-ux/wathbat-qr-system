import { motion } from 'framer-motion';
import { Download, CheckCircle2, QrCode, FileText, Calendar, Box } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { ProcessResult } from '@workspace/api-client-react';
import { useState } from 'react';

interface ResultsViewProps {
  result: ProcessResult;
  onReset: () => void;
}

export function ResultsView({ result, onReset }: ResultsViewProps) {
  const { t, isRtl } = useLanguage();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const downloadUrl = `/api/qr/download/${result.fileId}`;
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Wathbat_QR_${result.projectName || 'Document'}.docx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-5xl mx-auto space-y-8"
    >
      {/* Success Header Card */}
      <div className="glass-panel rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -ml-20 -mb-20"></div>
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{t('success_title')}</h2>
            <p className="text-muted-foreground">{t('success_desc')}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 relative z-10 w-full md:w-auto">
          <Button variant="outline" onClick={onReset} className="rounded-full bg-white/50">
            {t('back_home')}
          </Button>
          <Button 
            variant="accent" 
            size="lg"
            onClick={handleDownload}
            disabled={isDownloading}
            className="rounded-full gap-2 min-w-[200px]"
          >
            {isDownloading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Download className="w-5 h-5" />
            )}
            <span>{t('download_btn')}</span>
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: t('total_positions'), value: result.totalPositions, icon: Box, color: 'text-primary' },
          { label: t('project_name'), value: result.projectName || '—', icon: FileText, color: 'text-accent' },
          { label: t('date'), value: result.date || '—', icon: Calendar, color: 'text-foreground' }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            className="bg-white border border-border/50 rounded-2xl p-5 shadow-sm flex items-center gap-4"
          >
            <div className={`p-3 rounded-xl bg-slate-50 ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-lg font-bold text-foreground line-clamp-1">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-3xl border border-border shadow-lg shadow-primary/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="bg-slate-50/80 border-b border-border text-primary font-semibold">
              <tr>
                <th className="px-6 py-5 whitespace-nowrap">{t('table_position')}</th>
                <th className="px-6 py-5 whitespace-nowrap">{t('table_qty')}</th>
                <th className="px-6 py-5 whitespace-nowrap">{t('table_width')}</th>
                <th className="px-6 py-5 whitespace-nowrap">{t('table_height')}</th>
                <th className="px-6 py-5 whitespace-nowrap text-center">{t('table_qr')}</th>
              </tr>
            </thead>
            <motion.tbody 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="divide-y divide-border/50"
            >
              {result.positions.map((pos, i) => (
                <motion.tr 
                  variants={itemVariants}
                  key={i} 
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="px-6 py-4 font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      {pos.position}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{pos.quantity || '—'}</td>
                  <td className="px-6 py-4 text-muted-foreground">{pos.width || '—'}</td>
                  <td className="px-6 py-4 text-muted-foreground">{pos.height || '—'}</td>
                  <td className="px-6 py-4 flex justify-center">
                    <div className="relative w-14 h-14 bg-white rounded-xl border border-border shadow-sm p-1 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                      {pos.qrDataUrl ? (
                        <img src={pos.qrDataUrl} alt={`QR ${pos.position}`} className="w-full h-full object-contain mix-blend-multiply" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300 rounded-lg">
                          <QrCode className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
