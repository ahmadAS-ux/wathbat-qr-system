import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { API_BASE } from '@/lib/api-base';

// ---- Types ----------------------------------------------------------------

interface QuotationPosition {
  position: string;
  quantity: number;
  description: string;
  unitPrice: string;
  lineTotal: string;
}

interface ParsedQuotation {
  quotationNumber: string | null;
  quotationDate: string | null;
  currency: string;
  positions: QuotationPosition[];
  subtotalNet: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  grandTotal: string | null;
  dedupedPositionCount: number;
}

interface SectionDrawing {
  id: number;
  orderIndex: number;
  positionCode: string | null;
  mediaFilename: string;
  mimeType: string;
}

interface ParsedSection {
  system: string | null;
  drawingCount: number;
  drawings: SectionDrawing[];
}

interface AssemblyGlassItem {
  quantity: number;
  widthMm: number;
  heightMm: number;
  areaSqm: number;
  description: string;
}

interface AssemblyPosition {
  positionCode: string;
  quantity: number;
  system: string | null;
  widthMm: number | null;
  heightMm: number | null;
  glassItems: AssemblyGlassItem[];
}

interface ParsedAssemblyList {
  positionCount: number;
  positions: AssemblyPosition[];
}

interface CutProfile {
  number: string;
  description: string;
  colour: string;
  quantity: number;
  lengthMm: number;
  wastageMm: number;
  wastagePercent: number;
}

interface ParsedCutOptimisation {
  profileCount: number;
  profiles: CutProfile[];
}

type FileType = 'quotation' | 'section' | 'assembly_list' | 'cut_optimisation';
type Payload = ParsedQuotation | ParsedSection | ParsedAssemblyList | ParsedCutOptimisation;
type ModalState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'data'; payload: Payload };

// ---- Sub-components (defined outside to avoid inline component rule) ------

type TFn = (key: string) => string;

