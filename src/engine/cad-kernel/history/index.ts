/**
 * SECP CAD Kernel — Feature History Subsystem (PATCH-022)
 */

export * from './FeatureState';
export * from './FeatureDefinition';
export * from './FeatureNode';
export * from './FeatureDependency';
export * from './FeatureExecution';
export * from './FeatureHistoryValidator';
export * from './FeatureRegenerator';
export * from './FeatureHistoryEvidence';
export * from './FeatureHistoryVerification';
export * from './FeatureHistoryAcceptanceGate';
export * from './FeatureHistory';
export type {
  FeatureInput,
  FeatureOutput,
  FeatureDependency,
  FeatureGraph,
  FeatureNode as LegacyFeatureNode
} from './HistoryContracts';
