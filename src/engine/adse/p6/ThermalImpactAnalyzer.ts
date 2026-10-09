/**
 * SECP — ADSE-P6 Thermal Impact Analyzer
 * 
 * Analyzes blast radius of changes to:
 * - Material conductivity, density, specific heat, emissivity
 * - Geometry and structural placement from P5
 * - Boundary conditions and thermal loads
 * - Revisions and configurations
 * 
 * Computes downstream effect on Thermal Models, Executions, Verifications, and Evidence.
 */

import { ThermalRegistry } from './ThermalRegistry';
import { ThermalBoundaryEngine } from './ThermalBoundaryEngine';
import { ThermalInterfaceEngine } from './ThermalInterfaceEngine';
import { ThermalSolverBridge } from './ThermalSolverBridge';
import { ThermalVerificationAndEvidenceEngine } from './ThermalVerificationAndEvidenceEngine';
import { ThermalImpact } from './types';

export class ThermalImpactAnalyzer {
  constructor(
    private registry: ThermalRegistry,
    private boundaries: ThermalBoundaryEngine,
    private interfaces: ThermalInterfaceEngine,
    private solverBridge: ThermalSolverBridge,
    private verificationEngine: ThermalVerificationAndEvidenceEngine
  ) {}

  /**
   * Analyzes the impact of a material property mutation.
   */
  public analyzeMaterialMutationImpact(materialId: string, propertyName: string): ThermalImpact {
    const affectedRegions = this.registry.getAllRegions().filter(r => r.materialId === materialId);
    const affectedModelIds = Array.from(new Set(affectedRegions.map(r => r.thermalId)));

    const invalidatedExecutions = this.solverBridge.getAllExecutions()
      .filter(e => affectedModelIds.includes(e.thermalId))
      .map(e => e.executionId);

    const supersededEvidence = this.verificationEngine.getAllEvidences()
      .filter(ev => affectedModelIds.includes(ev.thermalId))
      .map(ev => ev.evidenceId);

    return {
      affectedModelIds,
      invalidatedExecutionIds: invalidatedExecutions,
      supersededEvidenceIds: supersededEvidence,
      impactedDownstreamArtifacts: [
        ...affectedRegions.map(r => `REGION:${r.regionId}`),
        ...affectedModelIds.map(m => `MODEL_REVISION_STALE:${m}`),
        'DIGITAL_THREAD_INVALIDATION_EVENT'
      ],
      reason: `Material property '${propertyName}' modified for material '${materialId}'.`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Analyzes the impact of a P5 structural interface or geometry revision change.
   */
  public analyzeStructuralDriftImpact(p5InterfaceId: string): ThermalImpact {
    const affectedInterfaces = this.interfaces.getAllInterfaces().filter(i => i.p5InterfaceId === p5InterfaceId);
    const affectedModelIds = Array.from(new Set(affectedInterfaces.map(i => i.thermalId)));

    const invalidatedExecutions = this.solverBridge.getAllExecutions()
      .filter(e => affectedModelIds.includes(e.thermalId))
      .map(e => e.executionId);

    const supersededEvidence = this.verificationEngine.getAllEvidences()
      .filter(ev => affectedModelIds.includes(ev.thermalId))
      .map(ev => ev.evidenceId);

    return {
      affectedModelIds,
      invalidatedExecutionIds: invalidatedExecutions,
      supersededEvidenceIds: supersededEvidence,
      impactedDownstreamArtifacts: [
        ...affectedInterfaces.map(i => `THERMAL_INTERFACE:${i.interfaceId}`),
        'P5_STRUCTURAL_COUPLING_DIRTY'
      ],
      reason: `P5 Structural Interface '${p5InterfaceId}' modified or revised.`,
      timestamp: new Date().toISOString()
    };
  }
}
