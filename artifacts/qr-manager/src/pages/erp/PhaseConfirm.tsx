import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useLanguage } from '@/hooks/use-language';
import { CheckCircle2, Loader2, AlertTriangle, MessageCircle } from 'lucide-react';

// This is a PUBLIC page — no auth, no AdminLayout.
// Customers access it via a QR code link.
// Uses direct fetch without API_BASE because it's a public page served relative to the domain.

interface PhaseInfo {
  id: number;
  projectId: number;
  projectName: string;
  customerName: string;
  phaseNumber: number;
  label: string | null;
  status: string;
  customerConfirmed: boolean;
  customerConfirmedAt: string | null;
}

export default function PhaseConfirm() {
  const { t, isRtl } = useLanguage();
  const params = useParams() as { phaseId: string };
  const phaseId = Number(params.phaseId);

  const [phase, setPhase] = useState<PhaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (Number.isNaN(phaseId)) { setError('invalid'); setLoading(false); return; }
    fetch(`/api/erp/phases/${phaseId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: PhaseInfo) => {
        setPhase(d);
        if (d.customerConfirmed) setConfirmed(true);
      })
      .catch(() => setError('not_found'))
      .finally(() => setLoading(false));
  }, [phaseId]);

  const handleConfirm = async () => {
    if (!phase) return;
    setConfirming(true);
    try {
      await fetch(`/api/erp/phases/${phaseId}/confirm`, { method: 'POST' });
      setConfirmed(true);

      // Open WhatsApp with pre-filled message
      const today = new Date().toLocaleDateString('ar-SA');
      const msg = t('confirm_whatsapp_msg')
        .replace('{phase}', String(phase.phaseNumber))
        .replace('{project}', phase.projectName)
        .replace('{date}', today);
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } catch {
      // Even if the API call fails, open WhatsApp
      setConfirmed(true);
    } finally {
      setConfirming(false);
    }
  };

  const phaseStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: t('phase_status_pending'),
      manufacturing: t('phase_status_manufacturing'),
      delivered: t('phase_status_delivered'),
      installed: t('phase_status_installed'),
      signed_off: t('phase_status_signed_off'),
    };
    return map[s] ?? s;
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#1B2A4A] to-[#0F1A30] flex items-center justify-center p-4"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-sm">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl font-bold">W</span>
          </div>
          <p className="text-white/50 text-sm" dir="ltr">Wathbat Aluminum</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-white/60" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className={`text-slate-600 text-sm ${isRtl ? 'font-[Tajawal]' : ''}`}>
              {error === 'invalid' ? 'Invalid QR code' : 'Phase not found'}
            </p>
          </div>
        ) : phase && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="bg-[#1B2A4A] px-6 py-5">
              <h1 className={`text-white font-bold text-lg ${isRtl ? 'font-[Tajawal]' : ''}`}>
                {t('confirm_page_title')}
              </h1>
            </div>

            {/* Phase Info */}
            <div className="px-6 py-5 space-y-3">
              <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-[#1B2A4A]/8 flex items-center justify-center shrink-0">
                  <span className="text-[#1B2A4A] font-bold text-lg">{phase.phaseNumber}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-[#1B2A4A] text-sm ${isRtl ? 'font-[Tajawal]' : ''}`}>
                    {t('confirm_phase_label')} {phase.phaseNumber}
                    {phase.label && ` — ${phase.label}`}
                  </p>
                  <p className={`text-xs text-slate-500 mt-0.5 truncate ${isRtl ? 'font-[Tajawal]' : ''}`}>
                    {t('confirm_project_label')}: {phase.projectName}
                  </p>
                </div>
              </div>

              <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {phaseStatusLabel(phase.status)}
                </span>
              </div>
            </div>

            {/* Action / Success */}
            <div className="px-6 pb-6">
              {confirmed ? (
                <div className="text-center space-y-3 py-4">
                  <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-teal-600" />
                  </div>
                  <div>
                    <p className={`font-bold text-teal-700 ${isRtl ? 'font-[Tajawal]' : ''}`}>
                      {t('confirm_success_title')}
                    </p>
                    <p className={`text-sm text-slate-500 mt-1 ${isRtl ? 'font-[Tajawal]' : ''}`}>
                      {t('confirm_success_body')}
                    </p>
                  </div>
                  {phase.customerConfirmedAt && (
                    <p className="text-xs text-slate-400" dir="ltr">
                      {new Date(phase.customerConfirmedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className={`w-full flex items-center justify-center gap-3 py-4 px-5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-60 text-sm ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
                >
                  {confirming ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <MessageCircle className="w-5 h-5 shrink-0" />
                  )}
                  {t('confirm_button')}
                </button>
              )}
            </div>

          </div>
        )}

        <p className="text-center text-white/25 text-xs mt-6" dir="ltr">wathbat.sa</p>
      </div>
    </div>
  );
}
