import { Transform3D } from '../assembly/AssemblyConstraintTypes';
import { Vector3D } from '../cadKernel';
import { ShapeHandle } from '../geometry/ShapeHandle';

/**
 * PATCH-SECP-047-A — Feature Contracts
 * Defines the structure for Parametric Features and Design Intent.
 */

export type FeatureType = 
  | 'SKETCH' 
  | 'EXTRUSION' 
  | 'REVOLVE' 
  | 'BOOLEAN' 
  | 'FILLET' 
  | 'CHAMFER' 
  | 'PATTERN' 
  | 'ROOT';

export type FeatureStatus = 'ACTIVE' | 'SUPPRESSED' | 'FAILED' | 'ROLLED_BACK';

export interface FeatureParameter {
  id: string;
  name: string;
  value: number | string | boolean | Vector3D | Transform3D;
  unit?: string;
}

/**
 * Topology Reference for stable identification
 */
export interface TopologyReference {
  featureId: string;        // The feature that produced this topology
  topologyType: 'FACE' | 'EDGE' | 'VERTEX';
  signature: string;        // Geometric/Topological signature for matching
  index?: number;           // Fallback index
}

export interface FeatureDefinition {
  featureId: string;
  type: FeatureType;
  name: string;
  parameters: Record<string, any>;
  references: TopologyReference[];  // Inputs from previous features
  status: FeatureStatus;
  suppressionState: 'ACTIVE' | 'SUPPRESSED';
  revision: number;
  deterministicHash: string;
  
  // Output tracking
  outputShape?: ShapeHandle;
  affectedFaceIds?: string[]; // IDs of faces created or modified by this feature
}

/**
 * Feature History - The "Model Tree"
 */
export interface DesignHistory {
  modelId: string;
  features: FeatureDefinition[];
  parameters: FeatureParameter[];
  revision: number;
  lastRegenerated: string;
}

/**
 * Diagnostic result for feature regeneration
 */
export interface FeatureDiagnosticResult {
  featureId: string;
  status: 'SUCCESS' | 'ERROR' | 'WARNING';
  message: string;
  affectedFeatures: string[];
  suggestedRecovery?: string;
}
