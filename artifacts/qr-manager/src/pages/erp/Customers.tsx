import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { useLanguage } from '@/hooks/use-language';
import { API_BASE } from '@/lib/api-base';

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-[#DCEFEC] text-[#0E6E6A]',
  inactive: 'bg-[#F4F2EB] text-slate-500',
  archived: 'bg-[#FBF0D6] text-[#9A6B0E]',
};

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

export default function ErpCustomers() {
  const { t, isRtl } = useLanguage();
  const [tab, setTab] = useState<'active' | 'all'>('active');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCustomers = async (q: string, status: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      const qs = params.toString();
      const res = await fetch(`${API_BASE}/api/erp/customers${qs ? `?${qs}` : ''}`);
      if (res.ok) setCustomers(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers(searchQ, tab === 'active' ? 'active' : '');
  }, [tab]);

  const handleSearch = (val: string) => {
    setSearchQ(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadCustomers(val, tab === 'active' ? 'active' : '');
    }, 300);
  };

  const statusLabel: Record<string, string> = {
    active: t('erp_customer_status_active'),
    inactive: t('erp_customer_status_inactive'),
    archived: t('erp_customer_status_archived'),
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1B2A4A]">{t('erp_customers_title')}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {customers.length} {t('erp_customers_subtitle')}
          </p>
        </div>

        {/* Search + Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute inset-y-0 start-3 my-auto w-4 h-4 text-slate-400 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQ}
              onChange={e => handleSearch(e.target.value)}
              placeholder={t('erp_customers_search_ph')}
              className="w-full border border-[#ECEAE2] rounded-xl ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 bg-[#FAFAF7]"
            />
          </div>
          <div className="flex gap-1 bg-[#ECEAE2] rounded-xl p-1 w-fit">
            <button
              onClick={() => setTab('active')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'active' ? 'bg-[#FAFAF7] text-[#1B2A4A] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t('erp_customers_tab_active')}
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'all' ? 'bg-[#FAFAF7] text-[#1B2A4A] shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t('erp_customers_tab_all')}
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">{t('processing')}</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            {searchQ.trim() ? t('erp_customers_no_results') : t('erp_customers_empty')}
          </div>
        ) : (
          <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#ECEAE2] bg-[#F4F2EB]">
                  <th className="text-start px-4 py-3 font-semibold text-slate-600">{t('erp_customers_col_name')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">{t('erp_lead_location')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-600">{t('erp_customers_col_status')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">{t('erp_customers_col_created')}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-50 last:border-0 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1B2A4A]">{c.name}</div>
                      <div className="text-slate-400 text-xs mt-0.5" dir="ltr">{formatPhone(c.phone)}</div>
                      {c.email && (
                        <div className="text-slate-400 text-xs mt-0.5" dir="ltr">{c.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{c.location ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status] ?? 'bg-[#ECEAE2] text-slate-600'}`}>
                        {statusLabel[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell" dir="ltr">
                      {c.createdAt.split('T')[0]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
