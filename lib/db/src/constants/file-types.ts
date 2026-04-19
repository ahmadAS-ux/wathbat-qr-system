// v2.5.0 active file types — single source of truth for both backend and DB layer
export const PROJECT_FILE_TYPES = [
  'glass_order',
  'price_quotation',
  'section',
  'assembly_list',
  'cut_optimisation',
  'qoyod',
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
export const MULTI_FILE_TYPES: readonly ProjectFileType[] = ['qoyod'];

// UI slot definitions in display order
export const UI_SLOT_ORDER: Array<{
  fileType: ProjectFileType;
  labelAr: string;
  labelEn: string;
  multiFile: boolean;
}> = [
  { fileType: 'glass_order',      labelAr: 'طلبية زجاج / ألواح', labelEn: 'Glass / Panel Order', multiFile: false },
  { fileType: 'price_quotation',  labelAr: 'عرض السعر',          labelEn: 'Quotation',            multiFile: false },
  { fileType: 'section',          labelAr: 'المقاطع',            labelEn: 'Section',              multiFile: false },
  { fileType: 'assembly_list',    labelAr: 'قائمة التجميع',      labelEn: 'Assembly List',        multiFile: false },
  { fileType: 'cut_optimisation', labelAr: 'تحسين القص',         labelEn: 'Cut Optimisation',     multiFile: false },
  { fileType: 'qoyod',            labelAr: 'قيود',               labelEn: 'Qoyod',                multiFile: true  },
];
