import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { apiJson } from "../config/api";
import { loadLookupOptions } from "../api/lookupApi";
import { LookupModal, LookupOption } from "../components/LookupModal";
import {
  FilterInput,
  SortLabel,
  useGridSortFilter,
} from "../components/GridSortFilter";
import {
  BoundPositionLabels,
  BoundTransTypeLabels,
} from "../data/documentTypes";

interface Card {
  boundCardID: number;
  type_?: number | null;
  status_?: number | null;
  documentNr?: string | null;
  transDate?: string | null;
  dueDate?: string | null;
  amount?: number | null;
  isOwn: boolean;
  debtor?: string | null;
  bankName?: string | null;
  customerTitle?: string | null;
  location?: string | null;
}

interface Roll {
  BoundRollID: number;
  Type_: number;
  RollDate: string;
  DocumentNumber?: string | null;
  Amount?: number | null;
  CustomerTitle?: string | null;
  BankAccountTitle?: string | null;
  SafeTitle?: string | null;
  Lines: number;
}

interface NewLine {
  type_: string;
  documentNr: string;
  dueDate: string;
  amount: string;
  debtor: string;
  bankName: string;
  branchName: string;
  accountNo: string;
}

type Tab = "portfoy" | "giris" | "bordrolar" | "takvim";

const n = (v?: number | null) =>
  (v ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const d = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("tr-TR") : "";
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): NewLine => ({
  type_: "1",
  documentNr: "",
  dueDate: "",
  amount: "",
  debtor: "",
  bankName: "",
  branchName: "",
  accountNo: "",
});

/** Bordro türü → kabul edilen konumlar ve karşı taraf (SqlUpdates/86) */
const ACTIONS: {
  type: number;
  from: number[];
  party: "cari" | "banka" | "kasa" | null;
}[] = [
  { type: 2, from: [1], party: "cari" },
  { type: 3, from: [1], party: "banka" },
  { type: 4, from: [1], party: "banka" },
  { type: 5, from: [3, 4], party: "banka" },
  { type: 6, from: [1], party: "kasa" },
  { type: 11, from: [3, 4], party: null },
  { type: 8, from: [1], party: "cari" },
  { type: 7, from: [1, 2, 3, 4], party: null },
  { type: 10, from: [8], party: "banka" },
];

const PARTY_FIELD = {
  cari: "CustomerID",
  banka: "BankAccountCardID",
  kasa: "SafeCardID",
} as const;
const PARTY_LABEL = {
  cari: "Cari",
  banka: "Banka hesabı",
  kasa: "Kasa",
} as const;

