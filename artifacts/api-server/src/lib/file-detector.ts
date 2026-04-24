export interface DetectResult {
  detected: string | null;
  confidence: 'high' | 'low';
}

export function detectFileType(filename: string): DetectResult {
  const name = filename.toLowerCase();

  // Glass/Panel Order — must check before vendor_order to avoid false match on "Order"
  if (name.includes('glass_panel_order') || name.includes('glass panel order')) {
    return { detected: 'glass_order', confidence: 'high' };
  }
  if (name.includes('quotation')) {
    return { detected: 'quotation', confidence: 'high' };
  }
  if (name.includes('section')) {
    return { detected: 'section', confidence: 'high' };
  }
  if (name.includes('assembly_list') || name.includes('assembly list')) {
    return { detected: 'assembly_list', confidence: 'high' };
  }
  if (name.includes('cut_optimisation') || name.includes('cut optimisation')) {
    return { detected: 'cut_optimisation', confidence: 'high' };
  }
  if (name.includes('material_analysis') || name.includes('material analysis')) {
    return { detected: 'material_analysis', confidence: 'high' };
  }
  // Vendor order: "Order -" or "Order_-_" but NOT glass panel orders (already caught above)
  if (name.includes('order_-_') || name.includes('order -')) {
    return { detected: 'vendor_order', confidence: 'high' };
  }

  return { detected: null, confidence: 'low' };
}

export const KNOWN_FILE_TYPES: Array<{
  value: string;
  labelEn: string;
  labelAr: string;
  multi: boolean;
}> = [
  { value: 'glass_order',       labelEn: 'Glass / Panel Order', labelAr: 'طلب الزجاج',    multi: false },
  { value: 'quotation',         labelEn: 'Quotation',           labelAr: 'عرض السعر',      multi: false },
  { value: 'section',           labelEn: 'Section',             labelAr: 'المقاطع',        multi: false },
  { value: 'assembly_list',     labelEn: 'Assembly List',       labelAr: 'قائمة التجميع',  multi: false },
  { value: 'cut_optimisation',  labelEn: 'Cut Optimisation',    labelAr: 'تحسين القطع',    multi: false },
  { value: 'material_analysis', labelEn: 'Material Analysis',   labelAr: 'تحليل المواد',   multi: false },
  { value: 'vendor_order',      labelEn: 'Vendor Order',        labelAr: 'أمر مورد',       multi: true  },
  { value: 'qoyod',             labelEn: 'Qoyod',               labelAr: 'قيود',           multi: true  },
  { value: 'other',             labelEn: 'Other',               labelAr: 'أخرى',           multi: true  },
];
