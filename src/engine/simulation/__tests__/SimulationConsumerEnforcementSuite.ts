/**
 * SECP Industrial OS — Simulation Consumer Enforcement & Truth Proof Suite
 * 
 * Tests simulation truth binding, scenario/solver integrity, and consumption enforcement
 * across QualityGate, EngineeringAiEngine, SimulationEngine, and SimulationExecutionRegistry.
 */

import { SimulationEngine, SimulationResult } from '../SimulationEngine';
import { SimulationScenario, ScenarioLifecycle, ParameterType } from '../SimulationScenarioTypes';
import { SimulationIdentityService } from '../SimulationIdentityService';
import { SimulationExecutionRegistry } from '../SimulationExecutionRegistry';
import { QualityGate } from '../../verification/QualityGate';
import { EngineeringAiEngine } from '../../ai/EngineeringAiEngine';
import { CanonicalDerivedArtifactBinding } from '../../topology/CanonicalDerivedArtifactBinding';
import { RevisionEngine } from '../../revision/RevisionEngine';

export interface SimulationEnforcementSuiteResult {
  totalTests: number;
  passedCount: number;
  failedCount: number;
  details: Array<{ testId: string; description: string; passed: boolean; details?: string }>;
}

export class SimulationConsumerEnforcementSuite {
  public static async runSuite(): Promise<SimulationEnforcementSuiteResult> {
    const details: Array<{ testId: string; description: string; passed: boolean; details?: string }> = [];

    const MODEL_ID = 'TURBINE_BLADE_01';
    const REV_A_HASH = 'cad_rev_hash_sim_aaaa1111222233334444555566667777888899990000aaaa111122223333';
    const REV_B_HASH = 'cad_rev_hash_sim_bbbb1111222233334444555566667777888899990000bbbb111122223333';
    const GEOM_1_HASH = 'geom_hash_sim_111122223333444455556666777788889999000011112222333344445555';
    const GEOM_2_HASH = 'geom_hash_sim_222233334444555566667777888899990000111122223333444455556666';

    let currentRevHash = REV_A_HASH;
    let currentGeomHash = GEOM_1_HASH;

    // Mock RevisionEngine for SimulationIdentityService
    const mockRevisionEngine: any = {
      getLatestReleasedRevision: (modelId: string) => {
        if (modelId === MODEL_ID) {
          return { 
            revisionHash: currentRevHash,
            snapshot: {
              geometryState: { geometryHash: currentGeomHash }
            }
          };
        }
        return null;
      },
      getLatestRevision: (modelId: string) => {
        if (modelId === MODEL_ID) {
          return { 
            revisionHash: currentRevHash,
            snapshot: {
              geometryState: { geometryHash: currentGeomHash }
            }
          };
        }
        return null;
      }
    };
    SimulationIdentityService.initialize(mockRevisionEngine);

    // Helper to build synthetic scenario
    const buildSyntheticScenario = (
      id: string,
      revision: string,
      geomHash: string,
      revHash: string,
      matId = 'MAT_STEEL_316L',
      solverConfigHash = 'SOLVER_CONFIG_STD'
    ): SimulationScenario => ({
      id,
      name: `Scenario ${id}`,
      description: 'FEA Stress Analysis',
      domain: 'AEROSPACE',
      status: ScenarioLifecycle.VALIDATED,
      geometry: {
        modelId: MODEL_ID,
        revision,
        hash: revHash,
        geometryHash: geomHash
      },
      material: {
        materialId: matId,
        revision: 'R1',
        propertiesHash: `prop_hash_${matId}`
      },
      loads: [
        { id: 'L1', type: 'PRESSURE', magnitude: 10, unit: 'MPa', reference: 'Face_01' }
      ],
      boundaryConditions: [
        { id: 'BC1', type: 'FIXED', value: 0, unit: 'mm', location: 'Root', reference: 'Face_02' }
      ],
      solver: {
        solverId: 'SOLVER_FEA_3D',
        version: 'v2.1',
        configurationHash: solverConfigHash,
        settings: { tolerance: 1e-6 }
      },
      mesh: {
        meshId: 'MESH_01',
        revision: 'R1',
        elementType: 'TET10',
        elementCount: 50000,
        hash: 'mesh_hash_50k'
      },
      parameters: [
        { id: 'diameter', name: 'Diameter', value: 100, type: ParameterType.NUMBER },
        { id: 'thickness', name: 'Thickness', value: 5, type: ParameterType.NUMBER }
      ],
      revision,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'ENG_USER_01'
    });

    // Clear registry before tests
    SimulationExecutionRegistry.clear();

    // =========================================================================
    // POSITIVE TESTS (P1 -> P5)
    // =========================================================================

    // P1: Valid Simulation Execution in Rev A
    try {
      const scenarioA = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH);
      const resultA = SimulationEngine.runScenario(scenarioA, REV_A_HASH, GEOM_1_HASH);
      const isAuth = QualityGate.authorizeAiInference(resultA, 'LEVEL_1_SYNTHETIC', REV_A_HASH, GEOM_1_HASH);
      console.log('P1 DIAGNOSTICS:', {
        status: resultA.status,
        hasBinding: !!resultA.derivedArtifactBinding,
        isAuth
      });
      details.push({
        testId: 'P1',
        description: 'Valid simulation execution in Rev A passes QualityGate authorization',
        passed: resultA.status === 'SAFE' && resultA.derivedArtifactBinding !== undefined && isAuth === true
      });
    } catch (e: any) {
      console.error('P1 Failure Exception:', e);
      details.push({ testId: 'P1', description: 'Valid simulation Rev A', passed: false, details: e.stack || e.message });
    }

