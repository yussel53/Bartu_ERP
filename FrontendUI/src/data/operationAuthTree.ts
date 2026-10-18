import { APP_MODULES } from './modules';
import { FORM_SCHEMAS } from './formSchemas';
import { getExtraFields } from './extraFields';
import { AuthAction } from './permissions';
import type { MenuScreen } from '../types/formTypes';

export type OpNodeKind = 'module' | 'group' | 'screen' | 'action' | 'field' | 'folder';

export interface OpTreeNode {
  id: string;
  kind: OpNodeKind;
  label: string;
  /** screen aksiyonu */
  screenId?: string;
  action?: AuthAction;
  /** alan yetkisi */
  tableName?: string;
  fieldName?: string;
  children?: OpTreeNode[];
}

const ACTION_LABELS: { action: AuthAction; label: string }[] = [
  { action: 'view', label: 'Seç' },
  { action: 'create', label: 'Ekle' },
  { action: 'update', label: 'Değiştir' },
  { action: 'delete', label: 'Çıkar' },
];

function flattenScreens(screens: MenuScreen[]): MenuScreen[] {
  return screens.flatMap((s) => [s, ...(s.children ? flattenScreens(s.children) : [])]);
}

function fieldNodesForScreen(screen: MenuScreen): OpTreeNode[] {
  const formCode = screen.formCode;
  if (!formCode) return [];
  const schema = FORM_SCHEMAS[formCode];
  if (!schema) return [];

  const nodes: OpTreeNode[] = [];
  const table = schema.tableName;

  // Logo: Değiştir altında sekmeler / alan grupları
  const genel: OpTreeNode[] = schema.fields
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((f) => ({
      id: `fld:${table}.${f.fieldName}`,
      kind: 'field' as const,
      label: f.label,
      tableName: table,
      fieldName: f.fieldName,
    }));

  if (genel.length) {
    nodes.push({
      id: `folder:${screen.id}:genel`,
      kind: 'folder',
      label: 'Genel Bilgiler',
      children: genel,
    });
  }

  if (schema.enableAddressesTab && schema.addressFields?.length) {
    nodes.push({
      id: `folder:${screen.id}:adres`,
      kind: 'folder',
      label: 'Adresler',
      children: schema.addressFields.map((f) => ({
        id: `fld:${table}.Addr.${f.fieldName}`,
        kind: 'field' as const,
        label: f.label,
        tableName: table,
        fieldName: `Addr_${f.fieldName}`,
      })),
    });
  }

  if (schema.enableContactsTab && schema.contactFields?.length) {
    nodes.push({
      id: `folder:${screen.id}:yetkili`,
      kind: 'folder',
      label: 'Yetkililer',
      children: schema.contactFields.map((f) => ({
        id: `fld:${table}.Contact.${f.fieldName}`,
        kind: 'field' as const,
        label: f.label,
        tableName: table,
        fieldName: `Contact_${f.fieldName}`,
      })),
    });
  }

  if (schema.enableAccountsTab && schema.accountFields?.length) {
    nodes.push({
      id: `folder:${screen.id}:hesap`,
      kind: 'folder',
      label: 'Hesaplar',
      children: schema.accountFields.map((f) => ({
        id: `fld:${table}.Account.${f.fieldName}`,
        kind: 'field' as const,
        label: f.label,
        tableName: table,
        fieldName: `Account_${f.fieldName}`,
      })),
    });
  }

  if (schema.enableUnitConvsTab && schema.unitConvFields?.length) {
    nodes.push({
      id: `folder:${screen.id}:birim`,
      kind: 'folder',
      label: 'Birim Çevirimi',
      children: [
        ...schema.unitConvFields.map((f) => ({
          id: `fld:${table}.ProductUnit.${f.fieldName}`,
          kind: 'field' as const,
          label: f.label,
          tableName: table,
          fieldName: `ProductUnit_${f.fieldName}`,
        })),
        ...(schema.barcodeFields || []).map((f) => ({
          id: `fld:${table}.Barcode.${f.fieldName}`,
          kind: 'field' as const,
          label: `Barkod · ${f.label}`,
          tableName: table,
          fieldName: `Barcode_${f.fieldName}`,
        })),
      ],
    });
  } else if (schema.enableBarcodesTab && schema.barcodeFields?.length) {
    nodes.push({
      id: `folder:${screen.id}:barkod`,
      kind: 'folder',
      label: 'Barkodlar',
      children: schema.barcodeFields.map((f) => ({
        id: `fld:${table}.Barcode.${f.fieldName}`,
        kind: 'field' as const,
        label: f.label,
        tableName: table,
        fieldName: `Barcode_${f.fieldName}`,
      })),
    });
  }

  if (schema.enableProductSubsTab && schema.productSubFields?.length) {
    nodes.push({
      id: `folder:${screen.id}:recete`,
      kind: 'folder',
      label: 'Alt Malzeme / Reçete',
      children: schema.productSubFields.map((f) => ({
        id: `fld:${table}.ProductSub.${f.fieldName}`,
        kind: 'field' as const,
        label: f.label,
        tableName: table,
        fieldName: `ProductSub_${f.fieldName}`,
      })),
    });
  }

  if (schema.enableVariantsTab && schema.variantFields?.length) {
    nodes.push({
      id: `folder:${screen.id}:varyant`,
      kind: 'folder',
      label: 'Varyantlar',
      children: schema.variantFields.map((f) => ({
        id: `fld:${table}.Variant.${f.fieldName}`,
        kind: 'field' as const,
        label: f.label,
        tableName: table,
        fieldName: `Variant_${f.fieldName}`,
      })),
    });
  }

  if (schema.enableCustomerAliasesTab && schema.customerAliasFields?.length) {
    nodes.push({
      id: `folder:${screen.id}:cari-malzeme`,
      kind: 'folder',
      label: 'Cari Malzeme',
      children: schema.customerAliasFields.map((f) => ({
        id: `fld:${table}.CustAlias.${f.fieldName}`,
        kind: 'field' as const,
        label: f.label,
        tableName: table,
        fieldName: `CustAlias_${f.fieldName}`,
      })),
    });
  }

  if (schema.enableAccountLinksTab && schema.accountLinkFields?.length) {
    nodes.push({
      id: `folder:${screen.id}:muhasebe`,
      kind: 'folder',
      label: 'Muhasebe Hesapları',
      children: schema.accountLinkFields.map((f) => ({
        id: `fld:${table}.AcctLink.${f.fieldName}`,
        kind: 'field' as const,
        label: f.label,
        tableName: table,
        fieldName: `AcctLink_${f.fieldName}`,
      })),
    });
  }

  if (schema.enableAuxilCodesTab && schema.auxilCodeFields?.length) {
    nodes.push({
      id: `folder:${screen.id}:ozel-kod`,
      kind: 'folder',
      label: 'Özel Kodlar',
      children: schema.auxilCodeFields.map((f) => ({
        id: `fld:${table}.Auxil.${f.fieldName}`,
        kind: 'field' as const,
        label: f.label,
        tableName: table,
        fieldName: `Auxil_${f.fieldName}`,
      })),
    });
  }

  if (schema.lineFields?.length) {
    nodes.push({
      id: `folder:${screen.id}:satir`,
      kind: 'folder',
      label: 'Kalemler',
      children: schema.lineFields.map((f) => ({
        id: `fld:${table}.Line.${f.fieldName}`,
        kind: 'field' as const,
        label: f.label,
        tableName: table,
        fieldName: `Line_${f.fieldName}`,
      })),
    });
  }

  const customs = getExtraFields(table).filter((f) => f.isActive);
  if (customs.length || schema.enableCustomFieldsTab) {
    nodes.push({
      id: `folder:${screen.id}:udf`,
      kind: 'folder',
      label: 'Tanımlı Alanlar',
      children: customs.map((f) => ({
        id: `fld:${f.tableName}.${f.fieldName}`,
        kind: 'field' as const,
        label: f.label,
        tableName: f.tableName,
        fieldName: f.fieldName,
      })),
    });
  }

  nodes.push({
    id: `fld:${table}.__meta`,
    kind: 'field',
    label: 'Kayıt bilgisi',
    tableName: table,
    fieldName: '__RecordInfo',
  });

  return nodes;
}

