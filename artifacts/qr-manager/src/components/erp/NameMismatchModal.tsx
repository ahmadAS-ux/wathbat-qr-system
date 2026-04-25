import { AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

export type NameMismatchChoice = 'cancel' | 'proceed' | 'proceedAndUpdate';

interface Props {
  nameInFile: string;
  nameInSystem: string;
  onChoice: (choice: NameMismatchChoice) => void;
}

export function NameMismatchModal({ nameInFile, nameInSystem, onChoice }: Props) {
  const { t, isRtl } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => onChoice('cancel')}
    >
      <div
        className="bg-[#FAFAF7] rounded-xl shadow-2xl w-full max-w-md border border-[#ECEAE2] overflow-hidden"
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-[#ECEAE2] ${isRtl ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <h3 className={`font-semibold text-slate-900 text-sm ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('name_mismatch_title')}
            </h3>
          </div>
          <button
            onClick={() => onChoice('cancel')}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className={`text-sm text-slate-600 ${isRtl ? 'font-[Tajawal]' : ''}`}>
            {t('name_mismatch_body')}
          </p>

          <div className="rounded-xl bg-[#F4F2EB] border border-[#ECEAE2] p-4 space-y-3 text-sm">
            <div>
              <p className={`text-xs text-slate-400 mb-1 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('name_mismatch_in_file')}</p>
              <p className="font-semibold text-slate-700" dir="ltr">"{nameInFile}"</p>
            </div>
            <div>
              <p className={`text-xs text-slate-400 mb-1 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('name_mismatch_in_system')}</p>
              <p className="font-semibold text-[#1B2A4A]" dir="ltr">"{nameInSystem}"</p>
            </div>
          </div>

          <div className={`flex flex-col gap-2 pt-1`}>
            <button
              onClick={() => onChoice('proceedAndUpdate')}
              className={`w-full px-4 py-2.5 text-sm font-semibold bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
            >
              {t('name_mismatch_proceed_update')}
            </button>
            <button
              onClick={() => onChoice('proceed')}
              className={`w-full px-4 py-2.5 text-sm font-semibold border border-[#ECEAE2] text-slate-700 rounded-xl hover:bg-[#F4F2EB] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
            >
              {t('name_mismatch_proceed')}
            </button>
            <button
              onClick={() => onChoice('cancel')}
              className={`w-full px-4 py-2 text-sm text-slate-400 hover:text-slate-600 rounded-xl hover:bg-[#F4F2EB] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
            >
              {t('name_mismatch_cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
