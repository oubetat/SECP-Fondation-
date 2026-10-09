export type ConfigurationStatus = 
  | 'DRAFT' 
  | 'VALIDATING' 
  | 'VALID' 
  | 'INVALID' 
  | 'SUPERSEDED' 
  | 'EXPIRED' 
  | 'ARCHIVED';

export type ConfigurationReleaseState = 
  | 'DRAFT' 
  | 'UNDER_REVIEW' 
  | 'APPROVED' 
  | 'RELEASED' 
  | 'SUSPENDED' 
  | 'RETIRED';

export type OptionType = 
  | 'BOOLEAN' 
  | 'ENUM' 
  | 'INTEGER' 
  | 'DECIMAL' 
  | 'TEXT' 
  | 'REFERENCE';

export type SelectionSource = 
  | 'USER' 
  | 'RULE' 
  | 'DEFAULT' 
  | 'IMPORT' 
  | 'ECO' 
  | 'CUSTOMER_ORDER' 
  | 'MANUFACTURING' 
  | 'SERVICE';

export type OptionDependencyType = 
  | 'OPTION_REQUIRES' 
  | 'OPTION_EXCLUDES' 
  | 'OPTION_IMPLIES' 
  | 'OPTION_CONFLICTS' 
  | 'OPTION_DEPENDS_ON';

export type RulePrecedenceLevel = 
  | 'SAFETY' 
  | 'REGULATORY' 
  | 'ENGINEERING' 
  | 'MANUFACTURING' 
  | 'COMMERCIAL' 
  | 'DEFAULT';

export type ConfigurationVerdict = 
  | 'VALID' 
  | 'INVALID' 
  | 'INCOMPLETE' 
  | 'CONFLICT' 
  | 'STALE' 
  | 'UNRESOLVED';

export type ClosureStatus = 
  | 'OPEN' 
  | 'PARTIAL' 
  | 'COMPLETE' 
  | 'BLOCKED' 
  | 'INVALID';

export interface ConfigurationEffectivityContext {
  effectiveFrom?: string;
  effectiveTo?: string;
  startSerial?: string;
  endSerial?: string;
  lotId?: string;
  projectId?: string;
  contractId?: string;
}

export interface ConfigurationContext {
  productId: string;
  configurationId: string;
  configurationVersion: string;
  revisionContext?: string;
  effectivityContext?: ConfigurationEffectivityContext;
  dateContext?: string;
  serialContext?: string;
  lotContext?: string;
  projectContext?: string;
  customerContext?: string;
  manufacturingContext?: string;
  serviceContext?: string;
}

export interface ConfigurationOption {
  optionId: string;
  optionCode: string;
  name: string;
  description: string;
  type: OptionType;
  allowedValues?: any[];
  defaultValue?: any;
  required: boolean;
  status: 'ACTIVE' | 'DEPRECATED';
}

export interface OptionDependency {
  dependencyId: string;
  sourceOptionId: string;
  targetOptionId: string;
  dependencyType: OptionDependencyType;
  conditionValue?: any;
  targetRequiredValue?: any;
}

export interface ConfigurationSelection {
  selectionId: string;
  configurationId: string;
  optionId: string;
  value: any;
  source: SelectionSource;
  selectedAt: string;
  selectedBy: string;
}

export interface ConfigurationRule {
  ruleId: string;
  ruleCode: string;
  version: string;
  priority: number;
  precedence: RulePrecedenceLevel;
  condition: (selections: Map<string, any>, context: ConfigurationContext) => boolean;
  action: {
    type: 'SELECT_OPTION' | 'EXCLUDE_COMPONENT' | 'INCLUDE_COMPONENT' | 'MODIFY_QUANTITY' | 'SET_REVISION' | 'SUPPRESS_OCCURRENCE';
    targetId: string;
    value?: any;
  };
  severity: 'WARNING' | 'ERROR' | 'CRITICAL';
  status: 'ACTIVE' | 'INACTIVE';
}

export interface RuleEvaluationTrace {
  ruleId: string;
  precedence: RulePrecedenceLevel;
  conditionResult: boolean;
  actionExecuted?: string;
  output?: any;
  timestamp: string;
}