function QuotationContent({ data, isRtl, t }: { data: ParsedQuotation; isRtl: boolean; t: TFn }) {
  return (
    <div className="space-y-4">
      <div className={`flex gap-4 text-xs text-slate-500 ${isRtl ? 'flex-row-reverse' : ''}`}>
        {data.quotationNumber !== null ? (
          <span dir="ltr" className="font-medium text-[#141A24]"># {data.quotationNumber}</span>
        ) : null}
        {data.quotationDate !== null ? (
          <span dir="ltr">{data.quotationDate}</span>
        ) : null}
      </div>

      {Array.isArray(data.positions) && data.positions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-slate-600" dir="ltr">
            <thead>
              <tr className="text-slate-400 border-b border-[#ECEAE2]">
                <th className="text-start pb-2 font-medium">{t('table_position')}</th>
                <th className="text-start pb-2 font-medium">{t('cut_opt_description')}</th>
                <th className="text-end pb-2 font-medium">{t('cut_opt_qty')}</th>
                <th className="text-end pb-2 font-medium">{t('quotation_unit_price')}</th>
                <th className="text-end pb-2 font-medium">{t('quotation_line_total')}</th>
              </tr>
            </thead>
            <tbody>
              {data.positions.map((pos, i) => (
                <tr key={i} className="border-b border-[#ECEAE2]/50 last:border-0">
                  <td className="py-1.5 font-medium text-[#141A24] shrink-0">{pos.position}</td>
                  <td className="py-1.5 max-w-[160px] truncate">{pos.description}</td>
                  <td className="py-1.5 text-end">{pos.quantity}</td>
                  <td className="py-1.5 text-end">{pos.unitPrice}</td>
                  <td className="py-1.5 text-end font-medium">{pos.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {(data.subtotalNet ?? data.grandTotal) !== null ? (
        <div className={`border-t border-[#ECEAE2] pt-3 space-y-1.5`}>
          {data.subtotalNet !== null ? (
            <div className={`flex justify-between text-xs text-slate-500 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <span className={isRtl ? 'font-[Tajawal]' : ''}>{t('quotation_subtotal')}</span>
              <span dir="ltr">{data.subtotalNet} {data.currency}</span>
            </div>
          ) : null}
          {data.taxAmount !== null ? (
            <div className={`flex justify-between text-xs text-slate-500 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <span className={isRtl ? 'font-[Tajawal]' : ''}>
                {t('quotation_tax')}{data.taxRate !== null ? ` (${data.taxRate})` : ''}
              </span>
              <span dir="ltr">{data.taxAmount} {data.currency}</span>
            </div>
          ) : null}
          {data.grandTotal !== null ? (
            <div className={`flex justify-between text-sm font-semibold text-[#141A24] ${isRtl ? 'flex-row-reverse' : ''}`}>
              <span className={isRtl ? 'font-[Tajawal]' : ''}>{t('quotation_grand_total')}</span>
              <span dir="ltr">{data.grandTotal} {data.currency}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SectionContent({ data, isRtl, t }: { data: ParsedSection; isRtl: boolean; t: TFn }) {
  return (
    <div className="space-y-3">
      {data.system !== null ? (
        <div className={`flex items-center gap-2 text-sm ${isRtl ? 'flex-row-reverse' : ''}`}>
          <span className={`text-slate-400 text-xs ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('section_system')}:</span>
          <span dir="ltr" className="font-medium text-[#141A24]">{data.system}</span>
        </div>
      ) : null}

      <div className={`flex items-center gap-2 text-xs text-slate-500 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <span className={isRtl ? 'font-[Tajawal]' : ''}>{t('section_drawings')}:</span>
        <span className="font-semibold text-[#141A24]">{data.drawingCount}</span>
      </div>

      {data.drawings.length > 0 ? (
        <div className="space-y-1">
          {data.drawings.map((d) => (
            <div
              key={d.id}
              className={`flex items-center gap-2 text-xs text-slate-600 py-1 border-b border-[#ECEAE2]/60 last:border-0 ${isRtl ? 'flex-row-reverse' : ''}`}
            >
              <span className="text-slate-400 shrink-0 w-5 text-end" dir="ltr">{d.orderIndex}</span>
              {d.positionCode !== null ? (
                <span className="font-medium text-[#141A24] shrink-0" dir="ltr">{d.positionCode}</span>
              ) : null}
              <span className="text-slate-400 truncate" dir="ltr">{d.mediaFilename}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AssemblyListContent({ data, isRtl, t }: { data: ParsedAssemblyList; isRtl: boolean; t: TFn }) {
  return (
    <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3 text-sm">
      <p className={`text-xs font-semibold text-teal-700 mb-2 ${isRtl ? 'font-[Tajawal]' : ''}`}>
        {t('assembly_list_parsed_positions').replace('{count}', String(data.positionCount))}
      </p>
      <div className="space-y-1.5">
        {data.positions.map((pos, i) => (
          <div key={i} className={`flex items-start gap-2 text-xs text-slate-600 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span className="font-semibold text-[#141A24] shrink-0" dir="ltr">{pos.positionCode}</span>
            <span className="text-slate-400 shrink-0">{pos.quantity} {t('assembly_list_pcs')}</span>
            {pos.widthMm !== null && pos.heightMm !== null ? (
              <span className="text-slate-400 shrink-0" dir="ltr">{pos.widthMm} × {pos.heightMm} mm</span>
            ) : null}
            {pos.glassItems.length > 0 ? (
              <span className="text-slate-400 truncate">{pos.glassItems[0].description}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CutOptContent({ data, isRtl, t }: { data: ParsedCutOptimisation; isRtl: boolean; t: TFn }) {
  return (
    <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3 text-sm">
      <p className={`text-xs font-semibold text-teal-700 mb-2 ${isRtl ? 'font-[Tajawal]' : ''}`}>
        {t('cut_opt_parsed_profiles').replace('{count}', String(data.profileCount))}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-slate-600" dir="ltr">
          <thead>
            <tr className="text-slate-400 border-b border-teal-100">
              <th className="text-start pb-1 font-medium">{t('cut_opt_number')}</th>
              <th className="text-start pb-1 font-medium">{t('cut_opt_description')}</th>
              <th className="text-end pb-1 font-medium">{t('cut_opt_qty')}</th>
              <th className="text-end pb-1 font-medium">{t('cut_opt_wastage_pct')}</th>
            </tr>
          </thead>
          <tbody>
            {data.profiles.slice(0, 10).map((p, i) => (
              <tr key={i} className="border-b border-teal-50 last:border-0">
                <td className="py-0.5 font-medium text-[#141A24]">{p.number}</td>
                <td className="py-0.5 truncate max-w-[120px]">{p.description}</td>
                <td className="py-0.5 text-end">{p.quantity}</td>
                <td className="py-0.5 text-end">{p.wastagePercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.profileCount > 10 ? (
          <p className={`text-xs text-slate-400 mt-1 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
            +{data.profileCount - 10} {t('cut_opt_more_profiles')}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ---- Endpoint map ---------------------------------------------------------

const ENDPOINT_MAP: Record<FileType, string> = {
  quotation: 'parsed-quotation',
  section: 'parsed-section',
  assembly_list: 'parsed-assembly-list',
  cut_optimisation: 'parsed-cut-optimisation',
};

// ---- Main component -------------------------------------------------------

interface Props {
  projectId: number;
  fileType: FileType;
  onClose: () => void;
}

export function ParsedDataPreviewModal({ projectId, fileType, onClose }: Props) {
  const { t, isRtl } = useLanguage();
  const [state, setState] = useState<ModalState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/erp/projects/${projectId}/${ENDPOINT_MAP[fileType]}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) { setState({ status: 'empty' }); return; }
        if (!res.ok) { setState({ status: 'error' }); return; }
        const data = await res.json();
        if (data === null) { setState({ status: 'empty' }); return; }
        setState({ status: 'data', payload: data as Payload });
      })
      .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [projectId, fileType]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#FAFAF7] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-[#ECEAE2] overflow-hidden"
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-[#ECEAE2] shrink-0 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <h3 className={`font-semibold text-slate-900 text-sm ${isRtl ? 'font-[Tajawal]' : ''}`}>
            {t('file_preview_title')}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-[#ECEAE2] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {state.status === 'loading' ? (
            <div className={`flex items-center gap-2 text-sm text-slate-500 ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              {t('file_preview_loading')}
            </div>
          ) : state.status === 'error' ? (
            <p className={`text-sm text-slate-500 ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('file_preview_error')}
            </p>
          ) : state.status === 'empty' ? (
            <p className={`text-sm text-slate-500 ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('file_preview_no_data')}
            </p>
          ) : fileType === 'quotation' ? (
            <QuotationContent data={state.payload as ParsedQuotation} isRtl={isRtl} t={t} />
          ) : fileType === 'section' ? (
            <SectionContent data={state.payload as ParsedSection} isRtl={isRtl} t={t} />
          ) : fileType === 'assembly_list' ? (
            <AssemblyListContent data={state.payload as ParsedAssemblyList} isRtl={isRtl} t={t} />
          ) : (
            <CutOptContent data={state.payload as ParsedCutOptimisation} isRtl={isRtl} t={t} />
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-3 border-t border-[#ECEAE2] shrink-0 flex ${isRtl ? 'justify-start' : 'justify-end'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-semibold bg-[#141A24] text-white rounded-xl hover:bg-[#0B1019] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
          >
            {t('file_preview_close')}
          </button>
        </div>
      </div>
    </div>
  );
}
