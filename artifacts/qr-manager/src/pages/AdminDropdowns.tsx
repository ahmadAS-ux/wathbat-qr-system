import { useState, useEffect } from 'react';
import { List, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { API_BASE as BASE } from '@/lib/api-base';

interface DropdownOption {
  id: number;
  category: string;
  value: string;
  labelAr: string;
  labelEn: string;
  sortOrder: number | null;
  active: boolean | null;
}

const DROPDOWN_CATEGORIES = [
  { key: 'lead_source',       labelKey: 'dropdown_cat_lead_source'       },
  { key: 'product_interest',  labelKey: 'dropdown_cat_product_interest'  },
  { key: 'building_type',     labelKey: 'dropdown_cat_building_type'     },
  { key: 'budget_range',      labelKey: 'dropdown_cat_budget_range'      },
] as const;

export default function AdminDropdowns() {
  const { t, isRtl } = useLanguage();

  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [addForms, setAddForms] = useState<Record<string, { labelAr: string; labelEn: string }>>({});
  const [deletingOptId, setDeletingOptId] = useState<number | null>(null);
  const [addingCat, setAddingCat] = useState<string | null>(null);

  const loadOptions = () => {
    fetch(`${BASE}/api/erp/options`)
      .then(r => r.ok ? r.json() : [])
      .then(setOptions)
      .catch(() => {});
  };

  useEffect(() => { loadOptions(); }, []);

  const optionsFor = (cat: string) => options.filter(o => o.category === cat);

  const deleteOption = async (id: number) => {
    if (!window.confirm(t('dropdown_delete_confirm'))) return;
    setDeletingOptId(id);
    try {
      await fetch(`${BASE}/api/erp/options/${id}`, { method: 'DELETE' });
      setOptions(prev => prev.filter(o => o.id !== id));
    } finally {
      setDeletingOptId(null);
    }
  };

  const addOption = async (cat: string) => {
    const f = addForms[cat];
    if (!f?.labelAr?.trim() || !f?.labelEn?.trim()) return;
    setAddingCat(cat);
    try {
      const existing = optionsFor(cat);
      const value = f.labelEn.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const res = await fetch(`${BASE}/api/erp/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: cat,
          value,
          labelAr: f.labelAr.trim(),
          labelEn: f.labelEn.trim(),
          sortOrder: existing.length + 1,
        }),
      });
      if (res.ok) {
        const row = await res.json();
        setOptions(prev => [...prev, row]);
        setAddForms(prev => ({ ...prev, [cat]: { labelAr: '', labelEn: '' } }));
      }
    } finally {
      setAddingCat(null);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#F0F2F5]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

          {/* Header */}
          <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
            <div className="p-2 rounded-xl bg-amber-50">
              <List className="w-5 h-5 text-amber-600" />
            </div>
            <div className={isRtl ? 'text-end' : ''}>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('dropdown_editor_title')}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{t('dropdown_editor_desc')}</p>
            </div>
          </div>

          {/* Dropdown Editor */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {DROPDOWN_CATEGORIES.map(({ key, labelKey }) => {
                const catOptions = optionsFor(key);
                const isOpen = expandedCat === key;
                const addForm = addForms[key] ?? { labelAr: '', labelEn: '' };
                return (
                  <div key={key}>
                    <button
                      onClick={() => setExpandedCat(isOpen ? null : key)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-700 text-sm">{t(labelKey)}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{catOptions.length}</span>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-4 space-y-2" dir={isRtl ? 'rtl' : 'ltr'}>
                        {catOptions.length > 0 && (
                          <div className="rounded-xl border border-slate-100 overflow-hidden mb-3">
                            {catOptions.map((opt, idx) => (
                              <div key={opt.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${idx !== 0 ? 'border-t border-slate-50' : ''}`}>
                                <span className="flex-1 font-medium text-slate-700">{opt.labelAr}</span>
                                <span className="text-slate-400 text-xs" dir="ltr">{opt.labelEn}</span>
                                <button
                                  onClick={() => deleteOption(opt.id)}
                                  disabled={deletingOptId === opt.id}
                                  className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20"
                            placeholder={t('dropdown_label_ar')}
                            dir="rtl"
                            value={addForm.labelAr}
                            onChange={e => setAddForms(p => ({ ...p, [key]: { ...addForm, labelAr: e.target.value } }))}
                          />
                          <input
                            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20"
                            placeholder={t('dropdown_label_en')}
                            dir="ltr"
                            value={addForm.labelEn}
                            onChange={e => setAddForms(p => ({ ...p, [key]: { ...addForm, labelEn: e.target.value } }))}
                          />
                          <button
                            onClick={() => addOption(key)}
                            disabled={addingCat === key || !addForm.labelAr.trim() || !addForm.labelEn.trim()}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1B2A4A] text-white text-sm font-semibold rounded-xl hover:bg-[#142240] disabled:opacity-40 transition-colors shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {addingCat === key ? '...' : t('dropdown_add_btn')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}
