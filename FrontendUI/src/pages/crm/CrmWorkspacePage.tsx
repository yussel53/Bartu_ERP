import React from 'react';
import {
  AlertTriangle,
  ShoppingCart,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FilePlus2,
  FileText,
  Handshake,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Tag,
  Trash2,
  Trophy,
  User,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  OFFER_STATUS,
  OPP_STATUS,
  PRIORITY,
  crmApi,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  isNeedsUpdate,
  type CrmAction,
  type CrmLookups,
  type CrmMail,
  type CrmMeeting,
  type CrmOffer,
  type CrmOpportunity,
  type CrmStats,
} from '../../api/crmApi';
import { getCurrentUserId } from '../../data/permissions';
import { Badge, Btn, Empty, MenuButton, Spinner, errMsg, inputCls } from './CrmUi';
import { OpportunityModal } from './OpportunityModal';
import { ActionModal, MeetingModal } from './ActionMeetingModals';
import { OfferModal, newOfferDraft } from './OfferEditor';
import { MailRow, MailViewer, OfferMailModal } from './MailModals';

type MidTab = 'actions' | 'meetings' | 'mails';

type ModalState =
  | { kind: 'opp'; opp?: CrmOpportunity | null }
  | { kind: 'action'; action?: CrmAction | null; withOffer?: boolean }
  | { kind: 'meeting'; meeting?: CrmMeeting | null; actionId?: number | null }
  | { kind: 'offer'; offer: Partial<CrmOffer>; title: string; readOnly?: boolean }
  | { kind: 'mail'; offer: CrmOffer }
  | { kind: 'viewMail'; mail: CrmMail }
  | null;

const PAGE_SIZE = 25;

function readDeepLinkId(): number | null {
  const m = /\/(\d+)\/?$/.exec(window.location.hash);
  return m ? Number(m[1]) : null;
}

function setDeepLink(basePath: string, id: number | null) {
  const target = `#/${basePath}${id ? `/${id}` : ''}`;
  if (window.location.hash !== target) window.history.replaceState(null, '', target);
}

function ColumnHeader({ icon, title, count, children }: { icon: React.ReactNode; title: string; count?: number; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 h-9 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
      {icon}
      <span>{title}</span>
      {count != null && <span className="ml-0.5 px-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300">{count}</span>}
      <div className="ml-auto flex items-center gap-1">{children}</div>
    </div>
  );
}

function AddBtn({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick} className="w-6 h-6 inline-flex items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700">
      <Plus className="w-3.5 h-3.5" />
    </button>
  );
}

function Kpi({ label, value, tone = 'slate' }: { label: string; value: React.ReactNode; tone?: 'slate' | 'blue' | 'green' | 'red' | 'amber' }) {
  const t = {
    slate: 'text-slate-800 dark:text-slate-100',
    blue: 'text-blue-700',
    green: 'text-emerald-700',
    red: 'text-rose-700',
    amber: 'text-amber-700',
  }[tone];
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 min-w-[110px]">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-[14px] font-semibold tabular-nums ${t}`}>{value}</div>
    </div>
  );
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  phone: <Phone className="w-3.5 h-3.5" />,
  users: <User className="w-3.5 h-3.5" />,
  mail: <Mail className="w-3.5 h-3.5" />,
  fileText: <FileText className="w-3.5 h-3.5" />,
  check: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  x: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
};

