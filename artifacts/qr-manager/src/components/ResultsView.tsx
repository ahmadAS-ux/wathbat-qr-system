import { motion } from 'framer-motion';
import { Download, CheckCircle2, QrCode, FileText, Calendar, Box, Loader2, Printer, Mail } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { ProcessResult } from '@workspace/api-client-react';
import { useState } from 'react';

interface ResultsViewProps {
  result: ProcessResult;
  onReset: () => void;
}

import { API_BASE as BASE } from '@/lib/api-base';

export function ResultsView({ result, onReset }: ResultsViewProps) {
  const { t, isRtl } = useLanguage();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setDownloadError('');
      const response = await fetch(`${BASE}/api/qr/download/${result.fileId}`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Wathbat_QR_${result.projectName || 'Document'}.html`;
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

  const handleSendEmail = () => {
    const projectName = result.projectName || (isRtl ? 'المستند' : 'Document');
    const subject = encodeURIComponent(`QR Report — ${projectName}`);
    const body = encodeURIComponent(
      isRtl
        ? `مرحباً،\n\nيرجى الاطلاع على تقرير QR للمشروع: ${projectName}\n\nالتاريخ: ${result.date || '—'}\nعدد المواضع: ${result.totalPositions ?? '—'}\n\nلتحميل التقرير، يرجى تسجيل الدخول إلى نظام وثبة.\n\nمع التحية،\nوثبة للألمنيوم`
        : `Hello,\n\nPlease find the QR report for project: ${projectName}\n\nDate: ${result.date || '—'}\nPositions: ${result.totalPositions ?? '—'}\n\nTo download the report, please log in to the Wathbat system.\n\nBest regards,\nWathbat Aluminum`
    );
    window.location.href = `mailto:${encodeURIComponent(emailTo)}?subject=${subject}&body=${body}`;
    setShowEmailModal(false);
    setEmailTo('');
  };

  const columns = [
    { key: 'position',  label: t('table_position') },
    { key: 'quantity',  label: t('table_qty') },
    { key: 'width',     label: t('table_width') },
    { key: 'height',    label: t('table_height') },
    { key: 'area',      label: t('table_area') },
    { key: 'perimeter', label: t('table_perimeter') },
    { key: 'qr',        label: t('table_qr') },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-7xl mx-auto space-y-6"
    >
      {/* Download banner */}
      <div className="no-print relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1B2A4A] to-[#243d6a] p-7 shadow-2xl shadow-[#1B2A4A]/25">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/svg%3E')] opacity-60" />
        <div className={`relative z-10 flex flex-col sm:flex-row items-center justify-between gap-5 ${isRtl ? 'sm:flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
              <CheckCircle2 className="w-7 h-7 text-[#4A6FA5]" />
            </div>
            <div className={isRtl ? 'text-right' : ''}>
              <h2 className="text-xl font-bold text-white">{t('success_title')}</h2>
              <p className="text-sm text-white/60 mt-0.5">{t('success_desc')}</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 shrink-0 no-print">
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-3 bg-[#4A6FA5] hover:bg-[#3d5f94] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-base px-9 py-4 rounded-2xl shadow-lg shadow-black/25 transition-all duration-200 hover:scale-105"
              >
                {isDownloading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <Download className="w-5 h-5" />
                }
                {t('download_btn')}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-5 py-4 rounded-2xl border border-white/20 transition-all duration-200 hover:scale-105"
              >
                <Printer className="w-5 h-5" />
                {t('print_btn')}
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-5 py-4 rounded-2xl border border-white/20 transition-all duration-200 hover:scale-105"
              >
                <Mail className="w-5 h-5" />
                {t('email_send_btn')}
              </button>
            </div>
            {downloadError && (
              <p className="text-red-300 text-xs">{downloadError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: t('positions_in_file'),
            value: result.rawPositionCount?.toString() ?? result.totalPositions?.toString(),
            icon: FileText,
          },
          {
            label: t('total_positions'),
            value: result.totalPositions?.toString(),
            icon: Box,
            highlight: result.rawPositionCount != null && result.rawPositionCount !== result.totalPositions,
          },
          { label: t('project_name'), value: result.projectName || '—', icon: FileText, wrap: true },
          { label: t('date'), value: result.date || '—', icon: Calendar },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className={`bg-white border ${(stat as any).highlight ? 'border-[#4A6FA5] ring-1 ring-[#4A6FA5]/30' : 'border-border/50'} rounded-2xl p-5 shadow-sm flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}
          >
            <div className={`p-3 rounded-xl shrink-0 ${(stat as any).highlight ? 'bg-[#4A6FA5]/10 text-[#4A6FA5]' : 'bg-[#1B2A4A]/5 text-[#1B2A4A]'}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className={isRtl ? 'text-right' : ''}>
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p
                title={(stat as any).wrap ? stat.value : undefined}
                className={`text-lg font-bold ${(stat as any).wrap ? 'break-words leading-snug' : 'truncate'} ${(stat as any).highlight ? 'text-[#4A6FA5]' : 'text-[#1B2A4A]'}`}
              >
                {stat.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Data table */}
      <div className="bg-white rounded-3xl border border-border shadow-lg shadow-[#1B2A4A]/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
            <thead className="bg-[#1B2A4A] text-white">
              <tr>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-4 font-semibold whitespace-nowrap text-center first:text-start last:text-center tracking-wide text-xs uppercase"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.positions.map((pos, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.015 * i }}
                  className={`border-b border-border/30 transition-colors group ${
                    i % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FB]/80'
                  } hover:bg-[#1B2A4A]/[0.03]`}
                >
                  <td className="px-4 py-3.5 font-bold text-[#1B2A4A] whitespace-nowrap">
                    {pos.position}
                  </td>
                  <td className="px-4 py-3.5 text-center text-foreground">{pos.quantity || '—'}</td>
                  <td className="px-4 py-3.5 text-center text-foreground">{pos.width || '—'}</td>
                  <td className="px-4 py-3.5 text-center text-foreground">{pos.height || '—'}</td>
                  <td className="px-4 py-3.5 text-center text-foreground">{pos.area || '—'}</td>
                  <td className="px-4 py-3.5 text-center text-foreground">{pos.perimeter || '—'}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center">
                      <div className="w-14 h-14 bg-white rounded-xl border border-border shadow-sm p-1 group-hover:scale-110 group-hover:shadow-md transition-all duration-200">
                        {pos.qrDataUrl ? (
                          <img
                            src={pos.qrDataUrl}
                            alt={`QR ${pos.position}`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-200">
                            <QrCode className="w-6 h-6" />
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

      {/* Reset */}
      <div className="no-print flex justify-center pt-2">
        <button
          onClick={onReset}
          className="text-sm text-muted-foreground hover:text-[#1B2A4A] transition-colors underline-offset-4 hover:underline font-medium"
        >
          {t('back_home')}
        </button>
      </div>

      {/* Email modal */}
      {showEmailModal && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className={`bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 ${isRtl ? 'text-end' : ''}`}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <h3 className="text-lg font-bold text-[#1B2A4A] mb-4">{t('email_modal_title')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('email_address_label')}</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  placeholder={t('email_address_placeholder')}
                  dir="ltr"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A6FA5] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('email_subject_label')}</label>
                <input
                  type="text"
                  value={`QR Report — ${result.projectName || 'Document'}`}
                  readOnly
                  dir="ltr"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 text-slate-500 cursor-default"
                />
              </div>
              <p className="text-xs text-slate-500">{t('email_note')}</p>
            </div>
            <div className={`flex gap-3 mt-5 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={handleSendEmail}
                disabled={!emailTo.includes('@')}
                className="flex-1 flex items-center justify-center gap-2 bg-[#4A6FA5] hover:bg-[#3d5f94] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-3 rounded-xl transition-colors"
              >
                <Mail className="w-4 h-4" />
                {t('email_send')}
              </button>
              <button
                onClick={() => { setShowEmailModal(false); setEmailTo(''); }}
                className="px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {t('email_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
