/**
 * SECP Industrial OS — EPC-006: Multidisciplinary Model Registry Types
 */

import { ArtifactStatus } from '../plm/PLMTypes';
import { ConfigurationStatus } from './ProductConfigurationTypes';

export enum ModelType {
  CAD = 'CAD',
  FEA = 'FEA',
  CFD = 'CFD',
  THERMAL = 'THERMAL',
  DYNAMICS = 'DYNAMICS',
  CONTROL = 'CONTROL',
  MANUFACTURING = 'MANUFACTURING',
  DIGITAL_TWIN = 'DIGITAL_TWIN'
}

export type ModelLifecycleStatus = ArtifactStatus | 'ACTIVE' | 'OBSOLETE';

export interface ModelProvenance {
  readonly creator: string;
  readonly createdAt: string;
  readonly sourceModelId?: string;
  readonly productConfigurationId: string;
  readonly dependencies: readonly string[];
  readonly hash: string;
}

export interface MultidisciplinaryModel {
  readonly modelId: string;
  readonly modelType: ModelType;
  readonly name: string;
  readonly description: string;
  readonly domain: string;
  readonly productId: string;
  readonly productRevisionId: string;
  readonly variantId: string;
  readonly configurationId: string;
  readonly modelRevision: string;
  readonly lifecycleStatus: ModelLifecycleStatus;
  readonly artifactReference: string;
  readonly parentModelId?: string;
  readonly sourceModelId?: string;
  readonly dependencyIds: readonly string[];
  readonly parameterSetReference?: string;
  readonly materialReference?: string;
  readonly geometryReference?: string;
  readonly solverReference?: string;
  readonly meshReference?: string;
  readonly controlReference?: string;
  readonly manufacturingReference?: string;
  readonly digitalTwinReference?: string;
  readonly provenance: ModelProvenance;
  readonly contentHash: string;
  readonly createdAt: string;
  readonly createdBy: string;
}

export interface ModelSnapshot {
  readonly model: MultidisciplinaryModel;
  readonly upstreamDependencies: readonly MultidisciplinaryModel[];
  readonly downstreamDependencies: readonly MultidisciplinaryModel[];
  readonly snapshotHash: string;
  readonly timestamp: string;
}

export type CompatibilityStatus = 'VALID' | 'STALE' | 'INCOMPATIBLE' | 'UNKNOWN';

export interface CompatibilityValidation {
  readonly modelId: string;
  readonly targetModelId: string;
  readonly status: CompatibilityStatus;
  readonly reason?: string;
}

export interface ModelRegistryIntegrityReport {
  readonly valid: boolean;
  readonly checks: {
    readonly uniqueIdentity: boolean;
    readonly validModelType: boolean;
    readonly validRevision: boolean;
    readonly validConfiguration: boolean;
    readonly validDependencies: boolean;
    readonly validHashes: boolean;
    readonly noCycles: boolean;
  };
  readonly errors: readonly string[];
}

export interface EPC006ValidationResult {
  readonly epc: 'EPC-006';
  readonly name: 'Multidisciplinary Model Registry';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly checks: Record<string, boolean>;
  readonly evidenceHash: string;
  readonly timestamp: string;
  readonly implementationRevision: string;
}