export function CrmWorkspacePage({ basePath }: { basePath: string }) {
  const [lookups, setLookups] = React.useState<CrmLookups | null>(null);
  const [needsUpdate, setNeedsUpdate] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<CrmStats | null>(null);

  // filtre
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<number | ''>(0);
  const [mine, setMine] = React.useState(false);
  const [page, setPage] = React.useState(1);

  // veri
  const [opps, setOpps] = React.useState<CrmOpportunity[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loadingOpps, setLoadingOpps] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<number | null>(readDeepLinkId);
  const [opp, setOpp] = React.useState<CrmOpportunity | null>(null);
  const [tag, setTag] = React.useState('');
  const [actions, setActions] = React.useState<CrmAction[] | null>(null);
  const [offers, setOffers] = React.useState<CrmOffer[] | null>(null);
  const [meetings, setMeetings] = React.useState<CrmMeeting[] | null>(null);
  const [mails, setMails] = React.useState<CrmMail[] | null>(null);
  const [selectedActionId, setSelectedActionId] = React.useState<number | null>(null);
  const [expandedOffer, setExpandedOffer] = React.useState<number | null>(null);
  const [tab, setTab] = React.useState<MidTab>('actions');
  const [modal, setModal] = React.useState<ModalState>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 3500);
  };
  const fail = (e: unknown) => {
    if (isNeedsUpdate(e)) setNeedsUpdate(errMsg(e));
    else window.alert(errMsg(e));
  };

  // ── yükleme ───────────────────────────────────────────────────────────
  React.useEffect(() => {
    crmApi
      .lookups()
      .then(setLookups)
      .catch((e) => (isNeedsUpdate(e) ? setNeedsUpdate(errMsg(e)) : setNeedsUpdate(`CRM servisine ulaşılamadı: ${errMsg(e)}`)));
  }, []);

  const loadStats = React.useCallback(() => {
    crmApi.stats(mine ? Number(getCurrentUserId()) : undefined).then(setStats).catch(() => undefined);
  }, [mine]);

  const loadOpps = React.useCallback(async () => {
    setLoadingOpps(true);
    try {
      const r = await crmApi.listOpportunities({
        status: status === '' ? null : status,
        q: q.trim(),
        ownerId: mine ? Number(getCurrentUserId()) : null,
        page,
        pageSize: PAGE_SIZE,
      });
      setOpps(r.items);
      setTotal(r.total);
    } catch (e) {
      if (isNeedsUpdate(e)) setNeedsUpdate(errMsg(e));
    } finally {
      setLoadingOpps(false);
    }
  }, [status, q, mine, page]);

  React.useEffect(() => {
    if (!lookups) return;
    const t = setTimeout(() => void loadOpps(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [lookups, loadOpps, q]);

  React.useEffect(() => {
    if (lookups) loadStats();
  }, [lookups, loadStats]);

  const loadDetail = React.useCallback(async (id: number) => {
    try {
      const [d, a, o, m, ml] = await Promise.all([
        crmApi.getOpportunity(id),
        crmApi.listActions(id),
        crmApi.listOffers(id),
        crmApi.listMeetings(id),
        crmApi.listMails(id),
      ]);
      setOpp(d.opportunity);
      setTag(d.tag);
      setActions(a);
      setOffers(o);
      setMeetings(m);
      setMails(ml);
    } catch (e) {
      setOpp(null);
      fail(e);
    }
  }, []);

  React.useEffect(() => {
    setSelectedActionId(null);
    setExpandedOffer(null);
    setActions(null);
    setOffers(null);
    setMeetings(null);
    setMails(null);
    setDeepLink(basePath, selectedId);
    if (selectedId && lookups) void loadDetail(selectedId);
    else setOpp(null);
  }, [selectedId, lookups, loadDetail, basePath]);

  const refreshAll = async () => {
    await loadOpps();
    loadStats();
    if (selectedId) await loadDetail(selectedId);
  };

  // ── işlemler ──────────────────────────────────────────────────────────
  const closeOpp = async (positive: boolean) => {
    if (!opp || !lookups) return;
    const note = window.prompt(positive ? 'Kazanıldı — kapanış notu (opsiyonel):' : 'Kaybedildi — neden? (opsiyonel):', '');
    if (note === null) return;
    const type = lookups.actionTypes.find((t) => t.closeKind === (positive ? 1 : 2));
    try {
      if (type) await crmApi.saveAction({ opportunityID: opp.opportunityID, actionTypeID: type.actionTypeID, description: note, isDone: true });
      else await crmApi.setOpportunityStatus(opp.opportunityID, positive ? 1 : 2, note);
      flash(positive ? 'Fırsat kazanıldı olarak kapatıldı.' : 'Fırsat kaybedildi olarak kapatıldı.');
      await refreshAll();
    } catch (e) {
      fail(e);
    }
  };

  const reopenOpp = async () => {
    if (!opp) return;
    try {
      await crmApi.setOpportunityStatus(opp.opportunityID, 0);
      await refreshAll();
    } catch (e) {
      fail(e);
    }
  };

  const deleteOpp = async () => {
    if (!opp) return;
    if (!window.confirm(`Fırsat #${opp.opportunityID} ve bağlı tüm aksiyon / teklif / görüşme kayıtları silinsin mi?`)) return;
    try {
      await crmApi.deleteOpportunity(opp.opportunityID);
      setSelectedId(null);
      await loadOpps();
      loadStats();
    } catch (e) {
      fail(e);
    }
  };

  const actionOp = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn();
      if (msg) flash(msg);
      if (selectedId) await loadDetail(selectedId);
      void loadOpps();
      loadStats();
    } catch (e) {
      fail(e);
    }
  };

  const openOffer = (o: CrmOffer, mode: 'view' | 'edit') =>
    setModal({
      kind: 'offer',
      offer: o,
      title: `Teklif ${o.docNum}${o.revisionNo ? `-R${o.revisionNo}` : ''}${mode === 'view' ? ' · Detay' : ' · Güncelle'}`,
      readOnly: mode === 'view',
    });

  const visibleOffers = React.useMemo(
    () => (offers || []).filter((o) => !selectedActionId || o.actionID === selectedActionId),
    [offers, selectedActionId],
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const today = new Date().toISOString().slice(0, 10);

  if (needsUpdate) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">Teklif Yönetimi kurulumu tamamlanmadı</h2>
        <p className="text-[12px] text-slate-600 dark:text-slate-300 mt-1">{needsUpdate}</p>
        <div className="mt-3 flex justify-center gap-2">
          <Btn variant="primary" onClick={() => (window.location.hash = '#/sistem')}>
            Sistem Yönetimi'ne git
          </Btn>
          <Btn icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => window.location.reload()}>
            Tekrar dene
          </Btn>
        </div>
      </div>
    );
  }
  if (!lookups) return <Spinner />;

  return (
    <div className="space-y-2.5">
      {/* KPI + filtre */}
      <div className="flex flex-wrap items-end gap-2">
        {stats && (
          <div className="flex flex-wrap gap-2 mr-auto">
            <Kpi label="Açık fırsat" value={stats.openCount} tone="blue" />
            <Kpi label="Açık potansiyel" value={fmtMoney(stats.openAmount)} />
            <Kpi label="Kazanılan" value={`${stats.wonCount} · ${fmtMoney(stats.wonAmount)}`} tone="green" />
            <Kpi label="Kaybedilen" value={stats.lostCount} tone="red" />
            <Kpi label="Geciken aksiyon" value={stats.overdueActions} tone={stats.overdueActions ? 'amber' : 'slate'} />
            <Kpi label="Bekleyen teklif" value={stats.openOffers} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/30 px-2.5 py-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputCls} pl-7`}
            placeholder="Fırsat, cari, kişi, fırsat no veya teklif no ara…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className={`${inputCls} w-40`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value === '' ? '' : Number(e.target.value));
            setPage(1);
          }}
        >
          <option value={0}>Açık fırsatlar</option>
          <option value={1}>Kazanılanlar</option>
          <option value={2}>Kaybedilenler</option>
          <option value={9}>Kapanmış (tümü)</option>
          <option value="">Tümü</option>
        </select>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => {
              setMine(e.target.checked);
              setPage(1);
            }}
          />
          Sadece benim
        </label>
        <Btn icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => void refreshAll()}>
          Yenile
        </Btn>
        <Btn variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModal({ kind: 'opp', opp: null })}>
          Yeni Fırsat
        </Btn>
      </div>

      {/* 3 kolon: Fırsatlar · Aksiyon/Görüşme/Mail · Teklifler */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 lg:h-[calc(100vh-260px)] lg:min-h-[520px]">
        {/* KOLON 1 — FIRSATLAR */}
        <section className="lg:col-span-3 flex flex-col rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden min-h-[300px]">
          <ColumnHeader icon={<Handshake className="w-3.5 h-3.5" />} title="Fırsatlar" count={total} />
          <div className="flex-1 overflow-y-auto">
            {loadingOpps && opps.length === 0 ? (
              <Spinner />
            ) : opps.length === 0 ? (
              <Empty>
                Kayıt yok.
                <br />
                <button type="button" className="mt-1 text-blue-600 font-medium" onClick={() => setModal({ kind: 'opp', opp: null })}>
                  + Yeni fırsat
                </button>
              </Empty>
            ) : (
              opps.map((o) => {
                const active = o.opportunityID === selectedId;
                const overdue = o.nextDueDate && o.nextDueDate.slice(0, 10) < today && o.status === 0;
                return (
                  <button
                    key={o.opportunityID}
                    type="button"
                    onClick={() => setSelectedId(o.opportunityID)}
                    className={`w-full text-left px-2.5 py-2 border-b border-slate-100 dark:border-slate-800 border-l-[3px] ${
                      active ? 'bg-blue-50/80 dark:bg-blue-900/20 border-l-blue-600' : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="font-mono font-semibold text-slate-500">#{o.opportunityID}</span>
                      <span className="text-slate-400">{fmtDate(o.createDate)}</span>
                      <span className={`ml-auto font-medium ${PRIORITY[o.priority]?.cls || ''}`}>{o.priority === 1 ? '● Yüksek' : ''}</span>
                      {o.status !== 0 && <Badge className={OPP_STATUS[o.status]?.cls || ''}>{OPP_STATUS[o.status]?.label}</Badge>}
                    </div>
                    <div className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">{o.title}</div>
                    <div className="text-[11.5px] text-slate-500 truncate">{o.customerTitle || o.contactName || '—'}</div>
                    <div className="flex items-center gap-2.5 mt-1 text-[10.5px] text-slate-500">
                      <span title="Aksiyon" className="inline-flex items-center gap-0.5">
                        <Zap className="w-3 h-3" /> {o.actionCount}
                      </span>
                      <span title="Teklif" className="inline-flex items-center gap-0.5">
                        <FileText className="w-3 h-3" /> {o.offerCount}
                      </span>
                      <span title="Görüşme" className="inline-flex items-center gap-0.5">
                        <MessageSquare className="w-3 h-3" /> {o.meetingCount}
                      </span>
                      <span title="Mail" className="inline-flex items-center gap-0.5">
                        <Mail className="w-3 h-3" /> {o.mailCount}
                      </span>
                      {o.lastOfferTotal != null && <span className="ml-auto font-medium text-slate-700 dark:text-slate-200 tabular-nums">{fmtMoney(o.lastOfferTotal)}</span>}
                    </div>
                    {overdue && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-amber-700">
                        <CalendarClock className="w-3 h-3" /> Geciken aksiyon ({fmtDate(o.nextDueDate)})
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between px-2.5 h-8 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 disabled:opacity-40">
              ‹ Önceki
            </button>
            <span>
              {page} / {pages}
            </span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-2 disabled:opacity-40">
              Sonraki ›
            </button>
          </div>
        </section>

        {/* KOLON 2 — FIRSAT DETAY + AKSİYON / GÖRÜŞME / MAİL */}
        <section className="lg:col-span-5 flex flex-col rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden min-h-[300px]">
          {!selectedId ? (
            <>
              <ColumnHeader icon={<Zap className="w-3.5 h-3.5" />} title="Aksiyonlar" />
              <Empty>Soldan bir fırsat seçin.</Empty>
            </>
          ) : !opp ? (
            <Spinner />
          ) : (
            <>
              {/* fırsat başlığı */}
              <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[11px] text-slate-500">#{opp.opportunityID}</span>
                      <Badge className={OPP_STATUS[opp.status]?.cls || ''}>{OPP_STATUS[opp.status]?.label}</Badge>
                      {opp.oppType && <Badge className="bg-white text-slate-500 border-slate-200">{opp.oppType}</Badge>}
                      <span
                        className="inline-flex items-center gap-1 text-[10.5px] font-mono text-violet-700 bg-violet-50 border border-violet-200 rounded px-1.5 cursor-pointer"
                        title="Outlook konu etiketi — tıklayınca kopyalanır"
                        onClick={() => {
                          void navigator.clipboard?.writeText(tag);
                          flash(`${tag} kopyalandı`);
                        }}
                      >
                        <Tag className="w-3 h-3" /> {tag}
                      </span>
                    </div>
                    <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{opp.title}</h2>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-slate-500 mt-0.5">
                      {opp.customerTitle && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {opp.customerTitle}
                        </span>
                      )}
                      {(opp.contactName || opp.contactEmail) && (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" /> {[opp.contactName, opp.contactEmail, opp.contactPhone].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      {opp.expectedAmount != null && <span>Beklenen: {fmtMoney(opp.expectedAmount, opp.currencyCode)}</span>}
                      {opp.probability != null && <span>%{opp.probability}</span>}
                      {opp.ownerName && <span>Sorumlu: {opp.ownerName}</span>}
                    </div>
                    {opp.closeNote && opp.status !== 0 && <div className="text-[11.5px] text-slate-600 mt-1 italic">Kapanış: {opp.closeNote}</div>}
                  </div>
                  <MenuButton
                    items={[
                      { label: 'Düzenle', icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => setModal({ kind: 'opp', opp }) },
                      { label: 'Yeni aksiyon', icon: <Zap className="w-3.5 h-3.5" />, onClick: () => setModal({ kind: 'action' }) },
                      { label: 'Yeni teklif', icon: <FilePlus2 className="w-3.5 h-3.5" />, onClick: () => setModal({ kind: 'action', withOffer: true }) },
                      { label: 'Görüşme ekle', icon: <MessageSquare className="w-3.5 h-3.5" />, onClick: () => setModal({ kind: 'meeting' }) },
                      'sep',
                      { label: 'Kazanıldı (olumlu kapat)', icon: <Trophy className="w-3.5 h-3.5 text-emerald-600" />, onClick: () => void closeOpp(true), hidden: opp.status !== 0 },
                      { label: 'Kaybedildi (olumsuz kapat)', icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />, onClick: () => void closeOpp(false), hidden: opp.status !== 0 },
                      { label: 'Yeniden aç', icon: <RotateCcw className="w-3.5 h-3.5" />, onClick: () => void reopenOpp(), hidden: opp.status === 0 },
                      'sep',
                      { label: 'Sil', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => void deleteOpp() },
                    ]}
                  />
                </div>
              </div>

              {/* sekmeler */}
              <div className="flex items-center gap-0.5 px-2 h-9 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                {(
                  [
                    ['actions', 'Aksiyonlar', actions?.length, <Zap key="a" className="w-3.5 h-3.5" />],
                    ['meetings', 'Görüşmeler', meetings?.length, <MessageSquare key="m" className="w-3.5 h-3.5" />],
                    ['mails', 'Mailler', mails?.length, <Mail key="e" className="w-3.5 h-3.5" />],
                  ] as [MidTab, string, number | undefined, React.ReactNode][]
                ).map(([k, label, n, icon]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={`inline-flex items-center gap-1 h-7 px-2.5 rounded text-[12px] font-medium ${
                      tab === k ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-700 border border-slate-200 dark:border-slate-700' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60'
                    }`}
                  >
                    {icon} {label}
                    {n != null && <span className="text-[10px] text-slate-400">({n})</span>}
                  </button>
                ))}
                <div className="ml-auto">
                  {tab === 'actions' && <AddBtn title="Yeni aksiyon" onClick={() => setModal({ kind: 'action' })} />}
                  {tab === 'meetings' && <AddBtn title="Yeni görüşme" onClick={() => setModal({ kind: 'meeting' })} />}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {tab === 'actions' &&
                  (actions == null ? (
                    <Spinner />
                  ) : actions.length === 0 ? (
                    <Empty>Bu fırsata ait aksiyon yok.</Empty>
                  ) : (
                    actions.map((a) => {
                      const active = a.actionID === selectedActionId;
                      const overdue = !a.isDone && a.dueDate && a.dueDate.slice(0, 10) < today;
                      return (
                        <div
                          key={a.actionID}
                          onClick={() => setSelectedActionId(active ? null : a.actionID)}
                          className={`px-2.5 py-2 border-b border-slate-100 dark:border-slate-800 cursor-pointer border-l-[3px] ${
                            active ? 'bg-blue-50/80 dark:bg-blue-900/20 border-l-blue-600' : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="text-slate-600 dark:text-slate-300">{ACTION_ICON[a.actionTypeIcon || ''] || <Zap className="w-3.5 h-3.5" />}</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{a.actionTypeTitle || 'Aksiyon'}</span>
                            <span>{fmtDateTime(a.actionDate)}</span>
                            <span className="ml-auto" />
                            {a.isDone ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                <Check className="w-3 h-3" /> Tamam
                              </Badge>
                            ) : (
                              <Badge className={overdue ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-slate-200'}>
                                Vade {fmtDate(a.dueDate)}
                              </Badge>
                            )}
                            <MenuButton
                              items={[
                                { label: 'Detay / düzenle', icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => setModal({ kind: 'action', action: a }) },
                                {
                                  label: 'Teklif ekle',
                                  icon: <FilePlus2 className="w-3.5 h-3.5" />,
                                  onClick: () =>
                                    setModal({
                                      kind: 'offer',
                                      offer: { ...newOfferDraft(opp.opportunityID, lookups, opp.currencyID), actionID: a.actionID },
                                      title: 'Yeni Teklif',
                                    }),
                                },
                                { label: 'Görüşme notu ekle', icon: <MessageSquare className="w-3.5 h-3.5" />, onClick: () => setModal({ kind: 'meeting', actionId: a.actionID }) },
                                'sep',
                                a.isDone
                                  ? { label: 'Tamamlanmadı olarak işaretle', icon: <RotateCcw className="w-3.5 h-3.5" />, onClick: () => void actionOp(() => crmApi.setActionDone(a.actionID, false)) }
                                  : { label: 'Tamamlandı', icon: <Check className="w-3.5 h-3.5" />, onClick: () => void actionOp(() => crmApi.setActionDone(a.actionID, true)) },
                                'sep',
                                {
                                  label: 'Sil',
                                  icon: <Trash2 className="w-3.5 h-3.5" />,
                                  danger: true,
                                  onClick: () => {
                                    if (window.confirm('Aksiyon ve bağlı teklifler silinsin mi?')) void actionOp(() => crmApi.deleteAction(a.actionID), 'Aksiyon silindi.');
                                  },
                                },
                              ]}
                            />
                          </div>
                          {a.description && <div className="text-[12px] text-slate-700 dark:text-slate-200 mt-0.5 whitespace-pre-wrap line-clamp-3">{a.description}</div>}
                          <div className="flex flex-wrap gap-x-3 text-[10.5px] text-slate-400 mt-0.5">
                            {a.contactName && <span>Kişi: {a.contactName}</span>}
                            {a.assignedUserName && <span>Sorumlu: {a.assignedUserName}</span>}
                            {(a.offerCount ?? 0) > 0 && <span className="text-blue-600">{a.offerCount} teklif</span>}
                          </div>
                        </div>
                      );
                    })
                  ))}

                {tab === 'meetings' &&
                  (meetings == null ? (
                    <Spinner />
                  ) : meetings.length === 0 ? (
                    <Empty>Görüşme kaydı yok.</Empty>
                  ) : (
                    meetings.map((m) => (
                      <div key={m.meetingID} className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Phone className="w-3.5 h-3.5" />
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{m.channel}</span>
                          <span>{m.direction === 1 ? 'Gelen' : 'Giden'}</span>
                          <span>{fmtDateTime(m.meetingDate)}</span>
                          {m.durationMin ? <span>{m.durationMin} dk</span> : null}
                          <span className="ml-auto" />
                          <MenuButton
                            items={[
                              { label: 'Düzenle', icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => setModal({ kind: 'meeting', meeting: m }) },
                              {
                                label: 'Sil',
                                icon: <Trash2 className="w-3.5 h-3.5" />,
                                danger: true,
                                onClick: () => {
                                  if (window.confirm('Görüşme silinsin mi?')) void actionOp(() => crmApi.deleteMeeting(m.meetingID));
                                },
                              },
                            ]}
                          />
                        </div>
                        {m.subject && <div className="text-[12.5px] font-medium text-slate-800 dark:text-slate-100 mt-0.5">{m.subject}</div>}
                        {m.notes && <div className="text-[12px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{m.notes}</div>}
                        <div className="flex flex-wrap gap-x-3 text-[10.5px] text-slate-400 mt-0.5">
                          {m.contactName && <span>Kişi: {m.contactName}</span>}
                          {m.createUserName && <span>Kaydeden: {m.createUserName}</span>}
                          {m.nextStep && (
                            <span className="text-blue-600">
                              Sonraki adım: {m.nextStep}
                              {m.nextStepDate ? ` (${fmtDate(m.nextStepDate)})` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ))}

                {tab === 'mails' &&
                  (mails == null ? (
                    <Spinner />
                  ) : mails.length === 0 ? (
                    <Empty>
                      Yazışma yok. Teklif menüsünden “Mail gönder” deyin; müşterinin yanıtları
                      <br />
                      Outlook CRM eklentisi ile konu etiketi <b>{tag}</b> üzerinden buraya düşer.
                    </Empty>
                  ) : (
                    mails.map((m) => <MailRow key={m.mailLogID} m={m} onOpen={(x) => setModal({ kind: 'viewMail', mail: x })} />)
                  ))}
              </div>
            </>
          )}
        </section>

        {/* KOLON 3 — TEKLİFLER */}
        <section className="lg:col-span-4 flex flex-col rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden min-h-[300px]">
          <ColumnHeader icon={<FileText className="w-3.5 h-3.5" />} title="Teklifler" count={opp ? visibleOffers.length : undefined}>
            {opp && (
              <AddBtn
                title="Yeni teklif"
                onClick={() =>
                  setModal({
                    kind: 'offer',
                    offer: { ...newOfferDraft(opp.opportunityID, lookups, opp.currencyID), actionID: selectedActionId },
                    title: 'Yeni Teklif',
                  })
                }
              />
            )}
          </ColumnHeader>
          {selectedActionId && (
            <div className="flex items-center gap-2 px-2.5 py-1 text-[11px] bg-blue-50 text-blue-700 border-b border-blue-100">
              Seçili aksiyonun teklifleri
              <button type="button" className="ml-auto underline" onClick={() => setSelectedActionId(null)}>
                Tümünü göster
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {!opp ? (
              <Empty>Fırsat seçin.</Empty>
            ) : offers == null ? (
              <Spinner />
            ) : visibleOffers.length === 0 ? (
              <Empty>Teklif yok.</Empty>
            ) : (
              visibleOffers.map((o) => {
                const exp = expandedOffer === o.offerID;
                const expired = o.validityDate && o.validityDate.slice(0, 10) < today && (o.status === 0 || o.status === 1);
                return (
                  <div key={o.offerID} className={`rounded-md border ${o.status === 4 ? 'border-slate-200 opacity-70' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900`}>
                    <div className="flex items-center gap-1.5 px-2 pt-1.5">
                      <button type="button" className="p-0.5 text-slate-400 hover:text-slate-700" onClick={() => setExpandedOffer(exp ? null : o.offerID)}>
                        {exp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                      <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
                        No {o.docNum}
                        {o.revisionNo ? <span className="text-amber-600">-R{o.revisionNo}</span> : null}
                      </span>
                      <span className="text-[11px] text-slate-400">{fmtDate(o.offerDate)}</span>
                      <Badge className={OFFER_STATUS[o.status]?.cls || ''}>{OFFER_STATUS[o.status]?.label}</Badge>
                      {(o.mailCount ?? 0) > 0 && (
                        <button type="button" onClick={() => setModal({ kind: 'mail', offer: o })} title="Yazışmalar">
                          <Badge className="bg-violet-50 text-violet-700 border-violet-200">
                            <Mail className="w-3 h-3" /> {o.mailCount}
                          </Badge>
                        </button>
                      )}
                      <span className="ml-auto" />
                      <MenuButton
                        items={[
                          { label: 'Detay', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => openOffer(o, 'view') },
                          { label: 'Güncelle', icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => openOffer(o, 'edit'), hidden: o.status === 4 },
                          { label: 'Yazdır / PDF', icon: <Printer className="w-3.5 h-3.5" />, onClick: () => window.open(crmApi.offerPrintUrl(o.offerID), '_blank') },
                          { label: 'Mail gönder / geçmiş', icon: <Send className="w-3.5 h-3.5" />, onClick: () => setModal({ kind: 'mail', offer: o }) },
                          'sep',
                          { label: 'Revize et', icon: <RotateCcw className="w-3.5 h-3.5" />, onClick: () => void actionOp(() => crmApi.reviseOffer(o.offerID), 'Revizyon oluşturuldu.'), hidden: o.status === 4 },
                          { label: 'Kopyala', icon: <Copy className="w-3.5 h-3.5" />, onClick: () => void actionOp(() => crmApi.copyOffer(o.offerID), 'Teklif kopyalandı.') },
                          {
                            label: o.orderVoucherID ? 'Siparişe dönüştürüldü' : 'Siparişe Dönüştür',
                            icon: <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />,
                            hidden: o.status === 4 || o.status === 3,
                            onClick: () => {
                              if (o.orderVoucherID) {
                                flash('Bu teklif zaten satış siparişine dönüştürülmüş.');
                                return;
                              }
                              if (!window.confirm(`Teklif ${o.docNum} satış siparişine dönüştürülsün mü?
Teklif onaylanır, fırsat kazanıldı olur; müşteri cariye döner.`)) return;
                              void actionOp(async () => {
                                const r = await crmApi.offerToOrder(o.offerID);
                                flash(r.message);
                              });
                            },
                          },
                          'sep',
                          { label: 'Onaylandı', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />, onClick: () => void actionOp(() => crmApi.setOfferStatus(o.offerID, 2)), hidden: o.status === 2 },
                          { label: 'Reddedildi', icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />, onClick: () => void actionOp(() => crmApi.setOfferStatus(o.offerID, 3)), hidden: o.status === 3 },
                          { label: 'Gönderildi', icon: <Send className="w-3.5 h-3.5" />, onClick: () => void actionOp(() => crmApi.setOfferStatus(o.offerID, 1)), hidden: o.status !== 0 },
                          'sep',
                          {
                            label: 'Sil',
                            icon: <Trash2 className="w-3.5 h-3.5" />,
                            danger: true,
                            onClick: () => {
                              if (window.confirm(`Teklif ${o.docNum} silinsin mi?`)) void actionOp(() => crmApi.deleteOffer(o.offerID), 'Teklif silindi.');
                            },
                          },
                        ]}
                      />
                    </div>
                    <div className="px-2.5 pb-2 pt-0.5 cursor-pointer" onClick={() => setExpandedOffer(exp ? null : o.offerID)}>
                      {o.description && <div className="text-[12px] text-slate-600 dark:text-slate-300 truncate">{o.description}</div>}
                      <div className="flex items-end justify-between mt-0.5">
                        <span className={`text-[11px] ${expired ? 'text-amber-700' : 'text-slate-400'}`}>
                          Geçerlilik: {fmtDate(o.validityDate)} · {o.lines.length} kalem
                        </span>
                        <span className="text-[13px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">{fmtMoney(o.grandTotal, o.currencyCode)}</span>
                      </div>
                    </div>
                    {exp && (
                      <div className="border-t border-slate-100 dark:border-slate-800 px-2 py-1.5">
                        <table className="w-full text-[11px]">
                          <thead className="text-slate-400">
                            <tr>
                              <th className="text-left font-medium">Ürün</th>
                              <th className="text-right font-medium">Miktar</th>
                              <th className="text-right font-medium">Fiyat</th>
                              <th className="text-right font-medium">Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.lines.map((l) => (
                              <tr key={l.offerLineID} className="border-t border-slate-50">
                                <td className="py-0.5 pr-1 truncate max-w-[160px]">{l.description || l.productCode}</td>
                                <td className="text-right">
                                  {l.quantity} {l.unitName}
                                </td>
                                <td className="text-right tabular-nums">{fmtMoney(l.price)}</td>
                                <td className="text-right tabular-nums">{fmtMoney(l.netTotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="text-right text-[11px] text-slate-500 mt-1">
                          Ara {fmtMoney(o.subTotal)} {o.generalDiscount ? `· Gnl. isk. ${fmtMoney(o.generalDiscount)}` : ''} · KDV {fmtMoney(o.vatTotal)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-[60] rounded-md bg-slate-900 text-white text-[12px] px-3 py-2 shadow-lg">{toast}</div>
      )}

      {/* modallar */}
      {modal?.kind === 'opp' && (
        <OpportunityModal
          initial={modal.opp}
          lookups={lookups}
          onClose={() => setModal(null)}
          onSaved={async (id) => {
            setModal(null);
            flash('Fırsat kaydedildi.');
            await loadOpps();
            loadStats();
            if (id === selectedId) await loadDetail(id);
            else setSelectedId(id);
          }}
        />
      )}
      {modal?.kind === 'action' && opp && (
        <ActionModal
          opportunity={opp}
          initial={modal.action}
          withOffer={modal.withOffer}
          lookups={lookups}
          onClose={() => setModal(null)}
          onSaved={async (r) => {
            setModal(null);
            flash(r.closed === 'won' ? 'Aksiyon kaydedildi, fırsat KAZANILDI.' : r.closed === 'lost' ? 'Aksiyon kaydedildi, fırsat kaybedildi.' : 'Aksiyon kaydedildi.');
            await refreshAll();
            if (r.offerId) setSelectedActionId(r.id);
          }}
        />
      )}
      {modal?.kind === 'meeting' && opp && (
        <MeetingModal
          opportunity={opp}
          initial={modal.meeting}
          actionId={modal.actionId}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            setTab('meetings');
            flash('Görüşme kaydedildi.');
            await refreshAll();
          }}
        />
      )}
      {modal?.kind === 'offer' && opp && (
        <OfferModal
          initial={modal.offer}
          title={modal.title}
          readOnly={modal.readOnly}
          lookups={lookups}
          customerId={opp.customerCardID}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            flash('Teklif kaydedildi.');
            await refreshAll();
          }}
        />
      )}
      {modal?.kind === 'mail' && (
        <OfferMailModal
          offer={modal.offer}
          lookups={lookups}
          onClose={() => setModal(null)}
          onChanged={() => {
            if (selectedId) void loadDetail(selectedId);
          }}
        />
      )}
      {modal?.kind === 'viewMail' && <MailViewer mail={modal.mail} onClose={() => setModal(null)} />}
    </div>
  );
}
