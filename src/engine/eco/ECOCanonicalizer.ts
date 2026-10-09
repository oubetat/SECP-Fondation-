import { createHash } from 'crypto';
import { EngineeringChangeOrder, ECOChangeSet, ECOImpactGraph, ECOApproval, ECOImplementationPlan, ECOVerificationRecord } from './types';

export class ECOCanonicalizer {
  
  public static computeObjectHash(obj: any): string {
    const canonicalStr = this.canonicalizeObject(obj);
    return createHash('sha256').update(canonicalStr).digest('hex');
  }

  public static computeChangeSetHash(changeSet: ECOChangeSet): string {
    const sortedChanges = [...(changeSet.changes || [])].sort((a, b) => a.changeId.localeCompare(b.changeId));
    return this.computeObjectHash({
      changeSetId: changeSet.changeSetId,
      ecoId: changeSet.ecoId,
      changes: sortedChanges
    });
  }

  public static computeImpactHash(impactGraph: ECOImpactGraph): string {
    const sortedNodes = [...(impactGraph.nodes || [])].sort((a, b) => a.entityId.localeCompare(b.entityId));
    return this.computeObjectHash({
      impactAnalysisId: impactGraph.impactAnalysisId,
      ecoId: impactGraph.ecoId,
      status: impactGraph.status,
      nodes: sortedNodes
    });
  }

  public static computeApprovalHash(approvals: ECOApproval[]): string {
    const sortedApprovals = [...approvals].sort((a, b) => a.approvalId.localeCompare(b.approvalId));
    return this.computeObjectHash(sortedApprovals);
  }

  public static computeImplementationHash(plan: ECOImplementationPlan): string {
    const sortedSteps = [...(plan.steps || [])].sort((a, b) => a.stepId.localeCompare(b.stepId));
    return this.computeObjectHash({
      planId: plan.planId,
      ecoId: plan.ecoId,
      steps: sortedSteps,
      requiredTests: [...(plan.requiredTests || [])].sort()
    });
  }

  public static computeVerificationHash(record: ECOVerificationRecord): string {
    return this.computeObjectHash({
      verificationId: record.verificationId,
      ecoId: record.ecoId,
      verdict: record.verdict,
      requestedVsActualMatched: record.requestedVsActualMatched,
      mismatches: [...(record.mismatches || [])].sort()
    });
  }

  public static computeECOHash(
    eco: EngineeringChangeOrder,
    changeSetHash: string,
    impactHash: string,
    approvalHash: string,
    implementationHash: string,
    verificationHash: string
  ): string {
    const canonical = JSON.stringify({
      ecoId: eco.ecoId,
      ecoNumber: eco.ecoNumber,
      reason: eco.reason,
      status: eco.status,
      targetEffectivity: eco.targetEffectivity,
      configurationScope: [...(eco.configurationScope || [])].sort(),
      affectedEntityIds: [...(eco.affectedEntityIds || [])].sort(),
      affectedRevisionIds: [...(eco.affectedRevisionIds || [])].sort(),
      changeSetHash,
      impactHash,
      approvalHash,
      implementationHash,
      verificationHash
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  public static computeECODependencyHash(dependsOnEcoIds: string[]): string {
    const sorted = [...dependsOnEcoIds].sort();
    return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  }

  private static canonicalizeObject(obj: any): string {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') {
      if (typeof obj === 'number') {
        if (isNaN(obj)) return 'NaN';
        if (!isFinite(obj)) return obj > 0 ? 'Infinity' : '-Infinity';
        return Number(obj.toFixed(6)).toString();
      }
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(o => this.canonicalizeObject(o)).join(',') + ']';
    }
    
    const keys = Object.keys(obj).sort();
    let result = '{';
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      result += JSON.stringify(key) + ':' + this.canonicalizeObject(obj[key]);
      if (i < keys.length - 1) result += ',';
    }
    result += '}';
    return result;
  }
}
