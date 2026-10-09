/**
 * SECP Industrial OS v3 — PATCH-181: Engineering Change Order (ECO) Engine
 * Manages full lifecycle change governance: Change Request -> Impact Analysis ->
 * ECO -> Engineering Review -> Simulation/Verification -> Approval -> Release.
 */

import { EngineeringChangeOrder, ChangeRequestItem, ImpactAnalysisReport } from './EngineeringDataOSTypes';
import { CrossSystemImpactAnalyzer } from './CrossSystemImpactAnalyzer';
import { ApprovalWorkflowEngine } from './ApprovalWorkflowEngine';
import { generateDeterministicHashSync } from '../../../lib/hash';

export class EngineeringECOEngine {
  private static ecos: Map<string, EngineeringChangeOrder> = new Map();

  public static clear(): void {
    this.ecos.clear();
  }

  /**
   * Creates an Engineering Change Order (ECO) and triggers automated impact analysis.
   */
  public static createECO(
    title: string,
    description: string,
    changeReason: EngineeringChangeOrder['changeReason'],
    priority: EngineeringChangeOrder['priority'],
    author: string,
    changeRequests: ChangeRequestItem[]
  ): EngineeringChangeOrder {
    const ecoNumber = `ECO-2026-${String(this.ecos.size + 1).padStart(4, '0')}`;
    const ecoId = `ECO-${generateDeterministicHashSync({ title, author, t: Date.now() }).substring(0, 8)}`;

    const affectedObjectIds = Array.from(new Set(changeRequests.map(cr => cr.targetObjectId)));

    // Perform automated cross-system impact analysis for the primary target object
    const primaryTarget = changeRequests[0];
    const impactSummary: ImpactAnalysisReport = primaryTarget
      ? CrossSystemImpactAnalyzer.evaluateImpact(primaryTarget.targetObjectId, primaryTarget.proposedRevision, description)
      : {
          rootSourceObjectId: 'N/A',
          rootSourceRevisionId: 'N/A',
          changeSummary: description,
          affectedAssemblies: [],
          affectedDrawings: [],
          affectedSimulations: [],
          affectedCAMToolpaths: [],
          affectedConfigurations: [],
          bomImpact: { costImpactUSD: 0, partsChangedCount: 0 },
          manufacturingImpact: { toolingChangeRequired: false, ncReprogrammingRequired: false, estimatedLeadTimeImpactDays: 0 },
          releaseBlockers: [],
          recommendedAction: 'Standard ECO Review'
        };

    // Attach workflow
    const workflow = ApprovalWorkflowEngine.createDefaultWorkflow(ecoId, 'ECO-REV-1', 'ECO');

    const eco: EngineeringChangeOrder = {
      ecoId,
      ecoNumber,
      title,
      description,
      changeReason,
      priority,
      author,
      createdAt: new Date().toISOString(),
      status: 'PROPOSED',
      changeRequests: [...changeRequests],
      affectedObjectIds,
      workflowId: workflow.workflowId,
      verificationRequirements: {
        femReanalysisRequired: impactSummary.affectedSimulations.some(s => s.domain === 'SIMULATION_FEM'),
        cfdReanalysisRequired: impactSummary.affectedSimulations.some(s => s.domain === 'SIMULATION_CFD'),
        camRegenerationRequired: impactSummary.affectedCAMToolpaths.length > 0,
        drawingUpdateRequired: impactSummary.affectedDrawings.length > 0,
        pmiValidationRequired: true,
        bomRecalculationRequired: impactSummary.bomImpact.partsChangedCount > 0
      },
      impactSummary
    };

    this.ecos.set(ecoId, eco);
    return eco;
  }

  /**
   * Advances the status of an ECO.
   */
  public static updateECOStatus(ecoId: string, status: EngineeringChangeOrder['status'], approvedBy?: string): EngineeringChangeOrder {
    const eco = this.ecos.get(ecoId);
    if (!eco) throw new Error(`ECO ${ecoId} not found`);

    eco.status = status;
    if (status === 'APPROVED' && approvedBy) {
      eco.approvedBy = approvedBy;
      eco.approvedAt = new Date().toISOString();
    }
    return eco;
  }

  public static getECO(ecoId: string): EngineeringChangeOrder | undefined {
    return this.ecos.get(ecoId);
  }

  public static getAllECOs(): EngineeringChangeOrder[] {
    return Array.from(this.ecos.values());
  }
}
