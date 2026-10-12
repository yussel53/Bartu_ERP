import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

const PLACEHOLDERS: { token: string; desc: string }[] = [
  { token: '{recId}', desc: 'Kayıt kimliği (primary key / SCOPE_IDENTITY)' },
  { token: '{ID}', desc: '{recId} ile aynı' },
  { token: '{pk}', desc: 'Tablo PK değeri (InvoiceID, ProductVoucherID…)' },
  { token: '{Code}', desc: 'Kart/fiş kodu (Code, CompanyCode, WhouseCode…)' },
  { token: '{Title}', desc: 'Ünvan / ad (Title, Name…)' },
  { token: '{DocumentNumber}', desc: 'Belge / fatura / fiş numarası' },
  { token: '{VoucherNo}', desc: 'Fiş no (DocumentNumber ile eşlenir)' },
  { token: '{InvoiceNo}', desc: 'Fatura no' },
  { token: '{FicheNo}', desc: 'Fiş no' },
  { token: '{DocumentDate}', desc: 'Belge tarihi' },
  { token: '{VoucherDate}', desc: 'Fiş tarihi' },
  { token: '{CustomerID}', desc: 'Cari kart ID' },
  { token: '{ProductID}', desc: 'Malzeme kart ID' },
  { token: '{WhouseID}', desc: 'Ambar ID' },
  { token: '{CompanyID}', desc: 'Firma ID' },
  { token: '{WorkplaceID}', desc: 'İşyeri ID' },
  { token: '{Status}', desc: 'Durum (Status_ / Status)' },
  { token: '{AlanAdi}', desc: 'Formdaki herhangi bir standart alan adı' },
];

const EXAMPLES = [
  {
    title: 'SQL — fatura durumu',
    cmd: 'UPDATE dbo.Invoice SET Status_ = 1 WHERE InvoiceID = {recId}',
  },
  {
    title: 'SQL — kod ile güncelle',
    cmd: "UPDATE dbo.ProductCard SET IsActive = 1 WHERE Code = '{Code}'",
  },
  {
    title: 'API — kayıt ID ile',
    cmd: 'POST /api/records/Invoice/{recId}/approve',
  },
  {
    title: 'API — fiş no ile',
    cmd: 'GET https://entegrator.ornek/api/send?no={DocumentNumber}&id={recId}',
  },
];

/** Kaydet sonrası komut formu — yer tutucu yardım paneli */
export const PostSaveHelpButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[12px] font-semibold rounded-md border border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100"
        title="Yer tutucu ve örnek komut yardımı"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        Yardım
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div>
                <div className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">
                  Kaydet Sonrası — Yer Tutucular
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Komut içinde {'{AlanAdi}'} yazın; kayıt sonrası otomatik doldurulur.
                </div>
              </div>
              <button
                type="button"
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-auto p-4 space-y-4 text-[12px]">
              <section>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                  Kimlik / Kod / Fiş
                </h4>
                <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-500">
                      <tr>
                        <th className="px-2.5 py-1.5 font-semibold">Yer tutucu</th>
                        <th className="px-2.5 py-1.5 font-semibold">Açıklama</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {PLACEHOLDERS.map((p) => (
                        <tr key={p.token} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="px-2.5 py-1.5 font-mono text-[11px] text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
                            {p.token}
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300">{p.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                  Örnek komutlar
                </h4>
                <ul className="space-y-2">
                  {EXAMPLES.map((ex) => (
                    <li
                      key={ex.title}
                      className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-800/50"
                    >
                      <div className="text-[11px] font-semibold text-slate-600 mb-1">{ex.title}</div>
                      <code className="block text-[11px] font-mono text-slate-800 dark:text-slate-200 break-all">
                        {ex.cmd}
                      </code>
                    </li>
                  ))}
                </ul>
              </section>

              <p className="text-[11px] text-slate-500 leading-snug">
                SQL: yalnızca <strong>UPDATE / INSERT / EXEC</strong>. API: <strong>GET|POST|PUT …</strong> URL.
                Form alanının gerçek adı da kullanılabilir (ör. {'{InvoiceID}'}, {'{TaxNumber}'}).
              </p>
            </div>

            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 px-3 text-[12px] font-semibold rounded-md bg-slate-800 text-white hover:bg-slate-700"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
