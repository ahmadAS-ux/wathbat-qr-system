import { RotateCcw, X } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReUploadConfirmModal({ onConfirm, onCancel }: Props) {
  const { t, isRtl } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-[#FAFAF7] rounded-xl shadow-2xl w-full max-w-sm border border-[#ECEAE2] overflow-hidden"
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b border-[#ECEAE2] ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <RotateCcw className="w-4 h-4 text-amber-500 shrink-0" />
            <h3 className={`font-semibold text-slate-900 text-sm ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('reupload_title')}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-[#ECEAE2] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className={`text-sm text-slate-600 mb-5 ${isRtl ? 'font-[Tajawal]' : ''}`}>
            {t('reupload_body')}
          </p>
          <div className={`flex gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button
              autoFocus
              onClick={onCancel}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
            >
              {t('erp_cancel')}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold border border-[#ECEAE2] text-slate-700 rounded-xl hover:bg-[#F4F2EB] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
            >
              {t('reupload_confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
