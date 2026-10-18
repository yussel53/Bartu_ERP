import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Braces, CheckCircle2, CircleSlash, Copy, FlaskConical, Loader2, Plus, Save, Sparkles, Trash2, XCircle } from 'lucide-react';
import {
  deleteRule,
  getRuleCatalog,
  listRules,
  previewRules,
  RuleCatalog,
  RuleConditions,
  RuleParamDef,
  RulePreset,
  RuleRunResult,
  RuleTemplateInfo,
  saveRule,
  TransformRule,
} from '../api/egovRulesApi';
import { useAuth } from '../components/AuthGate';
import { appConfirm } from '../utils/appConfirm';

const DOC_KINDS: { v: string; l: string }[] = [
  { v: '1', l: 'e-Fatura' },
  { v: '2', l: 'e-Arşiv' },
  { v: '3', l: 'e-İrsaliye' },
];
const SAMPLES = [
  { v: 'invoice', l: 'Örnek e-Fatura' },
  { v: 'earsiv', l: 'Örnek e-Arşiv' },
  { v: 'despatch', l: 'Örnek e-İrsaliye' },
];

const input = 'w-full h-7 px-2 text-xs border border-slate-300 rounded-sm bg-white focus:outline-none focus:border-blue-500';
const lbl = 'text-[11px] text-slate-500';

const emptyRule = (t: RuleTemplateInfo): TransformRule => ({
  eGovTransformRuleID: 0,
  name: t.title,
  templateCode: t.code,
  docKinds: t.docKinds.join(','),
  direction: 2,
  paramsJson: JSON.stringify(Object.fromEntries(t.params.map((p) => [p.key, p.default ?? '']))),
  conditionsJson: '{}',
  priority: 100,
  stopAfter: false,
  isActive: true,
  description: '',
});

const fromPreset = (p: RulePreset): TransformRule => ({
  eGovTransformRuleID: 0,
  name: p.name,
  templateCode: p.templateCode,
  docKinds: p.docKinds,
  direction: 2,
  paramsJson: JSON.stringify(p.params),
  conditionsJson: JSON.stringify(p.conditions ?? {}),
  priority: 100,
  stopAfter: false,
  isActive: true,
  description: p.description,
});

const parse = <T,>(json?: string | null, def = {} as T): T => {
  try {
    return json ? (JSON.parse(json) as T) : def;
  } catch {
    return def;
  }
};

/**
 * E-Devlet → Belge Kuralları: giden e-Fatura / e-Arşiv / e-İrsaliye gönderilmeden önce UBL üzerinde yapılacak
 * değişiklikler (Logo «Kural Tanımları» karşılığı) — şablon + parametre + koşul, kod yazmadan. Önizleme kalıcı değildir.
 */
