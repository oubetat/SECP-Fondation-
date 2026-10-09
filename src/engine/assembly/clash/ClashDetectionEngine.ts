import {
  ClashComponentDefinition,
  ClashDetectionOptions,
  ClashAssemblyReport,
  ClashResult,
  ClashVerdict,
  ClashPair,
} from './ClashTypes';
import { BroadPhaseDetector } from './BroadPhaseDetector';
import { NarrowPhaseDetector } from './NarrowPhaseDetector';
import { ClearanceAnalyzer } from './ClearanceAnalyzer';
import { ClashEvidenceEngine } from './ClashEvidence';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { KinematicState } from '../kinematics/KinematicState';
import { KinematicConfiguration } from '../kinematics/KinematicConfiguration';

export class ClashDetectionEngine {
  public static readonly ALGORITHM_VERSION = 'SECP_CLASH_V2.0.0';

  /**
   * Performs full clash and clearance detection on an assembly state
   */
  public static detectClashes(
    assemblyId: string,
    components: ClashComponentDefinition[],
    options: ClashDetectionOptions = {}
  ): ClashAssemblyReport {
    const analysisMode = options.analysisMode ?? 'STATIC_ANALYSIS';
    const tolerance = options.tolerance ?? 1e-4;
    const requiredClearance = options.requiredClearance ?? 0;

    // 1. Upfront validation of all components
    let invalidCount = 0;
    const compMap = new Map<string, ClashComponentDefinition>();
    for (const comp of components) {
      if (!NarrowPhaseDetector.validateComponentGeometry(comp)) {
        invalidCount++;
      }
      compMap.set(comp.componentId, comp);
    }

    if (invalidCount > 0) {
      const timestamp = '2026-08-19T00:00:00.000Z';
      const determinismHash = EngineeringHashChain.computeCanonicalHash({
        assemblyId,
        verdict: 'INVALID',
        invalidCount,
      }).canonicalHash;

      return {
        assemblyId,
        verdict: 'INVALID',
        analysisMode,
        totalEvaluatedPairs: (components.length * (components.length - 1)) / 2,
        candidatePairsCount: 0,
        clashCount: 0,
        clearanceViolationCount: 0,
        inconclusiveCount: 0,
        invalidCount,
        results: [],
        algorithmVersion: this.ALGORITHM_VERSION,
        timestamp,
        evidenceId: `EVID-ASSY-INVALID-${determinismHash.slice(0, 16)}`,
        determinismHash,
      };
    }

    // 2. Broad Phase
    const candidates = BroadPhaseDetector.findCandidatePairs(components, options);
    const results: ClashResult[] = [];

    let clashCount = 0;
    let clearanceViolationCount = 0;
    let inconclusiveCount = 0;

    // 3. Narrow Phase & Clearance Analysis on all candidates
    for (const candidate of candidates) {
      const compA = compMap.get(candidate.pair.componentAId);
      const compB = compMap.get(candidate.pair.componentBId);

      if (!compA || !compB) continue;

      const analysis = ClearanceAnalyzer.analyzePair(compA, compB, options);

      const transformAHash = ClashEvidenceEngine.computeTransformHash(compA.worldTransform);
      const transformBHash = ClashEvidenceEngine.computeTransformHash(compB.worldTransform);
      const geometryHashA = ClashEvidenceEngine.computeGeometryHash(compA);
      const geometryHashB = ClashEvidenceEngine.computeGeometryHash(compB);

      const resultId = `RES_${compA.componentId}_${compB.componentId}`;

      const clashRes: ClashResult = {
        id: resultId,
        pair: {
          componentAId: compA.componentId,
          componentBId: compB.componentId,
        },
        verdict: analysis.verdict,
        severity: analysis.severity,
        penetrationDepth: analysis.penetrationDepth,
        minimumClearance: analysis.minimumClearance,
        contacts: analysis.contacts,
        transformAHash,
        transformBHash,
        geometryHashA,
        geometryHashB,
        toleranceUsed: tolerance,
        algorithmVersion: this.ALGORITHM_VERSION,
        diagnostics: analysis.diagnostics,
      };

      // Generate Evidence for this result
      const evidence = ClashEvidenceEngine.createClashResultEvidence(assemblyId, clashRes);
      clashRes.evidenceId = evidence.evidenceId;

      results.push(clashRes);

      if (analysis.verdict === 'CLASH') clashCount++;
      else if (analysis.verdict === 'CLEARANCE_VIOLATION') clearanceViolationCount++;
      else if (analysis.verdict === 'INCONCLUSIVE') inconclusiveCount++;
      else if (analysis.verdict === 'INVALID') invalidCount++;
    }

    // 4. Determine overall assembly verdict
    let overallVerdict: ClashVerdict = 'NO_CLASH';
    if (invalidCount > 0) {
      overallVerdict = 'INVALID';
    } else if (clashCount > 0) {
      overallVerdict = 'CLASH';
    } else if (clearanceViolationCount > 0) {
      overallVerdict = 'CLEARANCE_VIOLATION';
    } else if (inconclusiveCount > 0) {
      overallVerdict = 'INCONCLUSIVE';
    }

    // Deterministic timestamp and evidence
    const timestamp = '2026-08-19T00:00:00.000Z';
    const determinismPayload = {
      assemblyId,
      verdict: overallVerdict,
      candidatePairsCount: candidates.length,
      clashCount,
      clearanceViolationCount,
      resultsSummary: results.map(r => ({
        pair: r.pair,
        verdict: r.verdict,
        depth: r.penetrationDepth,
      })),
    };
    const determinismHash = EngineeringHashChain.computeCanonicalHash(determinismPayload).canonicalHash;
    const evidenceId = `EVID-ASSY-CLASH-${determinismHash.slice(0, 16)}`;

    return {
      assemblyId,
      verdict: overallVerdict,
      analysisMode,
      totalEvaluatedPairs: (components.length * (components.length - 1)) / 2,
      candidatePairsCount: candidates.length,
      clashCount,
      clearanceViolationCount,
      inconclusiveCount,
      invalidCount,
      results,
      algorithmVersion: this.ALGORITHM_VERSION,
      timestamp,
      evidenceId,
      determinismHash,
    };
  }

