import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface RowContextMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  /** Bu öğeden önce ayırıcı çiz */
  separatorBefore?: boolean;
  onClick: () => void;
}

interface RowContextMenuProps {
  x: number;
  y: number;
  title?: string;
  items: RowContextMenuItem[];
  onClose: () => void;
}

/** Liste satırında sağ tık menüsü (fare konumunda, ekran dışına taşmaz). */
export const RowContextMenu: React.FC<RowContextMenuProps> = ({ x, y, title, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)),
      left: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)),
    });
  }, [x, y]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  if (items.length === 0) return null;

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="min-w-[200px] max-w-[280px] rounded-md border border-slate-200 bg-white shadow-lg py-1"
      onContextMenu={(e) => e.preventDefault()}
      role="menu"
    >
      {title && (
        <p className="px-2.5 pt-0.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">
          {title}
        </p>
      )}
      {items.map((item) => (
        <React.Fragment key={item.key}>
          {item.separatorBefore && <div className="my-1 border-t border-slate-100" />}
          <button
            type="button"
            role="menuitem"
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-left hover:bg-slate-50 ${
              item.danger ? 'text-red-600' : 'text-slate-700'
            }`}
            onClick={() => {
              onClose();
              item.onClick();
            }}
          >
            <span className="w-3.5 h-3.5 inline-flex items-center justify-center shrink-0">{item.icon}</span>
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>,
    document.body,
  );
};
