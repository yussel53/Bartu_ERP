import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Zap } from 'lucide-react';
import {
  addDaysInput,
  crmApi,
  nowLocalInput,
  type CrmAction,
  type CrmActionType,
} from '../api/crmApi';
import { getCurrentUserId } from '../data/permissions';
import { appToast } from '../utils/appToast';
import { appConfirm } from '../utils/appConfirm';

const DOC_TABLES = new Set([
  'Invoice',
  'ProductVoucher',
  'OrderVoucher',
  'SafeVoucher',
  'AccountVoucher',
  'BankVoucher',
  'CustomerVoucher',
  'BoundCard',
]);

export function isDocumentActionTable(table: string): boolean {
  return DOC_TABLES.has(table);
}

interface Props {
  tableName: string;
  recordId: number;
  documentNumber?: string | null;
  customerCardID?: number | null;
  readOnly?: boolean;
}

/** Belge üstünde CRM aksiyonları — kaydetmeden bağımsız, belgeye bağlı */
export const DocumentActionsPanel: React.FC<Props> = ({
  tableName,
  recordId,
  documentNumber,
  customerCardID,
  readOnly,
}) => {
  const [rows, setRows] = useState<CrmAction[]>([]);
  const [types, setTypes] = useState<CrmActionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [actionTypeID, setActionTypeID] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState(addDaysInput(3));

  const reload = useCallback(async () => {
    if (!(recordId > 0) || !isDocumentActionTable(tableName)) return;
    setLoading(true);
    try {
      const list = await crmApi.listActionsBySource(tableName, recordId);
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tableName, recordId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void crmApi
      .lookups()
      .then((l) => setTypes(l.actionTypes || []))
      .catch(() => setTypes([]));
  }, []);

  if (!(recordId > 0) || !isDocumentActionTable(tableName)) return null;

  const save = async () => {
    if (!actionTypeID) {
      appToast('Aksiyon tipi seçin', { kind: 'error' });
      return;
    }
    setBusy(true);
    try {
      await crmApi.saveAction({
        actionID: 0,
        actionTypeID: Number(actionTypeID),
        actionDate: nowLocalInput(),
        dueDate: dueDate || null,
        title: title.trim() || null,
        description: description.trim() || null,
        sourceTable: tableName,
        sourceID: recordId,
        sourceDocNo: documentNumber?.trim() || null,
        customerCardID: customerCardID || null,
        assignedUserID: Number(getCurrentUserId()) || null,
        isDone: false,
      });
      appToast('Aksiyon eklendi');
      setOpenForm(false);
      setTitle('');
      setDescription('');
      await reload();
    } catch (e) {
      appToast(e instanceof Error ? e.message : 'Kaydedilemedi', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 px-2.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-900 dark:text-violet-200">
          <Zap className="w-3.5 h-3.5" />
          Aksiyonlar
          {rows.length > 0 && (
            <span className="text-[10px] font-normal text-violet-600">({rows.length})</span>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setOpenForm((v) => !v)}
            className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-violet-800 bg-white border border-violet-300 hover:bg-violet-50 rounded-sm"
          >
            <Plus className="w-3 h-3" />
            Aksiyon ekle
          </button>
        )}
      </div>

      {openForm && (
        <div className="mb-2 rounded border border-violet-200 bg-white dark:bg-slate-900 p-2 space-y-1.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <label className="text-[11px] text-slate-600 space-y-0.5">
              <span>Tip</span>
              <select
                className="w-full h-7 px-1.5 text-[12px] border border-slate-300 rounded-sm"
                value={actionTypeID}
                onChange={(e) => setActionTypeID(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Seçin…</option>
                {types.map((t) => (
                  <option key={t.actionTypeID} value={t.actionTypeID}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-slate-600 space-y-0.5">
              <span>Konu</span>
              <input
                className="w-full h-7 px-1.5 text-[12px] border border-slate-300 rounded-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn. Ödeme araması"
              />
            </label>
            <label className="text-[11px] text-slate-600 space-y-0.5">
              <span>Vade</span>
              <input
                type="date"
                className="w-full h-7 px-1.5 text-[12px] border border-slate-300 rounded-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>
          <textarea
            className="w-full min-h-[52px] px-1.5 py-1 text-[12px] border border-slate-300 rounded-sm"
            placeholder="Not / sonuç…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              className="px-2 h-7 text-[11px] text-slate-600"
              onClick={() => setOpenForm(false)}
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex items-center gap-1 px-3 h-7 text-[11px] font-semibold text-white bg-violet-700 hover:bg-violet-600 rounded-sm disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Kaydet
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[11px] text-slate-400 inline-flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> yükleniyor…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          Bu belgeye henüz aksiyon yok. Örn. «Ödeme araması yaptık» kaydı ekleyebilirsiniz.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((a) => (
            <li
              key={a.actionID}
              className="flex flex-wrap items-start justify-between gap-2 rounded bg-white dark:bg-slate-900 border border-violet-100 dark:border-violet-900 px-2 py-1.5 text-[11px]"
            >
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  {a.actionTypeTitle || 'Aksiyon'}
                  {a.title ? <span className="font-normal text-slate-500"> · {a.title}</span> : null}
                  {a.isDone && (
                    <span className="ml-1 text-emerald-600 inline-flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> tamam
                    </span>
                  )}
                </div>
                {a.description && (
                  <div className="text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                    {a.description}
                  </div>
                )}
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {a.dueDate ? `Vade ${String(a.dueDate).slice(0, 10)} · ` : ''}
                  {a.assignedUserName || a.createUserName || ''}
                  {a.outlookItemId ? ' · Outlook' : ''}
                </div>
              </div>
              {!readOnly && !a.isDone && (
                <button
                  type="button"
                  className="text-[10px] font-semibold text-emerald-700 hover:underline"
                  onClick={async () => {
                    try {
                      await crmApi.setActionDone(a.actionID, true);
                      appToast('Tamamlandı');
                      void reload();
                    } catch (e) {
                      appToast(e instanceof Error ? e.message : 'Hata', { kind: 'error' });
                    }
                  }}
                >
                  Tamamla
                </button>
              )}
              {!readOnly && (
                <button
                  type="button"
                  className="text-[10px] text-red-600 hover:underline"
                  onClick={async () => {
                    if (!(await appConfirm('Aksiyon silinsin mi?'))) return;
                    try {
                      await crmApi.deleteAction(a.actionID);
                      void reload();
                    } catch (e) {
                      appToast(e instanceof Error ? e.message : 'Silinemedi', { kind: 'error' });
                    }
                  }}
                >
                  Sil
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
