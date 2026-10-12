import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, MoreVertical, Pencil, Trash2, Copy } from 'lucide-react';
import { AuthAction } from '../data/permissions';

export interface RowActionHandlers {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
}

interface RowActionsProps {
  allowed: Record<AuthAction, boolean>;
  handlers: RowActionHandlers;
}

export const RowActions: React.FC<RowActionsProps> = ({ allowed, handlers }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = btnRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const menuItems: {
    key: string;
    label: string;
    icon: React.ReactNode;
    show: boolean;
    danger?: boolean;
    onClick?: () => void;
  }[] = [
    {
      key: 'edit',
      label: 'Değiştir',
      icon: <Pencil className="w-3.5 h-3.5" />,
      show: allowed.update,
      onClick: handlers.onEdit,
    },
    {
      key: 'copy',
      label: 'Kopyala',
      icon: <Copy className="w-3.5 h-3.5" />,
      show: allowed.create,
      onClick: handlers.onCopy,
    },
    {
      key: 'delete',
      label: 'Çıkar',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      show: allowed.delete,
      danger: true,
      onClick: handlers.onDelete,
    },
  ].filter((i) => i.show);

  const hasAny = allowed.view || menuItems.length > 0;
  if (!hasAny) return <span className="text-[10px] text-slate-300">—</span>;

  return (
    <div className="flex items-center justify-start gap-0.5">
      {allowed.view && (
        <button
          type="button"
          title="İncele"
          onClick={handlers.onView}
          className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}

      {menuItems.length > 0 && (
        <>
          <button
            ref={btnRef}
            type="button"
            title="İşlemler"
            onClick={() => setOpen((v) => !v)}
            className={`p-1 rounded transition-colors ${
              open
                ? 'text-slate-800 bg-slate-100'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {open &&
            menuPos &&
            createPortal(
              <div
                ref={menuRef}
                style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
                className="min-w-[148px] rounded-md border border-slate-200 bg-white shadow-lg py-1"
              >
                {menuItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-left hover:bg-slate-50 ${
                      item.danger ? 'text-red-600' : 'text-slate-700'
                    }`}
                    onClick={() => {
                      setOpen(false);
                      item.onClick?.();
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>,
              document.body,
            )}
        </>
      )}
    </div>
  );
};
