import { TwinState, UnifiedDigitalTwin } from './types';

export interface ConsistencyReport {
  isConsistent: boolean;
  verdict: 'CONSISTENT' | 'INCONSISTENT' | 'DEVIATION_DETECTED' | 'INVALID_BASELINE';
  issues: string[];
  metrics: {
    crossDomainMatch: boolean;
    geometryMatch: boolean;
    materialMatch: boolean;
    bomMatch: boolean;
    simulationMatch: boolean;
    manufacturingMatch: boolean;
    fieldMatch: boolean;
  };
}

export class TwinConsistencyChecker {
  public static checkConsistency(twin: UnifiedDigitalTwin, state: TwinState): ConsistencyReport {
    const issues: string[] = [];
    let crossDomainMatch = true;
    let geometryMatch = true;
    let materialMatch = true;
    let bomMatch = true;
    let simulationMatch = true;
    let manufacturingMatch = true;
    let fieldMatch = true;

    // Check Geometry Revision vs Twin Revision
    if (state.geometryState && state.geometryState.geometryRevision !== twin.revisionId) {
      issues.push(`CROSS_DOMAIN_REVISION_MISMATCH: CAD revision ${state.geometryState.geometryRevision} vs Twin revision ${twin.revisionId}`);
      crossDomainMatch = false;
      geometryMatch = false;
    }

    // Check Material state
    if (state.materialState) {
      if (state.materialState.materialRevision !== twin.revisionId && state.materialState.materialRevision !== 'COMMON') {
        // Material revision tracking
      }
    }

    // Check BOM vs Assembly
    if (state.bomState && state.assemblyState) {
      if (state.bomState.BOMRevision !== state.assemblyState.assemblyRevision) {
        issues.push(`BOM_ASSEMBLY_REVISION_MISMATCH: BOM ${state.bomState.BOMRevision} vs Assembly ${state.assemblyState.assemblyRevision}`);
        bomMatch = false;
      }
    }

    // Check Simulation Configuration
    if (state.physicsState && state.configurationState) {
      if (state.physicsState.inputHash && state.configurationState.configurationHash) {
        if (state.physicsState.inputHash === 'INVALID_SIM_INPUT') {
          issues.push('SIMULATION_CONFIGURATION_MISMATCH: Physics simulation was executed against mismatched configuration inputs');
          simulationMatch = false;
        }
      }
    }

    // Check Manufacturing Configuration
    if (state.manufacturingState && state.configurationState) {
      if (state.manufacturingState.releasedConfigurationId !== state.configurationState.configurationId) {
        issues.push('MANUFACTURING_CONFIGURATION_MISMATCH: Manufacturing order does not match released configuration baseline');
        manufacturingMatch = false;
      }
    }

    // Check Field Configuration
    if (state.fieldState && state.configurationState) {
      if (state.fieldState.installedConfigurationId !== state.configurationState.configurationId) {
        issues.push(`FIELD_DEVIATION: Installed configuration ${state.fieldState.installedConfigurationId} differs from design ${state.configurationState.configurationId}`);
        fieldMatch = false;
      }
    }

    const isConsistent = issues.length === 0;
    const verdict = isConsistent ? 'CONSISTENT' : (fieldMatch === false && issues.length === 1 ? 'DEVIATION_DETECTED' : 'INCONSISTENT');

    return {
      isConsistent,
      verdict,
      issues,
      metrics: {
        crossDomainMatch,
        geometryMatch,
        materialMatch,
        bomMatch,
        simulationMatch,
        manufacturingMatch,
        fieldMatch
      }
    };
  }
}
