import { API_BASE, apiJson, getSelectedDb } from '../config/api';

export interface DocFileRow {
  documentFileID: number;
  sourceTable: string;
  sourceID: number;
  fileName: string;
  contentType?: string | null;
  extension?: string | null;
  sizeBytes?: number | null;
  title?: string | null;
  note?: string | null;
  createdAt?: string;
  createdBy?: number | null;
}

function normalize(r: Record<string, unknown>): DocFileRow {
  return {
    documentFileID: Number(r.documentFileID ?? r.DocumentFileID) || 0,
    sourceTable: String(r.sourceTable ?? r.SourceTable ?? ''),
    sourceID: Number(r.sourceID ?? r.SourceID) || 0,
    fileName: String(r.fileName ?? r.FileName ?? ''),
    contentType: (r.contentType ?? r.ContentType) as string | null | undefined,
    extension: (r.extension ?? r.Extension) as string | null | undefined,
    sizeBytes: (r.sizeBytes ?? r.SizeBytes) as number | null | undefined,
    title: (r.title ?? r.Title) as string | null | undefined,
    note: (r.note ?? r.Note) as string | null | undefined,
    createdAt: (r.createdAt ?? r.CreatedAt) as string | undefined,
    createdBy: (r.createdBy ?? r.CreatedBy) as number | null | undefined,
  };
}

export async function listDocFiles(table: string, id: number): Promise<DocFileRow[]> {
  const rows = await apiJson<Record<string, unknown>[]>(
    `/api/doc-files?table=${encodeURIComponent(table)}&id=${id}`,
  );
  return (Array.isArray(rows) ? rows : []).map((r) => normalize(r));
}

export async function uploadDocFile(
  table: string,
  id: number,
  file: File,
  opts?: { title?: string; note?: string },
): Promise<DocFileRow> {
  const fd = new FormData();
  fd.append('file', file);
  if (opts?.title) fd.append('title', opts.title);
  if (opts?.note) fd.append('note', opts.note);
  const headers: Record<string, string> = { Accept: 'application/json' };
  const db = getSelectedDb();
  if (db) headers['X-Bartu-Db'] = db;
  const res = await fetch(
    `${API_BASE}/api/doc-files?table=${encodeURIComponent(table)}&id=${id}`,
    { method: 'POST', headers, body: fd, credentials: 'include' },
  );
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      /* */
    }
    throw new Error(msg || 'Yükleme başarısız');
  }
  const row = (await res.json()) as Record<string, unknown>;
  return normalize(row);
}

export async function deleteDocFile(fileId: number): Promise<void> {
  await apiJson(`/api/doc-files/${fileId}`, { method: 'DELETE' });
}

export function docFileDownloadUrl(fileId: number): string {
  return `${API_BASE}/api/doc-files/${fileId}/download`;
}
