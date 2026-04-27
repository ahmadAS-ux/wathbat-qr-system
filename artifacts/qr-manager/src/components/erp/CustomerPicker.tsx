import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/hooks/use-language';
import { API_BASE } from '@/lib/api-base';

export interface CustomerOption {
  id: number;
  name: string;
  phone: string;
  status: string;
  email: string | null;
  location: string | null;
}

interface CustomerPickerProps {
  value: CustomerOption | null;
  onChange: (customer: CustomerOption | null) => void;
  disabled?: boolean;
}

function formatPhone(e164: string): string {
  if (!e164) return '';
  if (e164.startsWith('+966')) {
    const local = '0' + e164.slice(4);
    if (local.length === 10) {
      return `${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`;
    }
  }
  return e164;
}

export function CustomerPicker({ value, onChange, disabled = false }: CustomerPickerProps) {
  const { t, isRtl } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = (q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/erp/customers/search?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setOpen(true);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    search(val);
  };

  const handleSelect = (c: CustomerOption) => {
    onChange(c);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  if (value) {
    return (
      <div
        className={`flex items-center gap-2 border border-[#ECEAE2] rounded-xl px-3 py-2 bg-[#FAFAF7] ${isRtl ? 'flex-row-reverse' : ''}`}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1B2A4A] truncate">{value.name}</p>
          <p className="text-xs text-slate-400 truncate" dir="ltr">{formatPhone(value.phone)}</p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 text-xs px-2 py-1 rounded-lg hover:bg-[#ECEAE2]"
          >
            {t('cust_picker_clear')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative" dir={isRtl ? 'rtl' : 'ltr'}>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder={t('cust_picker_placeholder')}
        disabled={disabled}
        autoComplete="off"
        className="w-full border border-[#ECEAE2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 bg-[#FAFAF7] disabled:opacity-50"
      />
      {loading && (
        <div className="absolute inset-y-0 end-3 flex items-center">
          <div className="w-3.5 h-3.5 border-2 border-[#141A24]/20 border-t-[#141A24]/60 rounded-full animate-spin" />
        </div>
      )}
      {open && (
        <div className="absolute start-0 end-0 top-full mt-1 bg-[#FAFAF7] border border-[#ECEAE2] rounded-xl shadow-xl overflow-hidden z-50">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400">{t('cust_picker_no_results')}</p>
          ) : (
            <ul>
              {results.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={() => handleSelect(c)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#F4F2EB] transition-colors text-start border-t border-slate-50 first:border-t-0 ${isRtl ? 'flex-row-reverse' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1B2A4A] truncate">{c.name}</p>
                      <p className="text-xs text-slate-400 truncate" dir="ltr">{formatPhone(c.phone)}</p>
                    </div>
                    {c.location && (
                      <span className="text-[10px] text-slate-400 shrink-0 hidden sm:block">{c.location}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
