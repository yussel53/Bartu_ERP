import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import {
  AuthAction,
  FieldAuthFlags,
  ScreenAuthFlags,
  UserAuthProfile,
  fieldKey,
} from '../data/permissions';
import {
  OpTreeNode,
  buildOperationAuthTree,
  collectDescendants,
  nodeMatchesQuery,
} from '../data/operationAuthTree';

interface Props {
  profile: UserAuthProfile;
  companyLabel: string;
  userDisplay: string;
  disabled?: boolean;
  onPatchScreen: (screenId: string, action: AuthAction, value: boolean) => void;
  onSetAllScreen: (screenId: string, value: boolean) => void;
  onPatchField: (tableName: string, fieldName: string, patch: Partial<FieldAuthFlags>) => void;
}

function emptyScreen(): ScreenAuthFlags {
  return { view: false, create: false, update: false, delete: false };
}

function TriCheck({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      className="rounded border-slate-400 shrink-0"
      checked={checked}
      disabled={disabled}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate) && !checked;
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export const OperationAuthTreePanel: React.FC<Props> = ({
  profile,
  companyLabel,
  userDisplay,
  disabled,
  onPatchScreen,
  onSetAllScreen,
  onPatchField,
}) => {
  const tree = useMemo(() => buildOperationAuthTree(), []);
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    // İlk iki seviye açık
    const init: Record<string, boolean> = {};
    for (const m of tree) {
      init[m.id] = true;
      for (const g of m.children || []) init[g.id] = true;
    }
    return init;
  });
  const [q, setQ] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const isActionOn = (screenId: string, action: AuthAction) => {
    if (profile.isAdmin) return true;
    return Boolean((profile.screens[screenId] || emptyScreen())[action]);
  };

  const isFieldOn = (tableName: string, fieldName: string) => {
    if (profile.isAdmin) return true;
    const f = profile.fields[fieldKey(tableName, fieldName)];
    return Boolean(f?.canEdit || f?.canView);
  };

  const setFieldOn = (tableName: string, fieldName: string, on: boolean) => {
    onPatchField(tableName, fieldName, { canView: on, canEdit: on });
  };

  /** Düğüm ve altındaki tüm aksiyon/alan durumunu oku */
  const leafStates = (node: OpTreeNode): boolean[] => {
    const leaves = collectDescendants(node).filter(
      (n) => n.kind === 'action' || n.kind === 'field',
    );
    return leaves.map((n) => {
      if (n.kind === 'action' && n.screenId && n.action) {
        return isActionOn(n.screenId, n.action);
      }
      if (n.kind === 'field' && n.tableName && n.fieldName) {
        return isFieldOn(n.tableName, n.fieldName);
      }
      return false;
    });
  };

  const applyNode = (node: OpTreeNode, value: boolean) => {
    for (const n of collectDescendants(node)) {
      if (n.kind === 'action' && n.screenId && n.action) {
        if (n.action === 'view' || n.action === 'create' || n.action === 'delete') {
          onPatchScreen(n.screenId, n.action, value);
        } else if (n.action === 'update') {
          onPatchScreen(n.screenId, 'update', value);
        }
      }
      if (n.kind === 'field' && n.tableName && n.fieldName) {
        setFieldOn(n.tableName, n.fieldName, value);
      }
      if (n.kind === 'screen' && n.screenId) {
        onSetAllScreen(n.screenId, value);
      }
    }
  };

  const toggleOpen = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const renderNode = (node: OpTreeNode, depth: number): React.ReactNode => {
    if (!nodeMatchesQuery(node, q)) return null;
    const hasKids = Boolean(node.children?.length);
    const isOpen = open[node.id] ?? depth < 2;
    const states = leafStates(node);
    const allOn = states.length > 0 && states.every(Boolean);
    const someOn = states.some(Boolean);
    const isLeafAction = node.kind === 'action' && !hasKids;
    const isLeafField = node.kind === 'field';

    let checked = allOn;
    let indeterminate = someOn && !allOn;
    if (isLeafAction && node.screenId && node.action) {
      checked = isActionOn(node.screenId, node.action);
      indeterminate = false;
    }
    if (isLeafField && node.tableName && node.fieldName) {
      checked = isFieldOn(node.tableName, node.fieldName);
      indeterminate = false;
    }

    const onToggle = (v: boolean) => {
      if (isLeafAction && node.screenId && node.action) {
        onPatchScreen(node.screenId, node.action, v);
        return;
      }
      if (isLeafField && node.tableName && node.fieldName) {
        setFieldOn(node.tableName, node.fieldName, v);
        return;
      }
      applyNode(node, v);
    };

    const highlighted = highlightId === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1 py-[3px] pr-2 rounded cursor-default ${
            highlighted ? 'bg-amber-100' : 'hover:bg-slate-50'
          }`}
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => {
            setHighlightId(node.id);
            if (hasKids) toggleOpen(node.id);
          }}
        >
          <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-slate-400">
            {hasKids ? (
              isOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )
            ) : (
              <span className="w-3.5" />
            )}
          </span>
          <TriCheck
            checked={checked}
            indeterminate={indeterminate}
            disabled={disabled}
            onChange={onToggle}
          />
          <span
            className={`text-[12px] truncate ${
              node.kind === 'module' || node.kind === 'group'
                ? 'font-semibold text-slate-800'
                : node.kind === 'screen'
                  ? 'font-medium text-slate-800'
                  : 'text-slate-700'
            }`}
          >
            {node.label}
          </span>
        </div>
        {hasKids && isOpen && (
          <div>{node.children!.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-[480px]">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="text-[13px] font-semibold text-slate-800">İşlem Yetkileri</div>
        <div className="text-[11px] text-slate-500">
          {companyLabel} / {userDisplay}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1 font-sans">
        {tree.map((n) => renderNode(n, 0))}
      </div>
      <div className="border-t border-slate-200 px-2 py-1.5 flex items-center gap-2 bg-slate-50">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Yetki ağacında ara…"
          className="flex-1 h-7 text-[12px] border border-slate-300 rounded px-2 bg-white"
        />
      </div>
    </div>
  );
};
