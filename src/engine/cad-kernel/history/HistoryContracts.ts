/**
 * SECP CAD Kernel — Canonical Feature History & Feature Node Contracts
 * Phase 2 (PATCH-KERNEL-003)
 */

import { FeatureType, TopologyReference } from './FeatureDefinition';

export type StableFeatureId = string;
export type FeatureId = string;
export type SolidId = string;

export type FeatureNodeStatus =
  | 'DIRTY'
  | 'EVALUATING'
  | 'VALID'
  | 'FAILED';

export interface FeatureInput {
  name: string;
  value: any;
}

export interface FeatureOutput {
  topologyId: string;
}

export interface FeatureDependency {
  dependsOnFeatureId: string;
}

export interface FeatureNode {
  featureId: StableFeatureId;
  type: FeatureType | string;

  parameters: Record<string, number | string | any>;

  parents: FeatureId[];

  inputs: TopologyReference[] | FeatureInput[] | any;
  outputs: TopologyReference[] | FeatureOutput[] | any;

  resultSolidId?: SolidId;

  status: FeatureNodeStatus;

  // Compatibility aliases
  id?: FeatureId;
  name?: string;
  dependencies?: FeatureDependency[];
  outputGeometry?: any;
}

export interface FeatureGraph {
  features: FeatureNode[];
}
