import { useEffect, useRef } from 'react';

export interface DocumentHotkeyHandlers {
  onHelp?: () => void;
  onSave?: () => void;
  onDraft?: () => void;
  onCancel?: () => void;
  onToggleCustomerLine?: () => void;
  onQuickEntry?: () => void;
  onPreview?: () => void;
  onOpsMenu?: (anchor: { x: number; y: number }) => void;
  onColumnSettings?: () => void;
  onExcel?: () => void;
  onExtraDiscount?: () => void;
  onToggleGridExpand?: () => void;
  onPrevDetailTab?: () => void;
  onNextDetailTab?: () => void;
  onAddLine?: () => void;
  onDeleteLine?: () => void;
  onNextLine?: () => void;
  enabled?: boolean;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const t = (el as HTMLInputElement).type;
    return !['button', 'submit', 'checkbox', 'radio', 'file'].includes(t);
  }
  if (el.isContentEditable) return true;
  return false;
}

/** Fiş / fatura Logo kısayolları (F2 kaydet, F3 vazgeç, F11 kolon…) */
export function useDocumentHotkeys(handlers: DocumentHotkeyHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (handlers.enabled === false) return;

    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      if (h.enabled === false) return;
      // Modal / dialog açıkken (yardım hariç) çakışmayı azalt
      if (document.querySelector('[role="dialog"][aria-labelledby="hotkey-help-title"]')) {
        if (e.key !== 'F1' && e.key !== 'Escape') return;
      }

      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const alt = e.altKey;
      const shift = e.shiftKey;

      // F1 her yerde
      if (key === 'F1' && !ctrl && !alt) {
        e.preventDefault();
        h.onHelp?.();
        return;
      }

      // Alt+F4 — AppShell global de yakalar; burada engelleme
      if (key === 'F4' && alt) return;

      if (key === 'F2' && ctrl && !alt && !shift) {
        e.preventDefault();
        h.onDraft?.();
        return;
      }
      if (key === 'F2' && !ctrl && !alt && !shift) {
        e.preventDefault();
        h.onSave?.();
        return;
      }
      if (key === 'F3' && !ctrl && !alt) {
        e.preventDefault();
        h.onCancel?.();
        return;
      }
      if (key === 'F5' && !ctrl && !alt) {
        e.preventDefault();
        h.onToggleCustomerLine?.();
        return;
      }
      if (key === 'F6' && !ctrl && !alt) {
        e.preventDefault();
        h.onQuickEntry?.();
        return;
      }
      if (key === 'F7' && !ctrl && !alt && !shift) {
        e.preventDefault();
        h.onPreview?.();
        return;
      }
      if (key === 'F9' && !ctrl && !alt) {
        e.preventDefault();
        h.onOpsMenu?.({ x: window.innerWidth - 40, y: 80 });
        return;
      }
      if (key === 'F11' && !ctrl && !alt) {
        e.preventDefault();
        h.onColumnSettings?.();
        return;
      }
      if (key === 'F12' && !ctrl && !alt) {
        e.preventDefault();
        h.onExcel?.();
        return;
      }
      if (alt && !ctrl && (key === '5' || e.code === 'Digit5' || e.code === 'Numpad5')) {
        e.preventDefault();
        h.onExtraDiscount?.();
        return;
      }
      if (alt && !ctrl && key === 'Enter') {
        e.preventDefault();
        h.onToggleGridExpand?.();
        return;
      }
      if (ctrl && !alt && key === 'PageUp') {
        e.preventDefault();
        h.onPrevDetailTab?.();
        return;
      }
      if (ctrl && !alt && key === 'PageDown') {
        e.preventDefault();
        h.onNextDetailTab?.();
        return;
      }
      if (shift && !ctrl && !alt && key === 'Insert') {
        e.preventDefault();
        h.onAddLine?.();
        return;
      }
      if (shift && !ctrl && !alt && (key === 'Delete' || key === 'Del')) {
        e.preventDefault();
        h.onDeleteLine?.();
        return;
      }
      if (ctrl && !alt && !shift && key === 'Enter') {
        // textarea'da satır kırılması istenebilir; fiş satırında alt satıra geç
        if (isTypingTarget(e.target) && (e.target as HTMLElement).tagName === 'TEXTAREA') return;
        e.preventDefault();
        h.onNextLine?.();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers.enabled]);
}
