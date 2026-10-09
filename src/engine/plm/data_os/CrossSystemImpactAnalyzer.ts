/**
 * SECP Industrial OS v3 — PATCH-181: Cross-System Impact Analyzer
 * Traverses engineering dependency links to evaluate cascade invalidations across
 * CAD, Assemblies, Drawings, FEM/CFD Simulations, CAM Toolpaths, BOMs, and Configurations.
 */

import { EngineeringObjectGraph } from './EngineeringObjectGraph';
import { ImpactAnalysisReport } from './EngineeringDataOSTypes';

export class CrossSystemImpactAnalyzer {
  /**
   * Evaluates the comprehensive impact of modifying an engineering object/revision.
   */
  public static evaluateImpact(sourceObjectId: string, proposedRevisionLabel: string, changeReason: string): ImpactAnalysisReport {
    const context = EngineeringObjectGraph.getDesignInContext(sourceObjectId);
    const affectedAssemblies: ImpactAnalysisReport['affectedAssemblies'] = [];
    const affectedDrawings: ImpactAnalysisReport['affectedDrawings'] = [];
    const affectedSimulations: ImpactAnalysisReport['affectedSimulations'] = [];
    const affectedCAMToolpaths: ImpactAnalysisReport['affectedCAMToolpaths'] = [];
    const affectedConfigurations: ImpactAnalysisReport['affectedConfigurations'] = [];
    const releaseBlockers: string[] = [];

    // Collect affected assemblies from where-used
    for (const parent of context.whereUsed.usedInParents) {
      if (parent.domain === 'ASSEMBLY' || parent.domain === 'PRODUCT') {
        affectedAssemblies.push({
          objectId: parent.objectId,
          name: parent.name,
          revision: parent.revision
        });
      }
    }

    // Collect drawings
    for (const drawing of context.linkedDrawings) {
      affectedDrawings.push({
        objectId: drawing.objectId,
        name: drawing.name,
        currentStatus: 'IN_REVIEW'
      });
      releaseBlockers.push(`Drawing ${drawing.name} (${drawing.objectId}) requires re-dimensioning and tolerance check`);
    }

    // Collect simulations
    for (const sim of context.linkedSimulations) {
      affectedSimulations.push({
        objectId: sim.objectId,
        domain: sim.domain,
        status: 'INVALIDATED'
      });
      releaseBlockers.push(`Simulation ${sim.name} is invalidated by geometric/material change in ${sourceObjectId}`);
    }

    // Collect CAM toolpaths
    for (const cam of context.linkedCAM) {
      affectedCAMToolpaths.push({
        objectId: cam.objectId,
        toolpathName: cam.name,
        status: 'OUTDATED'
      });
      releaseBlockers.push(`CAM Toolpath ${cam.name} (${cam.objectId}) marked OUTDATED. Post-processor re-run required.`);
    }

    // Default configuration impact
    affectedConfigurations.push({
      configId: 'CFG-DEFAULT-PROD',
      configCode: 'CFG-PROD-2026'
    });

    const isMajor = changeReason.includes('GEOMETRY') || changeReason.includes('MATERIAL') || changeReason.includes('WEIGHT');

    return {
      rootSourceObjectId: sourceObjectId,
      rootSourceRevisionId: proposedRevisionLabel,
      changeSummary: `Proposed revision ${proposedRevisionLabel} on ${context.current?.name || sourceObjectId}: ${changeReason}`,
      affectedAssemblies,
      affectedDrawings,
      affectedSimulations,
      affectedCAMToolpaths,
      affectedConfigurations,
      bomImpact: {
        costImpactUSD: isMajor ? 145.0 : 0.0,
        partsChangedCount: affectedAssemblies.length + 1
      },
      manufacturingImpact: {
        toolingChangeRequired: isMajor,
        ncReprogrammingRequired: affectedCAMToolpaths.length > 0,
        estimatedLeadTimeImpactDays: isMajor ? 3 : 0
      },
      releaseBlockers,
      recommendedAction: releaseBlockers.length > 0
        ? `Initiate ECO and run verification pipeline (${affectedSimulations.length} simulations, ${affectedCAMToolpaths.length} toolpaths).`
        : 'Fast-track approval workflow permitted.'
    };
  }
}