    // P2: Valid Re-execution
    try {
      const scenarioA = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH);
      const resultA1 = SimulationEngine.runScenario(scenarioA, REV_A_HASH, GEOM_1_HASH);
      const resultA2 = SimulationEngine.runScenario(scenarioA, REV_A_HASH, GEOM_1_HASH);
      details.push({
        testId: 'P2',
        description: 'Valid re-execution produces consistent authentic result registered in execution registry',
        passed: resultA1.provenanceHash === resultA2.provenanceHash &&
                SimulationExecutionRegistry.verifyExecution(resultA1.provenanceHash!)
      });
    } catch (e: any) {
      details.push({ testId: 'P2', description: 'Valid re-execution', passed: false, details: e.message });
    }

    // P3: Valid Regeneration after CAD Revision
    try {
      // Update mock revision engine to GEOM_2_HASH for Rev B
      currentRevHash = REV_B_HASH;
      currentGeomHash = GEOM_2_HASH;
      
      const scenarioB = buildSyntheticScenario('SCEN_01', 'REV_B', GEOM_2_HASH, REV_B_HASH);
      const resultB = SimulationEngine.runScenario(scenarioB, REV_B_HASH, GEOM_2_HASH);
      const isAuthB = QualityGate.authorizeAiInference(resultB, 'LEVEL_1_SYNTHETIC', REV_B_HASH, GEOM_2_HASH);
      details.push({
        testId: 'P3',
        description: 'Regenerated simulation result for Rev B possesses valid binding to REV_B_HASH',
        passed: resultB.derivedArtifactBinding?.cadRevisionHash === REV_B_HASH && isAuthB === true
      });
      // Reset mock back
      currentRevHash = REV_A_HASH;
      currentGeomHash = GEOM_1_HASH;
    } catch (e: any) {
      details.push({ testId: 'P3', description: 'Valid regeneration Rev B', passed: false, details: e.message });
    }

    // P4: Identical Geometry Across Two Legitimate Revisions
    try {
      const scenarioA = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH);
      const resultA = SimulationEngine.runScenario(scenarioA, REV_A_HASH, GEOM_1_HASH);
      
      // Update mock to Rev B
      currentRevHash = REV_B_HASH;
      currentGeomHash = GEOM_1_HASH;

      // Scenario B has identical geometry hash GEOM_1_HASH but target revision REV_B_HASH
      const scenarioB = buildSyntheticScenario('SCEN_01', 'REV_B', GEOM_1_HASH, REV_B_HASH);
      const resultB = SimulationEngine.runScenario(scenarioB, REV_B_HASH, GEOM_1_HASH);

      const verifyA_in_A = CanonicalDerivedArtifactBinding.verifyBinding(resultA.derivedArtifactBinding!, REV_A_HASH, GEOM_1_HASH);
      const verifyA_in_B = CanonicalDerivedArtifactBinding.verifyBinding(resultA.derivedArtifactBinding!, REV_B_HASH, GEOM_1_HASH);
      const verifyB_in_B = CanonicalDerivedArtifactBinding.verifyBinding(resultB.derivedArtifactBinding!, REV_B_HASH, GEOM_1_HASH);

      details.push({
        testId: 'P4',
        description: 'Identical geometry across distinct CAD revisions produces distinct revision-bound artifact digests',
        passed: verifyA_in_A.isValid && !verifyA_in_B.isValid && verifyB_in_B.isValid &&
                resultA.derivedArtifactBinding?.artifactDigest !== resultB.derivedArtifactBinding?.artifactDigest
      });
      // Reset mock back
      currentRevHash = REV_A_HASH;
      currentGeomHash = GEOM_1_HASH;
    } catch (e: any) {
      details.push({ testId: 'P4', description: 'Identical geometry distinct revisions', passed: false, details: e.message });
    }

    // P5: Valid Downstream AI Analysis
    try {
      const scenarioA = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH);
      const resultA = SimulationEngine.runScenario(scenarioA, REV_A_HASH, GEOM_1_HASH);
      const insights = EngineeringAiEngine.analyzeDesignContext(null, resultA, REV_A_HASH, GEOM_1_HASH);
      details.push({
        testId: 'P5',
        description: 'Engineering AI engine accepts valid simulation result bound to target CAD revision',
        passed: insights.length > 0 && !insights.some(i => i.message.includes('binding verification failed'))
      });
    } catch (e: any) {
      details.push({ testId: 'P5', description: 'Valid AI analysis', passed: false, details: e.message });
    }

    // =========================================================================
    // ADVERSARIAL ATTACK TESTS (S1 -> S10)
    // =========================================================================

    // S1: Cross-Revision Replay Attack
    try {
      const scenarioA = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH);
      const resultA = SimulationEngine.runScenario(scenarioA, REV_A_HASH, GEOM_1_HASH);
      
      let blocked = false;
      try {
        QualityGate.authorizeAiInference(resultA, 'LEVEL_1_SYNTHETIC', REV_B_HASH, GEOM_1_HASH);
      } catch (err: any) {
        blocked = err.message.includes('AI_INFERENCE_DENIED');
      }

      details.push({
        testId: 'S1',
        description: 'Cross-revision replay of Simulation Result A into Revision B context is rejected',
        passed: blocked
      });
    } catch (e: any) {
      details.push({ testId: 'S1', description: 'Cross-revision replay attack', passed: false, details: e.message });
    }

    // S2: Identical Geometry Cross-Revision Separation
    try {
      const scenarioA = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH);
      const resultA = SimulationEngine.runScenario(scenarioA, REV_A_HASH, GEOM_1_HASH);

      const insightsB = EngineeringAiEngine.analyzeDesignContext(null, resultA, REV_B_HASH, GEOM_1_HASH);
      details.push({
        testId: 'S2',
        description: 'AI Engine flags warning when presented with Rev A simulation result for Rev B context with identical geometry',
        passed: insightsB.some(i => i.message.includes('binding verification failed'))
      });
    } catch (e: any) {
      details.push({ testId: 'S2', description: 'Identical geometry separation', passed: false, details: e.message });
    }

    // S3: Scenario Substitution Attack
    try {
      const scenarioA = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH);
      const resultA = SimulationEngine.runScenario(scenarioA, REV_A_HASH, GEOM_1_HASH);

      // Mutate scenarioId in binding payload
      const tamperedBinding = {
        ...resultA.derivedArtifactBinding!,
        payload: { ...resultA.derivedArtifactBinding!.payload, scenarioId: 'SCEN_SUBSTITUTED_99' }
      };
      const tamperedResult = { ...resultA, derivedArtifactBinding: tamperedBinding };

      let blocked = false;
      try {
        QualityGate.authorizeAiInference(tamperedResult, 'LEVEL_1_SYNTHETIC', REV_A_HASH, GEOM_1_HASH);
      } catch (err: any) {
        blocked = err.message.includes('AI_INFERENCE_DENIED');
      }

      details.push({
        testId: 'S3',
        description: 'Scenario substitution tampering invalidates derived binding digest and is rejected',
        passed: blocked
      });
    } catch (e: any) {
      details.push({ testId: 'S3', description: 'Scenario substitution attack', passed: false, details: e.message });
    }

    // S4: Solver Configuration Mutation Attack
    try {
      const scenario1 = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH, 'MAT_AL_6061', 'SOLVER_FEA_EXACT');
      const scenario2 = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH, 'MAT_AL_6061', 'SOLVER_FEA_INACCURATE');

      const result1 = SimulationEngine.runScenario(scenario1, REV_A_HASH, GEOM_1_HASH);
      const result2 = SimulationEngine.runScenario(scenario2, REV_A_HASH, GEOM_1_HASH);

      details.push({
        testId: 'S4',
        description: 'Solver configuration mutation changes solverConfigurationHash and yields distinct result bindings',
        passed: result1.solverConfigurationHash !== result2.solverConfigurationHash &&
                result1.provenanceHash !== result2.provenanceHash
      });
    } catch (e: any) {
      details.push({ testId: 'S4', description: 'Solver config mutation', passed: false, details: e.message });
    }

    // S5: Material Mutation Attack
    try {
      const scenarioSteel = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH, 'MAT_STEEL_316L');
      const scenarioAluminum = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH, 'MAT_AL_6061');

      const resultSteel = SimulationEngine.runScenario(scenarioSteel, REV_A_HASH, GEOM_1_HASH);
      const resultAluminum = SimulationEngine.runScenario(scenarioAluminum, REV_A_HASH, GEOM_1_HASH);

      details.push({
        testId: 'S5',
        description: 'Material property mutation alters materialHash and produces distinct derived artifact digests',
        passed: resultSteel.materialHash !== resultAluminum.materialHash &&
                resultSteel.provenanceHash !== resultAluminum.provenanceHash
      });
    } catch (e: any) {
      details.push({ testId: 'S5', description: 'Material mutation attack', passed: false, details: e.message });
    }

    // S6: Boundary Condition Mutation Attack
    try {
      const scenarioBc1 = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH);
      const scenarioBc2 = {
        ...scenarioBc1,
        boundaryConditions: [{ id: 'BC2', type: 'SLIDER', value: 5, unit: 'mm', location: 'Tip', reference: 'Face_05' }]
      };

      const resultBc1 = SimulationEngine.runScenario(scenarioBc1, REV_A_HASH, GEOM_1_HASH);
      const resultBc2 = SimulationEngine.runScenario(scenarioBc2, REV_A_HASH, GEOM_1_HASH);

      details.push({
        testId: 'S6',
        description: 'Boundary condition mutation alters boundaryConditionHash and derived artifact digest',
        passed: resultBc1.boundaryConditionHash !== resultBc2.boundaryConditionHash &&
                resultBc1.provenanceHash !== resultBc2.provenanceHash
      });
    } catch (e: any) {
      details.push({ testId: 'S6', description: 'Boundary condition mutation', passed: false, details: e.message });
    }

    // S7: Result Hash Forgery Attack
    try {
      const forgedResult: SimulationResult = {
        maxStressMpa: 120,
        safetyFactor: 2.5,
        displacementMm: 0.02,
        criticalFeatureId: 'Fillet_001',
        status: 'SAFE',
        provenanceHash: 'forged_fake_hash_ffff1111222233334444555566667777888899990000ffff111122223333'
      };

      let blocked = false;
      try {
        QualityGate.authorizeAiInference(forgedResult, 'LEVEL_1_SYNTHETIC', REV_A_HASH, GEOM_1_HASH);
      } catch (err: any) {
        blocked = err.message.includes('AI_INFERENCE_DENIED') && err.message.includes('unauthenticated or unregistered');
      }

      details.push({
        testId: 'S7',
        description: 'Unregistered/forged result provenanceHash is rejected by QualityGate',
        passed: blocked
      });
    } catch (e: any) {
      details.push({ testId: 'S7', description: 'Result hash forgery', passed: false, details: e.message });
    }

    // S8: Synthetic Result Without Binding
    try {
      const scenarioA = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH);
      const resultA = SimulationEngine.runScenario(scenarioA, REV_A_HASH, GEOM_1_HASH);
      
      const unboundResult = { ...resultA, derivedArtifactBinding: undefined };

      let blocked = false;
      try {
        QualityGate.authorizeAiInference(unboundResult, 'LEVEL_1_SYNTHETIC', REV_A_HASH, GEOM_1_HASH);
      } catch (err: any) {
        blocked = err.message.includes('lacks required derivedArtifactBinding');
      }

      details.push({
        testId: 'S8',
        description: 'Simulation result lacking derived artifact binding is rejected when target CAD revision is specified',
        passed: blocked
      });
    } catch (e: any) {
      details.push({ testId: 'S8', description: 'Unbound synthetic result promotion', passed: false, details: e.message });
    }

    // S9: Stale Result Replay
    try {
      const scenarioA = buildSyntheticScenario('SCEN_01', 'REV_A', GEOM_1_HASH, REV_A_HASH);
      const resultA = SimulationEngine.runScenario(scenarioA, REV_A_HASH, GEOM_1_HASH);
      
      // Update mock revision engine to GEOM_2_HASH for Rev B
      currentRevHash = REV_B_HASH;
      currentGeomHash = GEOM_2_HASH;
      
      const staleResult = SimulationEngine.runScenario(scenarioA); // Geometry mismatch -> STALE_IDENTITY

      let blocked = false;
      try {
        QualityGate.authorizeAiInference(staleResult, 'LEVEL_1_SYNTHETIC', REV_A_HASH, GEOM_1_HASH);
      } catch (err: any) {
        blocked = err.message.includes('result is stale');
      }

      details.push({
        testId: 'S9',
        description: 'Stale identity result from modified underlying geometry is rejected by QualityGate',
        passed: staleResult.status === 'STALE_IDENTITY' && blocked
      });
      // Reset mock
      currentRevHash = REV_A_HASH;
      currentGeomHash = GEOM_1_HASH;
    } catch (e: any) {
      details.push({ testId: 'S9', description: 'Stale result replay', passed: false, details: e.message });
    }

    // S10: Consumer Bypass Attempt
    try {
      const forgedResult: SimulationResult = {
        maxStressMpa: 50,
        safetyFactor: 3.0,
        displacementMm: 0.01,
        criticalFeatureId: 'Fillet_001',
        status: 'SAFE',
        provenanceHash: 'fake_provenance'
      };

      const insights = EngineeringAiEngine.analyzeDesignContext(null, forgedResult, REV_A_HASH, GEOM_1_HASH);
      
      details.push({
        testId: 'S10',
        description: 'Consumer boundary (AI Engine) rejects forged result lacking valid binding for target CAD revision',
        passed: insights.some(i => i.message.includes('lacks required derived artifact binding'))
      });
    } catch (e: any) {
      details.push({ testId: 'S10', description: 'Consumer bypass attempt', passed: false, details: e.message });
    }

    const passedCount = details.filter(d => d.passed).length;
    const failedCount = details.length - passedCount;

    return {
      totalTests: details.length,
      passedCount,
      failedCount,
      details
    };
  }
}
