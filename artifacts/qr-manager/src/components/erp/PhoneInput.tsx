import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/use-language';

interface PhoneInputProps {
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  className?: string;
}

type CountryCode = '+966' | 'other';

function toE164(local: string, countryCode: CountryCode): string {
  const digits = local.replace(/\D/g, '');
  if (countryCode === '+966') {
    if (digits.startsWith('0') && digits.length === 10) {
      return '+966' + digits.slice(1);
    }
    if (!digits.startsWith('0') && digits.length === 9) {
      return '+966' + digits;
    }
    return '';
  }
  // "other": user enters a full number; require at least 7 digits
  if (digits.length >= 7) return '+' + digits;
  return '';
}

function localFromE164(e164: string, countryCode: CountryCode): string {
  if (countryCode === '+966' && e164.startsWith('+966')) {
    const rest = e164.slice(4);
    return '0' + rest;
  }
  if (e164.startsWith('+')) return e164.slice(1);
  return e164;
}

function formatSaudiLocal(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
}

export function PhoneInput({ value, onChange, disabled = false, className = '' }: PhoneInputProps) {
  const { t, isRtl } = useLanguage();
  const [countryCode, setCountryCode] = useState<CountryCode>('+966');
  const [localInput, setLocalInput] = useState('');

  // Sync from external E.164 value into local display
  useEffect(() => {
    if (!value) {
      setLocalInput('');
      return;
    }
    if (value.startsWith('+966')) {
      setCountryCode('+966');
      setLocalInput(localFromE164(value, '+966'));
    } else if (value.startsWith('+')) {
      setCountryCode('other');
      setLocalInput(value.slice(1));
    } else {
      setLocalInput(value);
    }
  }, [value]);

  const handleCountryChange = (code: CountryCode) => {
    setCountryCode(code);
    setLocalInput('');
    onChange('');
  };

  const handleLocalChange = (raw: string) => {
    const cleaned = countryCode === '+966'
      ? raw.replace(/\D/g, '').slice(0, 10)
      : raw.replace(/[^\d+\s\-().]/g, '').slice(0, 20);
    setLocalInput(cleaned);
    const e164 = toE164(cleaned, countryCode);
    onChange(e164);
  };

  const displayValue = countryCode === '+966' ? formatSaudiLocal(localInput) : localInput;
  const placeholder = countryCode === '+966' ? t('phone_placeholder_sa') : t('phone_placeholder_other');

  return (
    <div className={`flex gap-0 ${className}`} dir="ltr">
      <select
        value={countryCode}
        onChange={e => handleCountryChange(e.target.value as CountryCode)}
        disabled={disabled}
        className="border border-e-0 border-[#ECEAE2] rounded-s-xl px-2 py-2 text-sm bg-[#F4F2EB] text-[#1B2A4A] focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 shrink-0 disabled:opacity-50"
      >
        <option value="+966">🇸🇦 +966</option>
        <option value="other">🌍 {t('phone_other_label')}</option>
      </select>
      <input
        type="tel"
        inputMode="numeric"
        value={displayValue}
        onChange={e => handleLocalChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="tel"
        className="flex-1 min-w-0 border border-[#ECEAE2] rounded-e-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 bg-[#FAFAF7] disabled:opacity-50"
      />
    </div>
  );
}
