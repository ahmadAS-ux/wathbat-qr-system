import { useRef, useState } from 'react';
import {
  Upload, Download, Eye, MoreVertical, Trash2, Loader2,
  FileText, QrCode,
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { ReUploadConfirmModal } from './ReUploadConfirmModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { API_BASE } from '@/lib/api-base';

export interface FileRecord {
  id: number;
  projectId: number;
  fileType: string;
  originalFilename: string;
  uploadedAt: string;
  uploadedByName?: string | null;
  isActive?: boolean;
  /** true if extracted_file is present on this row */
  hasExtracted?: boolean;
}

export type FileSlotFileType =
  | 'glass' | 'quotation' | 'sections' | 'assembly'
  | 'cut-optimisation' | 'material-analysis'
  | 'vendor' | 'qoyod' | 'other';

// FileSlot UI aliases (NOT backend file_type strings) where
// the EXTRACTED column is meaningful.
// - 'glass'  → QR-enhanced HTML report (Glass Order pipeline)
// - 'qoyod'  → byte-identical PDF copy (Qoyod pipeline)
// All other UI aliases hide the entire EXTRACTED column,
// INCLUDING the "Pending extraction" placeholder.
const EXTRACTED_TILE_FILE_TYPES = ['glass', 'qoyod'] as const;

const showsExtractedTile = (ft: string): boolean =>
  (EXTRACTED_TILE_FILE_TYPES as readonly string[]).includes(ft);

const ACCEPT_MAP: Record<FileSlotFileType, string> = {
  glass:              '.docx,.pdf,.html,.htm',
  quotation:          '.docx',
  sections:           '.docx',
  assembly:           '.docx',
  'cut-optimisation': '.docx',
  'material-analysis':'.docx',
  vendor:             '.docx',
  qoyod:              '.pdf',
  other:              '.docx',
};

export interface FileSlotProps {
  type: 'single' | 'bucket';
  fileType: FileSlotFileType;
  label: { ar: string; en: string };
  files: FileRecord[];
  onUpload: (file: File) => Promise<void>;
  onReplace: (fileId: number, newFile: File) => Promise<void>;
  onDownload: (fileId: number) => void;
  onDelete?: (fileId: number) => Promise<void>;
  canDelete?: boolean;
  canReplace?: boolean;
  isLoading?: boolean;
}

export function FileSlot({
  type,
  fileType,
  label,
  files,
  onUpload,
  onReplace,
  onDownload,
  onDelete,
  canDelete = false,
  canReplace = true,
  isLoading = false,
}: FileSlotProps) {
  const { isRtl, t, language } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingReplaceId, setPendingReplaceId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [replacingId, setReplacingId] = useState<number | null>(null);

  const displayLabel = language === 'ar' ? label.ar : label.en;
  const isEmpty = files.length === 0;
  const activeFile = type === 'single' ? (files.find(f => f.isActive !== false) ?? null) : null;

  // ── Hidden file input ──────────────────────────────────────────────────────
  const triggerInput = (forReplaceId?: number) => {
    if (forReplaceId !== undefined) {
      setReplacingId(forReplaceId);
    } else {
      setReplacingId(null);
    }
    if (inputRef.current) {
      inputRef.current.accept = ACCEPT_MAP[fileType];
      inputRef.current.value = '';
      inputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      if (replacingId !== null) {
        await onReplace(replacingId, file);
      } else {
        await onUpload(file);
      }
    } finally {
      setUploading(false);
      setReplacingId(null);
    }
  };

  const handleReplaceClick = (fileId: number) => {
    setPendingReplaceId(fileId);
  };

  const confirmReplace = () => {
    if (pendingReplaceId === null) return;
    const id = pendingReplaceId;
    setPendingReplaceId(null);
    triggerInput(id);
  };

  const handleDeleteConfirm = async () => {
    if (pendingDeleteId === null || !onDelete) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    await onDelete(id);
  };

  const extractedUrl = (fileId: number, pId: number) =>
    `${API_BASE}/api/erp/projects/${pId}/files/${fileId}/extracted`;
  const originalUrl = (fileId: number, pId: number) =>
    `${API_BASE}/api/erp/projects/${pId}/files/${fileId}`;

  // ── Empty state ────────────────────────────────────────────────────────────
  const emptyState = (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <p className={`text-xs text-slate-400 ${isRtl ? 'font-[Tajawal]' : ''}`}>{t('file_slot_no_file')}</p>
      <button
        onClick={() => triggerInput()}
        disabled={uploading || isLoading}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#141A24] text-white hover:bg-[#0B1019] transition-colors disabled:opacity-40 ${isRtl ? 'font-[Tajawal]' : ''}`}
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {t('erp_file_upload')}
      </button>
    </div>
  );

  // ── File row (used in both single and bucket filled states) ───────────────
  const renderFileRow = (file: FileRecord, compact = false) => {
    const isDeleting = false;

    return (
      <div
        key={file.id}
        className={`rounded-xl border border-[#ECEAE2] bg-[#FAFAF7] overflow-hidden ${compact ? '' : ''}`}
      >
        {/* Header row */}
        <div className={`flex items-center gap-3 px-4 py-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 shrink-0 ${isRtl ? 'font-[Tajawal]' : ''}`}>
                {t('file_slot_uploaded')}
              </span>
              <p className={`text-xs font-medium text-slate-600 truncate ${isRtl ? 'font-[Tajawal]' : ''}`}>{displayLabel}</p>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate" dir="ltr">{file.originalFilename}</p>
            <p className="text-xs text-slate-400 mt-0.5" dir="ltr">
              {new Date(file.uploadedAt).toLocaleDateString()}
              {file.uploadedByName && ` · ${file.uploadedByName}`}
            </p>
          </div>
          {/* ... menu for Admin delete */}
          {canDelete && onDelete && (
            <div className="relative shrink-0">
              <button
                onClick={() => setOpenMenuId(openMenuId === file.id ? null : file.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-[#ECEAE2] transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {openMenuId === file.id && (
                <div
                  className={`absolute top-full ${isRtl ? 'start-0' : 'end-0'} mt-1 bg-white rounded-xl shadow-xl border border-[#ECEAE2] z-20 py-1 min-w-[120px]`}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => { setOpenMenuId(null); setPendingDeleteId(file.id); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors ${isRtl ? 'flex-row-reverse font-[Tajawal]' : ''}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    {t('delete_file_confirm_btn')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview tiles */}
        {showsExtractedTile(fileType) ? (
          <div className="grid grid-cols-2 gap-2 px-4 pb-3">
            {/* EXTRACTED tile — Glass (QR HTML) and Qoyod (PDF copy) only */}
            {file.hasExtracted ? (
              <a
                href={extractedUrl(file.id, file.projectId)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-[#ECEAE2] bg-[#F4F2EB] p-2.5 hover:bg-[#ECEAE2] transition-colors cursor-pointer group"
              >
                <div className={`flex items-center gap-1.5 mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  {fileType === 'glass' ? (
                    <QrCode className="w-3 h-3 text-amber-500 shrink-0" />
                  ) : (
                    <FileText className="w-3 h-3 text-teal-500 shrink-0" />
                  )}
                  <span className={`text-[9px] font-bold text-slate-500 group-hover:text-slate-700 tracking-wide ${isRtl ? 'font-[Tajawal]' : ''}`}>
                    {t('file_slot_extracted')}
                  </span>
                </div>
                <p className={`text-[10px] text-teal-600 group-hover:text-teal-700 transition-colors ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
                  {t('file_slot_preview')} →
                </p>
              </a>
            ) : (
              <div className="rounded-lg border border-[#ECEAE2] bg-[#F4F2EB]/50 p-2.5 opacity-50 cursor-not-allowed">
                <div className={`flex items-center gap-1.5 mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <FileText className="w-3 h-3 text-slate-300 shrink-0" />
                  <span className={`text-[9px] font-bold text-slate-400 tracking-wide ${isRtl ? 'font-[Tajawal]' : ''}`}>
                    {t('file_slot_extracted')}
                  </span>
                </div>
                <p className={`text-[10px] text-slate-300 ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
                  {t('file_slot_pending_extraction')}
                </p>
              </div>
            )}

            {/* ORIGINAL tile */}
            <a
              href={originalUrl(file.id, file.projectId)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[#ECEAE2] bg-[#F4F2EB] p-2.5 hover:bg-[#ECEAE2] transition-colors cursor-pointer group"
            >
              <div className={`flex items-center gap-1.5 mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                <span className={`text-[9px] font-bold text-slate-500 group-hover:text-slate-700 tracking-wide ${isRtl ? 'font-[Tajawal]' : ''}`}>
                  {t('file_slot_original')}
                </span>
              </div>
              <p className={`text-[10px] text-slate-600 group-hover:text-slate-700 transition-colors ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
                {t('file_slot_preview')} →
              </p>
            </a>
          </div>
        ) : (
          <div className="px-4 pb-3">
            {/* ORIGINAL tile — full width for the 7 Orgadata .docx slots */}
            <a
              href={originalUrl(file.id, file.projectId)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[#ECEAE2] bg-[#F4F2EB] p-2.5 hover:bg-[#ECEAE2] transition-colors cursor-pointer group block"
            >
              <div className={`flex items-center gap-1.5 mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                <span className={`text-[9px] font-bold text-slate-500 group-hover:text-slate-700 tracking-wide ${isRtl ? 'font-[Tajawal]' : ''}`}>
                  {t('file_slot_original')}
                </span>
              </div>
              <p className={`text-[10px] text-slate-600 group-hover:text-slate-700 transition-colors ${isRtl ? 'font-[Tajawal] text-end' : ''}`}>
                {t('file_slot_preview')} →
              </p>
            </a>
          </div>
        )}

        {/* 3 action buttons — RTL order: معاينة | تنزيل | استبدال */}
        <div className={`flex items-center gap-2 px-4 pb-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
          {/* معاينة — opens original in browser (no download) */}
          <a
            href={originalUrl(file.id, file.projectId)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#ECEAE2] text-slate-700 hover:bg-[#F4F2EB] transition-colors ${isRtl ? 'font-[Tajawal] flex-row-reverse' : ''}`}
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            {t('file_slot_preview')}
          </a>

          {/* تنزيل — downloads original */}
          <button
            onClick={() => onDownload(file.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#ECEAE2] text-slate-700 hover:bg-[#F4F2EB] transition-colors ${isRtl ? 'font-[Tajawal] flex-row-reverse' : ''}`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            {t('erp_file_download')}
          </button>

          {/* استبدال — triggers ReUploadConfirmModal */}
          {canReplace && (
            <button
              onClick={() => handleReplaceClick(file.id)}
              disabled={uploading || isLoading}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#ECEAE2] text-slate-700 hover:bg-[#F4F2EB] transition-colors disabled:opacity-40 ${isRtl ? 'font-[Tajawal] flex-row-reverse' : ''}`}
            >
              {uploading && replacingId === file.id
                ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                : <Upload className="w-3.5 h-3.5 shrink-0" />}
              {t('erp_file_replace')}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Single-file slot ───────────────────────────────────────────────────────
  if (type === 'single') {
    return (
      <>
        <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />

        {isEmpty || !activeFile ? (
          <div className="rounded-xl border border-[#ECEAE2] bg-[#F4F2EB] overflow-hidden">
            <div className={`flex items-center gap-3 px-4 py-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <p className={`text-sm font-medium text-slate-600 ${isRtl ? 'font-[Tajawal]' : ''}`}>{displayLabel}</p>
            </div>
            <div className="border-t border-[#ECEAE2] bg-[#FAFAF7]">
              {emptyState}
            </div>
          </div>
        ) : (
          renderFileRow(activeFile)
        )}

        {pendingReplaceId !== null && (
          <ReUploadConfirmModal
            onConfirm={confirmReplace}
            onCancel={() => setPendingReplaceId(null)}
          />
        )}
        {pendingDeleteId !== null && (
          <DeleteConfirmModal
            onConfirm={handleDeleteConfirm}
            onCancel={() => setPendingDeleteId(null)}
          />
        )}
        {openMenuId !== null && (
          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
        )}
      </>
    );
  }

  // ── Multi-file bucket ──────────────────────────────────────────────────────
  return (
    <>
      <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />

      <div className="rounded-xl border border-[#ECEAE2] bg-[#F4F2EB] overflow-hidden">
        {/* Bucket header */}
        <div className={`flex items-center gap-3 px-4 py-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
          <p className={`flex-1 text-sm font-medium text-slate-700 ${isRtl ? 'font-[Tajawal]' : ''}`}>{displayLabel}</p>
          {files.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#141A24]/8 text-[#141A24]">
              {files.length}
            </span>
          )}
        </div>

        {isEmpty ? (
          <div className="border-t border-[#ECEAE2] bg-[#FAFAF7]">
            {emptyState}
          </div>
        ) : (
          <div className="border-t border-[#ECEAE2] bg-[#FAFAF7]">
            <div className="divide-y divide-[#ECEAE2] space-y-0">
              {files.map(f => (
                <div key={f.id} className="px-3 py-3">
                  {renderFileRow(f, true)}
                </div>
              ))}
            </div>
            {/* + Add file at the bottom — only when bucket has files */}
            <div className="px-4 py-3 border-t border-[#ECEAE2]">
              <button
                onClick={() => triggerInput()}
                disabled={uploading || isLoading}
                className={`inline-flex items-center gap-1.5 text-sm font-medium text-[#141A24] hover:opacity-70 transition-opacity disabled:opacity-40 ${isRtl ? 'font-[Tajawal] flex-row-reverse' : ''}`}
              >
                {uploading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : null}
                {t('file_slot_add_file')}
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingReplaceId !== null && (
        <ReUploadConfirmModal
          onConfirm={confirmReplace}
          onCancel={() => setPendingReplaceId(null)}
        />
      )}
      {pendingDeleteId !== null && (
        <DeleteConfirmModal
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
      {openMenuId !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}
    </>
  );
}
