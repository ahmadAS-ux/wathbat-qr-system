// v3.0 active file types — single source of truth for both backend and DB layer
export const PROJECT_FILE_TYPES = [
  'glass_order',
  'price_quotation',
  'quotation',
  'section',
  'assembly_list',
  'cut_optimisation',
  'material_analysis',
  'vendor_order',
  'qoyod',
  'other',
] as const;

export type ProjectFileType = typeof PROJECT_FILE_TYPES[number];

// Legacy types — kept for DB read compatibility, NOT allowed for new uploads
export const DEPRECATED_FILE_TYPES = [
  'technical_doc',
  'qoyod_deposit',
  'qoyod_payment',
  'attachment',
] as const;

export type DeprecatedFileType = typeof DEPRECATED_FILE_TYPES[number];

// Which slots allow multiple files per project (do not replace on re-upload)
export const MULTI_FILE_TYPES: readonly string[] = ['qoyod', 'vendor_order', 'other'];

// UI slot definitions in display order (v3.0 — 9 slots)
export const UI_SLOT_ORDER: Array<{
  fileType: string;
  labelAr: string;
  labelEn: string;
  multiFile: boolean;
}> = [
  { fileType: 'glass_order',       labelAr: 'طلب الزجاج',       labelEn: 'Glass / Panel Order', multiFile: false },
  { fileType: 'quotation',         labelAr: 'عرض السعر',         labelEn: 'Quotation',           multiFile: false },
  { fileType: 'section',           labelAr: 'المقاطع',           labelEn: 'Section',             multiFile: false },
  { fileType: 'assembly_list',     labelAr: 'قائمة التجميع',     labelEn: 'Assembly List',       multiFile: false },
  { fileType: 'cut_optimisation',  labelAr: 'تحسين القطع',       labelEn: 'Cut Optimisation',    multiFile: false },
  { fileType: 'material_analysis', labelAr: 'تحليل المواد',      labelEn: 'Material Analysis',   multiFile: false },
  { fileType: 'vendor_order',      labelAr: 'أمر مورد',          labelEn: 'Vendor Order',        multiFile: true  },
  { fileType: 'qoyod',             labelAr: 'قيود',              labelEn: 'Qoyod',               multiFile: true  },
  { fileType: 'other',             labelAr: 'أخرى',              labelEn: 'Other',               multiFile: true  },
];
