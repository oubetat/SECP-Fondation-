import { 
  ConfigurationStatus, 
  ConfigurationVerdict, 
  ConfigurationContext, 
  ConfigurationOption, 
  ConfigurationSelection, 
  ConfigurationRule, 
  OptionDependency,
  ResolvedConfiguration,
  ConfigurationSnapshot,
  ConfigurationEvidenceChain,
  OptionType,
  SelectionSource
} from '../configuration/types';

export type VariantStatus = 
  | 'DRAFT' 
  | 'VALIDATING' 
  | 'VALID' 
  | 'INVALID' 
  | 'REVIEW_REQUIRED' 
  | 'RELEASED' 
  | 'SUPERSEDED' 
  | 'RETIRED' 
  | 'ARCHIVED';

export type VariationDimension = 
  | 'POWERTRAIN' 
  | 'GEOMETRY' 
  | 'MATERIAL' 
  | 'SIZE' 
  | 'PERFORMANCE' 
  | 'REGULATORY' 
  | 'MANUFACTURING' 
  | 'CUSTOMER' 
  | 'MARKET' 
  | 'SERVICE';

export type VariantRuleType = 
  | 'INCLUDE' 
  | 'EXCLUDE' 
  | 'REQUIRE' 
  | 'FORBID' 
  | 'IMPLY' 
  | 'SELECT' 
  | 'REPLACE' 
  | 'OVERRIDE' 
  | 'CONSTRAIN';

export type VariantVerdict = 
  | 'VALID' 
  | 'INVALID' 
  | 'INCOMPLETE' 
  | 'CONFLICT' 
  | 'STALE' 
  | 'UNRESOLVED';

export type VariantClosureStatus = 
  | 'OPEN' 
  | 'PARTIAL' 
  | 'COMPLETE' 
  | 'BLOCKED' 
  | 'INVALID';

export type VariantCompatibilityStatus = 
  | 'COMPATIBLE' 
  | 'PARTIALLY_COMPATIBLE' 
  | 'INCOMPATIBLE' 
  | 'UNKNOWN';

export interface Variant {
  variantId: string;
  productId: string;
  variantCode: string;
  variantName: string;
  variantVersion: string;
  status: VariantStatus;
  parentVariantId?: string;
  createdAt: string;
  createdBy: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  variantHash: string;
  ruleSetVersion: string;
}

export interface VariantRule {
  ruleId: string;
  ruleCode: string;
  version: string;
  priority: number;
  type: VariantRuleType;
  condition: (context: ConfigurationContext, options: ConfigurationOption[]) => boolean;
  action: {
    type: 'SELECT_OPTION' | 'EXCLUDE_COMPONENT' | 'INCLUDE_COMPONENT' | 'MODIFY_QUANTITY' | 'SET_REVISION';
    targetId: string;
    value?: any;
  };
  severity: 'WARNING' | 'ERROR' | 'CRITICAL';
  scope: 'PRODUCT' | 'VARIANT' | 'CONFIGURATION' | 'BOM' | 'ASSEMBLY' | 'COMPONENT' | 'MANUFACTURING' | 'SERVICE' | 'REGULATORY';
  status: 'ACTIVE' | 'INACTIVE';
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface VariantDefinition {
  baseProduct: string;
  variationDimensions: VariationDimension[];
  allowedOptions: string[];
  requiredOptions: string[];
  forbiddenOptions: string[];
  variantRules: VariantRule[];
  effectivity: Record<string, any>;
  parentVariantId?: string;
  overrides: Array<{
    targetId: string;
    value: any;
    reason: string;
  }>;
}

export interface ResolvedVariant {
  variantId: string;
  variantVersion: string;
  resolvedConfiguration: ResolvedConfiguration;
  evidence: {
    inheritancePath: string[];
    evaluatedRules: string[];
    conflicts: string[];
  };
  variantHash: string;
  verdict: VariantVerdict;
}

export interface VariantFamily {
  familyId: string;
  productId: string;
  familyCode: string;
  familyName: string;
  variants: string[]; // variantIds
  familyRules: VariantRule[];
}

export interface VariantCompatibility {
  variantIdA: string;
  variantIdB: string;
  status: VariantCompatibilityStatus;
  checkedRules: string[];
  sharedComponents: string[];
  conflictingComponents: string[];
  evidenceHash: string;
}

export interface VariantSnapshot {
  variantId: string;
  variantVersion: string;
  variantHash: string;
  configurationHash: string;
  bomGraphHash: string;
  assemblyGraphHash: string;
  revisionGraphHash: string;
  ruleSetHash: string;
  createdAt: string;
}

export interface VariantDelta {
  variantIdA: string;
  variantIdB: string;
  addedOptions: string[];
  removedOptions: string[];
  changedOptions: Array<{ optionId: string; oldValue: any; newValue: any }>;
  addedComponents: string[];
  removedComponents: string[];
  changedRevisions: Array<{ entityId: string; oldRevision: string; newRevision: string }>;
  changedRules: string[];
  changedEffectivity: string[];
  changedManufacturingState: string[];
}

export interface VariantEvidenceChain {
  variantId: string;
  stages: {
    definitionHash: string;
    inheritanceHash: string;
    optionResolutionHash: string;
    ruleEvalHash: string;
    configResolutionHash: string;
    finalVariantHash: string;
  };
  provenance: {
    createdBy: string;
    approvedBy?: string;
    timestamp: string;
  };
}
