// SECP Industrial OS v2 — HARD ACCEPTANCE GATE 126
import { InspectionTwinEngine } from './InspectionTwinEngine';
import { IndependentInspectionVerifier } from './IndependentInspectionVerifier';
import { InspectionIdentityService } from './InspectionIdentityService';
import {
  InspectionPlan,
  MeasurementDevice,
  CalibrationRecord,
  MeasurementRecord,
  InspectionRequirement
} from './types';

export interface Gate126CheckResult {
  gateId: string;
  description: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface Gate126Summary {
  totalChecks: number;
  passedChecks: number;
  overallScore: number;
  verdict: 'PASS' | 'FAIL';
  checks: Gate126CheckResult[];
}

export class HardAcceptanceGate126 {
  public static evaluateGate(): Gate126Summary {
    const checks: Gate126CheckResult[] = [];
    const engine = new InspectionTwinEngine();

    const requirements: InspectionRequirement[] = [
      {
        requirementId: 'REQ-001',
        requirementType: 'SIZE',
        sourceReference: 'DWG-100-REV-A',
        featureId: 'FEAT-HOLE-01',
        datumReference: [],
        nominal: 10.0,
        upperLimit: 10.02,
        lowerLimit: 9.98,
        toleranceType: 'BILATERAL',
        measurementMethod: 'CMM_PROBE',
        requiredAccuracy: 0.005,
        uncertaintyLimit: 0.002,
        criticality: 'MAJOR',
        requirementHash: 'req_hash_1'
      }
    ];

    const inspectionPlan: InspectionPlan = {
      inspectionPlanId: 'PLAN-001',
      revision: 'REV-A',
      partDefinition: 'PART-100',
      requirements,
      measurementMethods: ['CMM_PROBE'],
      measurementDevices: ['CMM-ZEISS'],
      samplingPolicy: 'FULL_INSPECTION',
      inspectionPlanHash: 'plan_hash_001'
    };

    const measurementDevice: MeasurementDevice = {
      deviceId: 'CMM-ZEISS-01',
      deviceType: 'CMM',
      manufacturer: 'ZEISS',
      model: 'CONTURA',
      serialNumber: 'SN-Z-100',
      softwareVersion: 'CALYPSO 2026',
      firmwareVersion: '1.2.3',
      accuracy: 0.0015,
      resolution: 0.0001,
      deviceHash: 'dev_hash_1'
    };

    const calibrationRecord: CalibrationRecord = {
      calibrationId: 'CAL-2026-001',
      deviceId: 'CMM-ZEISS-01',
      certificateId: 'CERT-ISO-9001',
      calibrationDate: '2026-01-01',
      expiryDate: '2027-01-01', // Valid
      calibrationStandard: 'ISO-10360',
      uncertainty: 0.0005,
      status: 'VALID',
      certificateHash: 'cert_hash_1'
    };

    const measurements: MeasurementRecord[] = [
      {
        measurementId: 'MEAS-001',
        inspectionTwinId: 'TWIN-001',
        requirementId: 'REQ-001',
        featureId: 'FEAT-HOLE-01',
        deviceId: 'CMM-ZEISS-01',
        calibrationId: 'CAL-2026-001',
        timestamp: new Date().toISOString(),
        operatorId: 'OP-01',
        methodId: 'METH-01',
        rawDataHash: 'raw_01',
        processedDataHash: 'proc_01',
        nominalValue: 10.0,
        measuredValue: 10.005, // Inside tolerance
        unit: 'mm',
        uncertainty: 0.001,
        measurementHash: 'meas_hash_1'
      }
    ];

    // 1. GATE-126-01: Deterministic Inspection Identity
    const twin1 = engine.createInspectionTwin({
      inspectionTwinId: 'TWIN-001',
      partSerial: 'SN-100',
      manufacturingTwinId: 'MFG-TWIN-100',
      designRevision: 'REV-A',
      geometryRevision: 'REV-A',
      inspectionRevision: 'REV-A',
      inspectionPlan,
      measurementDevice,
      calibrationRecord,
      measurements,
      partIdentityHash: 'part_id_hash_100',
      requirementRevision: 'REV-A'
    });

    const twin1Reconstructed = engine.createInspectionTwin({
      inspectionTwinId: 'TWIN-001-RECON',
      partSerial: 'SN-100',
      manufacturingTwinId: 'MFG-TWIN-100',
      designRevision: 'REV-A',
      geometryRevision: 'REV-A',
      inspectionRevision: 'REV-A',
      inspectionPlan,
      measurementDevice,
      calibrationRecord,
      measurements,
      partIdentityHash: 'part_id_hash_100',
      requirementRevision: 'REV-A'
    });

    const g01Passed = twin1.inputHash === twin1Reconstructed.inputHash && twin1.inputHash.length === 64;
    checks.push({
      gateId: 'GATE-126-01',
      description: 'Deterministic Inspection Identity & Order-Invariant Input Hashing',
      passed: g01Passed,
      score: g01Passed ? 100 : 0,
      details: g01Passed ? `Determinism verified. Input Hash: ${twin1.inputHash.substring(0, 16)}...` : 'Input hash determinism failed'
    });

    // 2. GATE-126-02: Requirement Revision Integrity
    const revCheck = InspectionIdentityService.verifyRequirementRevision('REV-B', 'REV-A');
    const g02Passed = !revCheck.valid && revCheck.error?.includes('REQUIREMENT_REVISION_MISMATCH') === true;
    checks.push({
      gateId: 'GATE-126-02',
      description: 'Requirement Revision Integrity (REQUIREMENT_REVISION_MISMATCH)',
      passed: g02Passed,
      score: g02Passed ? 100 : 0,
      details: g02Passed ? 'Successfully intercepted REQUIREMENT_REVISION_MISMATCH' : 'Failed to intercept revision mismatch'
    });

    // 3. GATE-126-03: Measurement Unit Normalization & Mismatch Interception
    let g03Passed = false;
    try {
      InspectionIdentityService.normalizeUnit(10, 'kg', 'mm');
    } catch (e: any) {
      g03Passed = e.message.includes('UNIT_MISMATCH');
    }
    checks.push({
      gateId: 'GATE-126-03',
      description: 'Measurement Unit Normalization & Mismatch Interception',
      passed: g03Passed,
      score: g03Passed ? 100 : 0,
      details: g03Passed ? 'Successfully intercepted UNIT_MISMATCH' : 'Failed to intercept unit mismatch'
    });

    // 4. GATE-126-04: Measurement Uncertainty Capability Verification
    const uncertainMeas: MeasurementRecord = { ...measurements[0], uncertainty: 0.005 }; // > requirement uncertaintyLimit (0.002)
    const uncertainEval = InspectionIdentityService.evaluateTolerance(requirements[0], uncertainMeas);
    const g04Passed = uncertainEval.verdict === 'MEASUREMENT_INVALID';
    checks.push({
      gateId: 'GATE-126-04',
      description: 'Measurement Uncertainty Capability Verification (MEASUREMENT_INVALID)',
      passed: g04Passed,
      score: g04Passed ? 100 : 0,
      details: g04Passed ? 'Successfully intercepted MEASUREMENT_INVALID due to uncertainty' : 'Failed to verify uncertainty capability'
    });

    // 5. GATE-126-05: Guard Band Evaluation
    // Nominal: 10.0, Upper: 10.02. Guard band upper = 10.02 - 0.001 = 10.019.
    // Measured: 10.0195 -> Inside tolerance, but outside guard band -> INDETERMINATE
    const gbMeas: MeasurementRecord = { ...measurements[0], measuredValue: 10.0195, uncertainty: 0.001 };
    const gbEval = InspectionIdentityService.evaluateTolerance(requirements[0], gbMeas);
    const g05Passed = gbEval.verdict === 'INDETERMINATE';
    checks.push({
      gateId: 'GATE-126-05',
      description: 'Guard Band Evaluation & Ambiguous Zone Detection (INDETERMINATE)',
      passed: g05Passed,
      score: g05Passed ? 100 : 0,
      details: g05Passed ? 'Successfully detected INDETERMINATE guard band state' : 'Failed guard band evaluation'
    });

    // 6. GATE-126-06: Missing Measurement Detection (INCOMPLETE)
    const incompleteTwin = engine.createInspectionTwin({
      inspectionTwinId: 'TWIN-INCOMPLETE',
      partSerial: twin1.partSerial,
      manufacturingTwinId: twin1.manufacturingTwinId,
      designRevision: twin1.designRevision,
      geometryRevision: twin1.geometryRevision,
      inspectionRevision: twin1.inspectionRevision,
      inspectionPlan: twin1.inspectionState.inspectionPlan,
      measurementDevice: twin1.inspectionState.measurementDevice,
      calibrationRecord: twin1.inspectionState.calibrationRecord,
      partIdentityHash: twin1.inspectionState.partIdentityHash,
      requirementRevision: twin1.inspectionState.requirementRevision,
      measurements: [] // Missing measurements
    });
    const g06Passed = incompleteTwin.verdict === 'INCOMPLETE';
    checks.push({
      gateId: 'GATE-126-06',
      description: 'Missing Measurement Evidence Detection (INCOMPLETE)',
      passed: g06Passed,
      score: g06Passed ? 100 : 0,
      details: g06Passed ? 'Successfully detected INCOMPLETE inspection' : 'Failed to detect missing measurements'
    });

    // 7. GATE-126-07: Expired Calibration Interception
    const expiredCal: CalibrationRecord = { ...calibrationRecord, expiryDate: '2020-01-01' };
    const calCheck = InspectionIdentityService.verifyCalibration(expiredCal);
    const g07Passed = !calCheck.valid && calCheck.error?.includes('CALIBRATION_EXPIRED') === true;
    checks.push({
      gateId: 'GATE-126-07',
      description: 'Expired Calibration Interception (CALIBRATION_EXPIRED)',
      passed: g07Passed,
      score: g07Passed ? 100 : 0,
      details: g07Passed ? 'Successfully intercepted CALIBRATION_EXPIRED' : 'Failed to intercept expired calibration'
    });

    // 8. GATE-126-08: Cross-Part Evidence Attack Check
    const crossPart = InspectionIdentityService.verifyCrossPartEvidence('SN-200', 'SN-100');
    const g08Passed = !crossPart.valid && crossPart.error?.includes('PART_IDENTITY_MISMATCH') === true;
    checks.push({
      gateId: 'GATE-126-08',
      description: 'Cross-Part Evidence Attack Check (PART_IDENTITY_MISMATCH)',
      passed: g08Passed,
      score: g08Passed ? 100 : 0,
      details: g08Passed ? 'Successfully intercepted PART_IDENTITY_MISMATCH' : 'Failed to intercept cross-part evidence'
    });

    // 9. GATE-126-09: Fake PASS Attack Interception
    // Simulate a twin where the verdict is artificially set to PASS but the verifier catches it
    const fakeTwinBase = engine.createInspectionTwin({
      ...twin1, // Just to satisfy some properties if we did this way, wait no
      inspectionTwinId: 'TWIN-FAKE',
      partSerial: 'SN-100',
      manufacturingTwinId: 'MFG-TWIN-100',
      designRevision: 'REV-A',
      geometryRevision: 'REV-A',
      inspectionRevision: 'REV-A',
      inspectionPlan,
      measurementDevice,
      calibrationRecord,
      measurements: [{ ...measurements[0], measuredValue: 10.05 }], // clearly OUT_OF_TOLERANCE
      partIdentityHash: 'part_id_hash_100',
      requirementRevision: 'REV-A'
    });
    const fakePassTwin = { ...fakeTwinBase, verdict: 'PASS' as any };
    const indRes = IndependentInspectionVerifier.verifyTwinIndependently(fakePassTwin);
    const fakePassCheck = IndependentInspectionVerifier.compareVerdicts(fakePassTwin, indRes);
    const g09Passed = fakePassCheck.verdict === 'MISMATCH' && fakePassCheck.details.includes('VERDICT_INTEGRITY_FAILURE');
    checks.push({
      gateId: 'GATE-126-09',
      description: 'Fake PASS Attack Interception & Independent Verdict Enforcement',
      passed: g09Passed,
      score: g09Passed ? 100 : 0,
      details: g09Passed ? 'Successfully intercepted Fake PASS attack' : 'Failed to intercept Fake PASS'
    });

    // 10. GATE-126-10: Independent Inspection Verifier Differential Match
    const indResTrue = IndependentInspectionVerifier.verifyTwinIndependently(twin1);
    const matchCheck = IndependentInspectionVerifier.compareVerdicts(twin1, indResTrue);
    const g10Passed = matchCheck.verdict === 'MATCH';
    checks.push({
      gateId: 'GATE-126-10',
      description: 'Independent Inspection Verifier & Differential Engine Match',
      passed: g10Passed,
      score: g10Passed ? 100 : 0,
      details: g10Passed ? '100% Differential Match between Primary and Independent Verifiers' : 'Differential mismatch'
    });

    const passedCount = checks.filter(c => c.passed).length;
    const overallScore = (passedCount / checks.length) * 100;

    return {
      totalChecks: checks.length,
      passedChecks: passedCount,
      overallScore,
      verdict: passedCount === checks.length ? 'PASS' : 'FAIL',
      checks
    };
  }
}
