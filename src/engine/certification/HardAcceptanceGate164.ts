/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-164: Hard Acceptance Gate 164
 * 
 * Strict quality and security assessment gate for industrial Simulation Certificates,
 * running compliant and adversarial validation routines.
 */

import { AttestationCanonicalizer } from '../attestation/AttestationCanonicalizer';
import { CryptographicAttestationEngine } from '../attestation/CryptographicAttestationEngine';
import { CryptographicAttestation, SigningKeyPair } from '../attestation/types';
import { AttestationSigner } from '../attestation/AttestationSigner';
import { SimulationCertificateEngine } from './SimulationCertificateEngine';
import { SimulationScenario } from '../simulation/SimulationScenarioTypes';
import { SimulationIdentityService } from '../simulation/SimulationIdentityService';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { RevisionEngine } from '../revision/RevisionEngine';
import {
  SimulationCertificate,
  SimulationCertificationPolicy,
  SimulationCertificationLevel,
  SimulationInputManifest,
  SimulationExecutionManifest,
  SimulationResultManifest,
  SimulationVerificationMatrix,
} from './simulationTypes';

export interface GateCheck {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly passed: boolean;
  readonly verdict: string;
}

export interface GateReport164 {
  readonly gateId: string;
  readonly patch: 'PATCH-164';
  readonly verdict: 'PASS' | 'FAIL';
  readonly passedChecks: number;
  readonly totalChecks: number;
  readonly checks: readonly GateCheck[];
}

export class HardAcceptanceGate164 {
  private static readonly keyPair: SigningKeyPair = AttestationSigner.generateTestKeyPair('HMAC-SHA256', 'KEY-GATE-164-HMAC');

