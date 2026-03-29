import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Phone, MessageSquare, ChevronDown, Package, Ruler, Hash, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

const NOTES_MAX = 200;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const REASONS_EN = [
  'Item Received / استلام القطعة',
  'Manufacturing Defect / عيب تصنيع',
  'Maintenance Request / طلب صيانة',
  'Replacement Request / طلب استبدال',
  'Order Inquiry / استفسار عن الطلبية',
];

const REASONS_AR = [
  'استلام القطعة / Item Received',
  'الإبلاغ عن عيب تصنيع / Report Defect',
  'طلب صيانة / Maintenance Request',
  'طلب استبدال / Replacement Request',
  'استفسار عن الطلبية / Order Inquiry',
];

function isValidSaudiPhone(v: string) {
  return /^05\d{8}$/.test(v.replace(/\s/g, ''));
}

function SnapchatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12.065.001c1.246.002 5.273.371 7.093 4.5.544 1.233.414 3.334.31 5.033l-.006.1c.164.083.358.126.572.126.305 0 .63-.09.924-.264.12-.071.247-.106.37-.106.242 0 .467.136.574.349.139.276.085.612-.163.822-.062.052-1.498 1.25-1.857 2.398l-.032.107.1.069c1.28.875 3.4 1.427 4.05 1.603.102.027.29.1.386.293.103.202.073.455-.08.68-.66.974-2.347 1.534-5.02 1.666-.14.027-.221.13-.282.264-.112.25-.208.72-.308 1.213-.113.558-.23 1.135-.423 1.59-.1.238-.31.368-.555.368-.11 0-.226-.026-.343-.077-.366-.16-.815-.249-1.333-.249-.493 0-.936.088-1.35.243-.65.244-1.248.745-1.988 1.332-.733.58-1.565 1.239-2.765 1.239h-.096c-1.2 0-2.031-.658-2.764-1.239-.74-.587-1.338-1.088-1.99-1.332-.413-.155-.856-.243-1.349-.243-.519 0-.968.089-1.333.249-.117.051-.234.077-.343.077-.244 0-.455-.13-.554-.368-.194-.455-.312-1.032-.424-1.59-.1-.493-.195-.963-.307-1.213-.062-.133-.143-.237-.268-.261-2.687-.133-4.375-.692-5.035-1.666-.153-.225-.183-.478-.08-.68.097-.194.284-.266.387-.293.648-.176 2.77-.728 4.049-1.603l.101-.07-.032-.106c-.359-1.148-1.795-2.346-1.857-2.398-.248-.21-.302-.546-.163-.822.107-.213.332-.349.574-.349.123 0 .25.035.371.106.293.174.618.264.923.264.215 0 .409-.043.578-.128l-.007-.098c-.104-1.7-.233-3.8.31-5.034C6.748.372 10.82.003 12.065.001z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.25 8.25 0 0 0 4.83 1.56V6.81a4.85 4.85 0 0 1-1.07-.12z" />
    </svg>
  );
}

