// SECP Industrial OS v2 — PATCH-126 Verification & Forensic Runner
import * as fs from 'fs';
import * as path from 'path';
import { HardAcceptanceGate126 } from '../../src/engine/inspection_twin/HardAcceptanceGate126';
import { InspectionTwinEngine } from '../../src/engine/inspection_twin/InspectionTwinEngine';
import { IndependentInspectionVerifier } from '../../src/engine/inspection_twin/IndependentInspectionVerifier';
import { CanonicalInspectionSerializer } from '../../src/engine/inspection_twin/CanonicalInspectionSerializer';
import { InspectionIdentityService } from '../../src/engine/inspection_twin/InspectionIdentityService';
import {
  InspectionPlan,
  MeasurementDevice,
  CalibrationRecord,
  MeasurementRecord,
  InspectionRequirement
} from '../../src/engine/inspection_twin/types';

async function runPatch126Verification() {
  console.log('='.repeat(80));
  console.log('SECP INDUSTRIAL OS v2 — PATCH-126: INSPECTION TWIN & MEASUREMENT TRUTH');
  console.log('='.repeat(80));

  const reportsDir = path.join(process.cwd(), 'reports/digital-twin/patch-126');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

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
    expiryDate: '2027-01-01',
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
      measuredValue: 10.005,
      unit: 'mm',
      uncertainty: 0.001,
      measurementHash: 'meas_hash_1'
    }
  ];

  // Step 1: Generate 50 Forensic Reports
  console.log('>>> STEP 1: Generating 50 Comprehensive Inspection Forensic Reports...');
  for (let i = 1; i <= 50; i++) {
    const twinId = `INSP-TWIN-REPORT-${i.toString().padStart(3, '0')}`;
    const twin = engine.createInspectionTwin({
      inspectionTwinId: twinId,
      partSerial: `SN-PART-${i.toString().padStart(3, '0')}`,
      manufacturingTwinId: `MFG-TWIN-${i.toString().padStart(3, '0')}`,
      designRevision: 'REV-A',
      geometryRevision: 'REV-A',
      inspectionRevision: 'REV-A',
      inspectionPlan,
      measurementDevice,
      calibrationRecord,
      measurements: [{ ...measurements[0], inspectionTwinId: twinId, measurementId: `MEAS-${i}` }],
      partIdentityHash: `part_id_hash_${i}`,
      requirementRevision: 'REV-A'
    });

    const reportContent = {
      reportId: `REP-INSP-126-${i.toString().padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
      twinId: twin.inspectionTwinId,
      partSerial: twin.partSerial,
      inputHash: twin.inputHash,
      rootHash: twin.rootHash,
      state: twin.state,
      verdict: twin.verdict
    };

    fs.writeFileSync(path.join(reportsDir, `report_insp_${i.toString().padStart(3, '0')}.json`), JSON.stringify(reportContent, null, 2));
  }
  console.log(`Successfully generated 50 inspection forensic reports in ${reportsDir}`);

  // Step 2: Evaluate Hard Acceptance Gate 126
  console.log('\n>>> STEP 2: Evaluating Hard Acceptance Gate 126...');
  const gateResult = HardAcceptanceGate126.evaluateGate();
  console.log(`>>> Total Gate Checks: ${gateResult.totalChecks}`);
  console.log(`>>> Passed Gate Checks: ${gateResult.passedChecks}`);
  console.log(`>>> Overall Gate Score: ${gateResult.overallScore}%`);
  console.log(`>>> Gate Verdict: ${gateResult.verdict}`);

  for (const c of gateResult.checks) {
    console.log(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.gateId}: ${c.description}`);
    console.log(`         ${c.details}`);
  }

  // Step 3: Adversarial & Security Negative Attacks
  console.log('\n>>> STEP 3: Evaluating Adversarial & Security Negative Attacks...');

  // ADV 1: Cross-Part Evidence Attack
  const crossPart = InspectionIdentityService.verifyCrossPartEvidence('SN-WRONG', 'SN-CORRECT');
  const adv1Passed = !crossPart.valid && crossPart.error?.includes('PART_IDENTITY_MISMATCH') === true;
  console.log(`  [${adv1Passed ? 'PASS' : 'FAIL'}] ADV-126-01: Cross-Part Evidence Tampering -> Intercepted (PART_IDENTITY_MISMATCH)`);

  // ADV 2: Fake PASS Attack
  const fakeTwin = engine.createInspectionTwin({
      inspectionTwinId: 'TWIN-FAKE-PASS',
      partSerial: 'SN-FAKE',
      manufacturingTwinId: 'MFG-TWIN-FAKE',
      designRevision: 'REV-A',
      geometryRevision: 'REV-A',
      inspectionRevision: 'REV-A',
      inspectionPlan,
      measurementDevice,
      calibrationRecord,
      measurements: [{ ...measurements[0], measuredValue: 10.5 }], // Fail value
      partIdentityHash: 'part_id_hash_fake',
      requirementRevision: 'REV-A'
  });
  const fakePassTwin = { ...fakeTwin, verdict: 'PASS' as any };
  const indRes = IndependentInspectionVerifier.verifyTwinIndependently(fakePassTwin);
  const fakePassCheck = IndependentInspectionVerifier.compareVerdicts(fakePassTwin, indRes);
  const adv2Passed = fakePassCheck.verdict === 'MISMATCH' && fakePassCheck.details.includes('VERDICT_INTEGRITY_FAILURE');
  console.log(`  [${adv2Passed ? 'PASS' : 'FAIL'}] ADV-126-02: Fake PASS Verdict Injection -> Intercepted (VERDICT_INTEGRITY_FAILURE)`);

  // Step 4: Scale & Performance Benchmark
  console.log('\n>>> STEP 4: Running Scale & Performance Benchmark...');
  const startTime = Date.now();
  for (let k = 0; k < 1000; k++) {
    const t = engine.createInspectionTwin({
      inspectionTwinId: `PERF-TWIN-${k}`,
      partSerial: `SN-PERF-${k}`,
      manufacturingTwinId: `MFG-TWIN-PERF-${k}`,
      designRevision: 'REV-A',
      geometryRevision: 'REV-A',
      inspectionRevision: 'REV-A',
      inspectionPlan,
      measurementDevice,
      calibrationRecord,
      measurements: [{ ...measurements[0], inspectionTwinId: `PERF-TWIN-${k}`, measurementId: `MEAS-PERF-${k}` }],
      partIdentityHash: `part_id_hash_perf_${k}`,
      requirementRevision: 'REV-A'
    });
    CanonicalInspectionSerializer.computeInspectionInputHash(t.inspectionState);
  }
  const duration = Date.now() - startTime;
  console.log(`  [TIER 1,000 Inspection Twins] Creation & SHA-256 Root Hashing: ${duration.toFixed(2)}ms`);

  console.log('='.repeat(80));
  if (gateResult.verdict === 'PASS' && adv1Passed && adv2Passed) {
    console.log('FINAL INSPECTION TWIN STATUS: ALL PASS (100% TRUTH VERIFIED)');
  } else {
    console.log('FINAL INSPECTION TWIN STATUS: FAIL');
    process.exit(1);
  }
  console.log('='.repeat(80));
}

runPatch126Verification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
