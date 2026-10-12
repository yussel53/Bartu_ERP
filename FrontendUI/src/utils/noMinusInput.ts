import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react';

const MINUS_RE = /[-–−﹣－]/g;

export function stripMinusChars(value: string): string {
  return value.replace(MINUS_RE, '');
}

export function blockMinusKeyDown(e: KeyboardEvent<HTMLElement>): void {
  if (e.key === '-' || e.key === 'Subtract' || e.key === '–' || e.key === '−' || e.key === '﹣') {
    e.preventDefault();
  }
}

/** input/textarea: yazım ve yapıştırmada eksi karakterini temizler */
export function attachNoMinusHandlers<T extends HTMLInputElement | HTMLTextAreaElement>(
  existing?: {
    onKeyDown?: (e: KeyboardEvent<T>) => void;
    onChange?: (e: FormEvent<T>) => void;
    onPaste?: (e: ClipboardEvent<T>) => void;
  },
) {
  return {
    onKeyDown: (e: KeyboardEvent<T>) => {
      blockMinusKeyDown(e);
      existing?.onKeyDown?.(e);
    },
    onChange: (e: FormEvent<T>) => {
      const el = e.currentTarget;
      const cleaned = stripMinusChars(el.value);
      if (cleaned !== el.value) {
        const start = el.selectionStart;
        el.value = cleaned;
        if (start != null) {
          const next = Math.max(0, start - (el.value.length - cleaned.length));
          try {
            el.setSelectionRange(next, next);
          } catch {
            /* number input may not support */
          }
        }
      }
      existing?.onChange?.(e);
    },
    onPaste: (e: ClipboardEvent<T>) => {
      const text = e.clipboardData.getData('text');
      if (MINUS_RE.test(text)) {
        e.preventDefault();
        const el = e.currentTarget;
        const cleaned = stripMinusChars(text);
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const next = `${el.value.slice(0, start)}${cleaned}${el.value.slice(end)}`;
        el.value = next;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        existing?.onChange?.(e as unknown as FormEvent<T>);
      } else {
        existing?.onPaste?.(e);
      }
    },
  };
}