  public static evaluate(): GateReport164 {
    const checks: GateCheck[] = [];
    const engine = SimulationCertificateEngine.getInstance();
    engine.resetRegistry();

    // 1. Initialize Authoritative Identity for the Gate context
    const revisionEngine = new RevisionEngine();
    const testModelId = 'PART-998';
    const testRevHash = 'HASH-CAD-NURBS-GEOM-998';
    const testGeomHash = 'HASH-CAD-NURBS-GEOM-998';

    revisionEngine.registerRevision({
        modelId: testModelId,
        revisionId: 'REV-07',
        revisionHash: testRevHash,
        snapshot: { geometryState: { geometryHash: testGeomHash } } as any,
        author: 'GATE-164-SETUP',
        timestamp: new Date().toISOString()
    });
    SimulationIdentityService.initialize(revisionEngine);

    // 2. Run Canonical Simulation via SimulationEngine (The ONLY authorized production path)
    const scenario: SimulationScenario = {
      id: 'SCENARIO-CFD-998',
      geometry: { modelId: testModelId, geometryHash: testGeomHash },
      revision: 'REV-07',
      material: { materialId: 'MAT-WATER' },
      mesh: { hash: 'HASH-MESH-CFD-018' },
      solver: { solverId: 'CFD-SOLVER-N-S-V4' },
      parameters: [
        { id: 'diameter', name: 'Diameter', value: 100 },
        { id: 'thickness', name: 'Thickness', value: 5 }
      ],
      boundaryConditions: [],
      loads: []
    };

    const simResult = SimulationEngine.runScenario(scenario, testRevHash, testGeomHash);
    const testResultHash = simResult.provenanceHash!;

    const policy: SimulationCertificationPolicy = {
      policyId: 'POL-SIM-SAFETY-CRITICAL-164',
      policyVersion: '1.0.0',
      requiredClaims: ['CFD_CONVERGED', 'MASS_CONSERVED', 'STABILITY_OK'],
      minCertificationLevel: 3,
      requiredSolverIdentity: 'CFD-SOLVER-N-S-V4',
      requiredSolverVersion: '4.2.1',
      requireConvergence: true,
      requireConservation: true,
      requireStability: true,
    };

    const cfdInputParams = {
      fluid: 'Water',
      density: 997,
      viscosity: 0.001002,
      boundaryConditions: { inletVelocity: 1.5, outletPressure: 0.0 },
      initialConditions: { pressure: 0.0, velocity: 0.0 },
      solverSettings: { relaxU: 0.7, relaxP: 0.3 },
      timeStep: 0.005,
      convergenceCriteria: { continuity: 1e-5, momentum: 1e-5 },
      turbulenceModel: 'k-omega-SST',
      numericalSchemes: { divScheme: 'upwind' },
    };

    const computedSimId = SimulationCertificateEngine.computeSimulationId({
      engineeringObjectId: 'PART-998',
      objectRevision: 'REV-07',
      simulationType: 'CFD',
      modelHash: 'HASH-CAD-NURBS-GEOM-998',
      meshHash: 'HASH-MESH-CFD-018',
      materialHash: 'HASH-MAT-WATER',
      boundaryConditionHash: 'HASH-BC-INLET-1.5',
      solverConfigurationHash: 'HASH-SOLV-CONFIG-NS-V4',
    });

    // --- BASE STANDARD COMPLIANT INPUTS ---
    const rawInput: Omit<SimulationInputManifest, 'inputHash'> = {
      simulationId: computedSimId,
      simulationType: 'CFD',
      projectId: 'PRJ-164-RELIABILITY',
      engineeringObjectId: 'PART-998',
      objectRevision: 'REV-07',
      modelHash: 'HASH-CAD-NURBS-GEOM-998',
      geometryHash: 'HASH-CAD-NURBS-GEOM-998',
      meshHash: 'HASH-MESH-CFD-018',
      materialHash: 'HASH-MAT-WATER',
      boundaryConditionHash: 'HASH-BC-INLET-1.5',
      initialConditionHash: 'HASH-IC-STAGNANT',
      solverConfigurationHash: 'HASH-SOLV-CONFIG-NS-V4',
      cfdParameters: cfdInputParams,
    };

    const inputManifest = engine.buildSimulationInputManifest(rawInput);

    const executionManifest = engine.buildSimulationExecutionManifest({
      executionId: 'EXEC-721A-49F1',
      simulationId: inputManifest.simulationId,
      solverIdentity: 'CFD-SOLVER-N-S-V4',
      solverVersion: '4.2.1',
      runtime: 'Ubuntu 24.04 LTS (x86_64)',
      platform: 'HPC-NODE-CLUSTER-05',
      configuration: { cores: 64, precision: 'double' },
      startTime: '2026-08-22T00:00:00Z',
      endTime: '2026-08-22T00:15:30Z',
      iterationCount: 350,
      terminationReason: 'CONVERGED',
    });

    const resultManifest = engine.buildSimulationResultManifest({
      resultId: 'RES-918B-882E',
      resultHash: testResultHash,
      fieldHashes: { pressure: 'HASH-FLD-P', velocity: 'HASH-FLD-U' },
      scalarResults: { dragCoefficient: 0.42, maxPressureDrop: 12500 },
      vectorResults: { liftForces: [0.01, 0.02, 0.85] },
      iterationData: [],
      residualHistory: [{ continuity: 8e-6, momentum: 5e-6 }],
      conservationMetrics: { massError: 1e-7, momentumError: 1e-6, isConserved: true },
      convergenceMetrics: { isConverged: true, residualTolerance: 1e-5, finalResiduals: { continuity: 8e-6, momentum: 5e-6 } },
      solverTerminationState: 'CONVERGED_RESIDUAL_BELOW_TOLERANCE',
    });

    const matrix = engine.buildSimulationVerificationMatrix({
      verificationId: 'MAT-164-998',
      simulationId: inputManifest.simulationId,
      resultId: resultManifest.resultId,
      claims: [
        { claimId: 'CLM-01', claimType: 'CONVERGENCE', description: 'CFD converged fully', passed: true, evidenceReference: 'RES-918B-882E' },
        { claimId: 'CLM-02', claimType: 'CONSERVATION', description: 'Mass conserved', passed: true, evidenceReference: 'RES-918B-882E' },
        { claimId: 'CLM-03', claimType: 'STABILITY', description: 'Stability OK', passed: true, evidenceReference: 'RES-918B-882E' },
      ],
    });

    // Create a mock cryptographic attestation that perfectly matches inputs and outputs
    const attestationResult = CryptographicAttestationEngine.createAttestation({
      subject: {
        subjectId: inputManifest.engineeringObjectId,
        subjectType: 'CFD_RESULT',
        revision: inputManifest.objectRevision,
        artifactHash: resultManifest.resultHash,
      },
      evidence: {
        evidenceId: matrix.verificationId,
        evidenceType: 'SIMULATION_MATRIX',
        payload: { claims: matrix.claims },
        resultHash: resultManifest.resultHash,
      },
      executionContext: {
        executionId: executionManifest.executionId,
        solverIdentity: executionManifest.solverIdentity,
        solverVersion: executionManifest.solverVersion,
        engineeringIdentity: 'SECP-SIMULATION-AUTHORITY',
        inputs: inputManifest,
        outputs: resultManifest,
        inputHash: inputManifest.inputHash,
        outputHash: resultManifest.resultHash,
      },
      keyPair: this.keyPair,
    });

    const attestation = attestationResult.attestation!;

    // --- TEST 1: Compliant Simulation Certificate ---
    const standardCertResult = engine.createSimulationCertificate({
      input: inputManifest,
      execution: executionManifest,
      result: resultManifest,
      matrix,
      attestation,
      policy,
      issuer: 'SECP-SIMULATION-AUTHORITY',
      keyPair: this.keyPair,
    });

    checks.push({
      id: 'SEC-164-01',
      name: 'Compliant Simulation Certificate',
      description: 'Standard compliant solver inputs and physics checks generate a VALID certified certificate.',
      passed: standardCertResult.success && standardCertResult.certificate?.certificationStatus === 'CERTIFIED',
      verdict: standardCertResult.success ? 'CERTIFIED' : 'FAILED',
    });

    // --- TEST 2: Verification and Identity Determinism ---
    const verifyCompliantResult = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: inputManifest,
      currentExecution: executionManifest,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: attestation,
      currentPolicy: policy,
    });

    checks.push({
      id: 'SEC-164-02',
      name: 'Simulation Certificate Verification',
      description: 'Independent verify of unmodified certificate returns CERTIFIED verdict.',
      passed: verifyCompliantResult.verdict === 'CERTIFIED' && verifyCompliantResult.certificationLevel === 5,
      verdict: verifyCompliantResult.verdict,
    });

    // --- ADVERSARIAL QUALIFICATIONS (Section 18) ---

    // 1. Alter Geometry
    const badGeomInput = { ...inputManifest, modelHash: 'ALTERED-GEOM-999', inputHash: 'CALCULATED-BAD-HASH' };
    const badGeomVerify = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: badGeomInput,
      currentExecution: executionManifest,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: attestation,
    });
    checks.push({
      id: 'SEC-164-03',
      name: 'Adversarial: Geometry Modification',
      description: 'Alteration of CAD B-Rep Geometry hash fails verification.',
      passed: badGeomVerify.verdict === 'INVALID',
      verdict: badGeomVerify.verdict,
    });

    // 2. Alter Mesh
    const badMeshInput = { ...inputManifest, meshHash: 'ALTERED-MESH-999', inputHash: 'CALCULATED-BAD-HASH' };
    const badMeshVerify = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: badMeshInput,
      currentExecution: executionManifest,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: attestation,
    });
    checks.push({
      id: 'SEC-164-04',
      name: 'Adversarial: Mesh Alteration',
      description: 'Altering underlying CFD/FEM mesh representation fails verification.',
      passed: badMeshVerify.verdict === 'INVALID',
      verdict: badMeshVerify.verdict,
    });

    // 3. Alter Material
    const badMaterialInput = { ...inputManifest, materialHash: 'ALTERED-MAT-AIR', inputHash: 'CALCULATED-BAD-HASH' };
    const badMaterialVerify = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: badMaterialInput,
      currentExecution: executionManifest,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: attestation,
    });
    checks.push({
      id: 'SEC-164-05',
      name: 'Adversarial: Material Spec Modification',
      description: 'Substituting materials (e.g. density/viscosity) fails verification.',
      passed: badMaterialVerify.verdict === 'INVALID',
      verdict: badMaterialVerify.verdict,
    });

    // 4. Alter Boundary Condition
    const badBCInput = { ...inputManifest, boundaryConditionHash: 'ALTERED-BC-JET', inputHash: 'CALCULATED-BAD-HASH' };
    const badBCVerify = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: badBCInput,
      currentExecution: executionManifest,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: attestation,
    });
    checks.push({
      id: 'SEC-164-06',
      name: 'Adversarial: Boundary Condition Alteration',
      description: 'Tampering with physical boundary velocities/forces is caught.',
      passed: badBCVerify.verdict === 'INVALID',
      verdict: badBCVerify.verdict,
    });

    // 5. Alter Initial Condition
    const badICInput = { ...inputManifest, initialConditionHash: 'ALTERED-IC-TURBULENT', inputHash: 'CALCULATED-BAD-HASH' };
    const badICVerify = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: badICInput,
      currentExecution: executionManifest,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: attestation,
    });
    checks.push({
      id: 'SEC-164-07',
      name: 'Adversarial: Initial Condition Tampering',
      description: 'Modifying CFD pressure/velocity field starts triggers invalid state.',
      passed: badICVerify.verdict === 'INVALID',
      verdict: badICVerify.verdict,
    });

    // 6. Alter Solver Version
    const badSolverVersionExec = { ...executionManifest, solverVersion: '5.0.0-VULNERABLE' };
    const badSolverVerify = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: inputManifest,
      currentExecution: badSolverVersionExec,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: attestation,
    });
    checks.push({
      id: 'SEC-164-08',
      name: 'Adversarial: Solver Version Swap',
      description: 'Forced modification of execution solver identity or version fails verification.',
      passed: badSolverVerify.verdict === 'INVALID',
      verdict: badSolverVerify.verdict,
    });

    // 7. Alter Solver Configuration
    const badConfigInput = { ...inputManifest, solverConfigurationHash: 'ALTERED-SOLVER-SCHEME', inputHash: 'CALCULATED-BAD-HASH' };
    const badConfigVerify = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: badConfigInput,
      currentExecution: executionManifest,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: attestation,
    });
    checks.push({
      id: 'SEC-164-09',
      name: 'Adversarial: Solver Parameter Alteration',
      description: 'Modifying solver matrix schemes (e.g. upwind to central diff) fails.',
      passed: badConfigVerify.verdict === 'INVALID',
      verdict: badConfigVerify.verdict,
    });

    // 8. Alter Result
    const badResultOutput = { ...resultManifest, resultHash: 'ALTERED-MASSIVE-LIFT-999' };
    const badResultVerify = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: inputManifest,
      currentExecution: executionManifest,
      currentResult: badResultOutput,
      currentMatrix: matrix,
      currentAttestation: attestation,
    });
    checks.push({
      id: 'SEC-164-10',
      name: 'Adversarial: Result Payload Tampering',
      description: 'Malicious modification of numeric result payload triggers hash mismatch.',
      passed: badResultVerify.verdict === 'INVALID',
      verdict: badResultVerify.verdict,
    });

    // 9. Alter Residual History
    const badResidualsResult = { ...resultManifest, residualHistory: [{ continuity: NaN, momentum: NaN }] };
    const badResidualsCert = engine.createSimulationCertificate({
      input: inputManifest,
      execution: executionManifest,
      result: badResidualsResult,
      matrix,
      attestation,
      policy,
    });
    checks.push({
      id: 'SEC-164-11',
      name: 'Adversarial: Residual History NaN Tampering',
      description: 'Injecting NaN/unstable metrics blocks LEVEL 5 certificate issuance.',
      passed: !badResidualsCert.success && badResidualsCert.certificate?.certificationStatus !== 'CERTIFIED',
      verdict: badResidualsCert.success ? 'CERTIFIED' : 'INVALID',
    });

    // 10. Alter Convergence Status
    const badConvResult = {
      ...resultManifest,
      convergenceMetrics: { isConverged: false, residualTolerance: 1e-5, finalResiduals: { continuity: 1e-1, momentum: 1e-1 } },
    };
    const badConvCert = engine.createSimulationCertificate({
      input: inputManifest,
      execution: executionManifest,
      result: badConvResult,
      matrix,
      attestation,
      policy,
    });
    checks.push({
      id: 'SEC-164-12',
      name: 'Adversarial: Non-Converged Simulation',
      description: 'Rejects CERTIFIED status if numerical solver failed convergence.',
      passed: !badConvCert.success,
      verdict: badConvCert.success ? 'CERTIFIED' : 'INVALID',
    });

    // 11. Alter Conservation Metrics
    const badConsResult = {
      ...resultManifest,
      conservationMetrics: { massError: 5.5, momentumError: 0.1, isConserved: false },
    };
    const badConsCert = engine.createSimulationCertificate({
      input: inputManifest,
      execution: executionManifest,
      result: badConsResult,
      matrix,
      attestation,
      policy,
    });
    checks.push({
      id: 'SEC-164-13',
      name: 'Adversarial: Mass/Momentum Conservation Violation',
      description: 'Rejects certification if physical conservation equations are violated.',
      passed: !badConsCert.success,
      verdict: badConsCert.success ? 'CERTIFIED' : 'INVALID',
    });

    // 12. Alter Execution ID
    const badExecManifest = { ...executionManifest, executionId: 'EXEC-999X-SPURIOUS' };
    const badExecVerify = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: inputManifest,
      currentExecution: badExecManifest,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: attestation,
    });
    checks.push({
      id: 'SEC-164-14',
      name: 'Adversarial: Execution ID Splice',
      description: 'Replaying certificate against unauthorized execution context is caught.',
      passed: badExecVerify.verdict === 'INVALID',
      verdict: badExecVerify.verdict,
    });

    // 13. Use Evidence from Another Simulation
    const spuriousMatrix = { ...matrix, verificationId: 'MAT-SPURIOUS-999' };
    const spuriousMatrixVerify = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: inputManifest,
      currentExecution: executionManifest,
      currentResult: resultManifest,
      currentMatrix: spuriousMatrix,
      currentAttestation: attestation,
    });
    checks.push({
      id: 'SEC-164-15',
      name: 'Adversarial: Spurious Evidence Injection',
      description: 'Injecting unrelated matrix verification reference fails validation.',
      passed: spuriousMatrixVerify.verdict === 'INVALID',
      verdict: spuriousMatrixVerify.verdict,
    });

    // 14. Use Attestation from Another Execution
    const spuriousAttestation = { ...attestation, attestationId: 'ATT-SPURIOUS-XYZ' };
    const spuriousAttVerify = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: inputManifest,
      currentExecution: executionManifest,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: spuriousAttestation,
    });
    checks.push({
      id: 'SEC-164-16',
      name: 'Adversarial: Spurious Attestation Splice',
      description: 'Binding a valid certificate to a different cryptographic attestation fails.',
      passed: spuriousAttVerify.verdict === 'INVALID',
      verdict: spuriousAttVerify.verdict,
    });

    // 15. Alter Certification Policy
    const badPolicy: SimulationCertificationPolicy = { ...policy, requireStability: false, minCertificationLevel: 1 as SimulationCertificationLevel };
    const verifyBadPolicyResult = engine.verifySimulationCertificate(standardCertResult.certificate!, {
      currentInput: inputManifest,
      currentExecution: executionManifest,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: attestation,
      currentPolicy: badPolicy,
    });
    checks.push({
      id: 'SEC-164-17',
      name: 'Adversarial: Modified Policy Enforcement',
      description: 'Altering policy details post-issuance invalidates the certificate parameters.',
      passed: verifyBadPolicyResult.verdict === 'INVALID' && !verifyBadPolicyResult.policyVerified,
      verdict: verifyBadPolicyResult.verdict,
    });

    // 16. Revocation Protocol Enforcement
    const revokeResult = engine.revokeSimulationCertificate(standardCertResult.certificate!.certificateId, 'RESULT_MODIFIED', 'CHIEF-AUDITOR');
    const revokeVerify = engine.verifySimulationCertificate(revokeResult.certificate!, {
      currentInput: inputManifest,
      currentExecution: executionManifest,
      currentResult: resultManifest,
      currentMatrix: matrix,
      currentAttestation: attestation,
    });
    checks.push({
      id: 'SEC-164-18',
      name: 'Certificate Revocation Verification',
      description: 'Revoked certificates return REVOKED status, preventing false claims.',
      passed: revokeVerify.verdict === 'REVOKED',
      verdict: revokeVerify.verdict,
    });

    const passedChecks = checks.filter(c => c.passed).length;
    const failedChecks = checks.filter(c => !c.passed);
    if (failedChecks.length > 0) {
      console.log('FAILED CHECKS DETAILS:', JSON.stringify(failedChecks, null, 2));
    }
    const verdict = passedChecks === checks.length ? 'PASS' : 'FAIL';

    return {
      gateId: 'GATE-164-SIMULATION-CERTIFICATION',
      patch: 'PATCH-164',
      verdict,
      passedChecks,
      totalChecks: checks.length,
      checks,
    };
  }
}
