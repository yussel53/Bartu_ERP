import React from 'react';
import { ArrowLeft, Copy, FileSliders, Pencil } from 'lucide-react';
import { EntityFormPage } from './EntityFormPage';
import {
  CARD_DEFAULT_KINDS,
  CARD_DEFAULT_TEMPLATE_ID,
  type CardDefaultKind,
} from '../data/cardDefaults';
import { getRecord, saveRecord } from '../api/recordsApi';
import { getFormSchema } from '../data/formSchemas';

interface CardDefaultsPageProps {
  onBack: () => void;
  /** Menüden gelen tek kart öndeğeri (customer | product | bank | safe) */
  kindId?: string;
}

async function ensureKindTemplate(kind: CardDefaultKind): Promise<void> {
  try {
    await getRecord(kind.tableName, CARD_DEFAULT_TEMPLATE_ID, kind.primaryKeyColumn);
    return;
  } catch {
    /* yoksa seed */
  }
  const schema = getFormSchema(kind.formCode);
  const seed: Record<string, unknown> = {
    ...(schema?.fixedStandardFields || {}),
    Code:
      kind.id === 'customer'
        ? '120.*'
        : kind.id === 'product'
          ? '150.*'
          : kind.id === 'bank'
            ? '102.*'
            : '100.*',
    Title: `Öndeğer ${kind.title}`,
  };
  if (kind.tableName === 'CustomerCard') {
    seed.Type_ = 3;
    seed.TaxType = 1;
    seed.Active = true;
    seed.AccountGroupID = 1;
  }
  if (kind.tableName === 'ProductCard') {
    seed.ProductType = 1;
    seed.IsActive = true;
    seed.AccountGroupID = 1;
  }
  if (kind.tableName === 'BankCard' || kind.tableName === 'SafeCard') {
    seed.IsActive = true;
  }
  await saveRecord(
    kind.tableName,
    { recordId: CARD_DEFAULT_TEMPLATE_ID, standardFields: seed, additionalFields: {} },
    { pk: kind.primaryKeyColumn, formCode: kind.formCode },
  );
}

/**
 * Öndeğerler — ID=-1 şablon kartlar.
 * Yeni cari/malzeme/banka açılırken bu kayıttan alanlar kopyalanır.
 */
export const CardDefaultsPage: React.FC<CardDefaultsPageProps> = ({ onBack, kindId }) => {
  const menuKind = CARD_DEFAULT_KINDS.find((k) => k.id === kindId) || null;
  const [editing, setEditing] = React.useState<CardDefaultKind | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(!kindId);

  React.useEffect(() => {
    if (!kindId) {
      setReady(true);
      return;
    }
    const kind = CARD_DEFAULT_KINDS.find((k) => k.id === kindId);
    if (!kind) {
      setMsg('Bilinmeyen öndeğer türü');
      setReady(true);
      return;
    }
    let cancelled = false;
    setBusyId(kind.id);
    setMsg(null);
    setReady(false);
    void (async () => {
      try {
        await ensureKindTemplate(kind);
        if (!cancelled) {
          setEditing(kind);
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setMsg(e instanceof Error ? e.message : 'Şablon açılamadı');
          setReady(true);
        }
      } finally {
        if (!cancelled) setBusyId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kindId]);

  const openKind = async (kind: CardDefaultKind) => {
    setBusyId(kind.id);
    setMsg(null);
    try {
      await ensureKindTemplate(kind);
      setEditing(kind);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Şablon açılamadı');
    } finally {
      setBusyId(null);
    }
  };

  if (editing && ready) {
    return (
      <div className="space-y-2">
        {!menuKind && (
          <div className="flex items-center gap-2 px-0.5">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Öndeğerlere dön
            </button>
            <span className="text-[11px] text-slate-400">
              {editing.title} · şablon ID = {CARD_DEFAULT_TEMPLATE_ID}
            </span>
          </div>
        )}
        {menuKind && (
          <p className="text-[11px] text-slate-400 px-0.5">
            {editing.title} öndeğeri · şablon ID = {CARD_DEFAULT_TEMPLATE_ID}
          </p>
        )}
        <EntityFormPage
          key={`${editing.formCode}-${CARD_DEFAULT_TEMPLATE_ID}`}
          formCode={editing.formCode}
          mode="edit"
          recordId={String(CARD_DEFAULT_TEMPLATE_ID)}
          screenTitle={`${editing.title} öndeğeri`}
          onBack={menuKind ? onBack : () => setEditing(null)}
        />
      </div>
    );
  }

  if (menuKind) {
    return (
      <div className="py-8 text-center text-[12px] text-slate-500">
        {msg || (busyId ? 'Öndeğer açılıyor…' : 'Yükleniyor…')}
        {msg && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onBack}
              className="px-2.5 h-8 text-[12px] font-semibold text-slate-600 border border-slate-200 rounded-md"
            >
              Geri
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSliders className="w-5 h-5 text-slate-500" />
            Öndeğerler
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            ID = −1 şablon kartlar. Yeni ekle dediğinizde bu alanlar yeni karta kopyalanır.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-2.5 h-8 text-[12px] font-semibold text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50"
        >
          Geri
        </button>
      </div>

      {msg && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          {msg}
        </div>
      )}

      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
        <p className="flex items-start gap-1.5">
          <Copy className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Örnek: Cari şablonda Kod = <code className="px-1 bg-white rounded border">120.*</code>, Tür =
          Alıcı/Satıcı, Vergi tipi = Tüzel → Yeni cari açınca form bu değerlerle gelir.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CARD_DEFAULT_KINDS.map((kind) => (
          <div
            key={kind.id}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2"
          >
            <div>
              <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{kind.title}</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">{kind.subtitle}</p>
            </div>
            <button
              type="button"
              disabled={busyId === kind.id}
              onClick={() => void openKind(kind)}
              className="inline-flex items-center gap-1.5 px-2.5 h-8 text-[12px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md disabled:opacity-60"
            >
              <Pencil className="w-3.5 h-3.5" />
              {busyId === kind.id ? 'Açılıyor…' : 'Öndeğeri düzenle'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
