export type IntegritySeverity = 'error' | 'warning' | 'info';

export interface IntegrityIssue {
  severity: IntegritySeverity;
  code: string;
  messageAr: string;
  messageEn: string;
}

export interface IntegrityReport {
  overall: 'green' | 'amber' | 'red';
  issues: IntegrityIssue[];
  canPrint: boolean;
}

export function renderPlaceholders(
  template: string,
  values: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const v = values[key];
    if (v === undefined || v === null || v === '') return _match;
    return String(v);
  });
}

export function checkContractIntegrity(data: {
  project: any;
  quotation: any | null;
  section: any | null;
  drawings: any[];
  template: Record<string, string>;
  renderedIntroAr: string;
  renderedIntroEn: string;
  renderedTermsAr: string;
  renderedTermsEn: string;
  renderedSignatureAr: string;
  renderedSignatureEn: string;
}): IntegrityReport {
  const issues: IntegrityIssue[] = [];

  // 🔴 Error: quotation missing
  if (!data.quotation) {
    issues.push({
      severity: 'error',
      code: 'QUOTATION_MISSING',
      messageAr: 'لم يتم رفع ملف عرض السعر',
      messageEn: 'Quotation file not uploaded',
    });
  }

  // 🔴 Error: section missing
  if (!data.section) {
    issues.push({
      severity: 'error',
      code: 'SECTION_MISSING',
      messageAr: 'لم يتم رفع ملف المقاطع',
      messageEn: 'Section file not uploaded',
    });
  }

  // 🔴 Error: project name mismatch with quotation
  if (data.quotation && data.project) {
    const inFile = (data.quotation.projectNameInFile || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const inSystem = (data.project.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (inFile && inSystem && inFile !== inSystem) {
      issues.push({
        severity: 'error',
        code: 'PROJECT_NAME_MISMATCH_QUOTATION',
        messageAr: `اسم المشروع في عرض السعر (${data.quotation.projectNameInFile}) لا يطابق النظام (${data.project.name})`,
        messageEn: `Project name in quotation (${data.quotation.projectNameInFile}) does not match system (${data.project.name})`,
      });
    }
  }

  // 🔴 Error: sum of line totals doesn't match subtotalNet
  if (data.quotation && Array.isArray(data.quotation.positions)) {
    const parse = (s: string | null | undefined): number => {
      if (!s) return NaN;
      return parseFloat(String(s).replace(/,/g, ''));
    };
    const sum = data.quotation.positions.reduce(
      (acc: number, p: any) => acc + (parse(p.lineTotal) || 0),
      0
    );
    const net = parse(data.quotation.subtotalNet);
    if (!isNaN(sum) && !isNaN(net) && Math.abs(sum - net) > 0.5) {
      issues.push({
        severity: 'error',
        code: 'TOTALS_MISMATCH',
        messageAr: `مجموع البنود (${sum.toFixed(2)}) لا يطابق المجموع الصافي (${net.toFixed(2)})`,
        messageEn: `Sum of line totals (${sum.toFixed(2)}) does not match subtotal net (${net.toFixed(2)})`,
      });
    }
  }

  // 🔴 Error: unresolved placeholders
  const allRendered = [
    data.renderedIntroAr, data.renderedIntroEn,
    data.renderedTermsAr, data.renderedTermsEn,
    data.renderedSignatureAr, data.renderedSignatureEn,
  ].join('\n');
  const unresolved = Array.from(new Set(allRendered.match(/\{\{\w+\}\}/g) || []));
  if (unresolved.length > 0) {
    issues.push({
      severity: 'error',
      code: 'UNRESOLVED_PLACEHOLDERS',
      messageAr: `توجد متغيرات غير معبأة: ${unresolved.join(', ')}`,
      messageEn: `Unresolved placeholders: ${unresolved.join(', ')}`,
    });
  }

  // 🔴 Error: terms template missing
  if (!data.template.contract_terms_ar || !data.template.contract_terms_en) {
    issues.push({
      severity: 'error',
      code: 'TERMS_TEMPLATE_MISSING',
      messageAr: 'قالب الشروط والأحكام غير مكتمل في الإعدادات',
      messageEn: 'Contract terms template is incomplete in Settings',
    });
  }

  // 🟡 Warning: section project name differs
  if (data.section && data.project) {
    const inFile = (data.section.projectNameInFile || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const inSystem = (data.project.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (inFile && inSystem && inFile !== inSystem) {
      issues.push({
        severity: 'warning',
        code: 'PROJECT_NAME_MISMATCH_SECTION',
        messageAr: `اسم المشروع في ملف المقاطع (${data.section.projectNameInFile}) يختلف عن النظام`,
        messageEn: `Project name in section file (${data.section.projectNameInFile}) differs from system`,
      });
    }
  }

  // 🟡 Warning: position count vs drawing count mismatch
  if (data.quotation && data.drawings.length > 0) {
    const posCount = (data.quotation.positions || []).length;
    if (posCount !== data.drawings.length) {
      issues.push({
        severity: 'warning',
        code: 'POSITION_DRAWING_COUNT_MISMATCH',
        messageAr: `عدد البنود (${posCount}) لا يساوي عدد الرسومات (${data.drawings.length})`,
        messageEn: `Position count (${posCount}) differs from drawing count (${data.drawings.length})`,
      });
    }
  }

  const hasError = issues.some(i => i.severity === 'error');
  const hasWarning = issues.some(i => i.severity === 'warning');
  const overall = hasError ? 'red' : hasWarning ? 'amber' : 'green';

  return { overall, issues, canPrint: !hasError };
}
