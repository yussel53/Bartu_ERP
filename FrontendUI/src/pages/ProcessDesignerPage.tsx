import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { listExtraFieldTargets, type ExtraFieldTarget } from '../api/extraFieldsApi';
import {
  ProcessDef,
  ProcessStep,
  deleteProcessDef,
  describeProcessSelect,
  listProcessDefs,
  runProcessScans,
  saveProcessDef,
} from '../api/processApi';
import { evaluateFormula, formulaFieldRefs, FORMULA_FUNCTIONS } from '../data/formulaEval';
import { BankFetchEditor, DataFetchEditor, ModuleTransferEditor } from './ProcessJobEditors';
import { appConfirm } from '../utils/appConfirm';
import { listRoles, type Role } from '../api/rolesApi';
import {
  DIRECTION_OPTIONS,
  DOC_KIND_OPTIONS,
  NODE_TONE_CLASS,
  TRIGGER_OPTIONS,
  WORKFLOW_NODES,
  nodeMeta,
  triggerLabel,
  type WorkflowNodeDef,
} from '../data/processWorkflowCatalog';

interface ProcessDesignerPageProps {
  onBack: () => void;
}

type DraftStep = ProcessStep & { _key: string };

function emptyDef(): ProcessDef {
  return {
    processDefID: 0,
    code: '',
    name: '',
    description: '',
    triggerType: 3,
    sourceTable: 'EGovDocument',
    targetTable: 'OrderVoucher',
    isActive: true,
    sortOrder: 10,
    category: 'Approval',
    triggerConfigJson: JSON.stringify({ docKind: 1, direction: 1 }),
    steps: [],
  };
}

function parseCfg(json?: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    const v = JSON.parse(json) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stepSql(configJson?: string | null): string {
  const sql = parseCfg(configJson).sql;
  return typeof sql === 'string' ? sql : '';
}

function stepExpr(configJson?: string | null): string {
  const ifade = parseCfg(configJson).ifade;
  return typeof ifade === 'string' ? ifade : '';
}

const SQL_NODES = new Set(['DbScan', 'DbScanLoop']);

type ScanCol = { name: string; kind: 'alan' | 'tablo' };

function readScanCols(json?: string | null): ScanCol[] {
  const raw = parseCfg(json).columns;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const rec = item as { name?: unknown; kind?: unknown };
    const name = String(rec.name ?? '').trim();
    if (!name) return [];
    return [{ name, kind: rec.kind === 'tablo' ? 'tablo' as const : 'alan' as const }];
  });
}

function patchCfg(json: string | null | undefined, patch: Record<string, unknown>): string | null {
  const next: Record<string, unknown> = { ...parseCfg(json), ...patch };
  for (const key of Object.keys(next)) {
    if (next[key] == null || next[key] === '') delete next[key];
  }
  return Object.keys(next).length ? JSON.stringify(next) : null;
}

function fieldTokens(triggerJson: string | null | undefined, list: { configJson?: string | null }[], idx: number) {
  const bags = [triggerJson, ...list.slice(0, idx).map((s) => s.configJson)];
  const tokens: { token: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const json of bags) {
    const cols = readScanCols(json);
    const tableName = String(parseCfg(json).tabloAdi || 'Satirlar');
    if (cols.some((c) => c.kind === 'tablo') && seen.add(`{${tableName}}`)) {
      tokens.push({ token: `{${tableName}}`, label: `${tableName} (tablo)` });
    }
    for (const col of cols) {
      const token = col.kind === 'tablo' ? `{${tableName}.${col.name}}` : `{${col.name}}`;
      if (seen.add(token)) tokens.push({ token, label: col.kind === 'tablo' ? `${tableName}.${col.name}` : col.name });
    }
  }
  return tokens;
}

const FORMULA_NAMES = new Set(FORMULA_FUNCTIONS.map((f) => f.toUpperCase()));

