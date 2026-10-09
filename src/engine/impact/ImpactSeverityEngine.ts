import { ImpactSeverity, ImpactNode, RelationshipType } from './types';

export interface SeverityEvaluationContext {
  policyVersion: string;
  isRootSafetyCritical: boolean;
  changeReason?: string;
  affectedDomains?: string[];
  configurationCount?: number;
  effectivityScopeCount?: number;
  hasCertificationImpact?: boolean;
}

export class ImpactSeverityEngine {
  public static readonly POLICY_VERSION = 'Policy v1.0';

  public static calculateSeverity(
    node: Partial<ImpactNode>,
    relType: RelationshipType | undefined,
    context: SeverityEvaluationContext
  ): ImpactSeverity {
    let score = 0;

    // 1. Distance scoring
    if (node.distance === 0) {
      score += 40;
    } else if (node.distance === 1) {
      score += 25;
    } else if (node.distance === 2) {
      score += 15;
    } else {
      score += 5;
    }

    // 2. Safety Propagation & Inherited Relevance
    if (node.isSafetyCritical || context.isRootSafetyCritical) {
      if (relType === 'BOM_COMPONENT' || relType === 'ASSEMBLY_OCCURRENCE' || relType === 'MANUFACTURING_DEPENDENCY' || relType === 'SIMULATION_DEPENDENCY') {
        score += 35;
      } else if (relType === 'DOCUMENT_DEPENDENCY') {
        score += 15;
      } else {
        score += 25;
      }
    }

    // 3. Domain & Entity Type Sensitivity
    if (node.entityType === 'SIMULATION' || node.entityType === 'GCODE' || node.entityType === 'TOOLPATH') {
      score += 20;
    } else if (node.entityType === 'MATERIAL') {
      score += 15;
    } else if (node.entityType === 'ASSEMBLY') {
      score += 10;
    }

    // 4. Certification and Configuration multiplier
    if (context.hasCertificationImpact) {
      score += 20;
    }
    if ((context.configurationCount || 0) > 1) {
      score += 10;
    }

    // Map score to ImpactSeverity
    if (score >= 60) {
      return 'CRITICAL';
    } else if (score >= 40) {
      return 'HIGH';
    } else if (score >= 25) {
      return 'MEDIUM';
    } else if (score >= 10) {
      return 'LOW';
    }
    return 'NONE';
  }
}
