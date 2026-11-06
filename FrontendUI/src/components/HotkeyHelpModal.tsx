import React, { useEffect } from 'react';
import { LOGO_HOTKEYS } from '../data/logoHotkeys';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** F1 — Logo tarzı kısayol yardımı */
export const HotkeyHelpModal: React.FC<Props> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'F1') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/40 p-3">
      <div
        role="dialog"
        aria-labelledby="hotkey-help-title"
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-md border border-slate-400 bg-[#ece9d8] shadow-xl flex flex-col"
      >
        <div className="px-3 py-2 border-b border-slate-300 bg-[#d4d0c8] flex items-center justify-between gap-2">
          <h3 id="hotkey-help-title" className="text-[13px] font-semibold text-slate-800">
            Klavye Kısayolları (F1)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="h-7 px-3 text-[12px] border border-slate-500 bg-[#ece9d8] hover:bg-white"
          >
            Kapat
          </button>
        </div>
        <div className="overflow-y-auto p-2">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-left text-[11px] text-slate-600 border-b border-slate-300">
                <th className="px-2 py-1.5 w-[160px]">Tuş</th>
                <th className="px-2 py-1.5">İşlev</th>
                <th className="px-2 py-1.5 w-[88px]">Durum</th>
              </tr>
            </thead>
            <tbody>
              {LOGO_HOTKEYS.map((h) => (
                <tr key={h.keys} className="border-b border-slate-200/80">
                  <td className="px-2 py-1 font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {h.keys}
                  </td>
                  <td className="px-2 py-1 text-slate-700">{h.label}</td>
                  <td className="px-2 py-1">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide ${
                        h.status === 'active'
                          ? 'text-emerald-700'
                          : h.status === 'partial'
                            ? 'text-amber-700'
                            : 'text-slate-400'
                      }`}
                    >
                      {h.status === 'active' ? 'Aktif' : h.status === 'partial' ? 'Kısmi' : 'Planlı'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