/** İfade düz metin, {Alan} ya da ek alan formülü olabilir. Uymayanı kayda bırakmaz. */
function checkProcessExpr(expr: string, tokens: { token: string; label: string }[]): string | null {
  const text = expr.trim();
  if (!text) return null;
  const opened = (text.match(/\{/g) || []).length;
  const closed = (text.match(/\}/g) || []).length;
  if (opened !== closed) return 'Kapanmayan { }';

  const allowed = new Set<string>();
  for (const t of tokens) {
    const inner = t.token.replace(/^\{|\}$/g, '').trim();
    if (inner) allowed.add(inner.toLocaleLowerCase('tr-TR'));
  }
  const braces = [...text.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1].trim()).filter(Boolean);
  const unknown = braces.filter((name) => !allowed.has(name.toLocaleLowerCase('tr-TR')));
  if (unknown.length) return `Bilinmeyen alan: ${unknown.join(', ')}`;

  const stripped = text.replace(/\{[^{}]+\}/g, '1');
  const formulaLike =
    /[[\]()]|[+\-*/%=<>]/.test(stripped) ||
    /\b(IF|AND|OR|NOT|ROUND|ABS|MIN|MAX|LEN|UPPER|LOWER|TRIM|CONCAT|LEFT|RIGHT|TODAY|YEAR|MONTH|DAY)\s*\(/i.test(stripped);
  if (!formulaLike) return null;

  const formula = text.replace(/\{([^{}]+)\}/g, '[$1]');
  const sample: Record<string, unknown> = {};
  for (const name of allowed) sample[name] = 1;
  const { error } = evaluateFormula(formula, sample);
  if (error) return error;
  const bad = formulaFieldRefs(formula).filter(
    (name) => !FORMULA_NAMES.has(name.toUpperCase()) && !allowed.has(name.toLocaleLowerCase('tr-TR')),
  );
  if (bad.length) return `Bilinmeyen alan: ${bad.join(', ')}`;
  return null;
}

