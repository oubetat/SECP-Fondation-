/**
 * SECP — ADSE-P7 Power Impact Analyzer
 * 
 * Computes downstream blast radius of changes to:
 * - Power Sources, Loads, Buses, Branches, Converters, Storage
 * - Voltage drops, electrical losses, and thermal impacts on P6
 * - Digital Thread (P4) and verification/evidence invalidation
 */

import { PowerRegistry } from './PowerRegistry';
import { PowerSolverBridge } from './PowerSolverBridge';
import { PowerVerificationAndEvidenceEngine } from './PowerVerificationAndEvidenceEngine';
import { PowerImpact } from './types';

export class PowerImpactAnalyzer {
  constructor(
    private registry: PowerRegistry,
    private solverBridge: PowerSolverBridge,
    private verificationEngine: PowerVerificationAndEvidenceEngine
  ) {}

  /**
   * Analyzes the blast radius of a power load demand mutation.
   */
  public analyzeLoadMutationImpact(loadId: string, newDemandWatts: number): PowerImpact {
    const load = this.registry.getLoad(loadId);
    const affectedSystemIds = load ? [load.systemId] : [];

    const invalidatedExecutions = this.solverBridge.getAllExecutions()
      .filter(e => affectedSystemIds.includes(e.systemId))
      .map(e => e.executionId);

    const supersededEvidence = this.verificationEngine.getAllEvidences()
      .filter(ev => affectedSystemIds.includes(ev.systemId))
      .map(ev => ev.evidenceId);

    return {
      affectedSystemIds,
      invalidatedExecutionIds: invalidatedExecutions,
      supersededEvidenceIds: supersededEvidence,
      impactedThermalModelIds: [`P6_THERMAL_LOAD_MUTATED_BY:${loadId}`],
      impactedDownstreamArtifacts: [
        `LOAD:${loadId}`,
        `BUS:${load?.connectedBusId}`,
        'POWER_BUDGET_RECALCULATION_REQUIRED',
        'DIGITAL_THREAD_INVALIDATION_EVENT'
      ],
      reason: `Power Load '${loadId}' demand modified to ${newDemandWatts} W.`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyzes the impact of a source capacity change.
   */
  public analyzeSourceMutationImpact(sourceId: string): PowerImpact {
    const source = this.registry.getSource(sourceId);
    const affectedSystemIds = source ? [source.systemId] : [];

    const invalidatedExecutions = this.solverBridge.getAllExecutions()
      .filter(e => affectedSystemIds.includes(e.systemId))
      .map(e => e.executionId);

    const supersededEvidence = this.verificationEngine.getAllEvidences()
      .filter(ev => affectedSystemIds.includes(ev.systemId))
      .map(ev => ev.evidenceId);

    return {
      affectedSystemIds,
      invalidatedExecutionIds: invalidatedExecutions,
      supersededEvidenceIds: supersededEvidence,
      impactedThermalModelIds: [],
      impactedDownstreamArtifacts: [
        `SOURCE:${sourceId}`,
        'SYSTEM_CAPACITY_CHANGED',
        'POWER_MARGIN_VERIFICATION_REQUIRED'
      ],
      reason: `Power Source '${sourceId}' capacity or properties updated.`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyzes the impact of a converter efficiency change on power and thermal.
   */
  public analyzeConverterDriftImpact(converterId: string): PowerImpact {
    const conv = this.registry.getConverter(converterId);
    const affectedSystemIds = conv ? [conv.systemId] : [];

    const invalidatedExecutions = this.solverBridge.getAllExecutions()
      .filter(e => affectedSystemIds.includes(e.systemId))
      .map(e => e.executionId);

    const supersededEvidence = this.verificationEngine.getAllEvidences()
      .filter(ev => affectedSystemIds.includes(ev.systemId))
      .map(ev => ev.evidenceId);

    return {
      affectedSystemIds,
      invalidatedExecutionIds: invalidatedExecutions,
      supersededEvidenceIds: supersededEvidence,
      impactedThermalModelIds: [`P6_CONVERTER_HEAT_SOURCE_DIRTY:${converterId}`],
      impactedDownstreamArtifacts: [
        `CONVERTER:${converterId}`,
        'THERMAL_LOSS_SHIFT_EVENT'
      ],
      reason: `Converter '${converterId}' efficiency modified.`,
      timestamp: new Date().toISOString()
    };
  }
}
