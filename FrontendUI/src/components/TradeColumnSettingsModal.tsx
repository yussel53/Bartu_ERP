import React, { useEffect, useMemo, useState } from 'react';
import type { FormFieldDto } from '../types/formTypes';

export interface TradeColumnScreenOption {
  formCode: string;
  title: string;
  fields: FormFieldDto[];
  selectedKeys: string[];
}

interface TradeColumnSettingsModalProps {
  fields: FormFieldDto[];
  selectedKeys: string[];
  currentFormCode?: string;
  screens?: TradeColumnScreenOption[];
  onApply: (formCode: string, keys: string[]) => void;
  onCancel: () => void;
}

/**
 * Logo «Kolon Ayarları»: kaldırılan / seçilen çift liste + Ekle / Çıkar (checkbox yok)
 */
export const TradeColumnSettingsModal: React.FC<TradeColumnSettingsModalProps> = ({
  fields,
  selectedKeys,
  currentFormCode,
  screens,
  onApply,
  onCancel,
}) => {
  const screenList = useMemo(() => {
    if (screens?.length) return screens;
    return [
      {
        formCode: currentFormCode || 'current',
        title: 'Bu ekran',
        fields,
        selectedKeys,
      },
    ];
  }, [screens, currentFormCode, fields, selectedKeys]);

  const [activeCode, setActiveCode] = useState(
    currentFormCode && screenList.some((s) => s.formCode === currentFormCode)
      ? currentFormCode
      : screenList[0].formCode,
  );
  const [draftByCode, setDraftByCode] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const s of screenList) {
      init[s.formCode] = s.selectedKeys.length
        ? s.selectedKeys
        : s.fields.map((f) => f.fieldName);
    }
    return init;
  });
  const [leftPick, setLeftPick] = useState<string[]>([]);
  const [rightPick, setRightPick] = useState<string[]>([]);
  const [leftFilter, setLeftFilter] = useState('');
  const [rightFilter, setRightFilter] = useState('');

  const active = screenList.find((s) => s.formCode === activeCode) || screenList[0];
  const activeFields = active.fields;
  const selected = draftByCode[active.formCode] || active.selectedKeys;

  useEffect(() => {
    setLeftPick([]);
    setRightPick([]);
    setLeftFilter('');
    setRightFilter('');
  }, [activeCode]);

  const byKey = useMemo(() => {
    const m = new Map<string, FormFieldDto>();
    for (const f of activeFields) m.set(f.fieldName, f);
    return m;
  }, [activeFields]);

  const labelOf = (key: string) => {
    const idx = activeFields.findIndex((f) => f.fieldName === key);
    const f = byKey.get(key);
    return `(${idx >= 0 ? idx + 1 : '?'}) ${f?.label || key}`;
  };

  const removed = useMemo(
    () => activeFields.map((f) => f.fieldName).filter((k) => !selected.includes(k)),
    [activeFields, selected],
  );

  const setSelected = (updater: string[] | ((prev: string[]) => string[])) => {
    setDraftByCode((prev) => {
      const cur = prev[active.formCode] || active.selectedKeys;
      const next = typeof updater === 'function' ? updater(cur) : updater;
      return { ...prev, [active.formCode]: next };
    });
  };

  const filterList = (keys: string[], q: string) => {
    const s = q.trim().toLocaleLowerCase('tr-TR');
    if (!s) return keys;
    return keys.filter((k) => labelOf(k).toLocaleLowerCase('tr-TR').includes(s));
  };

  const leftKeys = filterList(removed, leftFilter);
  const rightKeys = filterList(selected, rightFilter);

  const togglePick = (
    key: string,
    current: string[],
    set: React.Dispatch<React.SetStateAction<string[]>>,
    e: React.MouseEvent,
  ) => {
    if (e.ctrlKey || e.metaKey) {
      set(current.includes(key) ? current.filter((k) => k !== key) : [...current, key]);
      return;
    }
    if (e.shiftKey && current.length) {
      const pool = set === setLeftPick ? leftKeys : rightKeys;
      const a = pool.indexOf(current[current.length - 1]);
      const b = pool.indexOf(key);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        set(pool.slice(lo, hi + 1));
        return;
      }
    }
    set([key]);
  };

  const listBox = (
    keys: string[],
    pick: string[],
    setPick: React.Dispatch<React.SetStateAction<string[]>>,
    filter: string,
    setFilter: (v: string) => void,
    title: string,
    side: 'left' | 'right',
  ) => (
    <div className="flex flex-col min-w-0 flex-1">
      <div className="text-[12px] font-semibold text-slate-700 mb-1">{title}</div>
      <ul
        className="w-full h-[300px] overflow-y-auto border border-slate-400 bg-white text-[12px] text-slate-800 select-none"
        role="listbox"
        aria-multiselectable
        aria-label={title}
      >
        {keys.length === 0 ? (
          <li className="px-2 py-3 text-slate-400 text-center">Liste boş</li>
        ) : (
          keys.map((k) => {
            const on = pick.includes(k);
            return (
              <li key={k}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`w-full text-left px-2 py-0.5 truncate ${
                    on ? 'bg-[#316ac5] text-white' : 'hover:bg-slate-100'
                  }`}
                  onClick={(e) => togglePick(k, pick, setPick, e)}
                  onDoubleClick={() => {
                    if (side === 'left') {
                      setSelected((prev) => (prev.includes(k) ? prev : [...prev, k]));
                      setLeftPick([]);
                    } else {
                      setSelected((prev) => prev.filter((x) => x !== k));
                      setRightPick([]);
                    }
                  }}
                >
                  {labelOf(k)}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtre…"
        className="mt-1 h-7 px-2 text-[11px] border border-slate-300 bg-white"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/35 p-3">
      <div
        className="w-full max-w-3xl rounded-sm border border-slate-400 bg-[#ece9d8] shadow-xl"
        role="dialog"
        aria-labelledby="col-settings-title"
      >
        <div className="px-3 py-2 border-b border-slate-300 bg-[#d4d0c8]">
          <h3 id="col-settings-title" className="text-[13px] font-semibold text-slate-800">
            Kolon Ayarları
          </h3>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Lütfen görüntülemek istediğiniz kolonları seçiniz.
          </p>
          {screenList.length > 1 && (
            <label className="mt-2 flex items-center gap-2 text-[12px] text-slate-700">
              <span className="font-semibold shrink-0">Ekran</span>
              <select
                value={activeCode}
                onChange={(e) => setActiveCode(e.target.value)}
                className="h-7 min-w-[180px] px-1.5 border border-slate-500 bg-white text-[12px]"
              >
                {screenList.map((s) => (
                  <option key={s.formCode} value={s.formCode}>
                    {s.title}
                    {s.formCode === currentFormCode ? ' (açık)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="p-3 flex gap-2 items-stretch">
          {listBox(leftKeys, leftPick, setLeftPick, leftFilter, setLeftFilter, 'Kaldırılan Kolonlar', 'left')}

          <div className="flex flex-col justify-center gap-1.5 shrink-0 px-1">
            <button
              type="button"
              onClick={() => {
                if (!leftPick.length) return;
                setSelected((prev) => [...prev, ...leftPick.filter((k) => !prev.includes(k))]);
                setLeftPick([]);
              }}
              className="h-7 min-w-[92px] px-2 text-[11px] font-semibold border border-slate-500 bg-[#d4d0c8] hover:bg-[#c9c4b8]"
            >
              Ekle →
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(activeFields.map((f) => f.fieldName));
                setLeftPick([]);
              }}
              className="h-7 min-w-[92px] px-2 text-[11px] border border-slate-500 bg-[#d4d0c8] hover:bg-[#c9c4b8]"
            >
              Hepsini →
            </button>
            <button
              type="button"
              onClick={() => {
                if (!rightPick.length) return;
                setSelected((prev) => prev.filter((k) => !rightPick.includes(k)));
                setRightPick([]);
              }}
              className="h-7 min-w-[92px] px-2 text-[11px] font-semibold border border-slate-500 bg-[#d4d0c8] hover:bg-[#c9c4b8] mt-2"
            >
              ← Çıkar
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected([]);
                setRightPick([]);
              }}
              className="h-7 min-w-[92px] px-2 text-[11px] border border-slate-500 bg-[#d4d0c8] hover:bg-[#c9c4b8]"
            >
              ← Hepsini
            </button>
          </div>

          {listBox(rightKeys, rightPick, setRightPick, rightFilter, setRightFilter, 'Seçilen Kolonlar', 'right')}
        </div>

        <div className="px-3 py-2 border-t border-slate-300 flex items-center justify-end gap-2 bg-[#d4d0c8]">
          <button
            type="button"
            onClick={onCancel}
            className="h-7 px-4 text-[12px] border border-slate-500 bg-[#ece9d8] hover:bg-white"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => {
              const keys =
                selected.length > 0
                  ? selected
                  : activeFields.slice(0, 1).map((f) => f.fieldName);
              onApply(active.formCode, keys);
            }}
            className="h-7 px-4 text-[12px] font-semibold border border-slate-500 bg-[#ece9d8] hover:bg-white"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