const SqlFieldEditor: React.FC<{
  json?: string | null;
  onChange: (json: string | null) => void;
  onError: (text: string) => void;
}> = ({ json, onChange, onError }) => {
  const [loading, setLoading] = useState(false);
  const cols = readScanCols(json);
  const tableName = String(parseCfg(json).tabloAdi || 'Satirlar');
  const loadCols = async () => {
    const sql = stepSql(json);
    if (!sql.trim()) {
      onError('Önce SELECT yazın.');
      return;
    }
    setLoading(true);
    try {
      const names = await describeProcessSelect(sql);
      const prev = new Map(cols.map((c) => [c.name.toLowerCase(), c.kind]));
      onChange(patchCfg(json, {
        sql,
        columns: names.map((name) => ({ name, kind: prev.get(name.toLowerCase()) ?? 'alan' })),
      }));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kolonlar okunamadı');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="sm:col-span-2 space-y-2">
      <label className="block text-[11px]">
        SELECT
        <textarea
          value={stepSql(json)}
          onChange={(e) => onChange(patchCfg(json, { sql: e.target.value }))}
          rows={4}
          spellCheck={false}
          placeholder="SELECT ... FROM ... WHERE ..."
          className="mt-0.5 w-full rounded border border-black/10 bg-white px-2 py-1 text-[12px] font-mono"
        />
      </label>
      <button
        type="button"
        disabled={loading}
        onClick={() => void loadCols()}
        className="rounded border border-sky-300 bg-white px-2 py-1 text-[11px] text-sky-800 hover:bg-sky-50 disabled:opacity-50"
      >
        {loading ? 'Kolonlar okunuyor…' : 'Kolon başlıklarını al'}
      </button>
      {cols.length > 0 && (
        <div className="rounded border border-black/10 bg-white/70 p-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wide opacity-70">Kolonlar · sonraki adımlarda kullanılır</div>
          {cols.map((col) => (
            <label key={col.name} className="flex items-center gap-2 text-[12px]">
              <span className="font-mono flex-1 min-w-0 truncate">{col.name}</span>
              <select
                value={col.kind}
                onChange={(e) => {
                  const kind = e.target.value === 'tablo' ? 'tablo' : 'alan';
                  onChange(patchCfg(json, {
                    columns: cols.map((c) => (c.name === col.name ? { ...c, kind } : c)),
                  }));
                }}
                className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px]"
              >
                <option value="alan">Alan</option>
                <option value="tablo">Tablo</option>
              </select>
            </label>
          ))}
          {cols.some((c) => c.kind === 'tablo') && (
            <label className="block text-[11px] pt-1">
              Tablo adı
              <input
                value={tableName}
                onChange={(e) => onChange(patchCfg(json, { tabloAdi: e.target.value.trim() || 'Satirlar' }))}
                className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-[12px] font-mono"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
};

function stepKey(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Sıra değişince çıkışlar adım numarasına göre yeniden bağlanır. 0 = süreci bitir. */
function renumberSteps(list: DraftStep[]): DraftStep[] {
  const oldToNew = new Map<number, number>();
  list.forEach((s, i) => oldToNew.set(s.stepNo, i + 1));
  const link = (n?: number | null) => {
    if (n == null || n === 0) return n ?? null;
    return oldToNew.get(n) ?? null;
  };
  return list.map((s, i) => ({
    ...s,
    stepNo: i + 1,
    nextStepOnOk: link(s.nextStepOnOk),
    nextStepOnFail: link(s.nextStepOnFail),
  }));
}

export const ProcessDesignerPage: React.FC<ProcessDesignerPageProps> = ({ onBack }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [defs, setDefs] = useState<ProcessDef[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedId, setSelectedId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<ProcessDef | null>(null);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  const [transferTargets, setTransferTargets] = useState<ExtraFieldTarget[]>([]);

  const reload = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const [df, rl, targets] = await Promise.all([
        listProcessDefs(true),
        listRoles().catch(() => [] as Role[]),
        listExtraFieldTargets().catch(() => [] as ExtraFieldTarget[]),
      ]);
      setDefs(df);
      setRoles(rl);
      setTransferTargets(targets);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Tanımlar okunamadı' });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadDef = (d: ProcessDef) => {
    setSelectedId(d.processDefID);
    setDraft({ ...d, steps: [] });
    setOpenKeys(new Set());
    setSteps(
      (d.steps || []).map((s) => ({
        ...s,
        nodeType: s.nodeType || 'TaskForm',
        _key: stepKey(),
      })),
    );
    setMsg(null);
  };

  const onNew = () => {
    const d = emptyDef();
    setSelectedId('new');
    setDraft(d);
    setSteps([]);
    setOpenKeys(new Set());
    setMsg(null);
  };

  const cfg = useMemo(() => parseCfg(draft?.triggerConfigJson), [draft?.triggerConfigJson]);
  const triggerOpt = TRIGGER_OPTIONS.find((t) => t.value === draft?.triggerType);

  const setCfg = (patch: Record<string, unknown>) => {
    if (!draft) return;
    const next = { ...cfg, ...patch };
    Object.keys(next).forEach((k) => {
      if (next[k] === null || next[k] === undefined || next[k] === '') delete next[k];
    });
    setDraft({ ...draft, triggerConfigJson: JSON.stringify(next) });
  };

  const addNode = (n: WorkflowNodeDef) => {
    const no = steps.length + 1;
    const key = stepKey();
    setOpenKeys((prev) => new Set(prev).add(key));
    setSteps((prev) => [
      ...prev,
      {
        _key: key,
        processStepID: 0,
        processDefID: draft?.processDefID || 0,
        stepNo: no,
        code: `${n.nodeType.toUpperCase()}${no}`,
        title: n.label,
        actionType: n.actionType,
        nodeType: n.nodeType,
        approverRoleId: n.needsApprover ? roles[0]?.id ?? null : null,
        approverUserId: null,
        isActive: true,
        configJson: n.nodeType === 'BankFetch'
          ? JSON.stringify({
              bankAccountCardId: 0,
              gun: 7,
              tabloAdi: 'Satirlar',
              columns: [
                { name: 'HesapKodu', kind: 'alan' },
                { name: 'HesapAdi', kind: 'alan' },
                { name: 'Banka', kind: 'alan' },
                { name: 'Iban', kind: 'alan' },
                { name: 'Tarih', kind: 'tablo' },
                { name: 'Aciklama', kind: 'tablo' },
                { name: 'Tutar', kind: 'tablo' },
                { name: 'Referans', kind: 'tablo' },
              ],
            })
          : null,
        nextStepOnOk: null,
        nextStepOnFail: null,
      },
    ]);
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      const t = copy[idx];
      copy[idx] = copy[j];
      copy[j] = t;
      return renumberSteps(copy);
    });
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => renumberSteps(prev.filter((_, i) => i !== idx)));
  };

  const onSave = async () => {
    if (!draft) return;
    const code = draft.code.trim().toUpperCase();
    if (!code || !draft.name.trim()) {
      setMsg({ kind: 'err', text: 'Kod ve ad zorunlu.' });
      return;
    }
    for (let i = 0; i < steps.length; i++) {
      const err = checkProcessExpr(stepExpr(steps[i].configJson), fieldTokens(draft.triggerConfigJson, steps, i));
      if (err) {
        setOpenKeys((prev) => new Set(prev).add(steps[i]._key));
        setMsg({ kind: 'err', text: `${steps[i].title || steps[i].code}: ${err}` });
        return;
      }
    }
    setBusy(true);
    setMsg(null);
    try {
      const payload: ProcessDef = {
        ...draft,
        code,
        steps: steps.map((s, i) => ({
          processStepID: 0,
          processDefID: draft.processDefID,
          stepNo: i + 1,
          code: (s.code || `STEP${i + 1}`).trim().toUpperCase(),
          title: s.title.trim() || `Adım ${i + 1}`,
          approverRoleId: s.approverRoleId ?? null,
          approverUserId: s.approverUserId ?? null,
          actionType: s.actionType || 'Approve',
          nodeType: s.nodeType || 'TaskForm',
          configJson: s.configJson ?? null,
          nextStepOnOk: s.nextStepOnOk ?? null,
          nextStepOnFail: s.nextStepOnFail ?? null,
          isActive: s.isActive !== false,
        })),
      };
      const saved = await saveProcessDef(payload);
      setMsg({ kind: 'ok', text: 'Onay tanımı kaydedildi.' });
      await reload();
      loadDef(saved);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Kayıt başarısız' });
    } finally {
      setBusy(false);
    }
  };

  const onScan = async () => {
    if (!draft || draft.processDefID <= 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await runProcessScans(draft.processDefID);
      const extra = r.messages?.length ? ` ${r.messages.join(' ')}` : '';
      setMsg({
        kind: r.started === 0 && r.messages?.length ? 'err' : 'ok',
        text: `${r.started} süreç başladı, ${r.skipped} açık kayıt atlandı.${extra}`,
      });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Tarama başarısız' });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (def: ProcessDef) => {
    if (def.processDefID <= 0) return;
    const ok = await appConfirm(
      `«${def.name}» silinsin mi? Adımları, süren örnekleri ve onay görevleri de silinir.`,
      { title: 'Süreç sil', okLabel: 'Sil', danger: true },
    );
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      await deleteProcessDef(def.processDefID);
      if (selectedId === def.processDefID) {
        setSelectedId(null);
        setDraft(null);
        setSteps([]);
      }
      setMsg({ kind: 'ok', text: 'Süreç silindi.' });
      await reload();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Silinemedi' });
    } finally {
      setBusy(false);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, WorkflowNodeDef[]>();
    for (const n of WORKFLOW_NODES) {
      const arr = map.get(n.group) || [];
      arr.push(n);
      map.set(n.group, arr);
    }
    return map;
  }, []);

  const groupTitle: Record<string, string> = {
    tetik: 'Başlangıç / izleme',
    akis: 'Akış',
    gorev: 'Görev / onay',
    veri: 'Veri',
    entegrasyon: 'Entegrasyon',
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f4f6f8]">
      <header className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Geri
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-slate-800">Süreçler</h2>
          <p className="text-[11px] text-slate-500">
            Ana kayıt · tetik seçimi · parça paleti (e-evrak / fiş / kart)
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void reload()}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Yenile
        </button>
        {draft && draft.processDefID > 0 && (draft.triggerType === 8 || steps.some((s) => s.nodeType === 'DbScan' || s.nodeType === 'DbScanLoop' || s.nodeType === 'DataFetch' || s.nodeType === 'BankFetch')) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onScan()}
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-[12px] font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
          >
            Taramayı çalıştır
          </button>
        )}
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-900"
        >
          <Plus className="w-3.5 h-3.5" /> Yeni tanım
        </button>
      </header>

      {msg && (
        <div
          className={`mx-4 mt-3 rounded-md border px-3 py-2 text-[12px] ${
            msg.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_220px] gap-0">
        {/* Liste */}
        <aside className="border-r border-slate-200 bg-white overflow-y-auto">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Tanımlar ({defs.length})
          </div>
          {defs.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-slate-500">
              Henüz tanım yok. <code className="text-[11px]">69_process_workflow_nodes.sql</code> uygulayın veya
              yeni oluşturun.
            </p>
          ) : (
            <ul className="pb-4">
              {defs.map((d) => (
                <li key={d.processDefID} className="flex items-stretch border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => loadDef(d)}
                    className={`flex-1 min-w-0 text-left px-3 py-2 hover:bg-slate-50 ${
                      selectedId === d.processDefID ? 'bg-sky-50 border-l-2 border-l-sky-500' : ''
                    }`}
                  >
                    <div className="text-[13px] font-medium text-slate-800 truncate">{d.name}</div>
                    <div className="text-[11px] text-slate-500 flex gap-2 mt-0.5">
                      <span className="font-mono">{d.code}</span>
                      <span>· {triggerLabel(d.triggerType)}</span>
                      {!d.isActive && <span className="text-rose-600">pasif</span>}
                    </div>
                  </button>
                  <button
                    type="button"
                    title="Süreç sil"
                    disabled={busy}
                    onClick={() => void onDelete(d)}
                    className="px-2 text-slate-400 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Editör */}
        <main className="overflow-y-auto p-4 space-y-4">
          {!draft ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-[13px] text-slate-500">
              Soldan bir onay tanımı seçin veya <strong>Yeni tanım</strong> ile başlayın.
              <p className="mt-2 text-[12px]">
                Örn. başlangıç: e-Fatura gelince → İnceleme → Belge Bağla → Görev Formu (onay)
              </p>
            </div>
          ) : (
            <>
              <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <h3 className="text-[13px] font-semibold text-slate-800">1 · Nasıl başlar?</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-[12px] text-slate-600">
                    Kod
                    <input
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] font-mono"
                      placeholder="ONAY_EFATURA_GELEN"
                    />
                  </label>
                  <label className="block text-[12px] text-slate-600">
                    Ad
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
                      placeholder="Gelen e-Fatura Onayı"
                    />
                  </label>
                  <label className="block text-[12px] text-slate-600 sm:col-span-2">
                    Açıklama
                    <input
                      value={draft.description || ''}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
                    />
                  </label>
                  <label className="block text-[12px] text-slate-600 sm:col-span-2">
                    Tetikleyici
                    <select
                      value={draft.triggerType}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const opt = TRIGGER_OPTIONS.find((t) => t.value === v);
                        setDraft({
                          ...draft,
                          triggerType: v,
                          sourceTable: opt?.defaultSource || draft.sourceTable,
                          triggerConfigJson:
                            v === 3
                              ? JSON.stringify({ docKind: 1, direction: 1 })
                              : v === 2
                                ? JSON.stringify({ typeFilter: null })
                                : '{}',
                        });
                      }}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
                    >
                      {TRIGGER_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {triggerOpt && <span className="mt-1 block text-[11px] text-slate-400">{triggerOpt.hint}</span>}
                  </label>
                  <label className="block text-[12px] text-slate-600">
                    Kaynak tablo
                    <input
                      value={draft.sourceTable || ''}
                      onChange={(e) => setDraft({ ...draft, sourceTable: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] font-mono"
                      placeholder="EGovDocument"
                    />
                  </label>
                  <label className="block text-[12px] text-slate-600">
                    Hedef tablo (bağlama)
                    <input
                      value={draft.targetTable || ''}
                      onChange={(e) => setDraft({ ...draft, targetTable: e.target.value || null })}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] font-mono"
                      placeholder="OrderVoucher"
                    />
                  </label>

                  {triggerOpt?.needsDocKind && (
                    <label className="block text-[12px] text-slate-600">
                      e-Belge türü
                      <select
                        value={Number(cfg.docKind ?? 1)}
                        onChange={(e) => setCfg({ docKind: Number(e.target.value) })}
                        className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
                      >
                        {DOC_KIND_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {triggerOpt?.needsDirection && (
                    <label className="block text-[12px] text-slate-600">
                      Yön
                      <select
                        value={Number(cfg.direction ?? 1)}
                        onChange={(e) => setCfg({ direction: Number(e.target.value) })}
                        className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
                      >
                        {DIRECTION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {triggerOpt?.needsSql && (
                    <div className="sm:col-span-2">
                      <SqlFieldEditor
                        json={draft.triggerConfigJson}
                        onChange={(next) => setDraft({ ...draft, triggerConfigJson: next })}
                        onError={(text) => setMsg({ kind: 'err', text })}
                      />
                      <span className="mt-1 block text-[11px] text-slate-400">
                        Alan kolonları her satırda bir süreç açar. Tablo işaretli kolonlar aynı başlık altında satır listesi olur.
                      </span>
                    </div>
                  )}
                  {triggerOpt?.needsTypeFilter && (
                    <label className="block text-[12px] text-slate-600">
                      Tip filtresi (Type_ / boş = hepsi)
                      <input
                        value={cfg.typeFilter == null ? '' : String(cfg.typeFilter)}
                        onChange={(e) =>
                          setCfg({ typeFilter: e.target.value.trim() === '' ? null : e.target.value.trim() })
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px]"
                        placeholder="örn. 1"
                      />
                    </label>
                  )}

                  <label className="flex items-center gap-2 text-[12px] text-slate-700 sm:col-span-2 pt-1">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                    />
                    Aktif (tetiklenince süreç başlar)
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[13px] font-semibold text-slate-800">2 · Süreç parçaları</h3>
                  <span className="text-[11px] text-slate-400">{steps.length} adım · sağdaki paletten ekleyin</span>
                </div>

                {steps.length === 0 ? (
                  <p className="text-[12px] text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-md">
                    Henüz parça yok. Sağ paletten örn. <em>İnceleme</em>, <em>Belge Bağla</em>,{' '}
                    <em>Görev Formu</em>, <em>Karar</em> ekleyin.
                  </p>
                ) : (
                  <ol className="space-y-1">
                    {steps.map((s, idx) => {
                      const meta = nodeMeta(s.nodeType || 'TaskForm');
                      const tone = meta ? NODE_TONE_CLASS[meta.tone] : NODE_TONE_CLASS.purple;
                      const open = openKeys.has(s._key);
                      const tokens = fieldTokens(draft.triggerConfigJson, steps, idx);
                      const exprErr = checkProcessExpr(stepExpr(s.configJson), tokens);
                      return (
                        <li
                          key={s._key}
                          className={`rounded-md border ${open ? 'px-3 py-2.5' : 'px-2 py-1'} ${tone}`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-mono opacity-70 w-5 shrink-0">{idx + 1}</span>
                            <button
                              type="button"
                              className="flex-1 min-w-0 text-left text-[12px] truncate"
                              onClick={() => setOpenKeys((prev) => new Set(prev).add(s._key))}
                            >
                              <span className="font-medium">{s.title || s.code}</span>
                              <span className="opacity-70"> · {meta?.label || s.nodeType}</span>
                            </button>
                            <button
                              type="button"
                              title="Genişlet"
                              onClick={() => setOpenKeys((prev) => new Set(prev).add(s._key))}
                              className={`w-6 h-6 rounded border text-[14px] leading-none ${open ? 'border-black/10 opacity-40' : 'border-black/20 bg-white hover:bg-black/5'}`}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              title="Daralt"
                              onClick={() =>
                                setOpenKeys((prev) => {
                                  const next = new Set(prev);
                                  next.delete(s._key);
                                  return next;
                                })
                              }
                              className={`w-6 h-6 rounded border text-[14px] leading-none ${open ? 'border-black/20 bg-white hover:bg-black/5' : 'border-black/10 opacity-40'}`}
                            >
                              −
                            </button>
                            <button
                              type="button"
                              title="Yukarı"
                              onClick={() => moveStep(idx, -1)}
                              className="p-1 rounded hover:bg-black/5"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Aşağı"
                              onClick={() => moveStep(idx, 1)}
                              className="p-1 rounded hover:bg-black/5"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Sil"
                              onClick={() => {
                                setOpenKeys((prev) => {
                                  const next = new Set(prev);
                                  next.delete(s._key);
                                  return next;
                                });
                                removeStep(idx);
                              }}
                              className="p-1 rounded hover:bg-rose-100 text-rose-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {open && (
                          <div className="flex flex-wrap items-start gap-2 mt-2">
                            <div className="flex-1 min-w-0 grid gap-2 sm:grid-cols-2">
                              <label className="block text-[11px]">
                                Başlık
                                <input
                                  value={s.title}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setSteps((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, title: v } : x)),
                                    );
                                  }}
                                  className="mt-0.5 w-full rounded border border-black/10 bg-white/80 px-2 py-1 text-[13px]"
                                />
                              </label>
                              <label className="block text-[11px]">
                                Kod
                                <input
                                  value={s.code}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setSteps((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, code: v } : x)),
                                    );
                                  }}
                                  className="mt-0.5 w-full rounded border border-black/10 bg-white/80 px-2 py-1 text-[13px] font-mono"
                                />
                              </label>
                              <div className="text-[11px] opacity-80 sm:col-span-2">
                                Tip: <strong>{meta?.label || s.nodeType}</strong> · {s.actionType}
                              </div>
                              {SQL_NODES.has(s.nodeType || '') && (
                                <SqlFieldEditor
                                  json={s.configJson}
                                  onChange={(next) =>
                                    setSteps((prev) => prev.map((x, i) => (i === idx ? { ...x, configJson: next } : x)))
                                  }
                                  onError={(text) => setMsg({ kind: 'err', text })}
                                />
                              )}
                              {s.nodeType === 'BankFetch' && (
                                <BankFetchEditor
                                  json={s.configJson}
                                  onChange={(next) =>
                                    setSteps((prev) => prev.map((x, i) => (i === idx ? { ...x, configJson: next } : x)))
                                  }
                                  onError={(text) => setMsg({ kind: 'err', text })}
                                />
                              )}
                              {s.nodeType === 'DataFetch' && (
                                <DataFetchEditor
                                  json={s.configJson}
                                  onChange={(next) =>
                                    setSteps((prev) => prev.map((x, i) => (i === idx ? { ...x, configJson: next } : x)))
                                  }
                                  onError={(text) => setMsg({ kind: 'err', text })}
                                />
                              )}
                              {s.nodeType === 'ModuleTransfer' && (
                                <ModuleTransferEditor
                                  json={s.configJson}
                                  targets={transferTargets}
                                  sourceNames={tokens
                                    .map((t) => t.label)
                                    .filter((label) => !label.endsWith('(tablo)'))}
                                  onChange={(next) =>
                                    setSteps((prev) => prev.map((x, i) => (i === idx ? { ...x, configJson: next } : x)))
                                  }
                                  onError={(text) => setMsg({ kind: 'err', text })}
                                />
                              )}
                              {tokens.length > 0 && (
                                <div className="sm:col-span-2 space-y-1">
                                  <div className="text-[10px] uppercase tracking-wide opacity-70">Kullanılabilir alanlar</div>
                                  <div className="flex flex-wrap gap-1">
                                    {tokens.map((t) => (
                                      <button
                                        key={t.token}
                                        type="button"
                                        onClick={() =>
                                          setSteps((prev) =>
                                            prev.map((x, i) =>
                                              i === idx
                                                ? {
                                                    ...x,
                                                    configJson: patchCfg(x.configJson, {
                                                      ifade: `${stepExpr(x.configJson)}${t.token}`,
                                                    }),
                                                  }
                                                : x,
                                            ),
                                          )
                                        }
                                        className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] font-mono text-sky-900 hover:bg-sky-100"
                                      >
                                        {t.label}
                                      </button>
                                    ))}
                                  </div>
                                  <label className="block text-[11px]">
                                    İfade
                                    <textarea
                                      value={stepExpr(s.configJson)}
                                      onChange={(e) => {
                                        const ifade = e.target.value;
                                        setSteps((prev) =>
                                          prev.map((x, i) =>
                                            i === idx ? { ...x, configJson: patchCfg(x.configJson, { ifade }) } : x,
                                          ),
                                        );
                                      }}
                                      rows={2}
                                      className={`mt-0.5 w-full rounded border bg-white px-2 py-1 text-[12px] font-mono ${exprErr ? 'border-rose-400' : 'border-black/10'}`}
                                    />
                                  </label>
                                  {exprErr ? (
                                    <p className="text-[11px] text-rose-700">{exprErr}</p>
                                  ) : stepExpr(s.configJson).trim() ? (
                                    <p className="text-[11px] text-emerald-700">Uyumlu</p>
                                  ) : (
                                    <p className="text-[11px] opacity-60">Düz metin, {'{Alan}'} veya formül (IF, +, [Alan]).</p>
                                  )}
                                </div>
                              )}
                              <label className="block text-[11px]">
                                Onay sonrası
                                <select
                                  value={s.nextStepOnOk == null ? '' : String(s.nextStepOnOk)}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const v = raw === '' ? null : Number(raw);
                                    setSteps((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, nextStepOnOk: v } : x)),
                                    );
                                  }}
                                  className="mt-0.5 w-full rounded border border-black/10 bg-white/80 px-2 py-1 text-[12px]"
                                >
                                  <option value="">Sıradaki adım</option>
                                  <option value="0">Süreci bitir</option>
                                  {steps
                                    .filter((x) => x._key !== s._key)
                                    .map((x) => (
                                      <option key={x._key} value={x.stepNo}>
                                        {x.stepNo} · {x.title || x.code}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <label className="block text-[11px]">
                                Red sonrası
                                <select
                                  value={s.nextStepOnFail == null ? '' : String(s.nextStepOnFail)}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const v = raw === '' ? null : Number(raw);
                                    setSteps((prev) =>
                                      prev.map((x, i) => (i === idx ? { ...x, nextStepOnFail: v } : x)),
                                    );
                                  }}
                                  className="mt-0.5 w-full rounded border border-black/10 bg-white/80 px-2 py-1 text-[12px]"
                                >
                                  <option value="">Süreci reddet</option>
                                  {steps
                                    .filter((x) => x._key !== s._key)
                                    .map((x) => (
                                      <option key={x._key} value={x.stepNo}>
                                        {x.stepNo} · {x.title || x.code}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              {(meta?.needsApprover || s.nodeType === 'TaskForm') && (
                                <label className="block text-[11px] sm:col-span-2">
                                  Onaycı rol
                                  <select
                                    value={s.approverRoleId ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value ? Number(e.target.value) : null;
                                      setSteps((prev) =>
                                        prev.map((x, i) =>
                                          i === idx ? { ...x, approverRoleId: v } : x,
                                        ),
                                      );
                                    }}
                                    className="mt-0.5 w-full rounded border border-black/10 bg-white/80 px-2 py-1 text-[13px]"
                                  >
                                    <option value="">Herkes / admin</option>
                                    {roles.map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {r.name} ({r.code})
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                            </div>
                          </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}

                <div className="flex justify-between gap-2 pt-2">
                  {draft.processDefID > 0 ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onDelete(draft)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 px-3 py-2 text-[13px] text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> Sil
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onSave()}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Kaydet
                  </button>
                </div>
              </section>
            </>
          )}
        </main>

        {/* Palet */}
        <aside className="border-l border-slate-200 bg-white overflow-y-auto">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sticky top-0 bg-white border-b border-slate-100">
            Parça paleti
          </div>
          <div className="p-2 space-y-3">
            {[...groups.entries()].map(([g, nodes]) => (
              <div key={g}>
                <div className="px-1 mb-1 text-[10px] font-semibold text-slate-400 uppercase">
                  {groupTitle[g] || g}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {nodes.map((n) => (
                    <button
                      key={n.nodeType}
                      type="button"
                      disabled={!draft}
                      title={draft ? `${n.label} ekle` : 'Önce tanım seçin'}
                      onClick={() => addNode(n)}
                      className={`rounded border px-1.5 py-2 text-[10px] font-medium leading-tight text-center disabled:opacity-40 hover:shadow-sm ${NODE_TONE_CLASS[n.tone]}`}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