export interface ResolvedComponent {
  componentId: string;
  entityType: 'PART' | 'ASSEMBLY' | 'BOM' | 'MATERIAL' | 'TOOLPATH';
  revisionId: string;
  baseQuantity: number;
  resolvedQuantity: number;
  inclusionReason: string;
  selectionReason?: string;
  effectivityReason?: string;
  isSuppressed: boolean;
  suppressionReason?: string;
  sourceBOM?: string;
  sourceAssembly?: string;
}

export interface ExcludedComponent {
  componentId: string;
  excludedByRuleId?: string;
  excludedByOptionId?: string;
  reason: string;
}

export interface ConfigurationVariant {
  variantId: string;
  variantCode: string;
  name: string;
  parentVariantId?: string;
  inheritanceVersion?: string;
  overrides: Array<{
    optionId: string;
    originalValue: any;
    overrideValue: any;
    reason: string;
    source: string;
    timestamp: string;
    authority: string;
  }>;
}

export interface ResolvedConfiguration {
  configurationId: string;
  configurationVersion: string;
  resolvedComponents: ResolvedComponent[];
  resolvedOptions: Array<{ optionId: string; value: any; source: SelectionSource }>;
  resolvedRevisions: Array<{ entityId: string; revisionId: string; reason: string }>;
  resolvedRules: string[];
  excludedComponents: ExcludedComponent[];
  unresolvedItems: string[];
  effectivityResults: {
    isValid: boolean;
    hasOverlap: boolean;
    hasGap: boolean;
    details: string[];
  };
  ruleEvaluationTraces: RuleEvaluationTrace[];
  configurationHash: string;
  verdict: ConfigurationVerdict;
}

export interface ConfigurationSnapshot {
  snapshotId: string;
  configurationId: string;
  configurationVersion: string;
  revisionGraphHash: string;
  bomGraphHash: string;
  assemblyGraphHash: string;
  ruleSetHash: string;
  configurationHash: string;
  isImmutable: boolean;
  createdAt: string;
}

export interface ConfigurationEvidenceChain {
  stageHashes: {
    inputContextHash: string;
    selectionsHash: string;
    ruleEvaluationHash: string;
    revisionResolutionHash: string;
    bomResolutionHash: string;
    assemblyResolutionHash: string;
    effectivityHash: string;
    finalConfigurationHash: string;
  };
  provenance: {
    createdBy: string;
    selectedBy: string;
    evaluatedByAlgorithm: string;
    verifierVersion: string;
    timestamp: string;
  };
}

export interface ConfigurationDelta {
  configurationIdA: string;
  configurationIdB: string;
  addedComponents: string[];
  removedComponents: string[];
  changedRevisions: Array<{ entityId: string; oldRevision: string; newRevision: string }>;
  changedQuantities: Array<{ componentId: string; oldQty: number; newQty: number }>;
  changedOptions: Array<{ optionId: string; oldValue: any; newValue: any }>;
  changedRules: string[];
  changedEffectivity: string[];
  deltaHash: string;
}

export interface ConfigurationManifest {
  configurationId: string;
  product: string;
  version: string;
  context: ConfigurationContext;
  options: Array<{ optionId: string; value: any; source: string }>;
  revisions: Array<{ entityId: string; revisionId: string }>;
  resolvedBOM: Array<{ componentId: string; quantity: number }>;
  assemblyState: Array<{ occurrenceId: string; status: 'ACTIVE' | 'SUPPRESSED' }>;
  rules: string[];
  effectivity: ConfigurationEffectivityContext;
  manufacturingState: { toolpathId?: string; processPlanId?: string };
  hashes: { configurationHash: string; snapshotHash: string };
  provenance: ConfigurationEvidenceChain['provenance'];
  verdict: ConfigurationVerdict;
}

export interface DifferentialConfigurationResult {
  verdict: 'MATCH' | 'MISMATCH' | 'INCOMPLETE' | 'INVALID';
  optionsMatch: boolean;
  revisionsMatch: boolean;
  componentsMatch: boolean;
  rulesMatch: boolean;
  hashMatch: boolean;
  mismatches: string[];
}
