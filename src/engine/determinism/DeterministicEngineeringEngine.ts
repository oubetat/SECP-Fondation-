/**
 * SECP Industrial OS v3 — PATCH-182: Deterministic Engineering Engine Orchestrator
 * Single Master Orchestrator executing the complete Deterministic Engineering Pipeline:
 * Input -> Geometry -> Topology -> Mesh -> Solver -> Result -> Canonicalization -> Hash -> Oracle Verification.
 */

import {
  EngineeringInputManifest,
  CanonicalGeometry,
  CanonicalTopology,
  CanonicalMesh,
  CanonicalResult,
  DeterministicEngineeringArtifact,
  ReplayVerificationStage,
  RuntimeBackend,
  FirstDivergenceLocation
} from './DeterminismTypes';

import { DeterministicInputContract } from './DeterministicInputContract';
import { DeterministicGeometryTopologyEngine } from './DeterministicGeometryTopology';
import { DeterministicMeshEngine } from './DeterministicMeshEngine';
import { DeterministicSolverRuntime } from './DeterministicSolverRuntime';
import { FloatingPointDeterminismMonitor } from './FloatingPointDeterminismMonitor';
import { IndependentDeterminismOracle } from './IndependentDeterminismOracle';

export class DeterministicEngineeringEngine {
  /**
   * Executes a full deterministic engineering run.
   */
  public static executeDeterministicRun(
    rawInput: Partial<EngineeringInputManifest> = {},
    backend: RuntimeBackend = 'CPU_REF',
    replayCount: number = 3
  ): {
    artifact: DeterministicEngineeringArtifact;
    geometry: CanonicalGeometry;
    topology: CanonicalTopology;
    mesh: CanonicalMesh;
    result: CanonicalResult;
    divergenceLocation: FirstDivergenceLocation;
  } {
    const envFingerprint = DeterministicInputContract.captureEnvironmentFingerprint(backend);
    const inputManifest = DeterministicInputContract.canonicalizeInput(rawInput);

    // 1. Geometry Canonicalization
    const geometry = DeterministicGeometryTopologyEngine.canonicalizeGeometry(inputManifest);

    // 2. Topology Canonicalization
    const topology = DeterministicGeometryTopologyEngine.canonicalizeTopology(inputManifest, geometry);

    // 3. Mesh Canonicalization
    const mesh = DeterministicMeshEngine.generateCanonicalMesh(inputManifest, geometry);

    // 4. Solver Execution (Reference CPU Run)
    const { result, trace, solverConfigHash, solverStateHash, manifest } = DeterministicSolverRuntime.solveDeterministic(
      inputManifest,
      geometry,
      mesh,
      backend
    );

    // Patch manifest with exact topology hash
    manifest.topologyHash = topology.topologyHash;

    // 5. Replay N Qualification Execution
    const replays: ReplayVerificationStage[] = [];
    for (let r = 1; r <= replayCount; r++) {
      const replayRun = DeterministicSolverRuntime.solveDeterministic(inputManifest, geometry, mesh, backend);
      const isInputMatch = replayRun.manifest.inputHash === manifest.inputHash;
      const isGeomMatch = replayRun.manifest.geometryHash === manifest.geometryHash;
      const isTopMatch = topology.topologyHash === manifest.topologyHash;
      const isMeshMatch = replayRun.manifest.meshHash === manifest.meshHash;
      const isSolMatch = replayRun.manifest.solverStateHash === manifest.solverStateHash;
      const isResMatch = replayRun.manifest.resultHash === manifest.resultHash;

      replays.push({
        replayIndex: r,
        inputMatch: isInputMatch,
        geometryMatch: isGeomMatch,
        topologyMatch: isTopMatch,
        meshMatch: isMeshMatch,
        solverMatch: isSolMatch,
        resultMatch: isResMatch,
        masterHash: replayRun.manifest.masterHash
      });
    }

    // 6. WASM SIMD Cross-Runtime Run for Divergence Localization test
    const wasmRun = DeterministicSolverRuntime.solveDeterministic(inputManifest, geometry, mesh, 'WASM_SIMD');
    const wasmTrace = wasmRun.trace;

    const divergenceLocation = FloatingPointDeterminismMonitor.localizeFirstDivergence(
      trace.map(t => ({ iteration: t.iteration, residualNorm: t.residualNorm, stateVector: t.intermediateValues })),
      wasmTrace.map(t => ({ iteration: t.iteration, residualNorm: t.residualNorm, stateVector: t.intermediateValues })),
      inputManifest.runtimeParameters.policy,
      'CPU_REF',
      'WASM_SIMD'
    );

    // 7. Assemble Engineering Artifact
    const artifact: DeterministicEngineeringArtifact = {
      artifactId: `ART-DET-${manifest.masterHash.substring(4, 16)}`,
      timestamp: new Date().toISOString(),
      inputManifest,
      geometryHash: geometry.geometryHash,
      topologyHash: topology.topologyHash,
      meshHash: mesh.connectivityHash,
      solverConfigHash,
      solverStateHash,
      resultHash: result.resultHash,
      masterHash: manifest.masterHash,
      environmentFingerprint: envFingerprint,
      residualTrace: trace.map(t => t.residualNorm),
      floatingPointClassification: divergenceLocation.classification || 'EXACT_MATCH',
      replays,
      oracleVerdict: 'PASS'
    };

    // 8. Independent Oracle Verification
    const oracleCheck = IndependentDeterminismOracle.verifyArtifactIntegrity(artifact);
    if (!oracleCheck.isValid) {
      artifact.oracleVerdict = 'FAIL';
      artifact.failureCategory = oracleCheck.failureCategory;
    }

    return {
      artifact,
      geometry,
      topology,
      mesh,
      result,
      divergenceLocation
    };
  }
}