function screenNode(screen: MenuScreen): OpTreeNode {
  const updateChildren = fieldNodesForScreen(screen);
  return {
    id: `scr:${screen.id}`,
    kind: 'screen',
    label: screen.title,
    screenId: screen.id,
    children: ACTION_LABELS.map(({ action, label }) => ({
      id: `act:${screen.id}:${action}`,
      kind: 'action' as const,
      label,
      screenId: screen.id,
      action,
      children: action === 'update' && updateChildren.length ? updateChildren : undefined,
    })),
  };
}

/** Logo tarzı işlem yetkisi ağacı: Modül → Grup → Ekran → Seç/Ekle/Değiştir(…)/Çıkar */
export function buildOperationAuthTree(): OpTreeNode[] {
  return APP_MODULES.map((mod) => ({
    id: `mod:${mod.id}`,
    kind: 'module' as const,
    label: mod.title,
    children: mod.groups
      .map((g) => {
        const screens = flattenScreens(g.screens).filter(
          (s) =>
            !s.isUserPermissionsAdmin &&
            !s.isDbUpdatesAdmin &&
            !s.isDbSettingsAdmin &&
            !s.isCustomFieldsAdmin &&
            !s.isAddressAdmin &&
            !s.isCardDefaultsAdmin &&
            !s.isProcessAdmin &&
            !s.isProcessDesigner &&
            !s.isELogoSync &&
            !s.isEGovDesignTemplates &&
            !s.isEGovRules &&
            !s.isStockCosting &&
            !s.isAccountingPost &&
            !s.isCustomerAging &&
            !s.isBoundPortfolio &&
            !s.isApprovalGroups &&
            !s.isCrmWorkspace &&
            !s.isCrmSettings &&
            !s.isSqlReportsAdmin &&
            !s.isSqlReportFolder &&
            !s.isSqlReportRunner &&
            !s.externalUrl,
        );
        if (!screens.length) return null;
        return {
          id: `grp:${mod.id}:${g.key}`,
          kind: 'group' as const,
          label: g.title,
          children: screens.map(screenNode),
        };
      })
      .filter(Boolean) as OpTreeNode[],
  })).filter((m) => (m.children?.length || 0) > 0);
}