export default function Scan() {
  const { language, setLanguage, t, isRtl } = useLanguage();

  const params = new URLSearchParams(window.location.search);
  const pos = params.get('pos') || '';
  const w = params.get('w') || '';
  const h = params.get('h') || '';
  const qty = params.get('qty') || '';
  const ref = params.get('ref') || '';
  const isValidScan = Boolean(pos);

  const [reason, setReason] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneBlurred, setPhoneBlurred] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const reasons = isRtl ? REASONS_AR : REASONS_EN;
  const phoneValid = isValidSaudiPhone(phone);
  const phoneError = phoneBlurred && phone.length > 0 && !phoneValid;
  const canSubmit = reason && phoneValid && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${BASE}/api/admin/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId: pos,
          requestType: reason,
          customerPhone: phone.replace(/\s/g, ''),
          projectName: ref || undefined,
          message: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setSubmitted(true);
    } catch {
      setSubmitError(isRtl ? 'حدث خطأ. يرجى المحاولة مرة أخرى.' : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLang = () => setLanguage(language === 'ar' ? 'en' : 'ar');

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#F8F9FB] flex flex-col"
      style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}
    >
      {/* ── Top bar ── */}
      <div className="bg-[#1B2A4A] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#4A6FA5] flex items-center justify-center">
            <span className="text-white font-bold text-xs">و</span>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">وثبة للألمنيوم</p>
            <p className="text-[10px] text-white/50 leading-tight">Wathbat Aluminum</p>
          </div>
        </div>
        <button
          onClick={toggleLang}
          className="text-xs font-semibold text-white/70 hover:text-white border border-white/20 rounded-full px-3 py-1 transition-colors"
        >
          {t('scan_lang_toggle')}
        </button>
      </div>

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-6 space-y-4">
        <AnimatePresence mode="wait">
          {!isValidScan ? (
            <motion.div
              key="invalid"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-16 flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-[#1B2A4A] font-semibold text-base">{t('scan_invalid_qr')}</p>
            </motion.div>
          ) : submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-10 flex flex-col items-center text-center gap-5"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </motion.div>
              <div>
                <h2 className="text-xl font-extrabold text-[#1B2A4A] mb-1">{t('scan_success_title')}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{t('scan_success_desc')}</p>
              </div>
              <div className="w-full bg-white border border-border/50 rounded-2xl p-4 text-sm space-y-1.5">
                <div className={`flex items-center justify-between gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <span className="text-muted-foreground">{t('scan_position')}</span>
                  <span className="font-bold text-[#1B2A4A]">{pos}</span>
                </div>
                {ref && (
                  <div className={`flex items-center justify-between gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <span className="text-muted-foreground">{t('scan_order_ref')}</span>
                    <span className="font-semibold text-[#1B2A4A]">{ref}</span>
                  </div>
                )}
                <div className={`flex items-center justify-between gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <span className="text-muted-foreground">{t('scan_reason_label')}</span>
                  <span className="font-semibold text-[#1B2A4A] text-end">{reason}</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* ── Product Info Card ── */}
              <div className="rounded-2xl bg-[#1B2A4A] text-white p-5 space-y-3">
                <div className={`flex items-center gap-2 mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <Package className="w-4 h-4 text-[#4A6FA5]" />
                  <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">{t('scan_product_title')}</h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className={`bg-white/10 rounded-xl p-3 ${isRtl ? 'text-right' : ''}`}>
                    <p className="text-[10px] text-white/50 uppercase tracking-wider mb-0.5">{t('scan_position')}</p>
                    <p className="text-xl font-extrabold text-white">{pos}</p>
                  </div>

                  {(w || h) && (
                    <div className={`bg-white/10 rounded-xl p-3 ${isRtl ? 'text-right' : ''}`}>
                      <p className="text-[10px] text-white/50 uppercase tracking-wider mb-0.5">{t('scan_dimensions')}</p>
                      <p className="text-lg font-extrabold text-white">{w && h ? `${w} × ${h}` : w || h}<span className="text-xs font-normal text-white/60 ms-1">mm</span></p>
                    </div>
                  )}

                  {ref && (
                    <div className={`bg-white/10 rounded-xl p-3 ${isRtl ? 'text-right' : ''}`}>
                      <p className="text-[10px] text-white/50 uppercase tracking-wider mb-0.5">{t('scan_order_ref')}</p>
                      <p className="text-sm font-bold text-white break-all">{ref}</p>
                    </div>
                  )}

                  {qty && (
                    <div className={`bg-white/10 rounded-xl p-3 ${isRtl ? 'text-right' : ''}`}>
                      <p className="text-[10px] text-white/50 uppercase tracking-wider mb-0.5">{t('scan_qty')}</p>
                      <p className="text-xl font-extrabold text-white">{qty}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Request Form ── */}
              <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-5 space-y-4">
                <h3 className={`font-bold text-[#1B2A4A] text-base ${isRtl ? 'text-right' : ''}`}>{t('scan_form_title')}</h3>

                {/* Reason dropdown */}
                <div className="space-y-1.5">
                  <label className={`block text-sm font-semibold text-[#1B2A4A] ${isRtl ? 'text-right' : ''}`}>
                    {t('scan_reason_label')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className={`w-full appearance-none border border-border rounded-xl px-4 py-3 text-sm bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5] transition-all ${!reason ? 'text-muted-foreground' : ''} ${isRtl ? 'pr-4 pl-10 text-right' : 'pl-4 pr-10'}`}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    >
                      <option value="" disabled>{t('scan_reason_placeholder')}</option>
                      {reasons.map((r, i) => (
                        <option key={i} value={r}>{r}</option>
                      ))}
                    </select>
                    <ChevronDown className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none ${isRtl ? 'left-3' : 'right-3'}`} />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className={`block text-sm font-semibold text-[#1B2A4A] ${isRtl ? 'text-right' : ''}`}>
                    {t('scan_phone_label')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRtl ? 'right-3' : 'left-3'}`} />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      onBlur={() => setPhoneBlurred(true)}
                      placeholder={t('scan_phone_placeholder')}
                      maxLength={10}
                      dir="ltr"
                      className={`w-full border rounded-xl py-3 text-sm bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all ${
                        phoneError
                          ? 'border-red-400 focus:ring-red-200'
                          : phoneValid && phone
                          ? 'border-emerald-400 focus:ring-emerald-100'
                          : 'border-border focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]'
                      } ${isRtl ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4'}`}
                    />
                  </div>
                  <AnimatePresence>
                    {phoneError && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`text-xs text-red-500 ${isRtl ? 'text-right' : ''}`}
                      >
                        {t('scan_phone_error')}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <div className={`flex items-center justify-between ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <label className={`block text-sm font-semibold text-[#1B2A4A]`}>
                      {t('scan_notes_label')}
                    </label>
                    <span className={`text-xs ${notes.length > NOTES_MAX * 0.9 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {NOTES_MAX - notes.length} {t('scan_notes_chars')}
                    </span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={e => { if (e.target.value.length <= NOTES_MAX) setNotes(e.target.value); }}
                    placeholder={t('scan_notes_placeholder')}
                    rows={3}
                    dir={isRtl ? 'rtl' : 'ltr'}
                    className={`w-full border border-border rounded-xl px-4 py-3 text-sm bg-white text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5] transition-all resize-none ${isRtl ? 'text-right' : ''}`}
                  />
                </div>

                {/* Error */}
                {submitError && (
                  <p className={`text-sm text-red-500 ${isRtl ? 'text-right' : ''}`}>{submitError}</p>
                )}

                {/* Submit */}
                <motion.button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  whileTap={canSubmit ? { scale: 0.97 } : {}}
                  className={`w-full py-4 rounded-2xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 ${
                    canSubmit
                      ? 'bg-[#4A6FA5] hover:bg-[#3d5f94] text-white shadow-lg shadow-[#4A6FA5]/30'
                      : 'bg-[#1B2A4A]/10 text-[#1B2A4A]/30 cursor-not-allowed'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('scan_submitting')}
                    </>
                  ) : t('scan_submit')}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <footer className="mt-auto bg-[#1B2A4A] text-white px-6 py-8">
        <div className="max-w-lg mx-auto space-y-5">
          {/* Brand */}
          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-[#4A6FA5] flex items-center justify-center shrink-0">
              <span className="text-white font-extrabold text-sm">و</span>
            </div>
            <div className={isRtl ? 'text-right' : ''}>
              <p className="font-extrabold text-base">وثبة للألمنيوم</p>
              <p className="text-xs text-white/50">Wathbat Aluminum</p>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Info */}
          <div className={`space-y-2 text-sm text-white/70 ${isRtl ? 'text-right' : ''}`}>
            <p className="font-semibold text-white/90">{t('scan_footer_location')}</p>
            <div>
              <p className="text-xs text-white/50 mb-1">{t('scan_footer_cs')}</p>
              <div className="flex flex-col gap-0.5 font-mono text-sm font-semibold" dir="ltr">
                <a href="tel:0536080555" className="hover:text-[#4A6FA5] transition-colors">0536080555</a>
                <a href="tel:0536080666" className="hover:text-[#4A6FA5] transition-colors">0536080666</a>
                <a href="tel:0536080777" className="hover:text-[#4A6FA5] transition-colors">0536080777</a>
              </div>
            </div>
            <a href="https://wathbat.sa" target="_blank" rel="noopener" className="block text-[#4A6FA5] hover:text-white transition-colors font-semibold">
              {t('scan_footer_website')}
            </a>
          </div>

          {/* Social */}
          <div className={isRtl ? 'text-right' : ''}>
            <p className="text-xs text-white/50 mb-3">{t('scan_footer_follow')}</p>
            <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              {[
                { href: 'https://snapchat.com', icon: <SnapchatIcon />, label: 'Snapchat' },
                { href: 'https://instagram.com', icon: <InstagramIcon />, label: 'Instagram' },
                { href: 'https://x.com', icon: <XIcon />, label: 'X' },
                { href: 'https://tiktok.com', icon: <TikTokIcon />, label: 'TikTok' },
              ].map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener"
                  aria-label={s.label}
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-[#4A6FA5] flex items-center justify-center transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/30 text-center pt-2">© {new Date().getFullYear()} Wathbat Aluminum · wathbat.sa</p>
        </div>
      </footer>
    </div>
  );
}