/** «…» ile seçilen kart (cari / banka hesabı / kasa) */
const PickField: React.FC<{
  field: string;
  label: string;
  value: LookupOption | null;
  onChange: (o: LookupOption | null) => void;
}> = ({ field, label, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<LookupOption[]>([]);
  const show = async () => {
    setOpts((await loadLookupOptions(field)) ?? []);
    setOpen(true);
  };
  return (
    <div className="space-y-0.5 text-xs min-w-[220px]">
      <span className="block text-[11px] text-slate-500">{label}</span>
      <div className="flex">
        <input
          readOnly
          value={value?.label ?? ""}
          onClick={() => void show()}
          className="h-7 px-2 flex-1 border border-slate-300 rounded-l-sm bg-white cursor-pointer"
        />
        <button
          type="button"
          onClick={() => void show()}
          className="h-7 px-2 border border-l-0 border-slate-300 rounded-r-sm hover:bg-slate-50"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (
        <LookupModal
          title={label}
          options={opts}
          value={value?.value}
          onSelect={(o) => {
            onChange(o);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

/** Finans → Hareketler → Çek / Senet Portföyü (Y-11) */
export const BoundPortfolioPage: React.FC<{ onBack: () => void }> = ({
  onBack,
}) => {
  const [tab, setTab] = useState<Tab>("portfoy");
  const [cards, setCards] = useState<Card[]>([]);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [posFilter, setPosFilter] = useState<number[]>([1]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [action, setAction] = useState<number | null>(null);
  const [rollDate, setRollDate] = useState(today());
  const [docNo, setDocNo] = useState("");
  const [desc, setDesc] = useState("");
  const [party, setParty] = useState<LookupOption | null>(null);
  const [entryType, setEntryType] = useState<1 | 9>(1);
  const [lines, setLines] = useState<NewLine[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        apiJson<Card[]>("/api/bound/portfolio"),
        apiJson<Roll[]>("/api/bound/rolls"),
      ]);
      setCards(c);
      setRolls(r);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () =>
      cards.filter(
        (c) => posFilter.length === 0 || posFilter.includes(c.status_ ?? 1),
      ),
    [cards, posFilter],
  );
  const cellText = (c: Card, key: string): string => {
    switch (key) {
      case "kind":
        return `${c.type_ === 2 ? "Senet" : "Çek"}${c.isOwn ? " (kendi)" : ""}`;
      case "doc":
        return c.documentNr ?? "";
      case "due":
        return d(c.dueDate);
      case "amount":
        return n(c.amount);
      case "pos":
        return BoundPositionLabels[String(c.status_ ?? 1)] ?? "";
      case "customer":
        return c.customerTitle ?? "";
      case "location":
        return c.location ?? "";
      case "debtor":
        return [c.debtor, c.bankName].filter(Boolean).join(" · ");
      default:
        return "";
    }
  };
  const grid = useGridSortFilter(shown, cellText);
  const selCards = cards.filter((c) => sel.has(c.boundCardID));
  const selPositions = new Set(selCards.map((c) => c.status_ ?? 1));
  const act = ACTIONS.find((a) => a.type === action);

  const resetForm = () => {
    setAction(null);
    setParty(null);
    setDocNo("");
    setDesc("");
    setRollDate(today());
  };

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiJson<{ message: string }>("/api/bound/rolls", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMsg({ text: r.message });
      return true;
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const partyBody = (p: "cari" | "banka" | "kasa" | null) =>
    p && party
      ? {
          [p === "cari"
            ? "customerID"
            : p === "banka"
              ? "bankAccountCardID"
              : "safeCardID"]: Number(party.value),
        }
      : {};

  const submitAction = async () => {
    if (!act) return;
    const ok = await send({
      type_: act.type,
      rollDate,
      documentNumber: docNo || null,
      description: desc || null,
      ...partyBody(act.party),
      lines: selCards.map((c) => ({ boundCardID: c.boundCardID })),
    });
    if (ok) {
      setSel(new Set());
      resetForm();
      await load();
    }
  };

  const submitEntry = async () => {
    const ok = await send({
      type_: entryType,
      rollDate,
      documentNumber: docNo || null,
      description: desc || null,
      customerID: party ? Number(party.value) : null,
      lines: lines
        .filter((l) => l.documentNr || l.amount)
        .map((l) => ({
          ...l,
          type_: Number(l.type_),
          amount:
            Number(String(l.amount).replace(/\./g, "").replace(",", ".")) || 0,
          dueDate: l.dueDate || null,
        })),
    });
    if (ok) {
      setLines([emptyLine()]);
      resetForm();
      setTab("portfoy");
      await load();
    }
  };

  const deleteRoll = async (r: Roll) => {
    if (
      !window.confirm(
        `${BoundTransTypeLabels[String(r.Type_)]} bordrosu ${r.DocumentNumber ?? r.BoundRollID} silinsin mi? Belgeler önceki konumlarına döner.`,
      )
    )
      return;
    setMsg(null);
    try {
      const res = await apiJson<{ message: string }>(
        `/api/bound/rolls/${r.BoundRollID}`,
        { method: "DELETE" },
      );
      setMsg({ text: res.message });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  };

  /** Vade takvimi: hareket bekleyen belgeler (portföy, tahsil, teminat, verilen) ay bazında */
  const calendar = useMemo(() => {
    const map = new Map<
      string,
      { inflow: number; outflow: number; items: Card[] }
    >();
    for (const c of cards.filter((x) =>
      [1, 3, 4, 8].includes(x.status_ ?? 1),
    )) {
      const key = c.dueDate ? c.dueDate.slice(0, 7) : "—";
      const m = map.get(key) ?? { inflow: 0, outflow: 0, items: [] };
      if (c.status_ === 8) m.outflow += c.amount ?? 0;
      else m.inflow += c.amount ?? 0;
      m.items.push(c);
      map.set(key, m);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [cards]);

  const COLS = [
    { key: "kind", label: "Tür" },
    { key: "doc", label: "Belge no" },
    { key: "due", label: "Vade" },
    { key: "amount", label: "Tutar", num: true },
    { key: "pos", label: "Konum" },
    { key: "customer", label: "Alındığı cari" },
    { key: "location", label: "Bulunduğu yer" },
    { key: "debtor", label: "Keşideci / banka" },
  ];

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`h-7 px-3 rounded-sm text-xs font-semibold whitespace-nowrap ${tab === t ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  );

  const headerFields = (needParty: "cari" | "banka" | "kasa" | null) => (
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-0.5 text-xs">
        <span className="block text-[11px] text-slate-500">Tarih</span>
        <input
          type="date"
          value={rollDate}
          onChange={(e) => setRollDate(e.target.value)}
          className="h-7 px-2 border border-slate-300 rounded-sm"
        />
      </label>
      <label className="space-y-0.5 text-xs">
        <span className="block text-[11px] text-slate-500">Bordro no</span>
        <input
          value={docNo}
          onChange={(e) => setDocNo(e.target.value)}
          className="h-7 px-2 w-32 border border-slate-300 rounded-sm"
        />
      </label>
      {needParty && (
        <PickField
          field={PARTY_FIELD[needParty]}
          label={PARTY_LABEL[needParty]}
          value={party}
          onChange={setParty}
        />
      )}
      <label className="space-y-0.5 text-xs flex-1 min-w-[160px]">
        <span className="block text-[11px] text-slate-500">Açıklama</span>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="h-7 px-2 w-full border border-slate-300 rounded-sm"
        />
      </label>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-slate-500" /> Çek / Senet Portföyü
          </h1>
          <p className="text-[12px] text-slate-500">
            Giriş, ciro, tahsile / teminata verme, tahsil, karşılıksız ve iade
            bordroları · cari, banka ve kasa ekstresine yansır
          </p>
        </div>
        <div className="flex gap-1">
          {tabBtn("portfoy", "Portföy")}
          {tabBtn("giris", "Yeni giriş")}
          {tabBtn("bordrolar", "Bordrolar")}
          {tabBtn("takvim", "Vade takvimi")}
        </div>
      </div>

      {msg && (
        <div
          className={`px-3 py-1.5 rounded-md text-xs border ${msg.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {msg.text}
        </div>
      )}

      {tab === "portfoy" && (
        <>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {Object.entries(BoundPositionLabels).map(([k, l]) => {
              const on = posFilter.includes(Number(k));
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    setPosFilter(
                      on
                        ? posFilter.filter((x) => x !== Number(k))
                        : [...posFilter, Number(k)],
                    )
                  }
                  className={`h-6 px-2 rounded-full border ${on ? "bg-blue-700 border-blue-700 text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                >
                  {l} (
                  {cards.filter((c) => (c.status_ ?? 1) === Number(k)).length})
                </button>
              );
            })}
          </div>

          {sel.size > 0 && (
            <div className="bg-white border border-blue-200 rounded-md p-2 space-y-2">
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <span className="text-slate-600 mr-1">
                  {sel.size} belge ·{" "}
                  {n(selCards.reduce((s, c) => s + (c.amount ?? 0), 0))}:
                </span>
                {ACTIONS.filter((a) =>
                  [...selPositions].every((p) => a.from.includes(p)),
                ).map((a) => (
                  <button
                    key={a.type}
                    type="button"
                    onClick={() => {
                      setAction(a.type);
                      setParty(null);
                    }}
                    className={`h-6 px-2 rounded-sm border ${action === a.type ? "bg-slate-800 border-slate-800 text-white" : "border-slate-300 hover:bg-slate-50"}`}
                  >
                    {BoundTransTypeLabels[String(a.type)]}
                  </button>
                ))}
              </div>
              {act && (
                <div className="flex flex-wrap items-end gap-2">
                  {headerFields(act.party)}
                  <button
                    type="button"
                    onClick={() => void submitAction()}
                    disabled={busy || (!!act.party && !party)}
                    className="h-7 px-3 rounded-sm bg-blue-700 text-white text-xs font-semibold hover:bg-blue-600 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{" "}
                    Bordroyu kaydet
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-md overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-7 px-2">
                    <input
                      type="checkbox"
                      checked={
                        grid.view.length > 0 &&
                        grid.view.every((c) => sel.has(c.boundCardID))
                      }
                      onChange={(e) =>
                        setSel(
                          e.target.checked
                            ? new Set(grid.view.map((c) => c.boundCardID))
                            : new Set(),
                        )
                      }
                    />
                  </th>
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      className={`px-2 py-1.5 font-semibold text-slate-700 ${c.num ? "text-right" : "text-left"}`}
                    >
                      <SortLabel
                        colKey={c.key}
                        label={c.label}
                        sort={grid.sort}
                        onSort={grid.toggleSort}
                        align={c.num ? "right" : "left"}
                      />
                    </th>
                  ))}
                </tr>
                <tr>
                  <th />
                  {COLS.map((c) => (
                    <th key={c.key} className="px-1 pb-1">
                      <FilterInput
                        colKey={c.key}
                        value={grid.filters[c.key] ?? ""}
                        onChange={grid.setFilter}
                        numeric={!!c.num}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.view.length === 0 && (
                  <tr>
                    <td
                      colSpan={COLS.length + 1}
                      className="px-3 py-4 text-center text-slate-400"
                    >
                      Belge yok. «Yeni giriş» ile müşteriden alınan çek /
                      senetleri portföye alın.
                    </td>
                  </tr>
                )}
                {grid.view.map((c) => {
                  const overdue =
                    c.dueDate &&
                    [1, 3, 4, 8].includes(c.status_ ?? 1) &&
                    c.dueDate.slice(0, 10) < today();
                  return (
                    <tr
                      key={c.boundCardID}
                      className={`border-b border-slate-100 hover:bg-blue-50/40 ${sel.has(c.boundCardID) ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-2">
                        <input
                          type="checkbox"
                          checked={sel.has(c.boundCardID)}
                          onChange={(e) => {
                            const s = new Set(sel);
                            if (e.target.checked) s.add(c.boundCardID);
                            else s.delete(c.boundCardID);
                            setSel(s);
                            setAction(null);
                          }}
                        />
                      </td>
                      {COLS.map((col) => (
                        <td
                          key={col.key}
                          className={`px-2 py-1 whitespace-nowrap ${col.num ? "text-right tabular-nums" : ""} ${col.key === "due" && overdue ? "text-red-700 font-semibold" : ""}`}
                        >
                          {cellText(c, col.key)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "giris" && (
        <div className="bg-white border border-slate-200 rounded-md p-3 space-y-3">
          <div className="flex gap-1 text-xs">
            {([1, 9] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEntryType(t)}
                className={`h-6 px-2 rounded-sm border ${entryType === t ? "bg-slate-800 border-slate-800 text-white" : "border-slate-300 hover:bg-slate-50"}`}
              >
                {BoundTransTypeLabels[String(t)]}
              </button>
            ))}
          </div>
          {headerFields("cari")}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-[11px] text-slate-500 text-left">
                  {[
                    "Tür",
                    "Belge / seri no",
                    "Vade",
                    "Tutar",
                    "Keşideci / borçlu",
                    "Banka",
                    "Şube",
                    "Hesap no",
                    "",
                  ].map((h) => (
                    <th key={h} className="px-1 py-0.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const set = (k: keyof NewLine, v: string) =>
                    setLines(
                      lines.map((x, j) => (j === i ? { ...x, [k]: v } : x)),
                    );
                  const inp = (
                    k: keyof NewLine,
                    cls = "w-28",
                    type = "text",
                  ) => (
                    <input
                      type={type}
                      value={l[k]}
                      onChange={(e) => set(k, e.target.value)}
                      className={`h-7 px-1.5 border border-slate-300 rounded-sm ${cls}`}
                    />
                  );
                  return (
                    <tr key={i}>
                      <td className="px-1 py-0.5">
                        <select
                          value={l.type_}
                          onChange={(e) => set("type_", e.target.value)}
                          className="h-7 px-1 border border-slate-300 rounded-sm"
                        >
                          <option value="1">Çek</option>
                          <option value="2">Senet</option>
                        </select>
                      </td>
                      <td className="px-1 py-0.5">{inp("documentNr")}</td>
                      <td className="px-1 py-0.5">
                        {inp("dueDate", "w-32", "date")}
                      </td>
                      <td className="px-1 py-0.5">
                        {inp("amount", "w-24 text-right")}
                      </td>
                      <td className="px-1 py-0.5">{inp("debtor", "w-40")}</td>
                      <td className="px-1 py-0.5">{inp("bankName")}</td>
                      <td className="px-1 py-0.5">
                        {inp("branchName", "w-24")}
                      </td>
                      <td className="px-1 py-0.5">
                        {inp("accountNo", "w-24")}
                      </td>
                      <td className="px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setLines(
                              lines.length > 1
                                ? lines.filter((_, j) => j !== i)
                                : [emptyLine()],
                            )
                          }
                          className="text-slate-400 hover:text-red-600"
                          title="Satırı sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setLines([...lines, emptyLine()])}
              className="h-7 px-2 text-xs rounded-sm border border-slate-300 hover:bg-slate-50 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Satır ekle
            </button>
            <button
              type="button"
              onClick={() => void submitEntry()}
              disabled={busy || !party}
              className="h-7 px-3 rounded-sm bg-blue-700 text-white text-xs font-semibold hover:bg-blue-600 disabled:opacity-50 inline-flex items-center gap-1"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{" "}
              Bordroyu kaydet
            </button>
          </div>
        </div>
      )}

      {tab === "bordrolar" && (
        <div className="bg-white border border-slate-200 rounded-md overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-left">
              <tr>
                {[
                  "Tarih",
                  "Bordro",
                  "No",
                  "Karşı taraf",
                  "Belge",
                  "Tutar",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`px-2 py-1.5 font-semibold text-slate-700 ${h === "Tutar" || h === "Belge" ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rolls.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-slate-400"
                  >
                    Bordro yok.
                  </td>
                </tr>
              )}
              {rolls.map((r) => (
                <tr
                  key={r.BoundRollID}
                  className="border-b border-slate-100 hover:bg-blue-50/40"
                >
                  <td className="px-2 py-1">{d(r.RollDate)}</td>
                  <td className="px-2 py-1">
                    {BoundTransTypeLabels[String(r.Type_)]}
                  </td>
                  <td className="px-2 py-1">{r.DocumentNumber}</td>
                  <td className="px-2 py-1">
                    {r.CustomerTitle ?? r.BankAccountTitle ?? r.SafeTitle ?? ""}
                  </td>
                  <td className="px-2 py-1 text-right">{r.Lines}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {n(r.Amount)}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => void deleteRoll(r)}
                      className="text-slate-400 hover:text-red-600"
                      title="Bordroyu sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "takvim" && (
        <div className="space-y-2">
          {calendar.length === 0 && (
            <div className="text-xs text-slate-400 px-1">
              Vadesi bekleyen belge yok.
            </div>
          )}
          {calendar.map(([month, m]) => (
            <div
              key={month}
              className="bg-white border border-slate-200 rounded-md"
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 text-xs">
                <span className="font-semibold text-slate-800">
                  {month === "—"
                    ? "Vadesiz"
                    : new Date(`${month}-01`).toLocaleDateString("tr-TR", {
                        month: "long",
                        year: "numeric",
                      })}
                </span>
                <span className="tabular-nums text-slate-600">
                  Tahsil edilecek{" "}
                  <b className="text-emerald-700">{n(m.inflow)}</b> · Ödenecek{" "}
                  <b className="text-red-700">{n(m.outflow)}</b>
                </span>
              </div>
              <table className="min-w-full text-[11px]">
                <tbody>
                  {m.items
                    .sort((a, b) =>
                      (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
                    )
                    .map((c) => (
                      <tr
                        key={c.boundCardID}
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="px-3 py-0.5 w-24">{d(c.dueDate)}</td>
                        <td className="px-2 py-0.5 w-28">
                          {cellText(c, "kind")}
                        </td>
                        <td className="px-2 py-0.5">{c.documentNr}</td>
                        <td className="px-2 py-0.5">
                          {BoundPositionLabels[String(c.status_ ?? 1)]}
                        </td>
                        <td className="px-2 py-0.5">
                          {c.location ?? c.customerTitle ?? ""}
                        </td>
                        <td
                          className={`px-3 py-0.5 text-right tabular-nums ${c.status_ === 8 ? "text-red-700" : ""}`}
                        >
                          {n(c.amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
