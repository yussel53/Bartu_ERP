import { apiJson } from '../config/api';

/** e-Belge kuralları — api/egov/transform-rules */

export interface RuleOption {
  value: string;
  label: string;
}

export interface RuleParamDef {
  key: string;
  label: string;
  /** text · textarea · number · bool · select · template · sql */
  type: string;
  required: boolean;
  default?: string | null;
  help?: string | null;
  options?: RuleOption[] | null;
}

export interface RuleTemplateInfo {
  code: string;
  title: string;
  category: string;
  description: string;
  logoEquivalent?: string | null;
  docKinds: number[];
  adminOnly: boolean;
  params: RuleParamDef[];
}

export interface RuleConditions {
  customerCodes?: string | null;
  taxNumbers?: string | null;
  profiles?: string | null;
  typeCodes?: string | null;
  currencies?: string | null;
  companyId?: number | null;
}

export interface RulePreset {
  key: string;
  name: string;
  templateCode: string;
  docKinds: string;
  params: Record<string, string>;
  conditions: RuleConditions;
  description: string;
  logoSource?: string | null;
  xsltSnippet?: string | null;
}

export interface RulePlaceholder {
  key: string;
  label: string;
  line: boolean;
}

export interface RuleCatalog {
  templates: RuleTemplateInfo[];
  presets: RulePreset[];
  placeholders: RulePlaceholder[];
}

export interface TransformRule {
  eGovTransformRuleID: number;
  name: string;
  templateCode: string;
  docKinds?: string | null;
  direction: number;
  paramsJson?: string | null;
  conditionsJson?: string | null;
  priority: number;
  stopAfter: boolean;
  isActive: boolean;
  description?: string | null;
  companyID?: number | null;
}

export interface RuleStepResult {
  ruleId: number;
  ruleName: string;
  templateCode: string;
  status: 'applied' | 'skipped' | 'error';
  changes: string[];
  message?: string | null;
}

export interface RuleRunResult {
  changed: boolean;
  steps: RuleStepResult[];
  xml?: string | null;
  originalXml?: string | null;
  values: Record<string, string>;
}

export function getRuleCatalog(): Promise<RuleCatalog> {
  return apiJson('/api/egov/transform-rules/catalog');
}

export function listRules(): Promise<TransformRule[]> {
  return apiJson('/api/egov/transform-rules');
}

export function saveRule(rule: TransformRule): Promise<{ success: boolean; id: number }> {
  return apiJson('/api/egov/transform-rules', { method: 'POST', body: JSON.stringify(rule) });
}

export function deleteRule(id: number): Promise<unknown> {
  return apiJson(`/api/egov/transform-rules/${id}`, { method: 'DELETE' });
}

export function previewRules(body: {
  rule?: TransformRule | null;
  ruleIds?: number[] | null;
  eGovDocumentId?: number | null;
  sample?: string | null;
  direction?: number;
  ignoreConditions?: boolean;
}): Promise<RuleRunResult> {
  return apiJson('/api/egov/transform-rules/preview', { method: 'POST', body: JSON.stringify(body) });
}
