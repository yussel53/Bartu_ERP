import React, { useState } from 'react';
import { Banknote, CreditCard, ChevronDown } from 'lucide-react';
import { CustomerVoucherType } from '../data/documentTypes';
import { useAppModules } from '../contexts/AppModulesContext';
import { findScreenByFormCode } from '../utils/findScreenByForm';
import { buildOpenDocHref, createOpenDocId } from '../contexts/OpenDocumentsContext';
import { stashCreatePrefill } from '../utils/createPrefill';
import { appToast } from '../utils/appToast';
import type { DynamicFormDataDto } from '../types/formTypes';

const SOURCE_TABLES = new Set(['Invoice', 'OrderVoucher', 'ProductVoucher']);

interface Props {
  tableName: string;
  recordId: number;
  customerId?: number | null;
  documentNumber?: string | null;
  /** Net / genel tutar */
  amount?: number | null;
  description?: string | null;
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fiş üstünden nakit / kredi kartı tahsilat fişi aç */
export const DocumentCollectionActions: React.FC<Props> = ({
  tableName,
  recordId,
  customerId,
  documentNumber,
  amount,
  description,
}) => {
  const { modules } = useAppModules();
  const [open, setOpen] = useState(false);

  if (!SOURCE_TABLES.has(tableName) || !(recordId > 0)) return null;

  const openCollection = (type: string, label: string) => {
    setOpen(false);
    const screen = findScreenByFormCode(modules, 'CustomerVoucherForm');
    if (!screen?.path) {
      appToast('Cari fiş ekranı menüde bulunamadı', { kind: 'error' });
      return;
    }
    const cust = Number(customerId) || 0;
    const amt = Number(amount) || 0;
    const docNo = String(documentNumber ?? '').trim();
    const desc =
      String(description ?? '').trim() ||
      `${label} ← ${tableName}${docNo ? ` ${docNo}` : ''} #${recordId}`;

    const data: DynamicFormDataDto = {
      recordId: 0,
      standardFields: {
        Type: type,
        Status: '0',
        VoucherDate: todayIso(),
        Description: desc,
        SourceTable: tableName,
        SourceID: recordId,
        ...(cust > 0 ? { CustomerID: cust } : {}),
        ...(amt > 0 ? { Amount: amt } : {}),
      },
      additionalFields: {},
      lines:
        cust > 0 && amt > 0
          ? [
              {
                CustomerID: cust,
                Description: desc,
                Amount: amt,
              },
            ]
          : cust > 0
            ? [{ CustomerID: cust, Description: desc, Amount: 0 }]
            : [],
    };

    const draftId = createOpenDocId('create');
    stashCreatePrefill('CustomerVoucherForm', data);
    window.location.hash = `#/${buildOpenDocHref(screen.path, 'create', { draftId })}`;
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Bu fişten tahsilat / kredi kartı belgesi aç"
        className="inline-flex items-center gap-1 px-2 h-7 text-[11px] font-semibold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100 rounded-sm"
      >
        <Banknote className="w-3.5 h-3.5" />
        Tahsilat
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Kapat" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-md border border-slate-200 bg-white shadow-lg py-1">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-teal-50 flex items-center gap-2"
              onClick={() => openCollection(CustomerVoucherType.NakitTahsilat, 'Nakit Tahsilat')}
            >
              <Banknote className="w-3.5 h-3.5 text-teal-700" />
              Nakit Tahsilat
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-violet-50 flex items-center gap-2"
              onClick={() => openCollection(CustomerVoucherType.KrediKarti, 'Kredi Kartı')}
            >
              <CreditCard className="w-3.5 h-3.5 text-violet-700" />
              Kredi kartı + ödeme linki
            </button>
          </div>
        </>
      )}
    </div>
  );
};
