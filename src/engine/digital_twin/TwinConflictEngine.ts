import { TwinState, UnifiedDigitalTwin } from './types';

export interface TwinConflict {
  conflictType: 
    | 'GEOMETRY_CONFLICT'
    | 'MATERIAL_CONFLICT'
    | 'BOM_CONFLICT'
    | 'ASSEMBLY_CONFLICT'
    | 'REVISION_CONFLICT'
    | 'CONFIGURATION_CONFLICT'
    | 'SIMULATION_CONFLICT'
    | 'MANUFACTURING_CONFLICT'
    | 'FIELD_CONFLICT'
    | 'EVIDENCE_CONFLICT';
  severity: 'WARNING' | 'ERROR' | 'CRITICAL';
  sourceDomain: string;
  targetDomain: string;
  description: string;
  sourceValue: any;
  targetValue: any;
}

export class TwinConflictEngine {
  public static detectConflicts(twin: UnifiedDigitalTwin, state: TwinState): TwinConflict[] {
    const conflicts: TwinConflict[] = [];

    // 1. Revision / Geometry conflict
    if (state.geometryState && state.geometryState.geometryRevision !== twin.revisionId) {
      conflicts.push({
        conflictType: 'REVISION_CONFLICT',
        severity: 'CRITICAL',
        sourceDomain: 'CAD_GEOMETRY',
        targetDomain: 'TWIN_IDENTITY',
        description: `Geometry revision ${state.geometryState.geometryRevision} does not match twin revision ${twin.revisionId}`,
        sourceValue: state.geometryState.geometryRevision,
        targetValue: twin.revisionId
      });
    }

    // 2. Configuration Conflict
    if (state.configurationState && state.configurationState.configurationId !== twin.configurationId) {
      conflicts.push({
        conflictType: 'CONFIGURATION_CONFLICT',
        severity: 'CRITICAL',
        sourceDomain: 'CONFIGURATION_STATE',
        targetDomain: 'TWIN_IDENTITY',
        description: `Configuration state ${state.configurationState.configurationId} does not match twin baseline ${twin.configurationId}`,
        sourceValue: state.configurationState.configurationId,
        targetValue: twin.configurationId
      });
    }

    // 3. Variant Conflict
    if (state.variantState && state.variantState.variantId !== twin.variantId) {
      conflicts.push({
        conflictType: 'CONFIGURATION_CONFLICT',
        severity: 'ERROR',
        sourceDomain: 'VARIANT_STATE',
        targetDomain: 'TWIN_IDENTITY',
        description: `Variant state ${state.variantState.variantId} does not match twin variant ${twin.variantId}`,
        sourceValue: state.variantState.variantId,
        targetValue: twin.variantId
      });
    }

    // 4. Simulation vs Configuration Conflict
    if (state.physicsState && state.configurationState) {
      // If physics simulation was executed on a different configuration input hash
      if (state.physicsState.inputHash && state.configurationState.configurationHash) {
        if (state.physicsState.inputHash === 'MISMATCH_SIM_HASH') {
          conflicts.push({
            conflictType: 'SIMULATION_CONFLICT',
            severity: 'CRITICAL',
            sourceDomain: 'SIMULATION_PHYSICS',
            targetDomain: 'CONFIGURATION',
            description: 'Simulation input configuration hash mismatch with twin configuration baseline.',
            sourceValue: state.physicsState.inputHash,
            targetValue: state.configurationState.configurationHash
          });
        }
      }
    }

    // 5. Manufacturing vs Released Configuration
    if (state.manufacturingState && state.configurationState) {
      if (state.manufacturingState.releasedConfigurationId !== state.configurationState.configurationId) {
        conflicts.push({
          conflictType: 'MANUFACTURING_CONFLICT',
          severity: 'CRITICAL',
          sourceDomain: 'MANUFACTURING',
          targetDomain: 'RELEASED_CONFIGURATION',
          description: 'Manufacturing order released configuration does not match current configuration baseline.',
          sourceValue: state.manufacturingState.releasedConfigurationId,
          targetValue: state.configurationState.configurationId
        });
      }
    }

    // 6. Field vs Installed Configuration
    if (state.fieldState && state.configurationState) {
      if (state.fieldState.installedConfigurationId !== state.configurationState.configurationId) {
        conflicts.push({
          conflictType: 'FIELD_CONFLICT',
          severity: 'WARNING',
          sourceDomain: 'FIELD_INSTANCE',
          targetDomain: 'DESIGN_CONFIGURATION',
          description: 'Field installed configuration differs from design baseline.',
          sourceValue: state.fieldState.installedConfigurationId,
          targetValue: state.configurationState.configurationId
        });
      }
    }

    // 7. Evidence Conflict (No evidence attached)
    if (!state.evidenceReferences || state.evidenceReferences.length === 0) {
      conflicts.push({
        conflictType: 'EVIDENCE_CONFLICT',
        severity: 'CRITICAL',
        sourceDomain: 'EVIDENCE_LAYER',
        targetDomain: 'TWIN_STATE',
        description: 'Digital Twin state has no backed enterprise evidence references.',
        sourceValue: null,
        targetValue: 'MANDATORY_EVIDENCE_REQUIRED'
      });
    }

    return conflicts;
  }
}
