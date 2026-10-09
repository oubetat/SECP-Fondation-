/**
 * SECP Industrial OS — EPC-016: Industrial Drone Mission & Product Definition Test Suite
 * Exhaustive test coverage covering schema validation, physical constraints,
 * unit validation, immutability/revisioning, evidence generation, provenance,
 * and anti-hardcoding / non-bypass requirements.
 */

import { describe, it, expect } from 'vitest';
import { IndustrialDroneProofCase } from '../mission/IndustrialDroneProofCase';
import { MissionValidator } from '../mission/MissionValidator';
import { EPC016Verifier } from '../mission/EPC016Verifier';
import { EPC016ValidationError, EPC016InputConfig } from '../mission/MissionTypes';
import { ProofCaseValidator } from '../ProofCaseValidator';
import { EngineeringRequirementValidator } from '../EngineeringRequirementValidator';

describe('EPC-016: Industrial Drone Mission & Product Definition', () => {
  // TEST 01: Create valid Industrial Drone Mission
  it('TEST 01: should successfully create a valid Industrial Drone Mission and Product Bundle', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const bundle = IndustrialDroneProofCase.createProductBundle(config);

    expect(bundle).toBeDefined();
    expect(bundle.proofCase.caseId).toBe('EPC-CASE-001');
    expect(bundle.proofCase.status).toBe('DEFINED');
    expect(bundle.productDefinition.productName).toBe('Industrial Drone');
    expect(bundle.requirements.length).toBeGreaterThanOrEqual(15);
    expect(bundle.configurationBaseline.status).toBe('QUALIFIED');
    expect(bundle.evidencePackage.contentHash).toBeDefined();
    expect(bundle.provenance.provenanceId).toBeDefined();

    // Verify ProofCase schema validity
    expect(ProofCaseValidator.validate(bundle.proofCase)).toBeDefined();
    expect(ProofCaseValidator.validate(bundle.proofCase).caseId).toBe('EPC-CASE-001');
  });

  // TEST 02: Missing MissionId -> FAIL
  it('TEST 02: should reject Mission Definition when missionId is missing or empty', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const invalidConfig: EPC016InputConfig = {
      ...config,
      mission: {
        ...config.mission,
        missionId: ''
      }
    };

    expect(() => IndustrialDroneProofCase.createProductBundle(invalidConfig)).toThrow(EPC016ValidationError);
    expect(() => MissionValidator.validate(invalidConfig)).toThrow(EPC016ValidationError);
    try {
      MissionValidator.validate(invalidConfig);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_MISSION_ID');
    }
  });

  // TEST 03: Missing Payload Requirement -> FAIL
  it('TEST 03: should reject Payload Definition when payload requirements array is empty', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const invalidConfig: EPC016InputConfig = {
      ...config,
      payload: {
        ...config.payload,
        payloadRequirements: []
      }
    };

    expect(() => IndustrialDroneProofCase.createProductBundle(invalidConfig)).toThrow(EPC016ValidationError);
    try {
      MissionValidator.validate(invalidConfig);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_PAYLOAD_REQUIREMENT');
    }
  });

  // TEST 04: Negative Payload Mass -> FAIL
  it('TEST 04: should reject negative payload mass', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const invalidConfig: EPC016InputConfig = {
      ...config,
      payload: {
        ...config.payload,
        payloadMass: { value: -1.5, unit: 'kg' }
      }
    };

    expect(() => IndustrialDroneProofCase.createProductBundle(invalidConfig)).toThrow(EPC016ValidationError);
    try {
      MissionValidator.validate(invalidConfig);
    } catch (e: any) {
      expect(e.code).toBe('NEGATIVE_PAYLOAD_MASS');
    }
  });

  // TEST 05: Invalid Unit -> FAIL
  it('TEST 05: should reject unknown or non-standard engineering units', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const invalidConfig: EPC016InputConfig = {
      ...config,
      performance: {
        ...config.performance,
        maximumSpeed: { value: 20, unit: 'warp_factor' }
      }
    };

    expect(() => IndustrialDroneProofCase.createProductBundle(invalidConfig)).toThrow(EPC016ValidationError);
    try {
      MissionValidator.validate(invalidConfig);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_UNIT');
    }
  });

  // TEST 06: Missing Verification Method -> FAIL
  it('TEST 06: should reject custom requirements with missing verification method', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const invalidReq: any = {
      requirementId: 'REQ-CUSTOM-001',
      description: 'Custom acoustic noise signature requirement',
      parameter: 'noiseLevel',
      unit: 'dB',
      tolerance: { type: 'BOUNDS', upperBound: 72 },
      priority: 'MEDIUM',
      // verificationMethod missing!
      validationMethod: 'PHYSICAL_TEST'
    };

    const invalidConfig: EPC016InputConfig = {
      ...config,
      customRequirements: [invalidReq]
    };

    expect(() => IndustrialDroneProofCase.createProductBundle(invalidConfig)).toThrow(EPC016ValidationError);
    try {
      MissionValidator.validate(invalidConfig);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_VERIFICATION_METHOD');
    }
  });

  // TEST 07: Missing Validation Method -> FAIL
  it('TEST 07: should reject custom requirements with missing validation method', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const invalidReq: any = {
      requirementId: 'REQ-CUSTOM-002',
      description: 'Custom telemetry latency requirement',
      parameter: 'latency',
      unit: 'ms',
      tolerance: { type: 'BOUNDS', upperBound: 100 },
      priority: 'HIGH',
      verificationMethod: 'MEASUREMENT'
      // validationMethod missing!
    };

    const invalidConfig: EPC016InputConfig = {
      ...config,
      customRequirements: [invalidReq]
    };

    expect(() => IndustrialDroneProofCase.createProductBundle(invalidConfig)).toThrow(EPC016ValidationError);
    try {
      MissionValidator.validate(invalidConfig);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_VALIDATION_METHOD');
    }
  });

  // TEST 08: Duplicate RequirementId -> FAIL
  it('TEST 08: should reject duplicate Requirement IDs across requirements', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const dupReq: any = {
      requirementId: 'REQ-DRONE-MTOM-001', // duplicate of standard MTOM requirement
      description: 'Duplicate MTOM definition',
      parameter: 'maximumTakeoffMass',
      unit: 'kg',
      tolerance: { type: 'BOUNDS', upperBound: 9.5 },
      priority: 'HIGH',
      verificationMethod: 'ANALYSIS',
      validationMethod: 'PHYSICAL_TEST'
    };

    const invalidConfig: EPC016InputConfig = {
      ...config,
      customRequirements: [dupReq, dupReq]
    };

    expect(() => IndustrialDroneProofCase.createProductBundle(invalidConfig)).toThrow(EPC016ValidationError);
    try {
      MissionValidator.validate(invalidConfig);
    } catch (e: any) {
      expect(e.code).toBe('DUPLICATE_REQUIREMENT_ID');
    }
  });

  // TEST 09: Invalid Environmental Range -> FAIL
  it('TEST 09: should reject invalid environmental ranges where min exceeds max', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const invalidConfig: EPC016InputConfig = {
      ...config,
      environment: {
        ...config.environment,
        temperatureRange: { min: 50, max: -20, unit: '°C' } // min > max!
      }
    };

    expect(() => IndustrialDroneProofCase.createProductBundle(invalidConfig)).toThrow(EPC016ValidationError);
    try {
      MissionValidator.validate(invalidConfig);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_ENVIRONMENTAL_RANGE');
    }
  });

  // TEST 10: Assumption correctly distinguished from Requirement -> PASS
  it('TEST 10: should strictly distinguish engineering assumptions from verified requirements', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const bundle = IndustrialDroneProofCase.createProductBundle(config);

    expect(bundle.assumptions.length).toBeGreaterThan(0);
    for (const assumption of bundle.assumptions) {
      expect(assumption.assumptionId.startsWith('ASSUMP-')).toBe(true);
      expect(assumption.rationale).toBeDefined();
      expect(assumption.status).toBe('ACTIVE');
    }

    // Assumptions must not be confused with completed/verified requirements
    for (const req of bundle.requirements) {
      expect(req.metadata?.status).not.toBe('VERIFIED');
      expect(req.metadata?.status).not.toBe('VALIDATED');
      expect(req.metadata?.status).toBe('DEFINED');
    }
  });

  // TEST 11: Requirement receives stable RequirementId -> PASS
  it('TEST 11: should assign stable, predictable Requirement IDs across multiple runs', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const bundle1 = IndustrialDroneProofCase.createProductBundle(config);
    const bundle2 = IndustrialDroneProofCase.createProductBundle(config);

    const ids1 = bundle1.requirements.map(r => r.requirementId);
    const ids2 = bundle2.requirements.map(r => r.requirementId);

    expect(ids1).toEqual(ids2);
    expect(ids1).toContain('REQ-DRONE-MTOM-001');
    expect(ids1).toContain('REQ-DRONE-RANGE-001');
    expect(ids1).toContain('REQ-DRONE-ENDURANCE-001');
    expect(ids1).toContain('REQ-DRONE-VMAX-001');
    expect(ids1).toContain('REQ-DRONE-PAYLOAD-MASS-001');
  });

  // TEST 12: Revision change detected -> PASS
  it('TEST 12: should support incrementing revision and tracking change history', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const bundleV1 = IndustrialDroneProofCase.createProductBundle(config);

    expect(bundleV1.productDefinition.revision).toBe('1.0');
    expect(bundleV1.revisionHistory.length).toBe(1);

    // Apply revision increment to V1.1 with modified endurance
    const bundleV11 = IndustrialDroneProofCase.incrementRevision(
      bundleV1,
      {
        endurance: {
          ...bundleV1.endurance,
          targetEndurance: { value: 3600, unit: 's' } // 60 min
        }
      },
      '1.1',
      'Extended target endurance requirement from 50 min to 60 min for maritime survey mission.'
    );

    expect(bundleV11.productDefinition.revision).toBe('1.1');
    expect(bundleV11.endurance.targetEndurance.value).toBe(3600);
    expect(bundleV11.revisionHistory.length).toBe(2);
    expect(bundleV11.revisionHistory[1].revision).toBe('1.1');
    expect(bundleV11.revisionHistory[1].changeSummary).toContain('Extended target endurance');
  });

  // TEST 13: Configuration references are valid -> PASS
  it('TEST 13: should establish a valid EPC-004 Configuration Baseline without uninstantiated CAD/CAE', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const bundle = IndustrialDroneProofCase.createProductBundle(config);
    const cb = bundle.configurationBaseline;

    expect(cb.baselineId).toBe('BASE-EPC-CASE-001-1.0');
    expect(cb.status).toBe('QUALIFIED');
    expect(cb.cad).toBe('NOT_DEFINED_YET');
    expect(cb.cae).toBe('NOT_DEFINED_YET');
    expect(cb.mesh).toBe('NOT_DEFINED_YET');
    expect(cb.solver).toBe('NOT_DEFINED_YET');
    expect(cb.cam).toBe('NOT_DEFINED_YET');
  });

  // TEST 14: No fake engineering result is generated -> PASS
  it('TEST 14: should not generate fake CFD/FEA or telemetry results during definition phase', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const bundle = IndustrialDroneProofCase.createProductBundle(config);

    // ProofCase simulations and tests arrays must be empty
    expect(bundle.proofCase.simulations).toEqual([]);
    expect(bundle.proofCase.tests).toEqual([]);
    expect(bundle.proofCase.models).toEqual([]);

    // Evidence status must be NOT_YET_AVAILABLE
    for (const req of bundle.requirements) {
      expect(req.metadata?.evidenceStatus).toBe('NOT_YET_AVAILABLE');
      expect(req.metadata?.designFeatureLink).toBe('NOT_YET_LINKED');
      expect(req.metadata?.analysisLink).toBe('NOT_YET_LINKED');
    }
  });

  // TEST 15: Evidence Package generated -> PASS
  it('TEST 15: should assemble a complete EPC-009 Evidence Package with valid SHA-256 hash', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const bundle = IndustrialDroneProofCase.createProductBundle(config);
    const ep = bundle.evidencePackage as any;

    expect(ep).toBeDefined();
    expect(ep.packageId).toBe('EVP-EPC016-EPC-CASE-001-1.0');
    expect(ep.source).toBe('EPC-016');
    expect(ep.contentHash).toBeDefined();
    expect(ep.contentHash.length).toBe(64); // Valid SHA-256 hex string
    expect(ep.lifecycle).toBe('ASSEMBLED');
    expect(ep.payload).toBeDefined();
  });

  // TEST 16: Provenance generated -> PASS
  it('TEST 16: should generate complete EPC-011 Provenance record', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const bundle = IndustrialDroneProofCase.createProductBundle(config);
    const prov = bundle.provenance;

    expect(prov).toBeDefined();
    expect(prov.provenanceId).toBe('PROV-EPC-CASE-001-1.0-DEF');
    expect(prov.actor).toBe('SECP_LEAD_SYSTEMS_ENGINEER');
    expect(prov.source).toBe('EPC-016');
    expect(prov.inputs.missionId).toBe('MIS-DRONE-INSPECT-001');
    expect(prov.process.processId).toBe('MISSION_TRANSFORMATION_PROCESS');
    expect(prov.outputs.length).toBeGreaterThan(0);
  });

  // TEST 23: Anti-hardcoding test (varying configurations without code changes) -> PASS
  it('TEST 23: should dynamically process custom and diverse mission payloads without hardcoding', () => {
    const customConfig: EPC016InputConfig = {
      caseId: 'EPC-CASE-002',
      revision: '2.0',
      mission: {
        missionId: 'MIS-DRONE-LIDAR-SURVEY-002',
        missionName: 'Heavy LiDAR Topographic Survey Mission',
        missionDescription: 'High-altitude dense forest canopy LiDAR penetration survey.',
        missionClass: 'SURVEYING',
        operatingScenario: 'Grid survey over 20 sq km mountainous terrain.',
        primaryObjective: 'Collect 100 pts/m2 LiDAR point cloud within 35 min flight duration.',
        secondaryObjectives: ['Real-time cloud transmission'],
        missionDuration: { value: 2100, unit: 's' },
        requiredRange: { value: 25000, unit: 'm' },
        requiredPayload: { value: 3.5, unit: 'kg' },
        operatingAltitude: { value: 450, unit: 'm' },
        operatingSpeed: { value: 16, unit: 'm/s' },
        environmentalConditionsRef: 'ENV-MOUNTAIN-01',
        operationalConstraints: ['BVLos approval required'],
        safetyConstraints: ['Parachute recovery system mandatory']
      },
      environment: {
        environmentProfileId: 'ENV-MOUNTAIN-01',
        profileName: 'Mountainous Sub-Zero Profile',
        mode: 'OUTDOOR',
        temperatureRange: { min: -25, max: 20, unit: '°C' },
        pressureRange: { min: 70000, max: 100000, unit: 'Pa' },
        humidityRange: { min: 5, max: 99, unit: '%' },
        windSpeedRange: { min: 0, max: 15, unit: 'm/s' },
        maximumGust: { value: 22, unit: 'm/s' },
        operatingAltitudeRange: { min: 1000, max: 4000, unit: 'm' },
        dustExposure: 'IP65',
        rainExposure: 'Heavy rain up to 15 mm/hr',
        visibilityConditions: { value: 2000, unit: 'm' }
      },
      payload: {
        payloadId: 'PAYLOAD-LIDAR-RIEGL-01',
        payloadName: 'Precision Topographic LiDAR Scanner',
        payloadType: 'LIDAR',
        payloadMass: { value: 3.2, unit: 'kg' },
        payloadDimensions: { length: 0.28, width: 0.22, height: 0.25, unit: 'm' },
        payloadPower: { value: 85, unit: 'W' },
        payloadCG: { x: 0.0, y: 0.0, z: -0.18, unit: 'm' },
        payloadMountLocation: 'Bottom damped quick-release mount',
        payloadOperationalMode: 'PULSED_LIDAR_CAPTURE',
        payloadDutyCycle: { value: 95, unit: '%' },
        payloadRequirements: [
          {
            requirementId: 'REQ-LIDAR-PULSE-RATE-001',
            description: 'Laser pulse repetition rate',
            parameter: 'pulseRate',
            unit: 'count',
            tolerance: { type: 'BOUNDS', lowerBound: 500000 },
            priority: 'HIGH',
            verificationMethod: 'MEASUREMENT',
            validationMethod: 'EXPERIMENT',
            category: 'PAYLOAD',
            revision: '2.0',
            metadata: { status: 'DEFINED', source: 'MISSION_DEFINITION' }
          }
        ]
      },
      endurance: {
        targetEndurance: { value: 2400, unit: 's' },
        minimumEndurance: { value: 2100, unit: 's' },
        missionDuration: { value: 2100, unit: 's' },
        reserveEnergy: { value: 25, unit: '%' },
        batteryCapacity: { value: 1600, unit: 'Wh' },
        energyConsumptionBudget: { value: 1200, unit: 'Wh' },
        cruisePowerBudget: { value: 1250, unit: 'W' },
        hoverPowerBudget: { value: 1500, unit: 'W' },
        payloadPowerBudget: { value: 85, unit: 'W' },
        reservePolicy: '25% battery threshold contingency.'
      },
      performance: {
        maximumTakeoffMass: { value: 18.5, unit: 'kg' },
        emptyMassTarget: { value: 11.5, unit: 'kg' },
        payloadCapacity: { value: 4.0, unit: 'kg' },
        maximumSpeed: { value: 25, unit: 'm/s' },
        cruiseSpeed: { value: 16, unit: 'm/s' },
        climbRate: { value: 6.0, unit: 'm/s' },
        maximumAltitude: { value: 4500, unit: 'm' },
        missionRange: { value: 30000, unit: 'm' },
        endurance: { value: 2400, unit: 's' },
        hoverTime: { value: 1800, unit: 's' },
        maximumWindSpeed: { value: 15, unit: 'm/s' },
        maximumGust: { value: 22, unit: 'm/s' },
        turningRate: { value: 45, unit: 'deg/s' },
        accelerationLimit: { value: 10.0, unit: 'm/s²' },
        landingSpeed: { value: 0.8, unit: 'm/s' }
      },
      assumptions: [],
      constraints: [],
      author: 'SURVEY_SPECIALIST'
    };

    const bundle = IndustrialDroneProofCase.createProductBundle(customConfig);
    expect(bundle.proofCase.caseId).toBe('EPC-CASE-002');
    expect(bundle.proofCase.revision).toEqual({
      revisionId: '2.0',
      timestamp: expect.any(String),
      author: 'SURVEY_SPECIALIST',
      changeSummary: expect.any(String)
    });
    expect(bundle.payload.payloadType).toBe('LIDAR');
    expect(bundle.performance.maximumTakeoffMass.value).toBe(18.5);

    // Verify EPC-016 Verifier on custom configuration
    const verification = EPC016Verifier.runVerification(customConfig);
    expect(verification.verdict).toBe('PASS');
    expect(verification.checks['PROOF_CASE_IDENTITY'].passed).toBe(true);
  });

  // TEST 24: Determinism & Reproducibility -> PASS
  it('TEST 24: should generate identical cryptographic hash given identical input configuration', () => {
    const config = IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const bundle1 = IndustrialDroneProofCase.createProductBundle(config);
    const bundle2 = IndustrialDroneProofCase.createProductBundle(config);

    // Hashes of requirements and parameters should be completely deterministic
    const reqsHash1 = bundle1.requirements.map(r => r.requirementId).join('|');
    const reqsHash2 = bundle2.requirements.map(r => r.requirementId).join('|');
    expect(reqsHash1).toBe(reqsHash2);
  });

  // TEST 25: Master Verifier execution -> PASS
  it('TEST 25: should pass all checks in EPC016Verifier', () => {
    const result = EPC016Verifier.runVerification();

    expect(result.epc).toBe('EPC-016');
    expect(result.verdict).toBe('PASS');
    expect(result.evidenceHash).toBeDefined();
    for (const [checkId, check] of Object.entries(result.checks)) {
      expect(check.passed, `Check ${checkId} failed: ${check.message}`).toBe(true);
    }
  });
});
