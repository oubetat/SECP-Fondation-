/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-PHASE-5-001: Aircraft & Industrial Qualification Engine
 * EngineeringSystemCanonicalModel.ts
 * 
 * Formal system-level canonical root entity (`EngineeringSystem`) linking
 * multidomain hardware assembly, system operating envelope, mission profile,
 * and traceable qualification requirements.
 */

import {
  MultidomainPcbAssembly,
  MultidomainPcbIntegrationEngine
} from '../crossdomain/MultidomainPcbIntegrationEngine';
import {
  QualificationRequirement
} from './QualificationRequirement';

export type SystemApplicationDomain =
  | 'AIRCRAFT_AVIONICS'
  | 'INDUSTRIAL_AUTOMATION'
  | 'AUTOMOTIVE_SUBSYSTEM'
  | 'DEFENSE_ELECTRONICS'
  | 'GENERAL_EMBEDDED';

export interface SystemOperatingEnvelope {
  nominalSupplyVoltageV: number;
  minSupplyVoltageV: number;
  maxSupplyVoltageV: number;
  maxOperatingCurrentA: number;
  minAmbientTempC: number;
  maxAmbientTempC: number;
  maxComponentJunctionTempC: number;
  maxTraceVoltageDropPercent: number;
  minInternalEnclosureClearanceMm: number;
  minLidVerticalKeepoutMm: number;
  vibrationProfileDeclared: string;
  emiClassificationDeclared: string;
}

export interface SystemSolverValidityEnvelope {
  circuitSolver: {
    engine: string;
    validityScope: string;
    unsupportedPhenomena: string[];
  };
  thermalSolver: {
    engine: string;
    validityScope: string;
    unsupportedPhenomena: string[];
  };
  mechanicalVerification: {
    engine: string;
    validityScope: string;
    unsupportedPhenomena: string[];
  };
}

export interface EngineeringSystem {
  systemId: string;
  revisionId: string;
  name: string;
  targetDomain: SystemApplicationDomain;
  targetStandard: string;
  operatingEnvelope: SystemOperatingEnvelope;
  multidomainAssembly: MultidomainPcbAssembly;
  qualificationRequirements: QualificationRequirement[];
  solverValidity: SystemSolverValidityEnvelope;
  declaredScopeAndLimitations: string[];
}

/**
 * Creates the canonical Reference Aircraft/Industrial Electronic Control Unit (ECU): `SECP-REF-ECU-001`
 */
