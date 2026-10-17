import React, { useEffect, useState } from 'react';
import { Send, Users } from 'lucide-react';
import { ApprovalGroup, listApprovalGroups, memberLabel } from '../api/approvalGroupsApi';
import { sendEGovIncoming } from '../api/egovIncomingApi';

interface Props {
  egovId: number;
  documentNo?: string | null;
  customerTitle?: string | null;
  userId: number;
  onClose: () => void;
  onSent: (message: string) => void;
}

/** Gelen e-fatura → «Onaya Gönder»: onay açıklaması + onay grubu (grubun herhangi bir üyesi onaylar) */
export const EGovSendApprovalModal: React.FC<Props> = ({ egovId, documentNo, customerTitle, userId, onClose, onSent }) => {
  const [groups, setGroups] = useState<ApprovalGroup[] | null>(null);
  const [groupsReady, setGroupsReady] = useState(true);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listApprovalGroups(true)
      .then((r) => {
        setGroupsReady(r.ready);
        // Üyesi olmayan grup seçilemez
        const usable = r.rows.filter((g) => g.members.length > 0);
        setGroups(usable);
        setGroupId((usable.find((g) => g.isDefault) ?? usable[0])?.approvalGroupID ?? null);
      })
      .catch((e) => {
        setGroups([]);
        setError(e instanceof Error ? e.message : 'Onay grupları okunamadı');
      });
  }, []);

  const selected = groups?.find((g) => g.approvalGroupID === groupId);
  const canSend = !busy && note.trim().length > 0 && (!groupsReady || groupId != null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await sendEGovIncoming(egovId, userId, note.trim(), groupsReady ? groupId : null);
      onSent(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-md bg-white shadow-xl p-5 space-y-3" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900">Onaya Gönder</h3>
        <p className="text-[12px] text-slate-600">
          {documentNo} · {customerTitle}
        </p>

        <label className="block space-y-1">
          <span className="text-[12px] text-slate-600">Onay açıklaması*</span>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Örn. Mal kabulü yapıldı, sipariş 2026/145 ile uyumlu."
            className="w-full px-2 py-1 text-[12px] rounded-sm border border-slate-300 bg-white"
          />
        </label>

        {groupsReady ? (
          <div className="space-y-1">
            <span className="text-[12px] text-slate-600">Onay grubu*</span>
            {groups == null ? (
              <div className="text-[12px] text-slate-400">Yükleniyor…</div>
            ) : groups.length === 0 ? (
              <div className="rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
                Üyesi olan aktif onay grubu yok — E-Devlet → Tanımlar → Onay Grupları ekranından grup ve üye ekleyin.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => (
                  <button
                    key={g.approvalGroupID}
                    type="button"
                    onClick={() => setGroupId(g.approvalGroupID)}
                    className={`px-2.5 h-7 text-[12px] rounded-sm border ${g.approvalGroupID === groupId ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <div className="flex items-start gap-1 text-[11px] text-slate-500">
                <Users className="w-3 h-3 mt-0.5 shrink-0" />
                <span>Onaylayabilecekler: {selected.members.map(memberLabel).join(', ')}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">
            Onay grupları kurulu değil (78_approval_groups.sql) — fatura onay sürecindeki role gider.
          </p>
        )}

        {error && <div className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-3 h-8 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => void send()}
            className="inline-flex items-center gap-1 px-3 h-8 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" /> Onaya Gönder
          </button>
        </div>
      </div>
    </div>
  );
};