export const EGovRulesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const isAdmin = !!useAuth()?.user.isAdmin;
  const [catalog, setCatalog] = useState<RuleCatalog | null>(null);
  const [rules, setRules] = useState<TransformRule[]>([]);
  const [edit, setEdit] = useState<TransformRule | null>(null);
  const [picker, setPicker] = useState<'template' | 'preset' | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [sample, setSample] = useState('invoice');
  const [egovId, setEgovId] = useState('');
  const [ignoreConditions, setIgnoreConditions] = useState(true);
  const [result, setResult] = useState<RuleRunResult | null>(null);
  const [showXml, setShowXml] = useState<'none' | 'after' | 'before'>('none');
  const lastTemplateField = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([getRuleCatalog(), listRules()]);
      setCatalog(c);
      setRules(r);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tpl = useMemo(() => catalog?.templates.find((t) => t.code === edit?.templateCode) ?? null, [catalog, edit?.templateCode]);
  const params = parse<Record<string, string>>(edit?.paramsJson);
  const cond = parse<RuleConditions>(edit?.conditionsJson);
  const setParam = (k: string, v: string) => edit && setEdit({ ...edit, paramsJson: JSON.stringify({ ...params, [k]: v }) });
  const setCond = (k: keyof RuleConditions, v: string) => edit && setEdit({ ...edit, conditionsJson: JSON.stringify({ ...cond, [k]: v || null }) });
  const kinds = (edit?.docKinds || '').split(',').filter(Boolean);
  const toggleKind = (k: string) =>
    edit && setEdit({ ...edit, docKinds: (kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k]).sort().join(',') });

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await saveRule(edit);
      setMsg({ text: 'Kural kaydedildi.' });
      await load();
      setEdit({ ...edit, eGovTransformRuleID: r.id });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: TransformRule) => {
    if (!(await appConfirm(`«${r.name}» kuralı silinsin mi?`, { title: 'Kural sil', okLabel: 'Sil', danger: true }))) return;
    await deleteRule(r.eGovTransformRuleID);
    if (edit?.eGovTransformRuleID === r.eGovTransformRuleID) setEdit(null);
    await load();
  };

  const test = async (all: boolean) => {
    setBusy(true);
    setResult(null);
    setMsg(null);
    try {
      const id = Number(egovId) || null;
      const r = await previewRules({
        rule: all ? null : edit,
        eGovDocumentId: id,
        sample: id ? null : sample,
        direction: 2,
        ignoreConditions: !all && ignoreConditions,
      });
      setResult(r);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  /** Yer tutucuyu son odaklanan şablon alanına ekle */
  const insertPlaceholder = (key: string) => {
    const k = lastTemplateField.current ?? tpl?.params.find((p) => p.type === 'template')?.key;
    if (!k) return;
    setParam(k, `${params[k] ?? ''}{${key}}`);
  };

  const paramField = (p: RuleParamDef) => {
    const v = params[p.key] ?? '';
    if (p.type === 'bool')
      return (
        <label key={p.key} className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={v === 'true'} onChange={(e) => setParam(p.key, e.target.checked ? 'true' : 'false')} />
          {p.label}
        </label>
      );
    return (
      <label key={p.key} className="block space-y-0.5">
        <span className={lbl}>
          {p.label}
          {p.required && <span className="text-red-600"> *</span>}
        </span>
        {p.type === 'select' ? (
          <select value={v} onChange={(e) => setParam(p.key, e.target.value)} className={input}>
            {(p.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : p.type === 'sql' || p.type === 'textarea' ? (
          <textarea
            value={v}
            onChange={(e) => setParam(p.key, e.target.value)}
            rows={p.type === 'sql' ? 6 : 3}
            spellCheck={false}
            className={`${input} h-auto py-1 ${p.type === 'sql' ? 'font-mono text-[11px]' : ''}`}
          />
        ) : (
          <input
            value={v}
            type={p.type === 'number' ? 'number' : 'text'}
            onChange={(e) => setParam(p.key, e.target.value)}
            onFocus={() => p.type === 'template' && (lastTemplateField.current = p.key)}
            className={`${input} ${p.type === 'template' ? 'font-mono' : ''}`}
          />
        )}
        {p.help && <span className="text-[10px] text-slate-400">{p.help}</span>}
      </label>
    );
  };

  const templateTitle = (code: string) => catalog?.templates.find((t) => t.code === code)?.title ?? code;
  const canEditThis = isAdmin;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <Braces className="w-4 h-4 text-slate-500" /> Belge Kuralları
          </h1>
          <p className="text-[12px] text-slate-500">
            Giden e-Fatura / e-Arşiv / e-İrsaliye gönderilmeden önce belgeye uygulanan değişiklikler — kod yazmadan, şablon + parametre + koşul.
          </p>
        </div>
        {canEditThis && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPicker('preset')}
              className="h-8 px-3 text-xs rounded-md border border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 inline-flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Hazır kurallardan ekle
            </button>
            <button
              type="button"
              onClick={() => setPicker('template')}
              className="h-8 px-3 text-xs rounded-md bg-blue-700 text-white hover:bg-blue-600 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Yeni kural
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className={`px-3 py-1.5 rounded-md text-xs border ${msg.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-3">
        {/* Kural listesi */}
        <div className="bg-white border border-slate-200 rounded-md">
          <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-700 flex justify-between">
            <span>Kurallar ({rules.length})</span>
            <span className="text-slate-400 font-normal">sıra = öncelik</span>
          </div>
          <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-auto">
            {rules.length === 0 && <li className="px-3 py-3 text-xs text-slate-400">Henüz kural yok. «Hazır kurallardan ekle» ile başlayın.</li>}
            {rules.map((r) => (
              <li
                key={r.eGovTransformRuleID}
                onClick={() => {
                  setEdit({ ...r });
                  setResult(null);
                }}
                className={`px-3 py-1.5 cursor-pointer text-xs flex items-center gap-2 hover:bg-blue-50/50 ${
                  edit?.eGovTransformRuleID === r.eGovTransformRuleID ? 'bg-blue-50' : ''
                }`}
              >
                {r.isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <CircleSlash className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-800">{r.name}</div>
                  <div className="truncate text-[10px] text-slate-500">
                    {templateTitle(r.templateCode)} · {(r.docKinds || '1,2,3').split(',').map((k) => DOC_KINDS.find((d) => d.v === k)?.l).filter(Boolean).join(', ')} · {r.priority}
                  </div>
                </div>
                {canEditThis && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void remove(r);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Düzenleyici + önizleme */}
        <div className="space-y-3">
          {edit && tpl ? (
            <div className="bg-white border border-slate-200 rounded-md p-3 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500">
                    {tpl.category} · {tpl.title}
                    {tpl.adminOnly && <span className="ml-1 px-1 rounded bg-amber-100 text-amber-800">yönetici</span>}
                  </div>
                  <div className="text-xs text-slate-600 max-w-3xl">{tpl.description}</div>
                  {tpl.logoEquivalent && <div className="text-[10px] text-slate-400">Logo karşılığı: {tpl.logoEquivalent}</div>}
                </div>
                {canEditThis && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEdit({ ...edit, eGovTransformRuleID: 0, name: `${edit.name} (kopya)` })}
                      className="h-7 px-2 text-xs rounded-sm border border-slate-300 hover:bg-slate-50 inline-flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> Kopyala
                    </button>
                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={busy}
                      className="h-7 px-3 text-xs rounded-sm bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" /> Kaydet
                    </button>
                  </div>
                )}
              </div>

              {/* Başlık: 3 sütun */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                <div className="space-y-2">
                  <label className="block space-y-0.5">
                    <span className={lbl}>Kural adı *</span>
                    <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={input} />
                  </label>
                  <label className="block space-y-0.5">
                    <span className={lbl}>Açıklama</span>
                    <input value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className={input} />
                  </label>
                </div>
                <div className="space-y-2">
                  <div className="space-y-0.5">
                    <span className={lbl}>Belge türleri</span>
                    <div className="flex gap-3 text-xs h-7 items-center">
                      {DOC_KINDS.filter((d) => tpl.docKinds.includes(Number(d.v))).map((d) => (
                        <label key={d.v} className="flex items-center gap-1">
                          <input type="checkbox" checked={kinds.includes(d.v)} onChange={() => toggleKind(d.v)} /> {d.l}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="block space-y-0.5">
                    <span className={lbl}>Yön</span>
                    <select value={edit.direction} onChange={(e) => setEdit({ ...edit, direction: Number(e.target.value) })} className={input}>
                      <option value={2}>Giden (gönderim öncesi)</option>
                      <option value={1}>Gelen</option>
                    </select>
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="block space-y-0.5">
                    <span className={lbl}>Öncelik (küçük önce)</span>
                    <input type="number" value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: Number(e.target.value) || 0 })} className={input} />
                  </label>
                  <div className="flex gap-4 text-xs h-7 items-center">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Etkin
                    </label>
                    <label className="flex items-center gap-1" title="Bu kural belgeyi değiştirdiyse sonraki kurallar çalışmaz">
                      <input type="checkbox" checked={edit.stopAfter} onChange={(e) => setEdit({ ...edit, stopAfter: e.target.checked })} /> Sonrakileri durdur
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <fieldset className="border border-slate-200 rounded-sm p-2 space-y-2">
                  <legend className="px-1 text-[11px] font-semibold text-slate-600">Parametreler</legend>
                  {tpl.params.map(paramField)}
                </fieldset>
                <fieldset className="border border-slate-200 rounded-sm p-2 space-y-2">
                  <legend className="px-1 text-[11px] font-semibold text-slate-600">Koşullar (boş = her belgede)</legend>
                  {(
                    [
                      ['customerCodes', 'Cari kodu', '120.*, 320.01'],
                      ['taxNumbers', 'VKN / TCKN', '1234567890, …'],
                      ['profiles', 'Senaryo', 'TICARIFATURA, IHRACAT'],
                      ['typeCodes', 'Fatura tipi', 'SATIS, IADE'],
                      ['currencies', 'Para birimi', 'USD, EUR · !TRY = TL dışı'],
                    ] as [keyof RuleConditions, string, string][]
                  ).map(([k, l, ph]) => (
                    <label key={k} className="block space-y-0.5">
                      <span className={lbl}>{l}</span>
                      <input value={(cond[k] as string) ?? ''} placeholder={ph} onChange={(e) => setCond(k, e.target.value)} className={input} />
                    </label>
                  ))}
                </fieldset>
              </div>

              {tpl.params.some((p) => p.type === 'template') && catalog && (
                <div className="space-y-1">
                  <div className={lbl}>Yer tutucular — tıklayınca son seçtiğiniz değer alanına eklenir</div>
                  <div className="flex flex-wrap gap-1">
                    {catalog.placeholders.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => insertPlaceholder(p.key)}
                        title={p.label}
                        className={`px-1.5 h-5 rounded-sm border text-[10px] font-mono ${
                          p.line ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-slate-200 bg-slate-50 text-slate-700'
                        } hover:border-blue-400`}
                      >
                        {`{${p.key}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-300 rounded-md p-6 text-center text-xs text-slate-500">
              Soldan bir kural seçin ya da yeni kural ekleyin. Kural seçmeden aşağıdan tüm etkin kuralları deneyebilirsiniz.
            </div>
          )}

          {/* Önizleme */}
          <div className="bg-white border border-slate-200 rounded-md p-3 space-y-2">
            <div className="flex flex-wrap items-end gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <FlaskConical className="w-4 h-4 text-slate-500" /> Dene (kalıcı değişiklik yok)
              </div>
              <label className="space-y-0.5">
                <span className={lbl}>Belge</span>
                <select value={sample} onChange={(e) => setSample(e.target.value)} disabled={!!egovId} className={`${input} w-40`}>
                  {SAMPLES.map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-0.5">
                <span className={lbl}>ya da e-Belge no (ID)</span>
                <input value={egovId} onChange={(e) => setEgovId(e.target.value.replace(/\D/g, ''))} placeholder="ör. 1" className={`${input} w-28`} />
              </label>
              {edit && (
                <label className="flex items-center gap-1 h-7">
                  <input type="checkbox" checked={ignoreConditions} onChange={(e) => setIgnoreConditions(e.target.checked)} /> Koşulları yok say
                </label>
              )}
              <div className="flex-1" />
              {edit && (
                <button
                  type="button"
                  onClick={() => void test(false)}
                  disabled={busy}
                  className="h-7 px-3 rounded-sm bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Bu kuralı dene
                </button>
              )}
              <button
                type="button"
                onClick={() => void test(true)}
                disabled={busy}
                className="h-7 px-3 rounded-sm border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Tüm etkin kuralları dene
              </button>
            </div>

            {result && (
              <div className="space-y-2">
                <ul className="divide-y divide-slate-100 border border-slate-100 rounded-sm">
                  {result.steps.length === 0 && <li className="px-2 py-1.5 text-xs text-slate-400">Çalışan kural yok.</li>}
                  {result.steps.map((s, i) => (
                    <li key={i} className="px-2 py-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        {s.status === 'applied' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : s.status === 'error' ? (
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                        ) : (
                          <CircleSlash className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <b>{s.ruleName}</b>
                        {s.message && <span className={s.status === 'error' ? 'text-red-700' : 'text-slate-500'}>— {s.message}</span>}
                      </div>
                      {s.changes.length > 0 && (
                        <ul className="pl-6 list-disc text-[11px] text-slate-700">
                          {s.changes.map((c, j) => (
                            <li key={j}>{c}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 text-xs">
                  <button type="button" onClick={() => setShowXml(showXml === 'after' ? 'none' : 'after')} className="underline text-blue-700">
                    {showXml === 'after' ? 'XML gizle' : 'Değişen XML'}
                  </button>
                  <button type="button" onClick={() => setShowXml(showXml === 'before' ? 'none' : 'before')} className="underline text-slate-600">
                    Önceki XML
                  </button>
                </div>
                {showXml !== 'none' && (
                  <pre className="max-h-96 overflow-auto bg-slate-50 border border-slate-200 rounded-sm p-2 text-[10px] whitespace-pre-wrap break-all">
                    {(showXml === 'after' ? result.xml : result.originalXml)?.replace(/></g, '>\n<')}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Şablon / hazır kural seçici */}
      {picker && catalog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto" onMouseDown={() => setPicker(null)}>
          <div className="mt-10 w-full max-w-3xl bg-white rounded-md shadow-xl border border-slate-200" onMouseDown={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
              {picker === 'preset' ? 'Hazır kurallar (Logo kural örneklerinin karşılığı)' : 'Şablon seçin'}
            </div>
            <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-auto">
              {picker === 'preset'
                ? catalog.presets.map((p) => (
                    <li
                      key={p.key}
                      onClick={() => {
                        setEdit(fromPreset(p));
                        setPicker(null);
                        setResult(null);
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-xs"
                    >
                      <div className="font-medium text-slate-800">{p.name}</div>
                      <div className="text-slate-600">{p.description}</div>
                      {p.logoSource && <div className="text-[10px] text-slate-400">Logo: {p.logoSource}</div>}
                    </li>
                  ))
                : catalog.templates
                    .filter((t) => !t.adminOnly || isAdmin)
                    .map((t) => (
                      <li
                        key={t.code}
                        onClick={() => {
                          setEdit(emptyRule(t));
                          setPicker(null);
                          setResult(null);
                        }}
                        className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-xs"
                      >
                        <div className="font-medium text-slate-800">
                          {t.title} <span className="text-[10px] text-slate-400">· {t.category}</span>
                        </div>
                        <div className="text-slate-600">{t.description}</div>
                      </li>
                    ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
