/**
 * Files on Google Drive. The CRM backend issues a short ticket; the file goes straight to the «Magmafy Files»
 * script (on the Drive account with the space) with it; its signed receipt is then recorded by the CRM.
 * In mock mode the ticket URL is «mock:files» and an in-browser store stands in for Drive.
 */
import { api } from './endpoints';
import { ApiError } from './errors';
import type { LeadFile } from './schemas';

export const FILE_MAX_BYTES = 20 * 1024 * 1024;
export const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv';
const MIME_OK = /^(application\/pdf|image\/(jpeg|png|webp|gif|heic|heif)|application\/(msword|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.[\w.-]+|zip|x-zip-compressed)|text\/(plain|csv))$/;
const BY_EXT: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', txt: 'text/plain', csv: 'text/csv'
};
/** Browsers often leave the type empty (Windows, HEIC): fall back to the extension. */
export function mimeOf(file: File) {
  if (file.type && MIME_OK.test(file.type)) return file.type;
  return BY_EXT[(file.name.split('.').pop() || '').toLowerCase()] || file.type || '';
}
export function checkFile(file: File): string | null {
  if (!file.size) return 'الملف فاضي';
  if (file.size > FILE_MAX_BYTES) return 'الملف أكبر من 20 ميجا';
  if (!MIME_OK.test(mimeOf(file))) return 'نوع الملف مش مسموح. المسموح: PDF، صور، Word، Excel، PowerPoint، ZIP، نص';
  return null;
}

const FILES_ERRORS: Record<string, string> = {
  expired: 'التذكرة انتهت، جرّب تاني', used: 'التذكرة اتستخدمت قبل كده، جرّب تاني', too_big: 'الملف أكبر من 20 ميجا',
  bad_type: 'نوع الملف مش مسموح', mismatch: 'الملف اتغير أثناء الرفع، جرّب تاني', not_found: 'الملف مش موجود على Drive',
  bad_ticket: 'سكريبت الملفات رفض الطلب: اتأكد إن FILES_SECRET نفس القيمة في الشيت وفي Files.gs',
  not_ready: 'سكريبت الملفات لسه مش متجهز: حط FILES_SECRET في Files.gs واعمل Deploy'
};

function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(new ApiError('APP_ERROR', 'مقدرناش نقرا الملف'));
    r.readAsDataURL(file);
  });
}

/** POST to the files script with upload progress. Apps Script answers through a redirect, which XHR follows. */
function postFiles(url: string, body: Record<string, unknown>, onProgress?: (p: number) => void): Promise<Record<string, unknown>> {
  if (url.startsWith('mock:')) return import('./mock/server').then((m) => m.mockFiles(body, onProgress));
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
    x.timeout = 5 * 60000;
    if (onProgress) x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.min(0.97, e.loaded / e.total)); };
    x.onload = () => {
      try { resolve(JSON.parse(x.responseText)); } catch { reject(new ApiError('SERVER', 'سكريبت الملفات رد برد مش مفهوم')); }
    };
    x.onerror = () => reject(new ApiError('NETWORK', 'مفيش اتصال بسكريبت الملفات'));
    x.ontimeout = () => reject(new ApiError('TIMEOUT', 'الرفع أخد وقت طويل، جرّب تاني'));
    x.send(JSON.stringify(body));
  });
}

function failOf(res: Record<string, unknown>) {
  const code = String(res.error || 'server');
  return new ApiError('APP_ERROR', FILES_ERRORS[code] || 'حصلت مشكلة في سكريبت الملفات، جرّب تاني');
}

export async function uploadLeadFile(leadId: string, file: File, onProgress?: (p: number) => void): Promise<LeadFile> {
  const bad = checkFile(file);
  if (bad) throw new ApiError('APP_ERROR', bad);
  const mime = mimeOf(file);
  const tk = await api.fileTicket({ op: 'upload', leadId, name: file.name, mime, size: file.size });
  const data = await toBase64(file);
  const res = await postFiles(tk.url, { action: 'upload', ticket: tk.ticket, data }, onProgress);
  if (!res.ok) throw failOf(res);
  const out = await api.attachFile(String(res.receipt));
  onProgress?.(1);
  return out.file;
}

/** Downloads the file through the files script (Drive links stay private) and returns a local object URL. */
export async function fetchLeadFile(f: LeadFile): Promise<{ url: string; mime: string; name: string }> {
  const tk = await api.fileTicket({ op: 'view', id: f.id });
  const res = await postFiles(tk.url, { action: 'get', ticket: tk.ticket });
  if (!res.ok) throw failOf(res);
  const bin = atob(String(res.data));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const mime = String(res.mime || f.mime);
  return { url: URL.createObjectURL(new Blob([bytes], { type: mime })), mime, name: String(res.name || f.name) };
}

export async function deleteLeadFile(f: LeadFile) {
  const r = await api.deleteFile(f.id);
  if (r.trash) { try { await postFiles(r.trash.url, { action: 'trash', ticket: r.trash.ticket }); } catch { /* hidden in the CRM; Drive cleanup can wait */ } }
}

export function fileKind(mime: string): 'pdf' | 'image' | 'doc' | 'sheet' | 'slides' | 'zip' | 'text' | 'file' {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (/word|msword/.test(mime)) return 'doc';
  if (/sheet|excel|csv/.test(mime)) return 'sheet';
  if (/presentation|powerpoint/.test(mime)) return 'slides';
  if (/zip/.test(mime)) return 'zip';
  if (mime.startsWith('text/')) return 'text';
  return 'file';
}
export function fileSize(n: number) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
