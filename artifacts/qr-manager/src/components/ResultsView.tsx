import { motion } from 'framer-motion';
import { Download, CheckCircle2, QrCode, FileText, Calendar, Box, Loader2 } from 'lucide-react';
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
  const [downloadError, setDownloadError] = useState('');

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setDownloadError('');
      const response = await fetch(`/api/qr/download/${result.fileId}`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
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
      console.error("Download failed:", error);
      setDownloadError('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const columns = [
    { key: 'position',  label: t('table_position') },
    { key: 'quantity',  label: t('table_qty') },
    { key: 'width',     label: t('table_width') },
    { key: 'height',    label: t('table_height') },
    { key: 'area',      label: t('table_area') },
    { key: 'perimeter', label: t('table_perimeter') },
    { key: 'price',     label: t('table_price') },
    { key: 'total',     label: t('table_total') },
    { key: 'qr',        label: t('table_qr') },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-7xl mx-auto space-y-6"
    >
      {/* Download banner — full-width, very prominent */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1a3a5c] to-[#1e4a75] p-7 shadow-xl shadow-primary/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M0 40L40 0H20L0 20M40 40V20L20 40\'/%3E%3C/g%3E%3C/svg%3E')]" />
        <div className={`relative z-10 flex flex-col sm:flex-row items-center justify-between gap-5 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
          {/* Success info */}
          <div className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-[#c8962a]" />
            </div>
            <div className={isRtl ? 'text-right' : ''}>
              <h2 className="text-xl font-bold text-white">{t('success_title')}</h2>
              <p className="text-sm text-white/70 mt-0.5">{t('success_desc')}</p>
            </div>
          </div>

          {/* Download button — big and gold */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-3 bg-[#c8962a] hover:bg-[#b8861a] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-base px-8 py-4 rounded-2xl shadow-lg shadow-black/20 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              {isDownloading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {t('download_btn')}
            </button>
            {downloadError && (
              <p className="text-red-300 text-xs">{downloadError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('total_positions'), value: result.totalPositions?.toString(), icon: Box },
          { label: t('project_name'), value: result.projectName || '—', icon: FileText },
          { label: t('date'), value: result.date || '—', icon: Calendar },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className={`bg-white border border-border/50 rounded-2xl p-5 shadow-sm flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <div className="p-3 rounded-xl bg-slate-50 text-primary shrink-0">
              <stat.icon className="w-5 h-5" />
            </div>
            <div className={isRtl ? 'text-right' : ''}>
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-bold text-foreground truncate">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Full data table */}
      <div className="bg-white rounded-3xl border border-border shadow-lg shadow-primary/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
            <thead className="bg-primary text-white">
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-4 font-semibold whitespace-nowrap text-center first:text-start last:text-center"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {result.positions.map((pos, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.02 * i }}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  <td className="px-4 py-3 font-bold text-primary whitespace-nowrap">
                    {pos.position}
                  </td>
                  <td className="px-4 py-3 text-center text-foreground">{pos.quantity || '—'}</td>
                  <td className="px-4 py-3 text-center text-foreground">{pos.width || '—'}</td>
                  <td className="px-4 py-3 text-center text-foreground">{pos.height || '—'}</td>
                  <td className="px-4 py-3 text-center text-foreground">{pos.area || '—'}</td>
                  <td className="px-4 py-3 text-center text-foreground">{pos.perimeter || '—'}</td>
                  <td className="px-4 py-3 text-center text-foreground">{pos.price || '—'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-foreground">{pos.total || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <div className="w-12 h-12 bg-white rounded-xl border border-border shadow-sm p-0.5 group-hover:scale-110 group-hover:shadow-md transition-all duration-200">
                        {pos.qrDataUrl ? (
                          <img
                            src={pos.qrDataUrl}
                            alt={`QR ${pos.position}`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-200">
                            <QrCode className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Process another document */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onReset}
          className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
        >
          {t('back_home')}
        </button>
      </div>
    </motion.div>
  );
}