export interface AuthCodeScreenItem {
  screenId: string;
  title: string;
  tableName: string;
  /** Ana kayıt / tanım grubu veya *Card tablosu = kart, diğerleri hareket */
  kind: 'card' | 'trans';
}

export interface AuthCodeScreenGroup {
  moduleTitle: string;
  groupTitle: string;
  screens: AuthCodeScreenItem[];
}

/** Yetki kodu verilebilecek ekranlar: kayıt formu olan her kart / hareket ekranı */
export function buildAuthCodeScreenGroups(): AuthCodeScreenGroup[] {
  const out: AuthCodeScreenGroup[] = [];
  for (const mod of APP_MODULES) {
    for (const g of mod.groups) {
      const screens: AuthCodeScreenItem[] = [];
      for (const s of flattenScreens(g.screens)) {
        const schema = s.formCode ? FORM_SCHEMAS[s.formCode] : undefined;
        if (!schema?.tableName) continue;
        screens.push({
          screenId: s.id,
          title: s.title,
          tableName: schema.tableName,
          kind: /ana kay|tanım/i.test(g.title) || schema.tableName.endsWith('Card') ? 'card' : 'trans',
        });
      }
      if (screens.length) out.push({ moduleTitle: mod.title, groupTitle: g.title, screens });
    }
  }
  return out;
}

export function collectDescendants(node: OpTreeNode): OpTreeNode[] {
  const out: OpTreeNode[] = [];
  const walk = (n: OpTreeNode) => {
    out.push(n);
    n.children?.forEach(walk);
  };
  walk(node);
  return out;
}

export function nodeMatchesQuery(node: OpTreeNode, q: string): boolean {
  if (!q) return true;
  const needle = q.toLocaleLowerCase('tr-TR');
  if (node.label.toLocaleLowerCase('tr-TR').includes(needle)) return true;
  return (node.children || []).some((c) => nodeMatchesQuery(c, q));
}
