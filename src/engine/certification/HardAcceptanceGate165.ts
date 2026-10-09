/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-165: Hard Acceptance Gate 165
 * 
 * Quality and security assessment gate for Manufacturing Certificates.
 * Evaluates the full suite of 25 adversarial and compliant forensic tests.
 */

import { AttestationCanonicalizer } from '../attestation/AttestationCanonicalizer';
import { CryptographicAttestationEngine } from '../attestation/CryptographicAttestationEngine';
import { CryptographicAttestation, SigningKeyPair } from '../attestation/types';
import { AttestationSigner } from '../attestation/AttestationSigner';
import { ManufacturingCertificateEngine } from './ManufacturingCertificateEngine';
import {
  ManufacturingCertificate,
  ManufacturingCertificationPolicy,
  ManufacturingInputManifest,
  ManufacturingToolpathManifest,
  ManufacturingCollisionVerification,
  GCodeVerificationResult,
  MachineExecutionEvidence,
  ManufacturingInspectionEvidence,
  ManufacturingVerificationMatrix,
} from './manufacturingTypes';

export interface GateCheck {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly passed: boolean;
  readonly verdict: string;
}

export interface GateReport165 {
  readonly gateId: string;
  readonly patch: 'PATCH-165';
  readonly verdict: 'PASS' | 'FAIL';
  readonly passedChecks: number;
  readonly totalChecks: number;
  readonly checks: readonly GateCheck[];
}

export class HardAcceptanceGate165 {
  private static readonly keyPair: SigningKeyPair = AttestationSigner.generateTestKeyPair('HMAC-SHA256', 'KEY-GATE-165-HMAC');

