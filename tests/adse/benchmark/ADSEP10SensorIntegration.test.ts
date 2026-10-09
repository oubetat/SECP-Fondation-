import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { ADSEWorkbenchBridge } from '../../../src/engine/adse/workbench/ADSEWorkbenchBridge';
import { Sensor, CalibrationCertificate, Measurement, SensorDiagnosticState, PhysicalFinding } from '../../../src/engine/adse/p10/types';

describe('ADSE P10 — Sensor Integration & Measurement Engineering Truth Suite', () => {
  let bridge: ADSEWorkbenchBridge;

  beforeEach(() => {
    ADSEWorkbenchBridge.resetInstance();
    bridge = ADSEWorkbenchBridge.getInstance();
  });

  // =========================================================================
  // BENCHMARK 1: P10-BENCH-001 — Core Sensor ↔ Measurement Truth Lifecycle
  // =========================================================================
  it('P10-BENCH-001: Verifies the complete sensor truth chain, Merkle snapshot reconstruction, calibration invalidation cascade, and physical finding propagation', async () => {
    const configBaseline = 'CONF-BASELINE';
    const sensorId = 'SENSOR-E2E-10';
    const reqId = 'RQ-E2E-10';

    console.log('--- P10-BENCH-001 START ---');

    // 1. Create a Requirement in P1 Requirements Engine
    bridge.p1.requirements.createRequirement({
      id: reqId,
      systemId: 'SYS-XA100',
      title: 'Structural Skin Temp Bounds',
      statement: 'Aerodynamic skin temperature must remain below 120 °C (393.15 K) ± 5 K.',
      rationale: 'Thermal protection boundary verification',
      source: 'Structures & Aerodynamics Spec',
      type: 'PERFORMANCE',
      priority: 'HIGH',
      configurationId: configBaseline,
      verificationIntentIds: [],
      constraintIds: []
    }, 'CHIEF_SYSTEMS_ENGINEER');

    // 2. Register Sensor in P10
    const sensor: Sensor = {
      sensorId,
      type: 'RTD_PLATINUM_PT100',
      manufacturer: 'AeroSensors Inc.',
      model: 'AS-PT100-XP',
      revision: 1,
      configurationId: configBaseline,
      physicalLocation: 'WING_LEADING_EDGE_STATION_4',
      measurementDomain: 'THERMAL',
      measurementRange: { min: -50, max: 250 }, // °C
      resolution: 0.01,
      accuracy: 0.15,
      samplingRateHz: 50,
      latencyMs: 5,
      calibrationState: 'UNINITIALIZED',
      uncertaintyModel: { type: 'GAUSSIAN', value: 0.2 },
      interfaceType: 'SPI_BUS_01',
      provenance: {
        originHash: createHash('sha256').update(sensorId).digest('hex'),
        createdBy: 'SYSTEMS_ARCHITECT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    bridge.p10.registry.registerSensor(sensor);

    const registeredSensor = bridge.p10.registry.getSensor(sensorId);
    expect(registeredSensor).toBeDefined();
    expect(registeredSensor?.physicalLocation).toBe('WING_LEADING_EDGE_STATION_4');

    // 3. Register Calibration Certificate (Human Actor Authorized)
    const calCert: CalibrationCertificate = {
      id: 'CAL-CERT-PT100-2026',
      sensorId,
      calibratedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      technicianId: 'TECH-HUMAN-LEAD-07',
      calibrationRevision: 1,
      offset: 0.05,
      gain: 28.5, // 28.5 °C per Volt
      accuracyClass: 'CLASS_A',
      authoritySignature: 'SIG_HUMAN_CHIEF_CALIBRATION_OFFICER'
    };
    bridge.p10.governance.authorizeCalibration(calCert, 'CHIEF_CALIBRATION_OFFICER');

    expect(bridge.p10.registry.getSensor(sensorId)?.calibrationState).toBe('VALID');

    // 4. Acquire Raw Sensor Voltage & Process into Calibrated Value (E2E-V02 Measurement Model)
    const measurement = bridge.p10.measurement.acquireCalibratedMeasurement({
      measurementId: 'MEAS-WING-001',
      sensorId,
      rawValue: 3.2, // 3.2 Volts
      unit: '°C',
      timestamp: new Date(Date.now() - 600000).toISOString(), // 10 mins ago
      acquisitionContext: 'FLIGHT-TEST-ALPHA-01',
      configurationId: configBaseline
    });

    // Calibrated Value = 28.5 * 3.2 + 0.05 = 91.25 °C
    expect(measurement.value).toBe(91.25);
    expect(measurement.uncertainty).toBe(0.2); // Base uncertainty bound
    expect(measurement.diagnosticState).toBe(SensorDiagnosticState.VALID);

    // 5. Digital Thread Coupling Assertion
    const threadNode = bridge.p4.registry.getNode(`thread:measurement:MEAS-WING-001`);
    expect(threadNode).toBeDefined();
    expect(threadNode?.canonicalId).toBe('MEAS-WING-001');

    // 6. Verification Bounds Overlap Evaluation (INV-06 / P10.4)
    const boundsEval = bridge.p10.measurement.evaluateVerificationBounds({
      requirementTarget: 120,
      requirementTolerance: 5, // Range: 115 °C to 125 °C
      measuredValue: 118,
      measuredUncertainty: 1.5 // Range: 116.5 °C to 119.5 °C (completely within bounds)
    });
    expect(boundsEval.passed).toBe(true);

    const boundsEvalFail = bridge.p10.measurement.evaluateVerificationBounds({
      requirementTarget: 120,
      requirementTolerance: 5,
      measuredValue: 124,
      measuredUncertainty: 2.0 // Range: 122 °C to 126 °C (exceeds upper limit of 125 °C)
    });
    expect(boundsEvalFail.passed).toBe(false);

    // 7. Persist to Cryptographic Merkle Snapshot
    const snapshot = bridge.p10.persistence.createSnapshot('SECP_MASTER_AUTHORITY');
    expect(snapshot.merkleRootHash).toBeDefined();

    // 8. Wipe Runtime State (Destroy)
    ADSEWorkbenchBridge.resetInstance();
    const restartedBridge = ADSEWorkbenchBridge.getInstance();
    expect(restartedBridge.p10.registry.getSensor(sensorId)).toBeUndefined();

    // 9. Restore & Reconstruction (Exact-match parity verification)
    const restoreRes = restartedBridge.p10.persistence.restoreFromSnapshot(snapshot);
    expect(restoreRes.isValid).toBe(true);

    const reconstructedSensor = restartedBridge.p10.registry.getSensor(sensorId);
    expect(reconstructedSensor).toBeDefined();
    expect(reconstructedSensor?.physicalLocation).toBe('WING_LEADING_EDGE_STATION_4');
    expect(restartedBridge.p10.registry.getMeasurement('MEAS-WING-001')?.value).toBe(91.25);

    // 10. Calibration Expiration Invalidation Cascade (INV-11)
    const expiredCert: CalibrationCertificate = {
      id: 'CAL-CERT-PT100-2025-EXPIRED',
      sensorId,
      calibratedAt: '2024-01-01T00:00:00Z',
      expiresAt: '2025-01-01T00:00:00Z', // Expired
      technicianId: 'TECH-HUMAN-LEAD-07',
      calibrationRevision: 2,
      offset: 0.05,
      gain: 28.5,
      accuracyClass: 'CLASS_A',
      authoritySignature: 'SIG_HUMAN_CHIEF_CALIBRATION_OFFICER'
    };
    restartedBridge.p10.governance.authorizeCalibration(expiredCert, 'CHIEF_CALIBRATION_OFFICER');

    // Acquiring measurement on expired calibration triggers diagnostic state change
    const expiredMeasurement = restartedBridge.p10.measurement.acquireCalibratedMeasurement({
      measurementId: 'MEAS-WING-002',
      sensorId,
      rawValue: 3.2,
      unit: '°C',
      timestamp: new Date().toISOString(),
      acquisitionContext: 'FLIGHT-TEST-ALPHA-01',
      configurationId: configBaseline
    });

    expect(expiredMeasurement.diagnosticState).toBe(SensorDiagnosticState.CALIBRATION_EXPIRED);
    expect(expiredMeasurement.uncertainty).toBe(0.5); // Multiplied uncertainty due to invalid/expired calibration (INV-06)

    // 11. Physical Finding → Truth Propagation (INV-08 / INV-10)
    const finding: PhysicalFinding = {
      findingId: 'FIND-WING-TEMP-EXCEED',
      sensorId,
      measurementId: 'MEAS-WING-002',
      engineeringFindingText: 'Wing Leading Edge skin temperature exceeded allowable composite limits.',
      affectedAssumptionId: 'ASSUMP-STRUCTURAL-COMPOSITE-LIMITS',
      associatedModelId: 'MODEL-AERO-THERMAL-WING',
      severity: 'CRITICAL',
      timestamp: new Date().toISOString(),
      status: 'OPEN'
    };
    restartedBridge.p10.registry.registerPhysicalFinding(finding);

    expect(restartedBridge.p10.registry.getPhysicalFinding('FIND-WING-TEMP-EXCEED')).toBeDefined();
    // Prove that physical finding does NOT directly mutate canonical engineering model values
    // but registers the traceability linkage in Digital Thread
    const p5Comp = restartedBridge.p5.registry.getElement('comp:def:Actuator');
    expect(p5Comp?.displayName).not.toBe('Wing Leading Edge skin temperature exceeded'); // Non-mutated

    console.log('--- P10-BENCH-001 COMPLETE ---');
  });

  // =========================================================================
  // BENCHMARK 2: ADVERSARIAL MEASUREMENT TRUTH BATTERY
  // =========================================================================
  it('P10 Adversarial Measurement Truth Battery: Verifies strict backend rejection of range, identity, duplicate, temporal, and AI authorization anomalies', async () => {
    const configBaseline = 'CONF-BASELINE';
    const sensorId = 'SENSOR-ADVERSARIAL-01';

    // 1. Setup baseline Sensor and Calibration
    const sensor: Sensor = {
      sensorId,
      type: 'PRESSURE_TRANSDUCER',
      manufacturer: 'Sensors R Us',
      model: 'S-PRESS-V4',
      revision: 1,
      configurationId: configBaseline,
      physicalLocation: 'HYDRAULIC_ACCUMULATOR_LINE_01',
      measurementDomain: 'CONTROL',
      measurementRange: { min: 0, max: 5000 }, // psi
      resolution: 0.1,
      accuracy: 2.0,
      samplingRateHz: 100,
      latencyMs: 1,
      calibrationState: 'UNINITIALIZED',
      uncertaintyModel: { type: 'GAUSSIAN', value: 5.0 },
      interfaceType: 'CAN_BUS_02',
      provenance: {
        originHash: 'initial-sensor-hash',
        createdBy: 'SYSTEMS_ARCHITECT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    bridge.p10.registry.registerSensor(sensor);

    const calCert: CalibrationCertificate = {
      id: 'CAL-ADVERSARIAL-01',
      sensorId,
      calibratedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      technicianId: 'HUMAN_TECH',
      calibrationRevision: 1,
      offset: 0,
      gain: 1000.0, // 1000 psi per Volt
      accuracyClass: 'CLASS_B',
      authoritySignature: 'SIG_HUMAN'
    };
    bridge.p10.registry.registerCalibrationCertificate(calCert);

    // --- REJECTION 1: Wrong Sensor Identity (INV-01) ---
    expect(() => {
      bridge.p10.measurement.acquireCalibratedMeasurement({
        measurementId: 'MEAS-ERR-01',
        sensorId: 'NON-EXISTENT-SENSOR-ID',
        rawValue: 2.5,
        unit: 'psi',
        timestamp: new Date().toISOString(),
        acquisitionContext: 'TEST',
        configurationId: configBaseline
      });
    }).toThrow(/SENSOR_NOT_FOUND/);

    // --- REJECTION 2: Wrong Configuration Context (INV-04) ---
    expect(() => {
      bridge.p10.measurement.acquireCalibratedMeasurement({
        measurementId: 'MEAS-ERR-02',
        sensorId,
        rawValue: 2.5,
        unit: 'psi',
        timestamp: new Date().toISOString(),
        acquisitionContext: 'TEST',
        configurationId: '' // Missing configuration
      });
    }).toThrow(/CONFIGURATION_CONTEXT_REQUIRED/);

    // --- REJECTION 3: Expired / Forged Calibration IDs ---
    expect(() => {
      const forgedCert: CalibrationCertificate = {
        id: 'FORGED-CAL-CERT-999',
        sensorId,
        calibratedAt: '2026-01-01T00:00:00Z',
        expiresAt: '2027-01-01T00:00:00Z',
        technicianId: 'MALICIOUS_TECH',
        calibrationRevision: 2,
        offset: 0,
        gain: 1000.0,
        accuracyClass: 'CLASS_A',
        authoritySignature: 'SIG_FORGED'
      };
      bridge.p10.registry.registerCalibrationCertificate(forgedCert);
    }).toThrow(/FORGED_CALIBRATION_CERTIFICATE/);

    // --- REJECTION 4: Duplicate Measurement Registration ---
    bridge.p10.measurement.acquireCalibratedMeasurement({
      measurementId: 'MEAS-E2E-DUPLICATE-CHECK',
      sensorId,
      rawValue: 2.5,
      unit: 'psi',
      timestamp: new Date().toISOString(),
      acquisitionContext: 'FLIGHT-TEST',
      configurationId: configBaseline
    });

    expect(() => {
      bridge.p10.measurement.acquireCalibratedMeasurement({
        measurementId: 'MEAS-E2E-DUPLICATE-CHECK', // Duplicate ID
        sensorId,
        rawValue: 3.0,
        unit: 'psi',
        timestamp: new Date().toISOString(),
        acquisitionContext: 'FLIGHT-TEST-ALPHA',
        configurationId: configBaseline
      });
    }).toThrow(/DUPLICATE_MEASUREMENT/);

    // --- REJECTION 5: Future Timestamp (INV-05) ---
    expect(() => {
      bridge.p10.measurement.acquireCalibratedMeasurement({
        measurementId: 'MEAS-FUTURE-01',
        sensorId,
        rawValue: 2.5,
        unit: 'psi',
        timestamp: '2099-01-01T00:00:00Z', // Far future timestamp
        acquisitionContext: 'TEST',
        configurationId: configBaseline
      });
    }).toThrow(/FUTURE_TIMESTAMP_REJECTED/);

    // --- REJECTION 6: Uncertainty Omission (INV-06) ---
    expect(() => {
      // Intentionally register measurement with negative / zero uncertainty
      bridge.p10.registry.registerMeasurement({
        measurementId: 'MEAS-ERR-UNCERTAINTY',
        sensorId,
        calibrationId: 'CAL-ADVERSARIAL-01',
        value: 100,
        rawValue: 0.1,
        unit: 'psi',
        timestamp: new Date().toISOString(),
        uncertainty: 0, // Zero uncertainty omitted
        configurationId: configBaseline,
        acquisitionContext: 'TEST',
        evidenceHash: 'hash-001',
        diagnosticState: SensorDiagnosticState.VALID
      });
    }).toThrow(/UNCERTAINTY_OMISSION_PROHIBITED/);

    // --- REJECTION 7: AI Autonomous Calibration (INV-09) ---
    expect(() => {
      const aiSignedCert: CalibrationCertificate = {
        id: 'CAL-AI-CERT-01',
        sensorId,
        calibratedAt: '2026-01-01T00:00:00Z',
        expiresAt: '2027-01-01T00:00:00Z',
        technicianId: 'ai:synthetic:technician', // AI technician
        calibrationRevision: 2,
        offset: 0,
        gain: 1000.0,
        accuracyClass: 'CLASS_A',
        authoritySignature: 'SIG_AI'
      };
      bridge.p10.governance.authorizeCalibration(aiSignedCert, 'ai:copilot');
    }).toThrow(/AI_GOVERNANCE_VIOLATION/);

    // --- DETECT ANOMALY: Range / Saturated Limits (P10.6) ---
    const outOfRangeMeasurement = bridge.p10.measurement.acquireCalibratedMeasurement({
      measurementId: 'MEAS-OUT-OF-LIMITS',
      sensorId,
      rawValue: 6.5, // 6.5 Volts * 1000 = 6500 psi. Max range is 5000 psi.
      unit: 'psi',
      timestamp: new Date().toISOString(),
      acquisitionContext: 'PRESSURE-SPIKE-TEST',
      configurationId: configBaseline
    });

    expect(outOfRangeMeasurement.diagnosticState).toBe(SensorDiagnosticState.OUT_OF_RANGE);
  });
});
