import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, LayoutTemplate, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { FormFieldDto, FormSchemaDto } from '../types/formTypes';
import {
  defaultLayoutFromSchema,
  FormLayoutDef,
  LayoutFieldCfg,
  LayoutSection,
} from '../data/formLayout';
import { deleteFormLayout, FormLayoutAssign, FormLayoutRow, saveFormLayout } from '../api/formLayoutsApi';
import { listAuthProfiles } from '../data/permissions';
import { listRoles, Role } from '../api/rolesApi';
import { appConfirm } from '../utils/appConfirm';

interface FormLayoutDesignerProps {
  /** Tasarım uygulanmamış (standart) şema — alan listesi buradan */
  baseSchema: FormSchemaDto;
  /** Düzenlenen tasarım (null = yeni tasarım) */
  layout: FormLayoutRow | null;
  def: FormLayoutDef;
  onDefChange: (def: FormLayoutDef) => void;
  /** Kaydedildi / silindi → listeyi yenile, verilen tasarıma geç */
  onSaved: (layoutId: number | null) => void;
  onClose: () => void;
}

const SECTION_LABEL: Record<LayoutSection, string> = {
  header: 'Başlık / kart alanları',
  lines: 'Kalem kolonları',
  custom: 'Ek alanlar',
};

/** Form üzerinde tasarım modu — yalnız yönetici (yan panel; değişiklik formda anında görünür) */
export const FormLayoutDesigner: React.FC<FormLayoutDesignerProps> = ({
  baseSchema,
  layout,
  def,
  onDefChange,
  onSaved,
  onClose,
}) => {
  const [section, setSection] = useState<LayoutSection>('header');
  const [name, setName] = useState(layout?.name ?? '');
  const [isDefault, setIsDefault] = useState(Boolean(layout?.isDefault));
  const [assigns, setAssigns] = useState<FormLayoutAssign[]>(layout?.assigns ?? []);
  const [roles, setRoles] = useState<Role[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const users = useMemo(() => listAuthProfiles(), []);

  useEffect(() => {
    setName(layout?.name ?? '');
    setIsDefault(Boolean(layout?.isDefault));
    setAssigns(layout?.assigns ?? []);
    setMsg(null);
  }, [layout]);

  useEffect(() => {
    void listRoles()
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  const sourceFields: Record<LayoutSection, FormFieldDto[]> = {
    header: baseSchema.fields,
    lines: baseSchema.lineFields || [],
    custom: baseSchema.customFields || [],
  };
  const sections = (['header', 'lines', 'custom'] as LayoutSection[]).filter((s) => sourceFields[s].length > 0);
  const fieldOf = (s: LayoutSection, n: string) => sourceFields[s].find((f) => f.fieldName === n);
  const list = def[section];

  const setList = (next: LayoutFieldCfg[]) => onDefChange({ ...def, [section]: next });
  const patch = (i: number, p: Partial<LayoutFieldCfg>) => setList(list.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setList(next);
  };

  const hasAssign = (t: 1 | 2, k: string) => assigns.some((a) => a.scopeType === t && a.scopeKey === k);
  const toggleAssign = (t: 1 | 2, k: string) =>
    setAssigns((prev) =>
      hasAssign(t, k) ? prev.filter((a) => !(a.scopeType === t && a.scopeKey === k)) : [...prev, { scopeType: t, scopeKey: k }],
    );

  const save = async (asNew: boolean) => {
    const nm = name.trim();
    if (!nm) {
      setMsg({ kind: 'err', text: 'Tasarım adı yazın.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const id = await saveFormLayout({
        layoutID: asNew ? 0 : layout?.layoutID ?? 0,
        formCode: baseSchema.formCode,
        name: nm,
        layoutJson: JSON.stringify(def),
        isDefault,
        assigns,
      });
      setMsg({ kind: 'ok', text: 'Tasarım kaydedildi.' });
      onSaved(id);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Kaydedilemedi' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!layout) return;
    if (!(await appConfirm(`«${layout.name}» tasarımı silinsin mi?\nAtanan kullanıcılar standart ekrana döner.`))) return;
    setBusy(true);
    try {
      await deleteFormLayout(layout.layoutID);
      onSaved(null);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Silinemedi' });
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'h-6 px-1.5 text-[11px] rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:border-blue-500';

  return (
    <aside className="fixed top-0 right-0 bottom-0 z-[85] w-full sm:w-[420px] flex flex-col bg-white dark:bg-slate-900 border-l border-slate-300 dark:border-slate-700 shadow-2xl">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
            <LayoutTemplate className="w-3 h-3" /> Ekran tasarımı
          </p>
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">{baseSchema.title}</h3>
        </div>
        <button type="button" onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Kapat">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 py-2 space-y-1.5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <label className="w-24 shrink-0 text-[11px] text-slate-600">Tasarım adı</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Satış ekibi"
            className={`${inputCls} flex-1 h-7 text-[12px]`}
          />
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-600 pl-[104px]">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Varsayılan tasarım (ataması olmayan herkes)
        </label>
      </div>

      <div className="flex gap-0.5 px-3 pt-2 border-b border-slate-200 dark:border-slate-700">
        {sections.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(s)}
            className={`px-2.5 h-7 text-[11px] font-medium border border-b-0 rounded-t-[4px] ${
              s === section
                ? 'bg-white dark:bg-slate-900 border-slate-300 text-slate-900 dark:text-white -mb-px'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-500 hover:text-slate-800'
            }`}
          >
            {SECTION_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 grid grid-cols-[18px_18px_minmax(0,1fr)_34px_34px_44px] gap-1 items-center px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 border-b border-slate-200">
          <span />
          <span title="Görünür">Gör.</span>
          <span>Etiket (boş = standart)</span>
          <span title="Zorunlu">Zor.</span>
          <span title="Salt okunur">S.O.</span>
          <span className="text-right">Sıra</span>
        </div>
        <ul>
          {list.map((c, i) => {
            const f = fieldOf(section, c.name);
            if (!f) return null;
            const locked = Boolean(f.isRequired);
            return (
              <li
                key={c.name}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIdx != null) move(dragIdx, i);
                  setDragIdx(null);
                }}
                className={`grid grid-cols-[18px_18px_minmax(0,1fr)_34px_34px_44px] gap-1 items-center px-3 py-1 border-b border-slate-100 dark:border-slate-800 ${
                  c.visible === false ? 'opacity-50' : ''
                } ${dragIdx === i ? 'bg-blue-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
              >
                <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-grab" />
                <input
                  type="checkbox"
                  checked={c.visible !== false || locked}
                  disabled={locked}
                  title={locked ? 'Standart ekranda zorunlu — gizlenemez' : 'Görünür'}
                  onChange={(e) => patch(i, { visible: e.target.checked })}
                />
                <div className="min-w-0">
                  <input
                    value={c.label ?? ''}
                    placeholder={f.label}
                    onChange={(e) => patch(i, { label: e.target.value })}
                    className={`${inputCls} w-full`}
                    title={`${f.fieldName} · ${f.label}`}
                  />
                  {section !== 'lines' && (
                    <input
                      value={c.defaultValue ?? ''}
                      placeholder="Varsayılan değer (yeni kayıt)"
                      onChange={(e) => patch(i, { defaultValue: e.target.value })}
                      className={`${inputCls} w-full mt-0.5 h-5 text-[10px] text-slate-500`}
                    />
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={locked || Boolean(c.required)}
                  disabled={locked}
                  title={locked ? 'Standart ekranda zorunlu' : 'Zorunlu yap'}
                  onChange={(e) => patch(i, { required: e.target.checked })}
                  className="justify-self-center"
                />
                <input
                  type="checkbox"
                  checked={Boolean(c.readOnly ?? f.isReadOnly)}
                  title="Salt okunur"
                  onChange={(e) => patch(i, { readOnly: e.target.checked })}
                  className="justify-self-center"
                />
                <div className="flex justify-end">
                  <button type="button" onClick={() => move(i, i - 1)} className="p-0.5 text-slate-400 hover:text-slate-700" title="Yukarı">
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} className="p-0.5 text-slate-400 hover:text-slate-700" title="Aşağı">
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {section === 'custom' && (
          <p className="px-3 py-2 text-[10px] text-slate-500">
            Yeni alan / kolon eklemek için: Ek Alanlar / Özel Kodlar modülünden alanı tanımlayın; burada görünür ve
            kullanıcıya göre açılıp kapatılabilir.
          </p>
        )}

        <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 mt-2">
          <h4 className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-1">Atama</h4>
          <p className="text-[10px] text-slate-500 mb-1.5">
            Seçilen kullanıcı / rollerde bu tasarım öncelikli açılır (kullanıcı &gt; rol &gt; varsayılan).
          </p>
          <div className="grid grid-cols-2 gap-x-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-500 mb-0.5">Kullanıcılar</p>
              {users.map((u) => (
                <label key={u.userId} className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={hasAssign(1, u.userId)} onChange={() => toggleAssign(1, u.userId)} />
                  <span className="truncate">{u.userName}</span>
                </label>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 mb-0.5">Roller</p>
              {roles.length === 0 && <p className="text-[10px] text-slate-400">Rol yok</p>}
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={hasAssign(2, String(r.id))} onChange={() => toggleAssign(2, String(r.id))} />
                  <span className="truncate">{r.name || r.code}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={`mx-3 mb-1 px-2 py-1 rounded-sm text-[11px] ${
            msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(false)}
          className="inline-flex items-center gap-1 px-3 h-7 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {layout ? 'Kaydet' : 'Tasarımı kaydet'}
        </button>
        {layout && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(true)}
            className="px-2.5 h-7 text-[11px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Yeni tasarım olarak kaydet
          </button>
        )}
        <button
          type="button"
          onClick={() => onDefChange(defaultLayoutFromSchema(baseSchema))}
          title="Alanları standart sıraya ve görünürlüğe döndür"
          className="inline-flex items-center gap-1 px-2 h-7 text-[11px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="w-3 h-3" />
          Standarda döndür
        </button>
        {layout && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="ml-auto inline-flex items-center gap-1 px-2 h-7 text-[11px] rounded-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            Sil
          </button>
        )}
      </div>
    </aside>
  );
};
