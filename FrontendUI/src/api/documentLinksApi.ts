import { apiJson } from '../config/api';

export interface DocumentLink {
  kind: string;
  label: string;
  table: string;
  id: number;
  documentNumber?: string | null;
  formCode: string;
  typeHint?: number | null;
}

export function fetchDocumentLinks(table: string, id: number) {
  return apiJson<DocumentLink[]>(`/api/document-links/${encodeURIComponent(table)}/${id}`);
}
