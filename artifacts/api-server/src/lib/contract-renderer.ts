import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export interface ContractRenderData {
  contractNumber: string;
  contractDate: string;
  projectCode: string;
  projectName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerLocation: string;
  quotationNumber: string;
  quotationDate: string;
  milestones: Array<{
    index: number;
    label: string;
    percent: number;
    amount: number;
  }>;
  companyCRNumber: string;
  coverIntroAr: string;
  coverIntroEn: string;
  termsAr: string;
  termsEn: string;
  companySignerName: string;
  companySignerRole: string;
  companySignDate: string;
}

// F1: templates at artifacts/api-server/templates/ (not src/templates/).
// At runtime __dirname = /app/artifacts/api-server/dist.
// path.join(__dirname, '..', 'templates') = /app/artifacts/api-server/templates.
const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

export function renderContractDocx(
  data: ContractRenderData,
  lang: 'ar' | 'en',
): Buffer {
  const filename = lang === 'ar'
    ? 'wathbah_contract_template_AR.docx'
    : 'wathbah_contract_template_EN.docx';

  const content = fs.readFileSync(path.join(TEMPLATE_DIR, filename));
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
    delimiters: { start: '{{', end: '}}' },
  });

  doc.render({
    contractNumber: data.contractNumber,
    contractDate: data.contractDate,
    quotationNumber: data.quotationNumber,
    quotationDate: data.quotationDate,
    projectCode: data.projectCode,
    projectName: data.projectName,
    companyCRNumber: data.companyCRNumber,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerEmail: data.customerEmail,
    customerLocation: data.customerLocation,
    coverIntroAr: data.coverIntroAr,
    coverIntroEn: data.coverIntroEn,
    milestones: data.milestones,
    termsAr: data.termsAr,
    termsEn: data.termsEn,
    companySignerName: data.companySignerName,
    companySignerRole: data.companySignerRole,
    companySignatureImage: '',
    companySignDate: data.companySignDate,
    customerSignerName: '',
    customerSignerRole: '',
    customerSignatureImage: '',
    customerSignDate: '',
  });

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
