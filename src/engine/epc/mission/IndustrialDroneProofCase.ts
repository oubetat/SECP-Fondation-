/**
 * SECP Industrial OS — EPC-016: Industrial Drone Proof Case Engine
 * Primary orchestrator for EPC-016 Mission & Product Definition.
 * Employs SECP Universal Engineering Core to convert Mission Definitions
 * into verifiable Engineering Requirements, Configuration Baseline,
 * and Canonical Evidence Packages.
 */

import {
  EPC016InputConfig,
  EPC016ProductBundle,
  EPC016ValidationError,
  MissionDefinition,
  OperatingEnvironmentDefinition,
  PayloadDefinition,
  EnduranceDefinition,
  PerformanceRequirementValues,
  MissionAssumption,
  MissionConstraint,
  ProductDefinition
} from './MissionTypes';
import { MissionValidator } from './MissionValidator';
import { MissionTransformer } from './MissionTransformer';
import { ProofCaseProject } from '../ProofCaseTypes';
import { ProvenanceAction, EvidenceProvenance } from '../evidence/EvidenceProvenanceTypes';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export class IndustrialDroneProofCase {
  public static readonly CASE_ID = 'EPC-CASE-001';
  public static readonly DEFAULT_REVISION = '1.0';

  /**
   * Generates a canonical baseline configuration for an Industrial Inspection Drone.
   * Note: This is an extensible configuration, not a hardcoded engine logic.
   */
  public static createDefaultInspectionDroneConfig(): EPC016InputConfig {
    const mission: MissionDefinition = {
      missionId: 'MIS-DRONE-INSPECT-001',
      missionName: 'Industrial Infrastructure Visual & Thermal Inspection',
      missionDescription: 'Autonomous and semi-autonomous aerial inspection of pipeline, flare stack, and structural assets in harsh environments.',
      missionClass: 'INSPECTION',
      operatingScenario: 'Asset integrity survey along a 5 km industrial corridor with automated waypoint following and hovering thermal checks.',
      primaryObjective: 'Deliver high-resolution visual and radiometric thermal imagery of target infrastructure within 45 minutes flight window.',
      secondaryObjectives: [
        'Maintain telemetry connection up to 8 km line-of-sight',
        'Safely execute automated Return-To-Home (RTH) upon low battery threshold',
        'Withstand moderate gust conditions up to 14 m/s'
      ],
      missionDuration: { value: 2700, unit: 's' }, // 45 min
      requiredRange: { value: 10000, unit: 'm' }, // 10 km
      requiredPayload: { value: 1.5, unit: 'kg' },
      operatingAltitude: { value: 120, unit: 'm' },
      operatingSpeed: { value: 12, unit: 'm/s' },
      environmentalConditionsRef: 'ENV-OUTDOOR-STANDARD-01',
      operationalConstraints: [
        'Line-of-Sight or Extended Visual Line-of-Sight operation',
        'Minimum safe standoff distance of 5 m from metallic structures'
      ],
      safetyConstraints: [
        'Fail-safe emergency landing on dual motor or ESC failure',
        'Geo-fencing containment within designated flight corridor'
      ]
    };

    const environment: OperatingEnvironmentDefinition = {
      environmentProfileId: 'ENV-OUTDOOR-STANDARD-01',
      profileName: 'Standard Harsh Industrial Outdoor Profile',
      mode: 'OUTDOOR',
      temperatureRange: { min: -10, max: 45, unit: '°C' },
      pressureRange: { min: 85000, max: 105000, unit: 'Pa' },
      humidityRange: { min: 10, max: 95, unit: '%' },
      windSpeedRange: { min: 0, max: 10, unit: 'm/s' },
      maximumGust: { value: 14, unit: 'm/s' },
      operatingAltitudeRange: { min: 0, max: 2000, unit: 'm' },
      dustExposure: 'IP54 IEC 60529',
      rainExposure: 'Light rain up to 5 mm/hr',
      visibilityConditions: { value: 5000, unit: 'm' }
    };

    const payload: PayloadDefinition = {
      payloadId: 'PAYLOAD-CAM-OPTICAL-THERMAL-01',
      payloadName: 'Dual Optical & Radiometric Thermal Gimbal Camera',
      payloadType: 'INSPECTION_CAMERA',
      payloadMass: { value: 1.2, unit: 'kg' },
      payloadDimensions: { length: 0.16, width: 0.14, height: 0.18, unit: 'm' },
      payloadPower: { value: 25, unit: 'W' },
      payloadCG: { x: 0.0, y: 0.0, z: -0.12, unit: 'm' },
      payloadMountLocation: 'Quick-release bottom anti-vibration mount',
      payloadOperationalMode: 'CONTINUOUS_SYNCHRONIZED_STREAM',
      payloadDutyCycle: { value: 100, unit: '%' },
      payloadRequirements: [
        {
          requirementId: 'REQ-PAYLOAD-FOV-001',
          description: 'Optical camera horizontal field of view',
          parameter: 'horizontalFOV',
          unit: 'deg',
          tolerance: { type: 'BOUNDS', lowerBound: 60, upperBound: 85 },
          priority: 'MEDIUM',
          verificationMethod: 'MEASUREMENT',
          validationMethod: 'EXPERIMENT',
          category: 'PAYLOAD',
          revision: '1.0',
          metadata: { status: 'DEFINED', source: 'MISSION_DEFINITION' }
        },
        {
          requirementId: 'REQ-PAYLOAD-THERMAL-NETD-001',
          description: 'Thermal sensor Noise Equivalent Temperature Difference (NETD)',
          parameter: 'thermalSensitivity',
          unit: 'count', // mK / count
          tolerance: { type: 'BOUNDS', upperBound: 50 },
          priority: 'HIGH',
          verificationMethod: 'MEASUREMENT',
          validationMethod: 'EXPERIMENT',
          category: 'PAYLOAD',
          revision: '1.0',
          metadata: { status: 'DEFINED', source: 'CUSTOMER_REQUIREMENT' }
        }
      ]
    };

    const endurance: EnduranceDefinition = {
      targetEndurance: { value: 3000, unit: 's' }, // 50 min
      minimumEndurance: { value: 2700, unit: 's' }, // 45 min
      missionDuration: { value: 2700, unit: 's' },
      reserveEnergy: { value: 20, unit: '%' },
      batteryCapacity: { value: 850, unit: 'Wh' },
      energyConsumptionBudget: { value: 680, unit: 'Wh' }, // 80% usable
      cruisePowerBudget: { value: 650, unit: 'W' },
      hoverPowerBudget: { value: 780, unit: 'W' },
      payloadPowerBudget: { value: 25, unit: 'W' },
      reservePolicy: 'Strict 20% energy reserve threshold triggers automatic return to base.'
    };

    const performance: PerformanceRequirementValues = {
      maximumTakeoffMass: { value: 9.5, unit: 'kg' },
      emptyMassTarget: { value: 6.5, unit: 'kg' },
      payloadCapacity: { value: 1.5, unit: 'kg' },
      maximumSpeed: { value: 20, unit: 'm/s' },
      cruiseSpeed: { value: 12, unit: 'm/s' },
      climbRate: { value: 5.0, unit: 'm/s' },
      maximumAltitude: { value: 2500, unit: 'm' },
      missionRange: { value: 15000, unit: 'm' },
      endurance: { value: 3000, unit: 's' },
      hoverTime: { value: 2400, unit: 's' },
      maximumWindSpeed: { value: 10, unit: 'm/s' },
      maximumGust: { value: 14, unit: 'm/s' },
      turningRate: { value: 60, unit: 'deg/s' },
      accelerationLimit: { value: 8.0, unit: 'm/s²' },
      landingSpeed: { value: 1.0, unit: 'm/s' }
    };

    const assumptions: MissionAssumption[] = [
      {
        assumptionId: 'ASSUMP-DRONE-PROP-EFF-001',
        description: 'Estimated hover propulsion figure of merit (FM)',
        parameter: 'propulsionFigureOfMerit',
        value: 0.72,
        unit: 'dimensionless',
        rationale: 'Based on high-efficiency 22-inch carbon folding propeller benchmarks.',
        impact: 'HIGH',
        status: 'ACTIVE'
      },
      {
        assumptionId: 'ASSUMP-DRONE-BATT-DENSITY-001',
        description: 'Assumed LiPo/Solid-State battery specific energy density',
        parameter: 'batterySpecificEnergy',
        value: 230,
        unit: 'Wh', // Wh/kg stored as nominal Wh per reference kg
        rationale: 'Industrial-grade semi-solid pouch cell pack specification.',
        impact: 'HIGH',
        status: 'ACTIVE'
      },
      {
        assumptionId: 'ASSUMP-DRONE-DRAG-COEFF-001',
        description: 'Estimated parasitic drag area (CdA) of fuselage and payload in cruise',
        parameter: 'parasiticDragArea',
        value: 0.045,
        unit: 'm', // m^2
        rationale: 'Preliminary aerodynamic estimation from streamlined industrial canopy.',
        impact: 'MEDIUM',
        status: 'ACTIVE'
      }
    ];

    const constraints: MissionConstraint[] = [
      {
        constraintId: 'CONST-DRONE-MTOM-LIMIT-001',
        constraintType: 'MaximumMass',
        description: 'Maximum allowable takeoff mass compliant with sub-10kg operational category',
        limitValue: 10.0,
        unit: 'kg',
        rationale: 'Civil Aviation Category II regulatory boundary threshold.'
      },
      {
        constraintId: 'CONST-DRONE-DIM-LIMIT-001',
        constraintType: 'MaximumVolume',
        description: 'Maximum folded transport footprint diagonal',
        limitValue: 0.85,
        unit: 'm',
        rationale: 'Standard rugged Pelican case transport container limit.'
      },
      {
        constraintId: 'CONST-DRONE-BATTERY-VOLT-001',
        constraintType: 'BatteryLimit',
        description: 'Maximum nominal pack voltage (12S LiPo equivalent)',
        limitValue: 50.4,
        unit: 'W', // or V
        rationale: 'Standard ESC and power distribution system component rating.'
      }
    ];

    return {
      caseId: IndustrialDroneProofCase.CASE_ID,
      revision: IndustrialDroneProofCase.DEFAULT_REVISION,
      mission,
      environment,
      payload,
      endurance,
      performance,
      assumptions,
      constraints,
      author: 'SECP_LEAD_SYSTEMS_ENGINEER'
    };
  }

  /**
   * Builds and returns a fully validated, traceable EPC-016 Product Definition Bundle.
   */
  public static createProductBundle(config: EPC016InputConfig): EPC016ProductBundle {
    const timestamp = new Date().toISOString();
    const caseId = config.caseId || this.CASE_ID;
    const revision = config.revision || this.DEFAULT_REVISION;

    // 1. Strict Input Validation (anti-tamper, positive physics, units, etc.)
    MissionValidator.validate(config);

    // 2. Transform Mission to Canonical EPC-002 Engineering Requirements
    const requirements = MissionTransformer.transformToRequirements(config);

    // 3. Create Product Definition Object
    const productDefinition = MissionTransformer.createProductDefinition(config, requirements, timestamp);

    // 4. Build EPC-004 Configuration Baseline
    const configurationBaseline: Record<string, unknown> = {
      baselineId: `BASE-${caseId}-${revision}`,
      status: 'QUALIFIED',
      revision,
      createdAt: timestamp,
      missionConfig: {
        missionId: config.mission.missionId,
        missionClass: config.mission.missionClass,
        primaryObjective: config.mission.primaryObjective,
        durationSeconds: config.mission.missionDuration.value
      },
      environmentConfig: {
        profileId: config.environment.environmentProfileId,
        mode: config.environment.mode,
        temperatureMin: config.environment.temperatureRange.min,
        temperatureMax: config.environment.temperatureRange.max
      },
      payloadConfig: {
        payloadId: config.payload.payloadId,
        payloadType: config.payload.payloadType,
        massKg: config.payload.payloadMass.value
      },
      requirementConfig: {
        totalRequirements: requirements.length,
        criticalCount: requirements.filter(r => r.priority === 'CRITICAL').length,
        requirementIds: requirements.map(r => r.requirementId)
      },
      // Elements that are intentionally deferred to future engineering phases
      cad: 'NOT_DEFINED_YET',
      cae: 'NOT_DEFINED_YET',
      mesh: 'NOT_DEFINED_YET',
      solver: 'NOT_DEFINED_YET',
      cam: 'NOT_DEFINED_YET'
    };

    // 5. Generate EPC-011 Provenance
    const provenance: EvidenceProvenance = {
      provenanceId: `PROV-${caseId}-${revision}-DEF`,
      evidenceId: `EV-${caseId}-${revision}-BUNDLE`,
      actor: config.author || 'SECP_MISSION_ENGINE',
      action: ProvenanceAction.VERIFICATION,
      timestamp,
      source: 'EPC-016',
      sourceVersion: revision,
      inputs: {
        missionId: config.mission.missionId,
        environmentProfileId: config.environment.environmentProfileId,
        payloadId: config.payload.payloadId,
        assumptionsCount: config.assumptions.length,
        constraintsCount: config.constraints.length
      },
      process: {
        processId: 'MISSION_TRANSFORMATION_PROCESS',
        processType: 'ENGINEERING_SPECIFICATION_DERIVATION',
        processVersion: '1.0.0',
        executionId: `EXEC-EPC016-${Date.now()}`,
        startTime: timestamp,
        endTime: timestamp,
        status: 'COMPLETED'
      },
      outputs: [
        `PROD-${caseId}-${revision}`,
        `BASE-${caseId}-${revision}`,
        `EV-${caseId}-${revision}-BUNDLE`
      ],
      parentEvidenceIds: [],
      configurationId: `BASE-${caseId}-${revision}`,
      revisionId: revision,
      metadata: {
        transformationType: 'MISSION_TO_PRODUCT_ENGINEERING_DEFINITION',
        schema: 'EPC-002 / EPC-016'
      }
    };

    // 6. Generate EPC-009 Evidence Package
    const evidencePayload = {
      caseId,
      revision,
      productDefinition,
      mission: config.mission,
      environment: config.environment,
      payload: config.payload,
      endurance: config.endurance,
      performance: config.performance,
      requirements,
      assumptions: config.assumptions,
      constraints: config.constraints,
      configurationBaseline,
      provenance
    };

    const contentHash = EvidenceIntegrityService.computeHash(evidencePayload);

    const evidencePackage = {
      packageId: `EVP-EPC016-${caseId}-${revision}`,
      caseId,
      revision,
      source: 'EPC-016',
      createdAt: timestamp,
      contentHash,
      lifecycle: 'ASSEMBLED',
      verdict: 'PASS',
      payload: evidencePayload,
      provenance
    };

    // 7. Create EPC-001 Proof Case Project
    const proofCase: ProofCaseProject = {
      caseId,
      caseType: 'PRODUCT',
      domain: 'INDUSTRIAL_DRONE',
      revision: {
        revisionId: revision,
        timestamp,
        author: config.author || 'SECP_MISSION_ENGINE',
        changeSummary: 'EPC-016 Industrial Drone Mission & Product Definition baseline created.'
      },
      status: 'DEFINED',
      owner: {
        ownerId: config.author || 'SECP_CHIEF_SYSTEMS_ENGINEER',
        name: 'Industrial Drone Lead Engineer',
        role: 'SYSTEMS_ARCHITECT'
      },
      requirements: requirements.map(r => ({
        requirementId: r.requirementId,
        title: r.description,
        category: r.category,
        revision,
        status: 'DEFINED',
        metadata: {
          priority: r.priority,
          verificationMethod: r.verificationMethod,
          validationMethod: r.validationMethod
        }
      })),
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: [
        {
          evidenceId: `EV-${caseId}-${revision}-BUNDLE`,
          evidenceType: 'MISSION_PRODUCT_DEFINITION',
          contentHash,
          timestamp,
          verificationStatus: 'DEFINED'
        }
      ],
      metadata: {
        epcPhase: 'EPC-016',
        productType: 'Industrial Drone',
        assumptionsCount: config.assumptions.length,
        constraintsCount: config.constraints.length,
        definedAt: timestamp
      }
    };

    const revisionHistory = [
      {
        revision,
        timestamp,
        author: config.author || 'SECP_MISSION_ENGINE',
        changeSummary: `Initial Mission & Product Definition baseline for ${config.mission.missionName}`
      }
    ];

    return {
      proofCase,
      mission: config.mission,
      environment: config.environment,
      payload: config.payload,
      endurance: config.endurance,
      performance: config.performance,
      requirements,
      assumptions: config.assumptions,
      constraints: config.constraints,
      productDefinition,
      configurationBaseline,
      evidencePackage,
      provenance,
      revisionHistory
    };
  }

  /**
   * Applies an incremental revision update to an existing bundle.
   */
  public static incrementRevision(
    currentBundle: EPC016ProductBundle,
    updates: Partial<EPC016InputConfig>,
    newRevision: string,
    changeSummary: string,
    author: string = 'SECP_MISSION_ENGINE'
  ): EPC016ProductBundle {
    if (newRevision === currentBundle.proofCase.revision || (typeof currentBundle.proofCase.revision === 'object' && newRevision === currentBundle.proofCase.revision.revisionId)) {
      throw new EPC016ValidationError(
        `New revision '${newRevision}' must differ from current revision '${currentBundle.productDefinition.revision}'`,
        'INVALID_REVISION_INCREMENT'
      );
    }

    const updatedConfig: EPC016InputConfig = {
      caseId: currentBundle.proofCase.caseId,
      revision: newRevision,
      mission: updates.mission || currentBundle.mission,
      environment: updates.environment || currentBundle.environment,
      payload: updates.payload || currentBundle.payload,
      endurance: updates.endurance || currentBundle.endurance,
      performance: updates.performance || currentBundle.performance,
      assumptions: updates.assumptions || currentBundle.assumptions,
      constraints: updates.constraints || currentBundle.constraints,
      customRequirements: updates.customRequirements,
      author
    };

    const newBundle = this.createProductBundle(updatedConfig);

    const updatedHistory = [
      ...currentBundle.revisionHistory,
      {
        revision: newRevision,
        timestamp: new Date().toISOString(),
        author,
        changeSummary
      }
    ];

    return {
      ...newBundle,
      revisionHistory: updatedHistory
    };
  }
}
