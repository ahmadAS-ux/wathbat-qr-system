import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Search, Archive, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { API_BASE } from '@/lib/api-base';

interface AuditRow {
  id: number;
  project_id: number;
  project_name: string;
  project_code: string | null;
  file_type: string;
  original_filename: string;
  uploaded_at: string;
  uploaded_by_name: string;
}

const FILE_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  glass_order:       { ar: 'طلبية زجاج / ألواح', en: 'Glass / Panel Order' },
  quotation:         { ar: 'عرض السعر',           en: 'Quotation' },
  price_quotation:   { ar: 'عرض السعر',           en: 'Quotation' },
  section:           { ar: 'المقاطع',             en: 'Section' },
  assembly_list:     { ar: 'قائمة التجميع',       en: 'Assembly List' },
  cut_optimisation:  { ar: 'تحسين القص',          en: 'Cut Optimisation' },
  material_analysis: { ar: 'تحليل المواد',        en: 'Material Analysis' },
  vendor_order:      { ar: 'أمر مورد',            en: 'Vendor Order' },
  qoyod:             { ar: 'قيود',                en: 'Qoyod' },
  other:             { ar: 'أخرى',               en: 'Other' },
};

const PAGE_SIZE = 50;

export default function AdminHistory() {
  const { t, isRtl } = useLanguage();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [all, setAll] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    if (user?.role !== 'Admin') return;
    setLoading(true);
    fetch(`${API_BASE}/api/erp/files/audit`)
      .then(r => r.ok ? r.json() : [])
      .then(setAll)
      .finally(() => setLoading(false));
  }, [user]);

  if (user && user.role !== 'Admin') {
    return (
      <AdminLayout>
        <div className="p-6 text-center text-slate-400">{t('audit_access_denied')}</div>
      </AdminLayout>
    );
  }

  const fileTypeLabel = (ft: string) => {
    const entry = FILE_TYPE_LABELS[ft];
    if (!entry) return ft;
    return isRtl ? entry.ar : entry.en;
  };

  const filtered = all.filter(r => {
    const q = search.toLowerCase();
    return (
      r.project_name.toLowerCase().includes(q) ||
      (r.project_code ?? '').toLowerCase().includes(q) ||
      r.original_filename.toLowerCase().includes(q) ||
      fileTypeLabel(r.file_type).toLowerCase().includes(q) ||
      r.uploaded_by_name.toLowerCase().includes(q)
    );
  });

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>

        {/* Header */}
        <div className="mb-6">
          <div className={`flex items-center gap-3 mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <Archive className="w-5 h-5 text-[#141A24]" />
            <h1 className="text-2xl font-bold text-[#1B2A4A]">{t('archive_title')}</h1>
          </div>
          <p className="text-slate-500 text-sm ms-8">{all.length} {isRtl ? 'ملف' : 'files'}</p>
        </div>

        {/* Search */}
        <div className="relative max-w-xs mb-4">
          <Search className="absolute inset-y-0 start-3 my-auto w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setVisible(PAGE_SIZE); }}
            placeholder={t('search_placeholder')}
            className="w-full border border-[#ECEAE2] rounded-xl ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141A24]/20 bg-[#FAFAF7]"
          />
        </div>

        {/* Table */}
        <div className="bg-[#FAFAF7] rounded-xl border border-[#ECEAE2] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#ECEAE2] bg-[#F4F2EB]">
                  <th className="text-start px-4 py-3 font-semibold text-slate-600">{t('audit_col_project')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-600">{t('audit_col_file_type')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">{t('audit_col_filename')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">{t('audit_col_uploaded_at')}</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">{t('audit_col_uploaded_by')}</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-400">{t('processing')}</td>
                  </tr>
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-400">{t('audit_empty')}</td>
                  </tr>
                ) : (
                  shown.map(row => (
                    <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-[#F4F2EB]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1B2A4A]">{row.project_name}</div>
                        {row.project_code && (
                          <div className="text-xs text-slate-400 mt-0.5" dir="ltr">{row.project_code}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{fileTypeLabel(row.file_type)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono hidden md:table-cell max-w-[200px] truncate" dir="ltr">
                        {row.original_filename}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell" dir="ltr">
                        {new Date(row.uploaded_at).toLocaleDateString()} {new Date(row.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{row.uploaded_by_name}</td>
                      <td className="px-3 py-3 text-end">
                        <button
                          onClick={() => navigate(`/erp/projects/${row.project_id}`)}
                          className="inline-flex items-center gap-1 text-xs text-[#1B2A4A] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {t('audit_view_project')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="flex justify-center p-4 border-t border-[#ECEAE2] bg-[#F4F2EB]">
              <button
                onClick={() => setVisible(v => v + PAGE_SIZE)}
                className="px-6 py-2 text-sm font-medium text-slate-600 border border-[#ECEAE2] rounded-full hover:bg-[#FAFAF7] transition-colors"
              >
                {t('show_more')}
              </button>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
