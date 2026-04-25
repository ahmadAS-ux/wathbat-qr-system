import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { API_BASE } from '@/lib/api-base';
import { checkContractIntegrity, type IntegrityReport } from './contract-integrity';
import { ArrowRight, ArrowLeft, Printer, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import logo from '@assets/image_1774733777220.png';

/* ─── Print + Contract CSS ─────────────────────────────────────────────────── */
const PRINT_STYLE = `
@media screen {
  .contract-print-bg { background: #E8E6DF; }
  .contract-page {
    width: 210mm;
    min-height: 297mm;
    padding: 20mm 18mm;
    margin: 20px auto;
    background: #ffffff;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    box-sizing: border-box;
  }
}
@page {
  size: A4;
  margin: 18mm 16mm;
}
@media print {
  body { background: #ffffff !important; }
  .no-print { display: none !important; }
  .contract-page {
    width: auto !important;
    min-height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    page-break-after: always;
  }
  .contract-page:last-child { page-break-after: auto; }
  tr, .drawing-figure { page-break-inside: avoid; }
  thead { display: table-header-group; }
}
.contract-page {
  font-family: 'Tajawal', 'DM Sans', system-ui, sans-serif;
  color: #1a1a1a;
  line-height: 1.55;
}
.contract-page[dir="rtl"] { text-align: end; }
.positions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
  margin-top: 8mm;
}
.positions-table th, .positions-table td {
  border: 0.5pt solid #999;
  padding: 2mm 3mm;
  vertical-align: top;
}
.positions-table th { background: #f2f2f2; font-weight: 700; }
.positions-table .col-position { width: 18mm; white-space: nowrap; }
.positions-table .col-qty { width: 20mm; white-space: nowrap; text-align: center; }
.positions-table .col-price, .positions-table .col-total {
  width: 28mm;
  text-align: end;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.positions-table .totals-row td { font-weight: 700; background: #fafafa; }
.positions-table .grand-total-row td { font-weight: 700; font-size: 11pt; background: #eaeaea; }
.drawing-figure { width: 100%; max-width: 174mm; margin: 0 auto; text-align: center; }
.drawing-figure img { max-width: 100%; max-height: 240mm; object-fit: contain; }
.drawing-header { font-size: 11pt; font-weight: 600; margin-bottom: 6mm; text-align: start; }
`;

/* ─── Placeholder helpers ──────────────────────────────────────────────────── */
function renderPlaceholders(
  template: string,
  values: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const v = values[key];
    if (v === undefined || v === null || v === '') return _match;
    return String(v);
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface DrawingMeta {
  id: number;
  orderIndex: number;
  positionCode: string | null;
  mimeType: string;
}

interface ContractData {
  project: any;
  quotation: any | null;
  section: any | null;
  drawings: DrawingMeta[];
  template: Record<string, string>;
}

/* ─── Component ────────────────────────────────────────────────────────────── */
export default function ContractPage() {
  const { t, isRtl, language } = useLanguage();
  const [, params] = useRoute('/erp/projects/:id/contract');
  const [, navigate] = useLocation();
  const id = params?.id;

  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [overrideApproved, setOverrideApproved] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideLogging, setOverrideLogging] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/erp/projects/${id}/contract`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((d: ContractData) => {
        setData(d);
        setLoading(false);

        const today = new Date();
        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        const lang = language;
        const values: Record<string, string | null | undefined> = {
          customerName: d.project?.customerName,
          projectName: d.project?.name,
          quotationNumber: d.quotation?.quotationNumber,
          quotationDate: d.quotation?.quotationDate,
          deliveryDeadline: d.project?.deliveryDeadline ? formatDate(d.project.deliveryDeadline) : null,
          grandTotal: d.quotation?.grandTotal ? `${d.quotation.grandTotal} SAR` : null,
          subtotalNet: d.quotation?.subtotalNet ? `${d.quotation.subtotalNet} SAR` : null,
          taxRate: d.quotation?.taxRate ? `${d.quotation.taxRate}%` : null,
          taxAmount: d.quotation?.taxAmount ? `${d.quotation.taxAmount} SAR` : null,
          today: todayFormatted,
          companyName: lang === 'ar' ? 'وثبة للألمنيوم' : 'Wathbah Aluminum',
        };

        const rendered = {
          introAr: renderPlaceholders(d.template.contract_cover_intro_ar || '', values),
          introEn: renderPlaceholders(d.template.contract_cover_intro_en || '', values),
          termsAr: renderPlaceholders(d.template.contract_terms_ar || '', values),
          termsEn: renderPlaceholders(d.template.contract_terms_en || '', values),
          sigAr: renderPlaceholders(d.template.contract_signature_block_ar || '', values),
          sigEn: renderPlaceholders(d.template.contract_signature_block_en || '', values),
        };

        const rep = checkContractIntegrity({
          project: d.project,
          quotation: d.quotation,
          section: d.section,
          drawings: d.drawings,
          template: d.template,
          renderedIntroAr: rendered.introAr,
          renderedIntroEn: rendered.introEn,
          renderedTermsAr: rendered.termsAr,
          renderedTermsEn: rendered.termsEn,
          renderedSignatureAr: rendered.sigAr,
          renderedSignatureEn: rendered.sigEn,
        });
        setReport(rep);
      })
      .catch(() => {
        setLoadError(t('contract_load_error'));
        setLoading(false);
      });
  }, [id]);

  const today = new Date();
  const todayFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const values: Record<string, string | null | undefined> = data ? {
    customerName: data.project?.customerName,
    projectName: data.project?.name,
    quotationNumber: data.quotation?.quotationNumber,
    quotationDate: data.quotation?.quotationDate,
    deliveryDeadline: data.project?.deliveryDeadline ? formatDate(data.project.deliveryDeadline) : null,
    grandTotal: data.quotation?.grandTotal ? `${data.quotation.grandTotal} SAR` : null,
    subtotalNet: data.quotation?.subtotalNet ? `${data.quotation.subtotalNet} SAR` : null,
    taxRate: data.quotation?.taxRate ? `${data.quotation.taxRate}%` : null,
    taxAmount: data.quotation?.taxAmount ? `${data.quotation.taxAmount} SAR` : null,
    today: todayFormatted,
    companyName: language === 'ar' ? 'وثبة للألمنيوم' : 'Wathbah Aluminum',
  } : {};

  const rendered = data ? {
    introAr: renderPlaceholders(data.template.contract_cover_intro_ar || '', values),
    introEn: renderPlaceholders(data.template.contract_cover_intro_en || '', values),
    termsAr: renderPlaceholders(data.template.contract_terms_ar || '', values),
    termsEn: renderPlaceholders(data.template.contract_terms_en || '', values),
    sigAr: renderPlaceholders(data.template.contract_signature_block_ar || '', values),
    sigEn: renderPlaceholders(data.template.contract_signature_block_en || '', values),
  } : null;

  const handlePrint = async () => {
    if (!id) return;
    try {
      await fetch(`${API_BASE}/api/erp/projects/${id}/contract/mark-printed`, { method: 'POST' });
    } catch {}
    window.print();
  };

  const handleOverride = async () => {
    if (!id || !report) return;
    setOverrideLogging(true);
    try {
      await fetch(`${API_BASE}/api/erp/projects/${id}/contract/override-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueCodes: report.issues.map(i => i.code) }),
      });
    } catch {}
    setOverrideLogging(false);
    setOverrideApproved(true);
    setShowOverrideModal(false);
    window.print();
  };

  const canPrintNow = report?.canPrint || overrideApproved;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400 text-sm">
        {t('contract_loading')}
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500 text-sm">
        {loadError || t('error_unexpected')}
      </div>
    );
  }

  const positions: any[] = data.quotation?.positions || [];

  return (
    <>
      {/* Inject print CSS */}
      <style>{PRINT_STYLE}</style>

      {/* Top bar — hidden on print */}
      <div
        className="no-print sticky top-0 z-40 bg-[#FAFAF7] border-b border-[#ECEAE2] px-4 py-3 shadow-sm"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className={`flex items-center gap-3 max-w-[230mm] mx-auto ${isRtl ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={() => navigate(`/erp/projects/${id}`)}
            className={`flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#1B2A4A] transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
          >
            {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {t('contract_back')}
          </button>
          <div className="flex-1" />

          {/* Integrity badge */}
          {report && (
            <span
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                report.overall === 'green'
                  ? 'bg-green-100 text-green-700'
                  : report.overall === 'amber'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
              } ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
            >
              {report.overall === 'green'
                ? <CheckCircle className="w-3.5 h-3.5" />
                : report.overall === 'amber'
                  ? <AlertTriangle className="w-3.5 h-3.5" />
                  : <AlertCircle className="w-3.5 h-3.5" />}
              {report.overall === 'green'
                ? t('contract_integrity_green')
                : report.overall === 'amber'
                  ? t('contract_integrity_amber')
                  : t('contract_integrity_red')}
            </span>
          )}

          <button
            onClick={handlePrint}
            disabled={!canPrintNow}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#1B2A4A] text-white rounded-xl hover:bg-[#243860] disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
          >
            <Printer className="w-4 h-4" />
            {t('contract_print')}
          </button>
        </div>
      </div>

      {/* Integrity banner — hidden on print */}
      {report && report.overall !== 'green' && (
        <div
          className={`no-print max-w-[230mm] mx-auto mt-4 mb-0 rounded-xl border p-4 ${
            report.overall === 'amber'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
          }`}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <p className={`font-semibold text-sm mb-2 ${report.overall === 'amber' ? 'text-amber-800' : 'text-red-800'} ${isRtl ? 'font-[Tajawal]' : ''}`}>
            {report.overall === 'amber' ? t('contract_integrity_amber') : t('contract_integrity_red')}
          </p>
          <ul className="space-y-1">
            {report.issues.map(issue => (
              <li key={issue.code} className={`text-sm flex items-start gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className={issue.severity === 'error' ? 'text-red-500' : 'text-amber-500'}>
                  {issue.severity === 'error' ? '🔴' : '🟡'}
                </span>
                <span className={`${issue.severity === 'error' ? 'text-red-700' : 'text-amber-700'} ${isRtl ? 'font-[Tajawal]' : ''}`}>
                  {isRtl ? issue.messageAr : issue.messageEn}
                </span>
              </li>
            ))}
          </ul>
          {report.overall === 'red' && !overrideApproved && (
            <button
              onClick={() => setShowOverrideModal(true)}
              className={`mt-3 text-sm text-red-600 underline hover:text-red-800 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
            >
              {t('contract_override_button')}
            </button>
          )}
        </div>
      )}

      {/* Override confirmation modal */}
      {showOverrideModal && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowOverrideModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            dir={isRtl ? 'rtl' : 'ltr'}
            onClick={e => e.stopPropagation()}
          >
            <h3 className={`text-base font-bold text-slate-900 mb-2 ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('contract_override_confirm_title')}
            </h3>
            <p className={`text-sm text-slate-600 mb-5 ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {t('contract_override_confirm_body')}
            </p>
            <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={handleOverride}
                disabled={overrideLogging}
                className={`flex-1 px-4 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
              >
                {t('contract_override_button')}
              </button>
              <button
                onClick={() => setShowOverrideModal(false)}
                className={`flex-1 px-4 py-2.5 text-sm font-semibold border border-[#ECEAE2] text-slate-700 rounded-xl hover:bg-[#ECEAE2] transition-colors ${isRtl ? 'font-[Tajawal]' : ''}`}
              >
                {t('erp_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract content */}
      <div className="contract-print-bg py-6">

        {/* PAGE 1: Cover */}
        <div className="contract-page" dir="rtl">
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '8mm' }}>
            <img src={logo} alt="Wathbah" style={{ height: '50px', objectFit: 'contain' }} />
          </div>

          {/* Title */}
          <h1 style={{ textAlign: 'center', fontSize: '18pt', fontWeight: 700, color: '#1B2A4A', marginBottom: '6mm', fontFamily: 'Tajawal, sans-serif' }}>
            {t('contract_title')}
          </h1>

          {/* Project / Customer info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2mm', marginBottom: '8mm', fontSize: '11pt', fontFamily: 'Tajawal, sans-serif' }}>
            <div>
              <span style={{ fontWeight: 700 }}>{t('contract_page_project')}: </span>
              <span dir="ltr" className="ltr">{data.project?.name}</span>
            </div>
            <div>
              <span style={{ fontWeight: 700 }}>{t('contract_page_customer')}: </span>
              <span>{data.project?.customerName}</span>
            </div>
          </div>

          {/* Cover intro Arabic */}
          {rendered?.introAr && (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '11pt', lineHeight: 1.8, fontFamily: 'Tajawal, sans-serif', marginBottom: '6mm' }} dir="rtl">
              {rendered.introAr}
            </div>
          )}

          {/* Cover intro English */}
          {rendered?.introEn && (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '10pt', lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif", color: '#333', marginTop: '6mm' }} dir="ltr">
              {rendered.introEn}
            </div>
          )}
        </div>

        {/* PAGE 2: Positions Table */}
        <div className="contract-page" dir={isRtl ? 'rtl' : 'ltr'}>
          {/* Header */}
          <div style={{ marginBottom: '4mm', fontFamily: 'Tajawal, sans-serif' }}>
            <div style={{ fontSize: '14pt', fontWeight: 700, color: '#1B2A4A', marginBottom: '3mm' }}>
              {t('contract_page_project')}: <span dir="ltr" className="ltr">{data.project?.name}</span>
            </div>
            <div style={{ display: 'flex', gap: '8mm', fontSize: '10pt', color: '#555' }}>
              <span>{t('contract_page_quotation_no')}: <span dir="ltr" className="ltr">{data.quotation?.quotationNumber ?? '—'}</span></span>
              <span>{t('contract_page_date')}: <span dir="ltr" className="ltr">{data.quotation?.quotationDate ?? todayFormatted}</span></span>
            </div>
          </div>

          {positions.length > 0 ? (
            <table className="positions-table">
              <thead>
                <tr>
                  <th className="col-position">{t('contract_table_position')}</th>
                  <th className="col-qty">{t('contract_table_quantity')}</th>
                  <th className="col-desc">{t('contract_table_description')}</th>
                  <th className="col-price">{t('contract_table_price')}</th>
                  <th className="col-total">{t('contract_table_total')}</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos: any, idx: number) => (
                  <tr key={idx}>
                    <td className="col-position" dir="ltr">{pos.position ?? ''}</td>
                    <td className="col-qty">{pos.quantity ?? ''}</td>
                    <td>{pos.description ?? ''}</td>
                    <td className="col-price" dir="ltr">{pos.unitPrice ?? ''}</td>
                    <td className="col-total" dir="ltr">{pos.lineTotal ?? ''}</td>
                  </tr>
                ))}
                {data.quotation?.subtotalNet && (
                  <tr className="totals-row">
                    <td colSpan={3} />
                    <td style={{ textAlign: 'end' }}>{t('contract_subtotal_net')}</td>
                    <td className="col-total" dir="ltr">{data.quotation.subtotalNet}</td>
                  </tr>
                )}
                {data.quotation?.taxAmount && (
                  <tr className="totals-row">
                    <td colSpan={3} />
                    <td style={{ textAlign: 'end' }}>
                      {t('contract_vat')}
                      {data.quotation.taxRate && <span dir="ltr" className="ltr"> ({data.quotation.taxRate}%)</span>}
                    </td>
                    <td className="col-total" dir="ltr">{data.quotation.taxAmount}</td>
                  </tr>
                )}
                {data.quotation?.grandTotal && (
                  <tr className="grand-total-row">
                    <td colSpan={3} />
                    <td style={{ textAlign: 'end' }}>{t('contract_grand_total')}</td>
                    <td className="col-total" dir="ltr">{data.quotation.grandTotal}</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#999', fontSize: '10pt', fontFamily: 'Tajawal, sans-serif' }}>
              {t('contract_no_quotation')}
            </p>
          )}
        </div>

        {/* PAGES 3..N: Drawings */}
        {data.drawings.map((drawing, idx) => {
          const matchedPosition = positions[idx];
          const headerLabel = drawing.positionCode
            ? `${t('contract_position')}: ${drawing.positionCode}`
            : matchedPosition?.position
              ? `${t('contract_position')}: ${matchedPosition.position}`
              : `${t('contract_drawing')} ${drawing.orderIndex + 1}`;

          return (
            <div key={drawing.id} className="contract-page" dir="ltr">
              <div className="drawing-header">{headerLabel}</div>
              <figure className="drawing-figure">
                <img
                  src={`${API_BASE}/api/erp/drawings/${drawing.id}`}
                  alt={`Drawing ${drawing.orderIndex + 1}`}
                  loading="lazy"
                />
              </figure>
            </div>
          );
        })}

        {/* PAGE N+1: Terms + Signatures */}
        <div className="contract-page">
          {/* Terms Arabic */}
          {rendered?.termsAr && (
            <div style={{ marginBottom: '8mm' }} dir="rtl">
              <h2 style={{ fontSize: '13pt', fontWeight: 700, marginBottom: '4mm', fontFamily: 'Tajawal, sans-serif' }}>
                {t('contract_terms_heading')}
              </h2>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '10pt', lineHeight: 1.8, fontFamily: 'Tajawal, sans-serif' }}>
                {rendered.termsAr}
              </div>
            </div>
          )}

          {/* Terms English */}
          {rendered?.termsEn && (
            <div style={{ marginBottom: '8mm' }} dir="ltr">
              <h2 style={{ fontSize: '13pt', fontWeight: 700, marginBottom: '4mm', fontFamily: "'DM Sans', sans-serif" }}>
                {t('contract_terms_heading')}
              </h2>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '10pt', lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>
                {rendered.termsEn}
              </div>
            </div>
          )}

          {/* Signature block Arabic */}
          {rendered?.sigAr && (
            <div style={{ marginTop: '12mm', whiteSpace: 'pre-wrap', fontSize: '10pt', lineHeight: 2.2, fontFamily: 'Tajawal, sans-serif' }} dir="rtl">
              {rendered.sigAr}
            </div>
          )}

          {/* Signature block English */}
          {rendered?.sigEn && (
            <div style={{ marginTop: '8mm', whiteSpace: 'pre-wrap', fontSize: '10pt', lineHeight: 2.2, fontFamily: "'DM Sans', sans-serif" }} dir="ltr">
              {rendered.sigEn}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
