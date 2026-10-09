/**
 * SECP Industrial OS — EPC-005: Product Configuration Manager Types
 * Domain-Agnostic Product Configuration, Revision, Variant, Assembly & BOM Schema.
 */

import { EngineeringConfigurationBaselineData } from './ConfigurationBaselineTypes';

export type ProductLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'OBSOLETE' | 'ARCHIVED';
export type RevisionStatus = 'DRAFT' | 'RELEASED' | 'OBSOLETE' | 'ARCHIVED';
export type VariantStatus = 'ACTIVE' | 'DEPRECATED' | 'INACTIVE';
export type ConfigurationStatus = 'DRAFT' | 'QUALIFIED' | 'SUPERSEDED' | 'REJECTED';

export interface ProductData {
  readonly productId: string;
  readonly name: string;
  readonly description: string;
  readonly productType: string;
  readonly lifecycleStatus: ProductLifecycleStatus;
  readonly currentRevisionId: string;
  readonly createdAt: string;
  readonly createdBy: string;
}

export interface ProductRevisionData {
  readonly revisionId: string;
  readonly productId: string;
  readonly revisionCode: string;
  readonly revisionNumber: number;
  readonly status: RevisionStatus;
  readonly parentRevisionId?: string;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly configurationIds: readonly string[];
  readonly createdAt: string;
  readonly createdBy: string;
}

export interface ProductVariantData {
  readonly variantId: string;
  readonly productId: string;
  readonly variantCode: string;
  readonly name: string;
  readonly description: string;
  readonly status: VariantStatus;
}

export interface ComponentReference {
  readonly componentId: string;
  readonly name: string;
  readonly revision: string;
  readonly quantity: number;
  readonly unit?: string;
  readonly childComponentIds?: readonly string[];
}

export interface AssemblyReference {
  readonly assemblyId: string;
  readonly assemblyRevision: string;
  readonly rootComponentId: string;
  readonly componentReferences: readonly ComponentReference[];
  readonly assemblyHash: string;
}

export interface BOMEntry {
  readonly entryId: string;
  readonly componentId: string;
  readonly name: string;
  readonly revision: string;
  readonly quantity: number;
  readonly unit: string;
}

export interface BOMReference {
  readonly bomId: string;
  readonly bomRevision: string;
  readonly entries: readonly BOMEntry[];
  readonly bomHash: string;
}

export interface ConfigurationProvenance {
  readonly creator: string;
  readonly createdAt: string;
  readonly productId: string;
  readonly revisionId: string;
  readonly variantId: string;
  readonly configurationId: string;
  readonly assemblyId: string;
  readonly assemblyRevision: string;
  readonly bomId: string;
  readonly bomRevision: string;
  readonly baselineId?: string;
  readonly sourceRevisions: Record<string, string>;
  readonly contentHash?: string;
}

export interface ProductConfigurationData {
  readonly configurationId: string;
  readonly productId: string;
  readonly revisionId: string;
  readonly variantId: string;
  readonly configurationCode: string;
  readonly status: ConfigurationStatus;
  readonly assembly: AssemblyReference;
  readonly bom: BOMReference;
  readonly baselineId?: string;
  readonly baseline?: EngineeringConfigurationBaselineData;
  readonly requirementTraceabilityRef?: string;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly isFrozen?: boolean;
  readonly contentHash?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly provenance: ConfigurationProvenance;
}

export interface ConfigurationSnapshot {
  readonly product: ProductData;
  readonly revision: ProductRevisionData;
  readonly variant: ProductVariantData;
  readonly configuration: ProductConfigurationData;
  readonly assembly: AssemblyReference;
  readonly bom: BOMReference;
  readonly baseline?: EngineeringConfigurationBaselineData;
  readonly snapshotHash: string;
  readonly timestamp: string;
}

export class ProductConfigurationValidationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'CONFIGURATION_VALIDATION_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ProductConfigurationValidationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ProductConfigurationValidationError.prototype);
  }
}

export interface ConfigurationDriftDetail {
  readonly component: string;
  readonly field: string;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly message: string;
}

export interface ConfigurationDriftReport {
  readonly configurationId: string;
  readonly isDriftDetected: boolean;
  readonly driftedItems: readonly string[];
  readonly details: readonly ConfigurationDriftDetail[];
  readonly timestamp: string;
}

export type ConfigurationDiffChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

export interface ConfigurationDiffEntry {
  readonly path: string;
  readonly changeType: ConfigurationDiffChangeType;
  readonly oldValue?: unknown;
  readonly newValue?: unknown;
  readonly description: string;
}

export interface ConfigurationComparisonResult {
  readonly configIdA: string;
  readonly configIdB: string;
  readonly isIdentical: boolean;
  readonly diffs: readonly ConfigurationDiffEntry[];
  readonly timestamp: string;
}

export interface EPC005ValidationResult {
  readonly epc: 'EPC-005';
  readonly name: 'Product Configuration Manager';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly checks: Record<string, boolean>;
  readonly evidenceHash: string;
  readonly timestamp: string;
  readonly implementationRevision: string;
}
