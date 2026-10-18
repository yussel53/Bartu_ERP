import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarClock, Download, Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { API_BASE, apiJson } from '../config/api';
import { listSqlReports, SqlReport } from '../api/sqlReportsApi';

interface Schedule {
  id: number;
  reportId: number;
  reportName?: string | null;
  title?: string | null;
  recipients: string;
  frequency: number;
  runHour: number;
  weekDay?: number | null;
  monthDay?: number | null;
  paramsJson?: string | null;
  isActive: boolean;
  lastRunAt?: string | null;
  lastStatus?: string | null;
  nextRunAt?: string | null;
}

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const empty = (): Schedule => ({ id: 0, reportId: 0, title: '', recipients: '', frequency: 1, runHour: 8, weekDay: 1, monthDay: 1, paramsJson: '', isActive: true });
const dt = (v?: string | null) => (v ? new Date(v).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const when = (s: Schedule) =>
  `${s.frequency === 2 ? `Her ${DAYS[(s.weekDay ?? 1) - 1]}` : s.frequency === 3 ? `Her ayın ${s.monthDay ?? 1}. günü` : 'Her gün'} ${String(s.runHour).padStart(2, '0')}:00`;

/** Rapor Üretici → Zamanlanmış Raporlar (Y-13): rapor belirlenen sıklıkta Excel eki ile e-postalanır */
export const ReportSchedulesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [rows, setRows] = useState<Schedule[]>([]);
  const [reports, setReports] = useState<SqlReport[]>([]);
  const [edit, setEdit] = useState<Schedule | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([apiJson<Schedule[]>('/api/report-schedules'), listSqlReports()]);
      setRows(s);
      setReports(r.filter((x) => x.isActive !== false));
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setMsg(null);
    try {
      const text = await fn();
      if (text) setMsg({ text });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run('save', async () => {
      if (!edit) return;
      await apiJson('/api/report-schedules', { method: 'POST', body: JSON.stringify(edit) });
      setEdit(null);
      return 'Zamanlama kaydedildi.';
    });

  const download = (s: Schedule) =>
    run(`dl-${s.id}`, async () => {
      const res = await fetch(`${API_BASE}/api/report-schedules/${s.id}/file`, { credentials: 'include' });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message || 'Dosya üretilemedi');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${s.title || s.reportName || 'rapor'}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

  const field = 'h-7 px-2 border border-slate-300 rounded-sm text-xs';
  const label = (t: string, el: React.ReactNode, cls = '') => (
    <label className={`space-y-0.5 ${cls}`}>
      <span className="block text-[11px] text-slate-500">{t}</span>
      {el}
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-slate-500" /> Zamanlanmış Raporlar
          </h1>
          <p className="text-[12px] text-slate-500">
            SQL raporları belirlenen gün ve saatte Excel eki ile e-postalanır · gönderim sizin mail tanımınızla (CRM → Mail tanımları ya da genel SMTP)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEdit(empty())}
          className="h-7 px-3 rounded-sm bg-blue-700 text-white text-xs font-semibold hover:bg-blue-600 inline-flex items-center gap-1 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" /> Yeni zamanlama
        </button>
      </div>

      {msg && (
        <div className={`px-3 py-1.5 rounded-md text-xs border ${msg.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {msg.text}
        </div>
      )}

      {edit && (
        <div className="bg-white border border-blue-200 rounded-md p-3 space-y-2 text-xs">
          <div className="flex flex-wrap gap-2 items-end">
            {label(
              'Rapor',
              <select value={edit.reportId} onChange={(e) => setEdit({ ...edit, reportId: Number(e.target.value) })} className={`${field} min-w-[220px]`}>
                <option value={0}>— seçin —</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.reportGroup} · {r.name}
                  </option>
                ))}
              </select>,
            )}
            {label('Başlık (e-posta konusu)', <input value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className={`${field} w-56`} />)}
            {label(
              'Alıcılar (virgülle)',
              <input value={edit.recipients} onChange={(e) => setEdit({ ...edit, recipients: e.target.value })} className={`${field} w-72`} />,
              'flex-1',
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            {label(
              'Sıklık',
              <select value={edit.frequency} onChange={(e) => setEdit({ ...edit, frequency: Number(e.target.value) })} className={field}>
                <option value={1}>Günlük</option>
                <option value={2}>Haftalık</option>
                <option value={3}>Aylık</option>
              </select>,
            )}
            {edit.frequency === 2 &&
              label(
                'Gün',
                <select value={edit.weekDay ?? 1} onChange={(e) => setEdit({ ...edit, weekDay: Number(e.target.value) })} className={field}>
                  {DAYS.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>,
              )}
            {edit.frequency === 3 &&
              label(
                'Ayın günü',
                <input type="number" min={1} max={28} value={edit.monthDay ?? 1} onChange={(e) => setEdit({ ...edit, monthDay: Number(e.target.value) })} className={`${field} w-20`} />,
              )}
            {label(
              'Saat',
              <select value={edit.runHour} onChange={(e) => setEdit({ ...edit, runHour: Number(e.target.value) })} className={field}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>,
            )}
            {label(
              'Parametreler (JSON, boş: rapor öndeğerleri)',
              <input
                value={edit.paramsJson ?? ''}
                onChange={(e) => setEdit({ ...edit, paramsJson: e.target.value })}
                placeholder='{"start_date":"prev_month_start","end_date":"prev_month_end"}'
                className={`${field} w-full font-mono`}
              />,
              'flex-1 min-w-[260px]',
            )}
            <label className="inline-flex items-center gap-1 h-7">
              <input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Etkin
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            Tarih anahtarları: boş (bugün), <code>-7 days</code>, <code>month_start</code>, <code>year_start</code>, <code>prev_month_start</code>,{' '}
            <code>prev_month_end</code>.
          </p>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEdit(null)} className="h-7 px-3 rounded-sm border border-slate-300 hover:bg-slate-50">
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!!busy || !edit.reportId || !edit.recipients.trim()}
              className="h-7 px-3 rounded-sm bg-blue-700 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 inline-flex items-center gap-1"
            >
              {busy === 'save' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Kaydet
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-md overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-left">
            <tr>
              {['Rapor', 'Zaman', 'Alıcılar', 'Sonraki', 'Son çalışma', ''].map((h) => (
                <th key={h} className="px-2 py-1.5 font-semibold text-slate-700 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                  Zamanlama yok.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className={`border-b border-slate-100 hover:bg-blue-50/40 ${s.isActive ? '' : 'text-slate-400'}`}>
                <td className="px-2 py-1">
                  <div className="font-medium">{s.title || s.reportName}</div>
                  {s.title && <div className="text-[11px] text-slate-500">{s.reportName}</div>}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">{s.isActive ? when(s) : 'Kapalı'}</td>
                <td className="px-2 py-1 max-w-[260px] truncate" title={s.recipients}>
                  {s.recipients}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">{s.isActive ? dt(s.nextRunAt) : ''}</td>
                <td className="px-2 py-1">
                  <div className="whitespace-nowrap">{dt(s.lastRunAt)}</div>
                  {s.lastStatus && <div className={`text-[11px] ${s.lastStatus.startsWith('Hata') ? 'text-red-700' : 'text-emerald-700'}`}>{s.lastStatus}</div>}
                </td>
                <td className="px-2 py-1 text-right whitespace-nowrap">
                  <button type="button" title="Excel indir (göndermeden)" onClick={() => void download(s)} className="p-1 text-slate-500 hover:text-slate-800">
                    {busy === `dl-${s.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    title="Şimdi gönder"
                    onClick={() =>
                      window.confirm(`«${s.title || s.reportName}» şimdi ${s.recipients} adresine gönderilsin mi?`) &&
                      void run(`send-${s.id}`, async () => (await apiJson<{ message: string }>(`/api/report-schedules/${s.id}/send`, { method: 'POST' })).message)
                    }
                    className="p-1 text-slate-500 hover:text-blue-700"
                  >
                    {busy === `send-${s.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                  <button type="button" title="Düzenle" onClick={() => setEdit({ ...s, paramsJson: s.paramsJson ?? '' })} className="p-1 text-slate-500 hover:text-slate-800">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Sil"
                    onClick={() =>
                      window.confirm('Zamanlama silinsin mi?') &&
                      void run(`del-${s.id}`, async () => {
                        await apiJson(`/api/report-schedules/${s.id}`, { method: 'DELETE' });
                        return 'Silindi.';
                      })
                    }
                    className="p-1 text-slate-500 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
