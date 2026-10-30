import React, { createContext, Suspense, useContext } from 'react';
import { X, Loader2 } from 'lucide-react';

const LookupCreateDepthContext = createContext(0);

export function useLookupCreateDepth(): number {
  return useContext(LookupCreateDepthContext);
}

/** Döngüsel import kırılır: EntityFormPage → Lookup → QuickCreate → EntityFormPage */
const EntityFormPageLazy = React.lazy(() =>
  import('../pages/EntityFormPage').then((m) => ({ default: m.EntityFormPage })),
);

interface QuickCreateModalProps {
  formCode: string;
  title: string;
  onClose: () => void;
  /** Yeni kayıt (create) — kaydınca onCreated */
  onCreated?: (info: { recordId: number; label?: string }) => void;
  /** Mevcut kartı aç (SAP altın ok / (i) ) */
  mode?: 'create' | 'edit' | 'view';
  recordId?: number | string;
  /** Düzenleme sonrası (opsiyonel) */
  onSaved?: (info: { recordId: number; label?: string }) => void;
}

/** Lookup’tan açılan gömülü kart formu — yeni veya mevcut (i) */
export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  formCode,
  title,
  onClose,
  onCreated,
  mode = 'create',
  recordId,
  onSaved,
}) => {
  const depth = useLookupCreateDepth();
  const isCreate = mode === 'create';
  const rid = recordId != null && String(recordId) !== '' ? String(recordId) : undefined;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6 bg-slate-900/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
            <p className="text-[10px] text-slate-500">
              {isCreate
                ? 'Kaydettikten sonra listeye eklenir ve seçilir'
                : 'Kartı inceleyin / düzenleyin — kapatınca fişe dönersiniz'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/80"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <LookupCreateDepthContext.Provider value={depth + 1}>
            <Suspense
              fallback={
                <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Form yükleniyor…
                </div>
              }
            >
              <EntityFormPageLazy
                formCode={formCode}
                mode={isCreate ? 'create' : mode === 'view' ? 'view' : 'edit'}
                recordId={isCreate ? undefined : rid}
                embedded
                onBack={onClose}
                onSaved={(info) => {
                  if (isCreate) {
                    onCreated?.(info);
                  } else {
                    onSaved?.(info);
                  }
                  onClose();
                }}
              />
            </Suspense>
          </LookupCreateDepthContext.Provider>
        </div>
      </div>
    </div>
  );
};
