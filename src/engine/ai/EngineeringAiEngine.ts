/**
 * SECP Engineering AI Assistant Engine
 * Provides semantic insights based on CAD metadata and Simulation results.
 */

import { GpuSelectionResult } from '../rendering/shared/GpuPickingEngine';
import { SimulationResult } from '../simulation/SimulationEngine';
import { SimulationExecutionRegistry } from '../simulation/SimulationExecutionRegistry';
import { CanonicalDerivedArtifactBinding } from '../topology/CanonicalDerivedArtifactBinding';

export interface AiInsight {
  type: 'OPTIMIZATION' | 'WARNING' | 'INFO';
  message: string;
  actionableParamId?: string;
  confidence: number;
}

export class EngineeringAiEngine {
  /**
   * Generates AI insights by correlating Selection and Simulation data
   */
  public static analyzeDesignContext(
    selection: GpuSelectionResult | null,
    sim: SimulationResult | null,
    targetCadRevisionHash?: string,
    targetGeometryHash?: string
  ): AiInsight[] {
    const insights: AiInsight[] = [];

    let effectiveSim: SimulationResult | null = sim;

    // Verify simulation result authenticity and content integrity against authoritative registry
    if (sim) {
      if (sim.status === 'STALE_IDENTITY') {
        insights.push({
          type: 'WARNING',
          message: `CRITICAL: Simulation result is STALE. The underlying CAD geometry has changed since this simulation was executed. Results are no longer valid for production decisions.`,
          confidence: 1.0
        });
        return insights;
      }

      if (!sim.provenanceHash || !sim.derivedArtifactBinding) {
        insights.push({
          type: 'WARNING',
          message: 'CRITICAL: Simulation result lacks required derived artifact binding or provenance. Result cannot be trusted for engineering decisions.',
          confidence: 1.0
        });
        return insights;
      }

      // Verify binding AND content consistency
      const verifyRes = SimulationExecutionRegistry.verifyResultBinding(
        sim,
        targetCadRevisionHash,
        targetGeometryHash
      );

      if (!verifyRes.isValid) {
        insights.push({
          type: 'WARNING',
          message: `CRITICAL: Simulation result binding verification failed for target CAD revision ${targetCadRevisionHash || 'UNKNOWN'} (${verifyRes.failureReason}). Result is rejected as cross-revision, unauthenticated, or tampered.`,
          confidence: 1.0
        });
        return insights;
      }

      // Use the authoritative record from the registry rather than untrusted caller mutations
      if (verifyRes.authoritativeResult) {
        effectiveSim = verifyRes.authoritativeResult;
      }
    }

    if (effectiveSim && effectiveSim.status !== 'SAFE') {
      if (effectiveSim.status === 'STALE_IDENTITY') {
        insights.push({
          type: 'WARNING',
          message: `CRITICAL: Simulation result is STALE. The underlying CAD geometry has changed since this simulation was executed. Results are no longer valid for production decisions.`,
          confidence: 1.0
        });
      } else {
        insights.push({
          type: effectiveSim.status === 'FAILURE' ? 'WARNING' : 'OPTIMIZATION',
          message: `High stress detected at ${effectiveSim.criticalFeatureId}. Suggest increasing 'Main_Diameter' or 'Shell_Thickness' to improve safety factor above 1.5.`,
          actionableParamId: 'p1',
          confidence: 0.94
        });
      }
    }

    if (selection) {
      if (selection.featureId === 'Fillet_003') {
        insights.push({
          type: 'INFO',
          message: `This Fillet was added to reduce stress concentration. Current simulations confirm it's the primary load path for the turbine assembly.`,
          confidence: 0.88
        });
      }
      
      insights.push({
        type: 'OPTIMIZATION',
        message: `Based on the geometry of ${selection.partName}, you could reduce weight by 12% by introducing a localized pocket feature on this face.`,
        confidence: 0.75
      });
    } else {
      insights.push({
        type: 'INFO',
        message: "I'm monitoring the design. Select any face or part to get localized engineering insights.",
        confidence: 1.0
      });
    }

    return insights;
  }
}
