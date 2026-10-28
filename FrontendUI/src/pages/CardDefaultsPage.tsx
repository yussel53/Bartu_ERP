import React from 'react';
import { ArrowLeft, Copy, FileSliders, Pencil } from 'lucide-react';
import { EntityFormPage } from './EntityFormPage';
import { CARD_DEFAULT_KINDS, type CardDefaultKind } from '../data/cardDefaults';
import { getRecord, saveRecord } from '../api/recordsApi';
import { getFormSchema } from '../data/formSchemas';
import { resolveTaxCardForSetting } from '../api/moduleParamsApi';

interface CardDefaultsPageProps {
  onBack: () => void;
  /** Menüden gelen tek öndeğer (customer | product | … | sales-invoice | purchase-order …) */
  kindId?: string;
}

async function ensureKindTemplate(kind: CardDefaultKind): Promise<void> {
  try {
    const existing = await getRecord(kind.tableName, kind.templateId, kind.primaryKeyColumn);
    // Mevcut malzeme öndeğerinde vergi kartı boşsa STK_KDV_SAL ile doldur
    if (kind.id === 'product') {
      const cur = existing.standardFields?.TaxCardID ?? existing.standardFields?.taxCardID;
      if (cur == null || cur === '' || cur === 0 || cur === '0') {
        try {
          const { taxCardId } = await resolveTaxCardForSetting('STK_KDV_SAL');
          if (taxCardId) {
            await saveRecord(
              kind.tableName,
              {
                recordId: kind.templateId,
                standardFields: { ...existing.standardFields, TaxCardID: taxCardId },
                additionalFields: existing.additionalFields || {},
              },
              { pk: kind.primaryKeyColumn, formCode: kind.formCode },
            );
          }
        } catch {
          /* */
        }
      }
    }
    return;
  } catch {
    /* yoksa seed */
  }
  const schema = getFormSchema(kind.formCode);
  const seed: Record<string, unknown> = { ...(schema?.fixedStandardFields || {}) };
  if (kind.group === 'voucher') {
    // Seçmeli alanların ön tanımı (ör. Fatura «Fiş Türü» = Satış / Alış)
    for (const f of schema?.fields || []) {
      if (f.defaultValue != null && f.defaultValue !== '' && seed[f.fieldName] == null) {
        seed[f.fieldName] = f.defaultValue;
      }
    }
    // Numara kolonu NOT NULL olabilir (ProductVoucher.DocumentNumber); yeni fişe kopyalanmaz
    for (const n of ['DocumentNumber', 'OrderSlipNo']) {
      if (schema?.fields.some((f) => f.fieldName === n)) seed[n] = 'ÖNDEĞER';
    }
    seed.Description = `Öndeğer ${kind.title}`;
  } else {
    seed.Title = `Öndeğer ${kind.title}`;
  }
  Object.assign(seed, kind.seed || {});
  // Malzeme öndeğer şablonu: STK_KDV_SAL → TaxCardID
  if (kind.id === 'product' && (seed.TaxCardID == null || seed.TaxCardID === '' || seed.TaxCardID === 0)) {
    try {
      const { taxCardId } = await resolveTaxCardForSetting('STK_KDV_SAL');
      if (taxCardId) seed.TaxCardID = taxCardId;
    } catch {
      /* yoksa şablon vergi kartı boş */
    }
  }
  await saveRecord(
    kind.tableName,
    { recordId: kind.templateId, standardFields: seed, additionalFields: {} },
    { pk: kind.primaryKeyColumn, formCode: kind.formCode },
  );
}

/**
 * Öndeğerler — negatif ID'li şablon kayıtlar.
 * Kart: ID=-1 · Fiş: aynı tabloda türe göre -1, -2, -3 …
 * Yeni kayıt açılırken bu şablondan alanlar kopyalanır.
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
              {editing.title} · {editing.tableName} şablon ID = {editing.templateId}
            </span>
          </div>
        )}
        {menuKind && (
          <p className="text-[11px] text-slate-400 px-0.5">
            {editing.title} öndeğeri · {editing.tableName} şablon ID = {editing.templateId}
            {editing.group === 'voucher' && ' · yalnız başlık alanları (numara ve tarih yeni fişte verilir)'}
          </p>
        )}
        <EntityFormPage
          key={`${editing.formCode}-${editing.templateId}`}
          formCode={editing.formCode}
          mode="edit"
          recordId={String(editing.templateId)}
          templateMode
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
            Negatif ID'li şablon kayıtlar. Yeni ekle dediğinizde bu alanlar yeni kart / fişe kopyalanır.
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
        <p className="flex items-start gap-1.5">
          <Copy className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Fiş örneği: Satış Faturası şablonunda Ambar, Döviz, Ödeme planı, Yetki kodu doldurulur → yeni satış
          faturası bu değerlerle açılır. Numara, tarih, kur ve satırlar şablondan gelmez.
        </p>
      </div>

      {(['card', 'voucher'] as const).map((group) => (
      <div key={group} className="space-y-2">
      <h2 className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">
        {group === 'card' ? 'Kartlar' : 'Fişler'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CARD_DEFAULT_KINDS.filter((k) => k.group === group).map((kind) => (
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
      ))}
    </div>
  );
};
