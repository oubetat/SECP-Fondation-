/**
 * SECP — ADSE-P1 Requirement Impact Analyzer
 * Specialized analytical layer for change impact assessment.
 */

import { ImpactAnalysisResult } from './types';
import { RequirementTraceabilityEngine } from './RequirementTraceabilityEngine';
import { ADSERequirementsEngine } from './ADSERequirementsEngine';
import { ADSESystemModelEngine } from './ADSESystemModelEngine';

export class RequirementImpactAnalyzer {
  constructor(
    private traceabilityEngine: RequirementTraceabilityEngine,
    private requirementsEngine: ADSERequirementsEngine,
    private systemModelEngine: ADSESystemModelEngine
  ) {}

  public analyzeChangeImpact(requirementId: string): ImpactAnalysisResult {
    const affectedIds = this.traceabilityEngine.getImpactTrace(requirementId);
    
    const affectedEntities = affectedIds.map(id => {
      // Resolve entity type
      let type = 'UNKNOWN';
      let reason = 'Downstream dependency of ' + requirementId;

      const req = this.requirementsEngine.getRequirement(id);
      if (req) {
        type = 'Requirement';
      } else {
        const func = this.systemModelEngine.getFunction(id);
        if (func) type = 'Function';
        else {
          const sub = this.systemModelEngine.getSubsystem(id);
          if (sub) type = 'Subsystem';
          else {
            const comp = this.systemModelEngine.getComponent(id);
            if (comp) type = 'ComponentReference';
          }
        }
      }

      return { id, type, reason };
    });

    return {
      rootCauseId: requirementId,
      affectedEntities
    };
  }
}