export function createReferenceEcuSystem(): EngineeringSystem {
  const baseAssembly = MultidomainPcbIntegrationEngine.createReferenceBenchmarkAssembly();

  // Adjust assembly identifiers and characteristics for SECP-REF-ECU-001
  const assembly: MultidomainPcbAssembly = {
    ...baseAssembly,
    assemblyId: 'SECP-REF-ECU-001-ASSEMBLY',
    revisionId: 'REV-5.0.0-QUAL',
    pcb: {
      ...baseAssembly.pcb,
      designId: 'SECP-PCB-ECU-001',
      revisionId: 'REV-5.0.0-QUAL',
      layerCount: 4, // 4-Layer rigid board per IPC-6012 Class 3
      components: [
        ...baseAssembly.pcb.components
      ]
    }
  };

  const operatingEnvelope: SystemOperatingEnvelope = {
    nominalSupplyVoltageV: 28.0, // Standard 28V DC aircraft avionics supply
    minSupplyVoltageV: 18.0,
    maxSupplyVoltageV: 32.0,
    maxOperatingCurrentA: 5.0,
    minAmbientTempC: -40.0,
    maxAmbientTempC: 85.0,
    maxComponentJunctionTempC: 105.0,
    maxTraceVoltageDropPercent: 3.0,
    minInternalEnclosureClearanceMm: 2.0,
    minLidVerticalKeepoutMm: 3.0,
    vibrationProfileDeclared: 'STATIC_GEOMETRY_FIT_ONLY (Dynamic vibration testing NOT_PROVEN)',
    emiClassificationDeclared: 'METALLIC_ENCLOSURE_SEALED (Emissions testing NOT_PROVEN)'
  };

  const solverValidity: SystemSolverValidityEnvelope = {
    circuitSolver: {
      engine: 'src/engine/engineeringCore/NodalCircuitSolver.ts (MNA)',
      validityScope: 'DC Steady-State linear resistive networks and constant current/voltage sources.',
      unsupportedPhenomena: [
        'High-frequency RF transmission line effects',
        'Electromagnetic transient lightning surges (DO-160 Section 22)',
        'Dielectric breakdown under transient over-voltages'
      ]
    },
    thermalSolver: {
      engine: 'src/engine/crossdomain/MultidomainPcbIntegrationEngine.ts (Theta-JA Lumped 0D/1D)',
      validityScope: 'Steady-state 1D junction-to-ambient conductive/convective lumped resistance.',
      unsupportedPhenomena: [
        '3D Navier-Stokes computational fluid dynamics (CFD)',
        'Anisotropic multi-layer PCB internal copper thermal spreading',
        'Solar radiation heating and altitude air-density thinning effects'
      ]
    },
    mechanicalVerification: {
      engine: 'src/engine/crossdomain/MultidomainPcbIntegrationEngine.ts (MCAD Rigid Clearance)',
      validityScope: 'Nominal 3D bounding-box spatial clearance, standoff alignment, and cutout egress.',
      unsupportedPhenomena: [
        'Random vibration fatigue and resonance (MIL-STD-810H)',
        'Pyrotechnic and mechanical crash shock (DO-160 Section 7)',
        'Thermal expansion (CTE mismatch) solder joint cyclic stress'
      ]
    }
  };

  const qualificationRequirements: QualificationRequirement[] = [
    {
      requirementId: 'REQ-ECU-ELEC-001',
      sourceStandard: 'DO-254',
      standardClause: 'Section 5.3 — Circuit Electrical Integrity',
      criticality: 'SAFETY_CRITICAL',
      title: 'Power Bus Nodal Law Conservation',
      description: 'The electrical power bus network must satisfy Kirchhoff Voltage and Current Laws with negligible numerical residue (< 1e-12 W).',
      verificationMethod: 'ANALYSIS',
      authoritativeEngine: 'NodalCircuitSolver.solveDetailed',
      targetReference: {
        domain: 'ELECTRICAL',
        elementId: 'CIRCUIT_BENCHMARK_DC_BUS',
        elementType: 'NET',
        canonicalModelPath: 'multidomainAssembly.electricalCircuit'
      },
      acceptanceCriteria: {
        operator: '<=',
        expectedValue: 1e-12,
        unit: 'Watts'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'DC steady state only. Matrix conditioned with non-singular conductance.'
    },
    {
      requirementId: 'REQ-ECU-ELEC-002',
      sourceStandard: 'DO-254',
      standardClause: 'Section 5.3.2 — Supply Distribution Voltage Drop',
      criticality: 'SAFETY_CRITICAL',
      title: 'PCB Copper Trace Voltage Drop Margin',
      description: 'Physical PCB copper power distribution traces must maintain maximum voltage drop under 3.0% of nominal rail voltage.',
      verificationMethod: 'ANALYSIS',
      authoritativeEngine: 'MultidomainPcbIntegrationEngine.verifyElectricalTraceDrop',
      targetReference: {
        domain: 'ECAD',
        elementId: 'trace-power-vbus',
        elementType: 'TRACE',
        canonicalModelPath: 'multidomainAssembly.pcb.traces[0]'
      },
      acceptanceCriteria: {
        operator: '<=',
        expectedValue: 3.0,
        unit: 'Percent'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'Ohmic resistance calculated at 25°C standard copper resistivity.'
    },
    {
      requirementId: 'REQ-ECU-HARN-001',
      sourceStandard: 'IPC-6012-CLASS-3',
      standardClause: 'IPC/WHMA-A-620D Class 3 — High Reliability Wiring',
      criticality: 'SAFETY_CRITICAL',
      title: 'Harness Wire Gauge Ampacity Rating',
      description: 'Harness wires connecting to ECU external interfaces must have current-carrying ampacity rated strictly above operating load current.',
      verificationMethod: 'ANALYSIS',
      authoritativeEngine: 'MultidomainPcbIntegrationEngine.verifyEcadHarnessInterface',
      targetReference: {
        domain: 'WIRING_HARNESS',
        elementId: 'W_PWR_POS',
        elementType: 'WIRE',
        canonicalModelPath: 'multidomainAssembly.harness.wires[0]'
      },
      acceptanceCriteria: {
        operator: '==',
        expectedValue: 0,
        unit: 'Ampacity Violations'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'Continuous DC ampacity under standard ambient derating.'
    },
    {
      requirementId: 'REQ-ECU-HARN-002',
      sourceStandard: 'DO-254',
      standardClause: 'Section 5.4.1 — Interconnection Net & Pin Parity',
      criticality: 'SAFETY_CRITICAL',
      title: 'Connector Pinout Mating and Net Parity',
      description: '100% of mated connector pins between PCB and wiring harness must match net designations without cross-wiring or floating pins.',
      verificationMethod: 'INSPECTION',
      authoritativeEngine: 'MultidomainPcbIntegrationEngine.verifyEcadHarnessInterface',
      targetReference: {
        domain: 'CROSSDOMAIN',
        elementId: 'IF_PCB_HARNESS_01',
        elementType: 'CONNECTOR',
        canonicalModelPath: 'multidomainAssembly.harnessInterfaces[0]'
      },
      acceptanceCriteria: {
        operator: '==',
        expectedValue: 0,
        unit: 'Pinout Mismatches'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'Discrete topological mapping comparison between canonical ECAD and Harness pin arrays.'
    },
    {
      requirementId: 'REQ-ECU-THERM-001',
      sourceStandard: 'MIL-STD-810H',
      standardClause: 'Method 501.7 — High Temperature Operating Junction Limit',
      criticality: 'SAFETY_CRITICAL',
      title: 'Maximum Semiconductor Junction Temperature',
      description: 'All active semiconductor components must operate at junction temperatures <= 105.0°C under worst-case operational dissipation.',
      verificationMethod: 'SIMULATION',
      authoritativeEngine: 'MultidomainPcbIntegrationEngine.verifyThermalDissipation',
      targetReference: {
        domain: 'THERMAL',
        elementId: 'U1',
        elementType: 'COMPONENT',
        canonicalModelPath: 'multidomainAssembly.pcb.components[0]'
      },
      acceptanceCriteria: {
        operator: '<=',
        expectedValue: 105.0,
        unit: 'Degrees Celsius'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'Theta-JA 0D/1D lumped thermal model; does not account for transient thermal shock or localized CFD turbulent eddies.'
    },
    {
      requirementId: 'REQ-ECU-MECH-001',
      sourceStandard: 'DO-254',
      standardClause: 'Section 5.5 — Physical Installation & Enclosure Keepout',
      criticality: 'MISSION_CRITICAL',
      title: 'PCB Board Cavity Wall Clearance',
      description: 'The PCB perimeter must maintain at least 2.0mm clearance from the enclosure internal conductive aluminum walls.',
      verificationMethod: 'INSPECTION',
      authoritativeEngine: 'MultidomainPcbIntegrationEngine.verifyMcadMechanicalFit',
      targetReference: {
        domain: 'MCAD',
        elementId: 'ENC_CAVITY',
        elementType: 'ENCLOSURE',
        canonicalModelPath: 'multidomainAssembly.mechanicalEnclosure'
      },
      acceptanceCriteria: {
        operator: '==',
        expectedValue: true,
        unit: 'Clearance Status'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'Rigid body geometry evaluation at nominal dimensions; manufacturing tolerances not Monte-Carlo bounded.'
    },
    {
      requirementId: 'REQ-ECU-MECH-002',
      sourceStandard: 'DO-254',
      standardClause: 'Section 5.5.2 — Standoff Coaxial Alignment',
      criticality: 'MISSION_CRITICAL',
      title: 'Chassis Standoff Coaxial Alignment',
      description: 'Enclosure mounting standoffs must align with PCB mounting holes within 0.25mm axial tolerance.',
      verificationMethod: 'INSPECTION',
      authoritativeEngine: 'MultidomainPcbIntegrationEngine.verifyMcadMechanicalFit',
      targetReference: {
        domain: 'MCAD',
        elementId: 'ENC_STANDOFFS',
        elementType: 'STANDOFF',
        canonicalModelPath: 'multidomainAssembly.mechanicalEnclosure.standoffs'
      },
      acceptanceCriteria: {
        operator: '==',
        expectedValue: true,
        unit: 'Alignment Status'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: '2D planar Euclidian center-to-center distance comparison.'
    },
    {
      requirementId: 'REQ-ECU-MECH-003',
      sourceStandard: 'DO-254',
      standardClause: 'Section 5.5.3 — Vertical Z-Height Keepout Clearance',
      criticality: 'MISSION_CRITICAL',
      title: 'Component 3D Height Enclosure Lid Keepout',
      description: 'Tallest installed component must maintain at least 3.0mm vertical clearance from the enclosure lid ceiling.',
      verificationMethod: 'INSPECTION',
      authoritativeEngine: 'MultidomainPcbIntegrationEngine.verifyMcadMechanicalFit',
      targetReference: {
        domain: 'MCAD',
        elementId: 'ENC_LID',
        elementType: 'ENCLOSURE',
        canonicalModelPath: 'multidomainAssembly.mechanicalEnclosure'
      },
      acceptanceCriteria: {
        operator: '==',
        expectedValue: true,
        unit: 'Keepout Status'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'Linear vertical Z-axis subtraction without considering structural deflection under shock load.'
    },
    {
      requirementId: 'REQ-ECU-BOM-001',
      sourceStandard: 'DO-254',
      standardClause: 'Section 11.2 — Configuration Index and Traceable BOM',
      criticality: 'SAFETY_CRITICAL',
      title: 'Unified Multidomain BOM 100% Attribution',
      description: 'Every part in the release package must have a valid manufacturer, part number, and domain assignment (zero unassigned items).',
      verificationMethod: 'INSPECTION',
      authoritativeEngine: 'MultidomainPcbIntegrationEngine.verifyManufacturingBom',
      targetReference: {
        domain: 'BOM',
        elementId: 'UNIFIED_BOM_INDEX',
        elementType: 'BOM_ENTRY',
        canonicalModelPath: 'multidomainAssembly.bomItems'
      },
      acceptanceCriteria: {
        operator: '==',
        expectedValue: 0,
        unit: 'Unassigned Items'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'Syntactic and domain attribute completeness check.'
    },
    {
      requirementId: 'REQ-ECU-EVID-001',
      sourceStandard: 'SECP-CORE-STANDARD',
      standardClause: 'SECP Engineering Truth Ledger Clause 1.0',
      criticality: 'SAFETY_CRITICAL',
      title: 'Cryptographic Lineage & Evidence Ledger Attestation',
      description: 'The complete system configuration hash must be signed and registered in the immutable evidence ledger.',
      verificationMethod: 'TEST',
      authoritativeEngine: 'EngineeringTruthCertificateEngine & EngineeringEvidenceLedger',
      targetReference: {
        domain: 'CROSSDOMAIN',
        elementId: 'CRYPTO_ATTESTATION',
        elementType: 'NET',
        canonicalModelPath: 'system.cryptographicDigest'
      },
      acceptanceCriteria: {
        operator: '!=',
        expectedValue: '',
        unit: 'SHA-256 Digest'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'SHA-256 deterministic serialization.'
    },
    {
      requirementId: 'REQ-ECU-PCB-POUR-001',
      sourceStandard: 'IPC-6012-CLASS-3',
      standardClause: 'IPC-2221 / IPC-6012 — Copper Pour & Thermal Relief Generation',
      criticality: 'MISSION_CRITICAL',
      title: 'Automated Copper Pour & Thermal Relief Spoke Generation',
      description: 'Ground and power copper pours must be generated with proper clearance subtraction and thermal relief spokes without foreign net short circuits.',
      verificationMethod: 'ANALYSIS',
      authoritativeEngine: 'PcbCopperPourEngine.generatePour',
      targetReference: {
        domain: 'ECAD',
        elementId: 'POUR_GND_BOTTOM',
        elementType: 'ENCLOSURE',
        canonicalModelPath: 'multidomainAssembly.pcb'
      },
      acceptanceCriteria: {
        operator: '==',
        expectedValue: 0,
        unit: 'Clearance Breaches'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'Polygon boundary clearance subtraction on 2D copper layers.'
    },
    {
      requirementId: 'REQ-ECU-PCB-SI-001',
      sourceStandard: 'DO-254',
      standardClause: 'Section 5.3.3 — Controlled Impedance & Signal Integrity',
      criticality: 'MISSION_CRITICAL',
      title: 'Microstrip Characteristic Impedance ($Z_0$) Target Compliance',
      description: 'High-speed signal traces must maintain characteristic impedance within acceptable tolerance of target 50 ohms per IPC-2141.',
      verificationMethod: 'ANALYSIS',
      authoritativeEngine: 'PcbSignalIntegrityEngine.calculateMicrostrip',
      targetReference: {
        domain: 'ECAD',
        elementId: 'trace-power-vbus',
        elementType: 'TRACE',
        canonicalModelPath: 'multidomainAssembly.pcb.traces[0]'
      },
      acceptanceCriteria: {
        operator: '==',
        expectedValue: true,
        unit: '50 Ohm Compliance'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'Wheeler approximation equations for microstrip lines under standard FR4 dielectric (Er=4.3).'
    },
    {
      requirementId: 'REQ-ECU-PCB-MECH-004',
      sourceStandard: 'MIL-STD-810H',
      standardClause: 'Method 514.8 — Substrate Bending Deflection & Stress Limits',
      criticality: 'MISSION_CRITICAL',
      title: 'Substrate Bending Deflection and Stress Margin',
      description: 'The PCB substrate center deflection under static load must not exceed L/500 and bending stress must remain below yield limit.',
      verificationMethod: 'SIMULATION',
      authoritativeEngine: 'PcbStructuralDeflectionEngine.evaluateStructuralIntegrity',
      targetReference: {
        domain: 'MCAD',
        elementId: 'SECP-PCB-MULTIDOMAIN-REF-001',
        elementType: 'ENCLOSURE',
        canonicalModelPath: 'multidomainAssembly.pcb'
      },
      acceptanceCriteria: {
        operator: '==',
        expectedValue: true,
        unit: 'Structural Stability Status'
      },
      state: 'IMPLEMENTED',
      solverValidityLimits: 'Linear elastic plate-beam bending approximation; non-linear large deflection and fatigue are NOT_PROVEN.'
    }
  ];

  return {
    systemId: 'SECP-REF-ECU-001',
    revisionId: 'REV-5.0.0-QUAL',
    name: 'Industrial / Aircraft Electronic Control Unit (ECU) Reference Assembly',
    targetDomain: 'AIRCRAFT_AVIONICS',
    targetStandard: 'DO-254 & IPC-6012 Class 3',
    operatingEnvelope,
    multidomainAssembly: assembly,
    qualificationRequirements,
    solverValidity,
    declaredScopeAndLimitations: [
      'Qualified strictly for DC steady-state power distribution and low-frequency signaling.',
      'Thermal qualification is bounded by 0D/1D lumped Theta-JA conduction/convection; 3D CFD air-flow modeling is NOT_PROVEN.',
      'Mechanical qualification verifies rigid kinematic clearances; dynamic shock, vibration (MIL-STD-810H), and fatigue are NOT_PROVEN.',
      'Lightning surge and high-intensity radiated field (HIRF) immunity under DO-160 are NOT_PROVEN without physical lab test evidence.',
      'This qualification decision represents an internal engineering truth determination within SECP declared boundaries and does NOT substitute for official FAA/EASA certified type ratings.'
    ]
  };
}