  /**
   * Analyzes clashes at a specific kinematic configuration
   */
  public static detectClashesAtConfiguration(
    assemblyState: KinematicState,
    configuration: KinematicConfiguration,
    geometryMap: Map<string, ClashComponentDefinition['geometry']>,
    options: ClashDetectionOptions = {}
  ): ClashAssemblyReport {
    const components: ClashComponentDefinition[] = [];

    for (const body of assemblyState.getBodies()) {
      const transform = configuration.bodyTransforms[body.bodyId] ?? body.worldTransform;
      const geom = geometryMap.get(body.componentId) ?? {
        id: `GEOM_${body.componentId}`,
        type: 'BOX',
        dimensions: { dx: 20, dy: 20, dz: 20 },
      };

      components.push({
        componentId: body.componentId,
        geometryId: geom.id,
        geometry: geom,
        worldTransform: transform,
      });
    }

    return this.detectClashes(assemblyState.assemblyId, components, options);
  }

  /**
   * Sweeps discrete kinematic motion path configurations and reports collision timeline
   */
  public static sweepClashAnalysis(
    assemblyState: KinematicState,
    motionPath: KinematicConfiguration[],
    geometryMap: Map<string, ClashComponentDefinition['geometry']>,
    options: ClashDetectionOptions = {}
  ): {
    reports: ClashAssemblyReport[];
    overallVerdict: ClashVerdict;
    firstClashIndex?: number;
  } {
    const reports: ClashAssemblyReport[] = [];
    let overallVerdict: ClashVerdict = 'NO_CLASH';
    let firstClashIndex: number | undefined;

    const sweepOptions: ClashDetectionOptions = {
      ...options,
      analysisMode: 'DISCRETE_SWEEP',
    };

    for (let step = 0; step < motionPath.length; step++) {
      const config = motionPath[step];
      const report = this.detectClashesAtConfiguration(
        assemblyState,
        config,
        geometryMap,
        sweepOptions
      );
      reports.push(report);

      if (report.verdict === 'CLASH' && firstClashIndex === undefined) {
        firstClashIndex = step;
        overallVerdict = 'CLASH';
      } else if (report.verdict === 'CLEARANCE_VIOLATION' && overallVerdict !== 'CLASH') {
        overallVerdict = 'CLEARANCE_VIOLATION';
      }
    }

    return {
      reports,
      overallVerdict,
      firstClashIndex,
    };
  }
}
