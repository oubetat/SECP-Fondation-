/**
 * PATCH-SECP-063: Change Impact Analyzer
 * Evaluates the required re-engineering levels (CAM regeneration, process revalidation, etc.)
 * for corrective adjustments, integrating structural rules from SECP-058 & SECP-059.
 */

import { ChangeImpactAssessment, ChangeImpactLevel } from './NCRTypes';

export class ChangeImpactEngine {
  /**
   * Assesses required actions and level of engineering impact based on root-cause category
   */
  public static assessChangeImpact(params: {
    ncrId: string;
    rootCauseCategoryId: 'tooling' | 'cad_geometry' | 'fixture' | 'nc_program' | 'machine' | 'operator_error';
    assessedBy: string;
  }): ChangeImpactAssessment {
    const assessmentId = `cia-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();

    let impactLevel: ChangeImpactLevel = 'NONE';
    let requiredActions: string[] = [];
    let requiresRevalidation = false;

    switch (params.rootCauseCategoryId) {
      case 'cad_geometry':
        impactLevel = 'FULL_ENGINEERING_REQUALIFICATION';
        requiredActions = [
          'Revise CAD design models',
          'Recalculate tolerance stack-ups',
          'Regenerate CAM toolpaths',
          'Regenerate NC G-code',
          'Execute first-article qualification'
        ];
        requiresRevalidation = true;
        break;

      case 'nc_program':
        impactLevel = 'NC_REGENERATION';
        requiredActions = [
          'Edit post-processor parameters',
          'Regenerate CNC G-code paths',
          'Conduct spindle-simulation dry-run'
        ];
        requiresRevalidation = true;
        break;

      case 'tooling':
        impactLevel = 'PROCESS_REVALIDATION';
        requiredActions = [
          'Replace cutting tool insert',
          'Apply micro-metric Z-offset adjustments',
          'Reset spindle speed multipliers'
        ];
        requiresRevalidation = true;
        break;

      case 'fixture':
        impactLevel = 'LOCAL_REWORK';
        requiredActions = [
          'Verify clamp pneumatic pressures',
          'Re-align fixture locating pins'
        ];
        requiresRevalidation = false;
        break;

      case 'machine':
        impactLevel = 'PROCESS_REVALIDATION';
        requiredActions = [
          'Recalibrate coordinate measuring system (probe)',
          'Check spindle lubricating pressure'
        ];
        requiresRevalidation = true;
        break;

      default:
        impactLevel = 'NONE';
        requiredActions = ['Log incident. Standard oversight only.'];
        requiresRevalidation = false;
        break;
    }

    return {
      assessmentId,
      ncrId: params.ncrId,
      rootCauseCategoryId: params.rootCauseCategoryId,
      impactLevel,
      requiredActions,
      requiresRevalidation,
      assessedBy: params.assessedBy,
      timestamp
    };
  }
}