  public static evaluate(): GateReport165 {
    const checks: GateCheck[] = [];
    const engine = ManufacturingCertificateEngine.getInstance();
    engine.resetRegistry();

    // --- POLICY DEFINITION ---
    const policy: ManufacturingCertificationPolicy = {
      policyId: 'POL-MFG-SAFETY-CRITICAL-165',
      policyVersion: '1.0.0',
      minCertificationLevel: 5,
      requiredClaims: [
        'DESIGN_IDENTITY_VERIFIED',
        'DESIGN_REVISION_VERIFIED',
        'TOOLPATH_INTEGRITY_VERIFIED',
        'GCODE_VERIFIED',
        'COLLISION_STATUS_VERIFIED',
        'EXECUTION_EVIDENCE_VERIFIED',
        'INSPECTION_EVIDENCE_VERIFIED',
      ],
      requirePostProcessorMatch: true,
      requireNoCollision: true,
      requireGCodeValidity: true,
      requireRealMachineExecution: true,
      requireInspectionPassed: true,
    };

    // Compute Stable Manufacturing ID for Baseline
    const computedMfgId = ManufacturingCertificateEngine.computeManufacturingId({
      designRevisionId: 'REV-01',
      manufacturingDefinitionHash: 'HASH-MFG-DEF-BASELINE',
      materialHash: 'HASH-MAT-AL-6061-T6',
      machineDefinitionHash: 'HASH-MACHINE-HAAS-VF2',
      toolLibraryHash: 'HASH-TOOL-LIB-BASELINE',
      camOperationHash: 'HASH-CAM-OP-BASELINE',
      postProcessorHash: 'HASH-POST-HAAS-BASELINE',
    });

    // --- SETUP STANDARDS & MANIFESTS ---
    const rawInput: Omit<ManufacturingInputManifest, 'inputHash' | 'manufacturingDefinitionHash'> = {
      manufacturingId: computedMfgId,
      projectId: 'PRJ-165-FORGING',
      design: {
        engineeringObjectId: 'PART-777',
        objectRevision: 'REV-01',
        geometryHash: 'HASH-GEOM-CAD-777',
        pmiMetadata: { flatnessTolerance: 0.02, surfaceFinishRa: 0.8 },
      },
      material: {
        materialId: 'MAT-AL-6061',
        materialRevision: 'A',
        materialState: 'T6',
        materialHash: 'HASH-MAT-AL-6061-T6',
      },
      cam: {
        operations: [{ operationId: 'OP-01', type: 'FACE_MILLING' }, { operationId: 'OP-02', type: 'POCKET_MILLING' }],
        strategies: ['FACE', 'POCKET'],
        cuttingParameters: {
          feeds: [250, 450],
          speeds: [1200, 2000],
          stepdown: 2.0,
          stepover: 35,
          tolerances: { standard: 0.01 },
        },
        camOperationHash: 'HASH-CAM-OP-BASELINE',
      },
      tooling: {
        toolId: 'TOOL-ENDMILL-12MM',
        toolGeometry: { flutes: 4, fluteLength: 25 },
        holder: 'CAT40-ER32',
        toolLength: 75.0,
        toolDiameter: 12.0,
        toolLibraryHash: 'HASH-TOOL-LIB-BASELINE',
      },
      machine: {
        machineId: 'HAAS-VF2',
        machineConfiguration: { travelX: 762, travelY: 406, maxSpindleSpeed: 10000 },
        axisConfiguration: 'XYZ',
        kinematicModel: '3-AXIS-VMC',
        limits: { maxFeedRate: 5000 },
        machineDefinitionHash: 'HASH-MACHINE-HAAS-VF2',
        kinematicsHash: 'HASH-KINEMATICS',
      },
      postProcessor: {
        postProcessorId: 'POST-HAAS-NGC',
        version: '1.2.0',
        configuration: { useCoolantG83: true },
        postProcessorHash: 'HASH-POST-HAAS-BASELINE',
      },
    };

    const input = engine.buildManufacturingInputManifest(rawInput);

    const toolpath = engine.buildToolpathManifest({
      toolpathId: 'TP-BASELINE-777',
      manufacturingId: computedMfgId,
      operations: [
        { operationId: 'OP-01', toolId: 'TOOL-ENDMILL-12MM', machineId: 'HAAS-VF2', kinematicsId: 'HASH-KINEMATICS', pathSegments: [], toolpathHash: 'HASH-PATH-SEG-01' },
        { operationId: 'OP-02', toolId: 'TOOL-ENDMILL-12MM', machineId: 'HAAS-VF2', kinematicsId: 'HASH-KINEMATICS', pathSegments: [], toolpathHash: 'HASH-PATH-SEG-02' },
      ],
      numberOperations: 2,
      toolChanges: 0,
      rapidMoves: 25,
      cuttingMoves: 1200,
      feedRates: [250, 450],
      spindleSpeeds: [1200, 2000],
      totalPathLength: 3500.5,
      estimatedCycleTime: 480.0,
    });

    const collision: ManufacturingCollisionVerification = {
      collisionVerificationId: 'COLL-BASELINE-777',
      manufacturingId: computedMfgId,
      status: 'NO_COLLISION_DETECTED',
      checkedItems: {
        toolWorkpiece: true,
        holderWorkpiece: true,
        toolFixture: true,
        machineWorkpiece: true,
        machineFixture: true,
        axisLimitViolations: true,
        kinematicSingularities: true,
      },
    };
    engine.registerCollisionVerification(collision);

    const gcode = engine.buildGCodeVerificationManifest({
      manufacturingId: computedMfgId,
      gcodeHash: 'HASH-GCODE-PROGRAM-777',
      postProcessorId: 'POST-HAAS-NGC',
      isSyntaxValid: true,
      checkedItems: {
        syntax: true,
        toolCalls: true,
        toolNumbers: true,
        coordinates: true,
        feedRates: true,
        spindleCommands: true,
        machineLimits: true,
        unsupportedCommands: true,
        modalState: true,
        programStructure: true,
        postProcessorMatch: true,
      },
      status: 'GCODE_VALID',
    });

    const execution = engine.buildMachineExecutionManifest({
      executionId: 'EXEC-BASELINE-777',
      manufacturingId: computedMfgId,
      machineId: 'HAAS-VF2',
      machineConfigurationHash: 'HASH-MACHINE-HAAS-VF2',
      programHash: 'HASH-GCODE-PROGRAM-777',
      controllerId: 'HAAS-NGC-V3.4',
      executionStart: '2026-08-22T08:00:00Z',
      executionEnd: '2026-08-22T08:08:00Z',
      executionStatus: 'SUCCESS',
      telemetry: { averageSpindleLoad: 35.2, maxAxisLoad: 62.4 },
      alarmEvents: [],
      toolChanges: 0,
      cycleData: { actualCycleTime: 482.5 },
    });

    const inspection = engine.buildInspectionManifest({
      inspectionId: 'INSPECT-BASELINE-777',
      manufacturingId: computedMfgId,
      measurements: [
        {
          measurementId: 'MEAS-01',
          instrumentId: 'CMM-ZEISS-01',
          measurementValue: 12.001,
          unit: 'mm',
          tolerance: 0.005,
          measuredAt: '2026-08-22T09:30:00Z',
          measurementHash: 'HASH-MEAS-01',
          pass: true,
        },
      ],
      inspectionType: 'CMM',
    });

    const matrix: ManufacturingVerificationMatrix = {
      verificationId: 'VM-BASELINE-777',
      manufacturingId: computedMfgId,
      claims: [
        { claimId: 'CLM-01', claimType: 'COLLISION', description: 'Collision validation passed', passed: true, evidenceId: 'COLL-BASELINE-777' },
        { claimId: 'CLM-02', claimType: 'GCODE', description: 'G-Code syntax validated', passed: true, evidenceId: gcode.gcodeVerificationId },
      ],
    };
    engine.registerVerificationMatrix(matrix);

    // Create a valid cryptographic attestation
    const attestationParams = {
      subject: {
        subjectId: computedMfgId,
        subjectType: 'CAM_TOOLPATH',
        revision: 'REV-01',
        artifactHash: input.inputHash,
      },
      evidence: {
        evidenceId: 'EVID-BASE-777',
        evidenceType: 'MANUFACTURING_DEFINITION',
        payload: { inputHash: input.inputHash },
        resultHash: input.inputHash,
      },
      executionContext: {
        executionId: 'EXEC-BASE-777',
        solverIdentity: 'HAAS-POST-COMPILER',
        solverVersion: '1.0',
        engineeringIdentity: 'ENG-SECP-SYSTEM-AUTHORITY',
        inputs: {},
        outputs: {},
      },
    };
    const attResult = CryptographicAttestationEngine.createAttestation(attestationParams);
    const attestation = attResult.attestation!;

    // --- EVALUATING COMPLIANT BASELINE ---
    const baselineResult = engine.createManufacturingCertificate({
      input,
      toolpath,
      collision,
      gcode,
      execution,
      inspection,
      matrix,
      attestation,
      policy,
      engineeringIdentity: 'ENG-SECP-SYSTEM-AUTHORITY',
      keyPair: HardAcceptanceGate165.keyPair,
    });

    checks.push({
      id: 'SEC-165-00',
      name: 'Compliant Baseline Certification',
      description: 'Verifies that a fully aligned and audited manufacturing chain generates a Level 6 certified certificate.',
      passed: baselineResult.success && baselineResult.certificate?.certificationStatus === 'CERTIFIED' && baselineResult.certificate?.certificateLevel === 6,
      verdict: baselineResult.certificate?.certificationStatus || 'FAILED',
    });

    const trustedKeys = { [HardAcceptanceGate165.keyPair.keyId]: HardAcceptanceGate165.keyPair.publicKey };

    // ==========================================
    // --- 25 ADVERSARIAL TEST BATTERIES ---
    // ==========================================

    // Check 1: Mutation of Design Revision
    const mutInput1 = { ...input, design: { ...input.design, objectRevision: 'REV-MUTATED-01' } };
    const mutVerify1 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: mutInput1,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-01',
      name: 'Adversarial Check 1: Design Revision Mutation',
      description: 'Altering the design revision post-issuance must invalidate the verification status.',
      passed: mutVerify1.verdict === 'INVALID' && !mutVerify1.inputVerified,
      verdict: mutVerify1.verdict,
    });

    // Check 2: Mutation of Geometry Hash
    const mutInput2 = { ...input, design: { ...input.design, geometryHash: 'HASH-CAD-MUTATED-999' } };
    const mutVerify2 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: mutInput2,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-02',
      name: 'Adversarial Check 2: Geometry Hash Mutation',
      description: 'Altering the geometry hash in design input must trigger integrity failures.',
      passed: mutVerify2.verdict === 'INVALID' && !mutVerify2.inputVerified,
      verdict: mutVerify2.verdict,
    });

    // Check 3: Mutation of Material Specification
    const mutInput3 = { ...input, material: { ...input.material, materialId: 'MAT-AL-7075' } };
    const mutVerify3 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: mutInput3,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-03',
      name: 'Adversarial Check 3: Material Mutation',
      description: 'Altering material specifications breaks the physical-to-computational binding.',
      passed: mutVerify3.verdict === 'INVALID' && !mutVerify3.inputVerified,
      verdict: mutVerify3.verdict,
    });

    // Check 4: Mutation of Tool Library
    const mutInput4 = { ...input, tooling: { ...input.tooling, toolId: 'TOOL-BALLNOSE-6MM' } };
    const mutVerify4 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: mutInput4,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-04',
      name: 'Adversarial Check 4: Tooling Mutation',
      description: 'Using tools not defined in the original library breaks toolpath verifiability.',
      passed: mutVerify4.verdict === 'INVALID' && !mutVerify4.inputVerified,
      verdict: mutVerify4.verdict,
    });

    // Check 5: Mutation of Tool Holder
    const mutInput5 = { ...input, tooling: { ...input.tooling, holder: 'BT40-MUTATED' } };
    const mutVerify5 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: mutInput5,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-05',
      name: 'Adversarial Check 5: Tool Holder Mutation',
      description: 'Altering tool holders post-issuance invalidates the definition consistency.',
      passed: mutVerify5.verdict === 'INVALID' && !mutVerify5.inputVerified,
      verdict: mutVerify5.verdict,
    });

    // Check 6: Mutation of Machine Definition
    const mutInput6 = { ...input, machine: { ...input.machine, machineId: 'FANUC-ROBODRILL' } };
    const mutVerify6 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: mutInput6,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-06',
      name: 'Adversarial Check 6: Machine Definition Mutation',
      description: 'Executing the path on an un-certified machine model triggers physical mismatches.',
      passed: mutVerify6.verdict === 'INVALID' && !mutVerify6.inputVerified,
      verdict: mutVerify6.verdict,
    });

    // Check 7: Mutation of Machine Kinematics
    const mutInput7 = { ...input, machine: { ...input.machine, kinematicModel: '5-AXIS-TRUNNION' } };
    const mutVerify7 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: mutInput7,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-07',
      name: 'Adversarial Check 7: Kinematic Model Mutation',
      description: 'Changing kinematic models after certificate issuance must fail validation.',
      passed: mutVerify7.verdict === 'INVALID' && !mutVerify7.inputVerified,
      verdict: mutVerify7.verdict,
    });

    // Check 8: Mutation of Feed Rate
    const mutInput8 = { ...input, cam: { ...input.cam, cuttingParameters: { ...input.cam.cuttingParameters, feeds: [9999, 9999] } } };
    const mutVerify8 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: mutInput8,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-08',
      name: 'Adversarial Check 8: Feed Rate Mutation',
      description: 'Mutated feed rates in the CAM configuration are detected through input manifest changes.',
      passed: mutVerify8.verdict === 'INVALID' && !mutVerify8.inputVerified,
      verdict: mutVerify8.verdict,
    });

    // Check 9: Mutation of Spindle Speed
    const mutInput9 = { ...input, cam: { ...input.cam, cuttingParameters: { ...input.cam.cuttingParameters, speeds: [9999, 9999] } } };
    const mutVerify9 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: mutInput9,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-09',
      name: 'Adversarial Check 9: Spindle Speed Mutation',
      description: 'Altering spindle speeds violates CAM process boundaries, causing verification failure.',
      passed: mutVerify9.verdict === 'INVALID' && !mutVerify9.inputVerified,
      verdict: mutVerify9.verdict,
    });

    // Check 10: Mutation of Toolpath Manifest
    const mutToolpath = { ...toolpath, manifestHash: 'HASH-ALTERED-TOOLPATH' };
    const mutVerify10 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentToolpath: mutToolpath,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-10',
      name: 'Adversarial Check 10: Toolpath Manifest Mutation',
      description: 'Altering or mutating toolpath segments breaks the physical execution lineage.',
      passed: mutVerify10.verdict === 'INVALID' && !mutVerify10.toolpathVerified,
      verdict: mutVerify10.verdict,
    });

    // Check 11: Mutation of Post Processor
    const mutInput11 = { ...input, postProcessor: { ...input.postProcessor, postProcessorId: 'POST-MUTATED-FANUC' } };
    const mutVerify11 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: mutInput11,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-11',
      name: 'Adversarial Check 11: Post Processor Mutation',
      description: 'Post processor mismatch invalidates the verified program generation.',
      passed: mutVerify11.verdict === 'INVALID' && !mutVerify11.inputVerified,
      verdict: mutVerify11.verdict,
    });

    // Check 12: Mutation of G-Code Hash
    const mutGCode = { ...gcode, gcodeHash: 'HASH-GCODE-TAMPERED-999' };
    const mutVerify12 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentGCode: mutGCode,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-12',
      name: 'Adversarial Check 12: G-Code Program Tampering',
      description: 'Tampering with G-Code post-generation is caught by G-Code verification mismatch.',
      passed: mutVerify12.verdict === 'INVALID' && !mutVerify12.gcodeVerified,
      verdict: mutVerify12.verdict,
    });

    // Check 13: Deletion of CAM Operation
    const mutInput13 = { ...input, cam: { ...input.cam, operations: [] } };
    const mutVerify13 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: mutInput13,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-13',
      name: 'Adversarial Check 13: Operation Deletion',
      description: 'Deleting required CAM operations triggers input manifest mismatch.',
      passed: mutVerify13.verdict === 'INVALID' && !mutVerify13.inputVerified,
      verdict: mutVerify13.verdict,
    });

    // Check 14: Mutation of Tool Change Count
    const mutToolpath14 = { ...toolpath, operations: [], numberOperations: 0, manifestHash: 'HASH-ALTERED-TP-14' };
    const mutVerify14 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentToolpath: mutToolpath14,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-14',
      name: 'Adversarial Check 14: Toolpath Operations Deletion',
      description: 'Mismatched toolpath operation records invalidates toolpath verifiability.',
      passed: mutVerify14.verdict === 'INVALID' && !mutVerify14.toolpathVerified,
      verdict: mutVerify14.verdict,
    });

    // Check 15: Modified Collision Result (Collision Detected)
    const mutCollision15 = { ...collision, status: 'COLLISION_DETECTED' as const };
    const mutVerify15 = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentCollision: mutCollision15,
      trustedPublicKeys: trustedKeys,
    });
    checks.push({
      id: 'SEC-165-15',
      name: 'Adversarial Check 15: Post-Issuance Collision Mutation',
      description: 'Post-issuance alteration of collision detection results must invalidate verification.',
      passed: mutVerify15.verdict === 'INVALID' && !mutVerify15.collisionVerified,
      verdict: mutVerify15.verdict,
    });

    // Check 16: Failed Machine Execution
    const failExecResult = engine.createManufacturingCertificate({
      input,
      toolpath,
      collision,
      gcode,
      execution: { ...execution, executionStatus: 'FAILED' },
      inspection,
      matrix,
      attestation,
      policy,
      engineeringIdentity: 'ENG-SECP-SYSTEM-AUTHORITY',
      keyPair: HardAcceptanceGate165.keyPair,
    });
    checks.push({
      id: 'SEC-165-16',
      name: 'Adversarial Check 16: Failed Machine Execution',
      description: 'Failed or aborted execution runs must never be granted "CERTIFIED" status.',
      passed: !failExecResult.success && failExecResult.certificate?.certificationStatus === 'INVALID',
      verdict: failExecResult.certificate?.certificationStatus || 'FAILED',
    });

    // Check 17: Mismatched Machine Identity
    const badMachineResult = engine.createManufacturingCertificate({
      input,
      toolpath,
      collision,
      gcode,
      execution: { ...execution, machineId: 'DIFFERENT-HAAS-VF3' },
      inspection,
      matrix,
      attestation,
      policy,
      engineeringIdentity: 'ENG-SECP-SYSTEM-AUTHORITY',
      keyPair: HardAcceptanceGate165.keyPair,
    });
    checks.push({
      id: 'SEC-165-17',
      name: 'Adversarial Check 17: Mismatched Machine Execution',
      description: 'Attempting to verify execution on a machine not defined in the CAM input must be rejected.',
      passed: !badMachineResult.success,
      verdict: badMachineResult.certificate?.certificationStatus || 'FAILED',
    });

    // Check 18: Mismatched Inspection Identity
    const badInspectResult = engine.createManufacturingCertificate({
      input,
      toolpath,
      collision,
      gcode,
      execution,
      inspection: { ...inspection, manufacturingId: 'MFG-WRONG-ID-999' },
      matrix,
      attestation,
      policy,
      engineeringIdentity: 'ENG-SECP-SYSTEM-AUTHORITY',
      keyPair: HardAcceptanceGate165.keyPair,
    });
    checks.push({
      id: 'SEC-165-18',
      name: 'Adversarial Check 18: Inspection Part Identity Mismatch',
      description: 'Binding inspection reports from other parts must fail manufacturing validation.',
      passed: !badInspectResult.success,
      verdict: badInspectResult.certificate?.certificationStatus || 'FAILED',
    });

    // Check 19: Certificate Revocation Lifecycle
    const certToRevoke = engine.getManufacturingCertificate(baselineResult.certificate!.certificateId)!;
    const isRevoked = engine.revokeManufacturingCertificate(certToRevoke.certificateId, 'DESIGN_MODIFIED', 'ENG-SECP-SYSTEM-AUTHORITY');
    const revokedCert = engine.getManufacturingCertificate(certToRevoke.certificateId)!;
    checks.push({
      id: 'SEC-165-19',
      name: 'Adversarial Check 19: Revocation Lifecycle Transition',
      description: 'Revoked certificates must transition state to REVOKED and register on the FEN ledger.',
      passed: isRevoked && revokedCert.certificationStatus === 'REVOKED' && revokedCert.revocationReason === 'DESIGN_MODIFIED',
      verdict: revokedCert.certificationStatus,
    });

    // Check 20: Broken Evidence Chain
    const badMatrixResult = engine.createManufacturingCertificate({
      input,
      toolpath,
      collision,
      gcode,
      execution,
      inspection,
      matrix: { ...matrix, claims: [{ claimId: 'CLM-01', claimType: 'COLLISION', description: 'Failed Claim', passed: false, evidenceId: 'COLL-BASELINE-777' }] },
      attestation,
      policy,
      engineeringIdentity: 'ENG-SECP-SYSTEM-AUTHORITY',
      keyPair: HardAcceptanceGate165.keyPair,
    });
    checks.push({
      id: 'SEC-165-20',
      name: 'Adversarial Check 20: Failed Verification Claim in Matrix',
      description: 'Failing checks inside the verification matrix halts certificate issuance.',
      passed: !badMatrixResult.success,
      verdict: badMatrixResult.certificate?.certificationStatus || 'FAILED',
    });

    // Check 21: Cryptographic Attestation Tampered
    const badSigVerify = engine.verifyManufacturingCertificate(baselineResult.certificate!, {
      currentInput: input,
      trustedPublicKeys: { [HardAcceptanceGate165.keyPair.keyId]: 'FORGED-PUBLIC-KEY' },
    });
    checks.push({
      id: 'SEC-165-21',
      name: 'Adversarial Check 21: Signature Verification Failure',
      description: 'Tampered public keys or forged signatures must trigger signature failures.',
      passed: badSigVerify.verdict === 'INVALID' && badSigVerify.signatureVerified === false,
      verdict: badSigVerify.verdict,
    });

    // Check 22: Modified Policy Evaluation
    const mutPolicy: ManufacturingCertificationPolicy = { ...policy, minCertificationLevel: 6 };
    const badPolicyResult = engine.createManufacturingCertificate({
      input,
      toolpath,
      collision,
      gcode,
      execution,
      inspection,
      matrix,
      attestation,
      policy: mutPolicy,
      engineeringIdentity: 'ENG-SECP-SYSTEM-AUTHORITY',
      keyPair: HardAcceptanceGate165.keyPair,
    });
    checks.push({
      id: 'SEC-165-22',
      name: 'Adversarial Check 22: Policy Post-Issuance Alteration',
      description: 'Stricter policy updates block issuance if the current verification levels do not satisfy them.',
      passed: !badPolicyResult.success,
      verdict: badPolicyResult.certificate?.certificationStatus || 'FAILED',
    });

    // Check 23: Invalid G-Code Syntax
    const badGCodeResult = engine.createManufacturingCertificate({
      input,
      toolpath,
      collision,
      gcode: { ...gcode, isSyntaxValid: false, status: 'INVALID' },
      execution,
      inspection,
      matrix,
      attestation,
      policy,
      engineeringIdentity: 'ENG-SECP-SYSTEM-AUTHORITY',
      keyPair: HardAcceptanceGate165.keyPair,
    });
    checks.push({
      id: 'SEC-165-23',
      name: 'Adversarial Check 23: G-Code Syntax Failure',
      description: 'Invalid G-Code syntax or instruction set must block certificate issuance.',
      passed: !badGCodeResult.success,
      verdict: badGCodeResult.certificate?.certificationStatus || 'FAILED',
    });

    // Check 24: Out-of-Tolerance Measurement
    const outOfTolResult = engine.createManufacturingCertificate({
      input,
      toolpath,
      collision,
      gcode,
      execution,
      inspection: {
        ...inspection,
        measurements: [{ ...inspection.measurements[0], pass: false }],
      },
      matrix,
      attestation,
      policy,
      engineeringIdentity: 'ENG-SECP-SYSTEM-AUTHORITY',
      keyPair: HardAcceptanceGate165.keyPair,
    });
    checks.push({
      id: 'SEC-165-24',
      name: 'Adversarial Check 24: Out of Tolerance Inspection',
      description: 'Inspection measurements exceeding allowable engineering tolerances block certification.',
      passed: !outOfTolResult.success && outOfTolResult.errors.some(e => e.includes('tolerance')),
      verdict: outOfTolResult.certificate?.certificationStatus || 'FAILED',
    });

    // Check 25: Fabricated/Unproven Machine Run
    const emptyExecResult = engine.createManufacturingCertificate({
      input,
      toolpath,
      collision,
      gcode,
      execution: undefined, // no physical run evidence
      inspection,
      matrix,
      attestation,
      policy,
      engineeringIdentity: 'ENG-SECP-SYSTEM-AUTHORITY',
      keyPair: HardAcceptanceGate165.keyPair,
    });
    checks.push({
      id: 'SEC-165-25',
      name: 'Adversarial Check 25: Fabricated/Unproven Machine Run',
      description: 'Demanding real execution evidence fails certificate issuance if execution records are missing.',
      passed: !emptyExecResult.success && emptyExecResult.errors.some(e => e.includes('execution')),
      verdict: emptyExecResult.certificate?.certificationStatus || 'FAILED',
    });

    // Count passed checks
    const passedChecks = checks.filter(c => c.passed).length;
    const totalChecks = checks.length;
    const verdict = passedChecks === totalChecks ? 'PASS' : 'FAIL';

    return {
      gateId: 'GATE-MFG-CERT-165',
      patch: 'PATCH-165',
      verdict,
      passedChecks,
      totalChecks,
      checks,
    };
  }
}
