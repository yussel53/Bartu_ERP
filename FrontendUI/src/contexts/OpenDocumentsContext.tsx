import React from 'react';
import { DynamicFormDataDto } from '../types/formTypes';

export type OpenDocMode = 'create' | 'edit' | 'view';

export interface OpenDocument {
  id: string;
  formCode: string;
  screenPath: string;
  screenTitle: string;
  mode: OpenDocMode;
  recordId?: string;
  /** Tray / sekme etiketi */
  label: string;
  data?: DynamicFormDataDto;
  updatedAt: number;
}

interface OpenOrFocusInput {
  id: string;
  formCode: string;
  screenPath: string;
  screenTitle: string;
  mode: OpenDocMode;
  recordId?: string;
  label?: string;
}

interface OpenDocumentsContextValue {
  documents: OpenDocument[];
  activeId: string | null;
  openOrFocus: (input: OpenOrFocusInput) => OpenDocument;
  updateDraft: (id: string, patch: { data?: DynamicFormDataDto; label?: string }) => void;
  closeDocument: (id: string) => void;
  setActiveId: (id: string | null) => void;
  getDocument: (id: string) => OpenDocument | undefined;
}

const OpenDocumentsContext = React.createContext<OpenDocumentsContextValue | null>(null);

function newDraftId(): string {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function createOpenDocId(mode: OpenDocMode, recordId?: string): string {
  if (mode === 'edit' && recordId) return `edit-${recordId}`;
  if (mode === 'view' && recordId) return `view-${recordId}`;
  return newDraftId();
}

export function buildOpenDocHref(screenPath: string, mode: OpenDocMode, opts: { draftId?: string; recordId?: string }): string {
  if (mode === 'create') {
    const id = opts.draftId || newDraftId();
    return `${screenPath}/yeni/${id}`;
  }
  if (mode === 'edit' && opts.recordId) return `${screenPath}/degistir/${opts.recordId}`;
  if (mode === 'view' && opts.recordId) return `${screenPath}/incele/${opts.recordId}`;
  return screenPath;
}

export const OpenDocumentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = React.useState<OpenDocument[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const getDocument = React.useCallback(
    (id: string) => documents.find((d) => d.id === id),
    [documents],
  );

  const openOrFocus = React.useCallback((input: OpenOrFocusInput): OpenDocument => {
    let result: OpenDocument | undefined;
    setDocuments((prev) => {
      const existing = prev.find((d) => d.id === input.id);
      if (existing) {
        result = {
          ...existing,
          formCode: input.formCode,
          screenPath: input.screenPath,
          screenTitle: input.screenTitle,
          mode: input.mode,
          recordId: input.recordId,
          label: input.label || existing.label,
          updatedAt: Date.now(),
        };
        return prev.map((d) => (d.id === input.id ? result! : d));
      }
      result = {
        id: input.id,
        formCode: input.formCode,
        screenPath: input.screenPath,
        screenTitle: input.screenTitle,
        mode: input.mode,
        recordId: input.recordId,
        label: input.label || input.screenTitle,
        updatedAt: Date.now(),
      };
      return [...prev, result];
    });
    setActiveId(input.id);
    return (
      result || {
        id: input.id,
        formCode: input.formCode,
        screenPath: input.screenPath,
        screenTitle: input.screenTitle,
        mode: input.mode,
        recordId: input.recordId,
        label: input.label || input.screenTitle,
        updatedAt: Date.now(),
      }
    );
  }, []);

  const updateDraft = React.useCallback(
    (id: string, patch: { data?: DynamicFormDataDto; label?: string }) => {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                data: patch.data !== undefined ? patch.data : d.data,
                label: patch.label !== undefined ? patch.label : d.label,
                updatedAt: Date.now(),
              }
            : d,
        ),
      );
    },
    [],
  );

  const closeDocument = React.useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const value = React.useMemo(
    () => ({
      documents,
      activeId,
      openOrFocus,
      updateDraft,
      closeDocument,
      setActiveId,
      getDocument,
    }),
    [documents, activeId, openOrFocus, updateDraft, closeDocument, getDocument],
  );

  return <OpenDocumentsContext.Provider value={value}>{children}</OpenDocumentsContext.Provider>;
};

export function useOpenDocuments(): OpenDocumentsContextValue {
  const ctx = React.useContext(OpenDocumentsContext);
  if (!ctx) {
    throw new Error('useOpenDocuments must be used within OpenDocumentsProvider');
  }
  return ctx;
}

/** Provider yoksa null — QuickCreate modal vb. */
export function useOpenDocumentsOptional(): OpenDocumentsContextValue | null {
  return React.useContext(OpenDocumentsContext);
}
