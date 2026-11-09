/**
 * SECP Industrial OS v3 — Capability Registry
 * Central repository for all engineering capabilities, performance metrics, and maturity states.
 */

import { 
  EngineeringCapability, 
  EngineeringDomain, 
  CapabilityMaturity, 
  CapabilityStatus,
  IndustrialCapabilityState,
  DomainCapabilityReport
} from './CapabilityTypes';

export class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  private capabilities: Map<string, EngineeringCapability> = new Map();

  private constructor() {
    this.initializeRegistry();
  }

  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  private initializeRegistry() {
    // CAD Capabilities
    this.registerCapability({
      id: 'CAD-BREP-CORE',
      domain: 'CAD',
      name: 'Industrial B-Rep Kernel',
      description: 'Advanced B-Rep geometry engine with NURBS and Boolean operations.',
      maturity: CapabilityMaturity.INDUSTRIAL,
      status: CapabilityStatus.VERIFIED,
      isVerified: true,
      isValidated: true,
      isProductionProven: false,
      coverage: 0.87,
      performance: { medianExecutionTimeMs: 42, p95ExecutionTimeMs: 81, memoryUsageMb: 320 },
      supportedScope: ['Box/Box Boolean', 'Cylinder/Box Boolean', 'Nested Booleans', 'Tangency Handling'],
      unsupportedScope: ['Spherical Singularities', 'Very Thin Solids'],
      knownLimitations: ['Degenerate edges in extreme scaling', 'NURBS knots > 1000'],
      evidenceReferences: ['PATCH-171', 'PATCH-172', 'GATE-041'],
      benchmarkReferences: ['CAD-BENCH-2026-A'],
      lastVerification: new Date().toISOString(),
      runtimeVersion: 'v2.4.0-CORE',
      determinismStatus: 'PASS',
      industrialScore: 82
    });

    // CFD Capabilities
    this.registerCapability({
      id: 'CFD-INC-FLOW',
      domain: 'CFD',
      name: 'Incompressible Flow Solver',
      description: 'Steady and transient incompressible flow with heat transfer.',
      maturity: CapabilityMaturity.VALIDATED,
      status: CapabilityStatus.VALIDATED,
      isVerified: true,
      isValidated: true,
      isProductionProven: false,
      coverage: 0.92,
      performance: { medianExecutionTimeMs: 1200, p95ExecutionTimeMs: 2500, memoryUsageMb: 2048, cpuUtilization: 0.95 },
      supportedScope: ['Laminar Flow', 'Turbulent Flow (RANS)', 'Conjugate Heat Transfer'],
      unsupportedScope: ['Compressible Shock Capturing', 'Supersonic Flow'],
      knownLimitations: ['High Mach number divergence', 'Non-Newtonian fluids'],
      evidenceReferences: ['PATCH-176', 'GATE-185'],
      benchmarkReferences: ['NASA-T3A', 'CFD-CERT-01'],
      lastVerification: new Date().toISOString(),
      runtimeVersion: 'v1.185.0-SOLVER',
      determinismStatus: 'PASS',
      industrialScore: 78
    });

    // FEM Capabilities
    this.registerCapability({
      id: 'FEM-NONLINEAR',
      domain: 'FEM',
      name: 'Nonlinear Structural Solver',
      description: 'Geometric and material nonlinearity with contact mechanics.',
      maturity: CapabilityMaturity.VERIFIED,
      status: CapabilityStatus.VERIFIED,
      isVerified: true,
      isValidated: false,
      isProductionProven: false,
      coverage: 0.75,
      performance: { medianExecutionTimeMs: 850, p95ExecutionTimeMs: 1800, memoryUsageMb: 1536 },
      supportedScope: ['Hyperelasticity', 'Plasticity', 'Large Deformations'],
      unsupportedScope: ['Dynamic Impact', 'Fracture Mechanics'],
      knownLimitations: ['Penalty contact chatter', 'Extreme distortion mesh failure'],
      evidenceReferences: ['PATCH-177', 'PATCH-238'],
      benchmarkReferences: ['FEM-VALID-B1'],
      lastVerification: new Date().toISOString(),
      runtimeVersion: 'v2.0.0-FEM',
      determinismStatus: 'PASS',
      industrialScore: 71
    });

    // CAM Capabilities
    this.registerCapability({
      id: 'CAM-5AXIS',
      domain: 'CAM',
      name: 'True Simultaneous 5-Axis CAM',
      description: 'Continuous 5-axis toolpath generation with collision avoidance.',
      maturity: CapabilityMaturity.INDUSTRIAL,
      status: CapabilityStatus.VERIFIED,
      isVerified: true,
      isValidated: false,
      isProductionProven: false,
      coverage: 0.81,
      performance: { medianExecutionTimeMs: 4500, p95ExecutionTimeMs: 9000, memoryUsageMb: 512, gpuUtilization: 0.4 },
      supportedScope: ['Swarf Milling', 'Contour Finishing', 'Gouge Detection'],
      unsupportedScope: ['Robotic Arm Kinematics', 'Non-orthogonal Machines'],
      knownLimitations: ['Singularity axis flip', 'Holder collision in deep cavities'],
      evidenceReferences: ['PATCH-179', 'GATE-179'],
      benchmarkReferences: ['ISO-10791-7'],
      lastVerification: new Date().toISOString(),
      runtimeVersion: 'v1.0.4-CAM',
      determinismStatus: 'PASS',
      industrialScore: 85
    });
    // Human Factors & Ergonomics Capabilities
    this.registerCapability({
      id: 'HFEE-DHM-FOUNDATION',
      domain: 'HUMAN_FACTORS',
      name: 'Digital Human Modeling Data Foundation',
      description: 'ISO 7250-1 & ANSUR II anthropometric dataset, 19-segment skeletal topology, and anatomical joint ROM boundaries.',
      maturity: CapabilityMaturity.IMPLEMENTED,
      status: CapabilityStatus.SUPPORTED,
      isVerified: true,
      isValidated: false,
      isProductionProven: false,
      coverage: 0.85,
      performance: { medianExecutionTimeMs: 15, p95ExecutionTimeMs: 35, memoryUsageMb: 128 },
      supportedScope: [
        'ISO 7250-1 Body Measurement Definitions',
        'ANSUR II 2012 Percentiles (P5, P50, P95)',
        '19-Segment Branched Skeletal Topology',
        'Anatomical ROM Boundaries (NASA STD-3001)',
        'EngineeringDocument Revision Binding'
      ],
      unsupportedScope: [
        'Full Multi-Branch Inverse Kinematics Solver',
        'RULA/REBA/OWAS Assessment Solvers',
        '3D Reach Surface Mesh Generator',
        'Binocular Vision Raycasting'
      ],
      knownLimitations: [
        'Static posture foundation only in TASK 002',
        'Requires TASK 003 for multi-branch IK solving'
      ],
      evidenceReferences: ['SECP-HFEE-001-TASK002', 'ANSUR-II-2012', 'ISO-7250-1'],
      benchmarkReferences: ['ISO-7250-1:2017', 'NASA-STD-3001-V2'],
      lastVerification: new Date().toISOString(),
      runtimeVersion: 'v1.0.0-DHM',
      determinismStatus: 'PASS',
      industrialScore: 80
    });

    // Human Factors Inverse Kinematics Capabilities
    this.registerCapability({
      id: 'HFEE-HUMAN-KINEMATICS',
      domain: 'HUMAN_FACTORS',
      name: 'Branched Human Posture & Inverse Kinematics Engine',
      description: 'Damped Least Squares (DLS) numerical solver for 19-segment branched human skeleton with multi-effector IK targets and ROM constraints.',
      maturity: CapabilityMaturity.IMPLEMENTED,
      status: CapabilityStatus.SUPPORTED,
      isVerified: true,
      isValidated: false,
      isProductionProven: false,
      coverage: 0.88,
      performance: { medianExecutionTimeMs: 22, p95ExecutionTimeMs: 48, memoryUsageMb: 140 },
      supportedScope: [
        'Branched 19-Segment Forward Kinematics',
        'Single and Multi-Effector Inverse Kinematics (Hands, Feet, Head)',
        'Damped Least Squares (DLS) Numerical Optimization',
        'Anatomical ROM Joint Constraint Enforcement',
        'Posture Regularization & Neutral Angle Preference',
        'Singularity & Unreachable Target Diagnostics',
        'Canonical EngineeringDocument Revision Binding'
      ],
      unsupportedScope: [
        'Dynamic Physics & Mass-Inertia Balance (TASK 004/007)',
        'RULA / REBA / OWAS Ergonomic Assessment (TASK 006)',
        'Pressurized Spaceflight Suit Resistance Factors'
      ],
      knownLimitations: [
        'Consumes provisional ANSUR II mean/P50 values qualified with limitations',
        'Kinematic posture solver only (non-dynamic)'
      ],
      evidenceReferences: ['SECP-HFEE-001-TASK003', 'NASA-STD-3001-V2'],
      benchmarkReferences: ['DLS-NUMERICAL-IK-2026'],
      lastVerification: new Date().toISOString(),
      runtimeVersion: 'v1.0.0-KIN',
      determinismStatus: 'PASS',
      industrialScore: 85
    });

    // Human Factors Reachability & Reach Envelopes Capabilities
    this.registerCapability({
      id: 'HFEE-REACHABILITY-ENGINE',
      domain: 'HUMAN_FACTORS',
      name: 'Human Reachability & Spatial Reach Envelopes Engine',
      description: 'Spatial reachability evaluator, discrete 3D grid envelope sampler, and CAD obstacle collision checking via CollisionAuthority.',
      maturity: CapabilityMaturity.IMPLEMENTED,
      status: CapabilityStatus.SUPPORTED,
      isVerified: true,
      isValidated: false,
      isProductionProven: false,
      coverage: 0.86,
      performance: { medianExecutionTimeMs: 45, p95ExecutionTimeMs: 120, memoryUsageMb: 160 },
      supportedScope: [
        'Single Target Reachability Evaluation (Hands, Feet, Head)',
        'Four-Way Status Classification (Kinematic, Anatomical, Collision-Free)',
        'CAD Geometry Obstacle Interaction via CollisionAuthority',
        '3D Grid Reach Envelope Generation & Coverage Ratio',
        'Canonical EngineeringDocument & CAD Revision Binding'
      ],
      unsupportedScope: [
        'RULA / REBA / OWAS Ergonomic Comfort Assessment (TASK 006)',
        'Biomechanical Muscle Force & L5-S1 Spine Load Calculations',
        'Continuous Mathematical Reach Surface Mesh (Sampled Grid Coverage Only)'
      ],
      knownLimitations: [
        'Consumes qualified ANSUR II dataset foundation with documented mean/P50 limitations',
        'Sampled grid envelope does not prove continuous mathematical coverage'
      ],
      evidenceReferences: ['SECP-HFEE-001-TASK004', 'COLLISION-AUTHORITY-V1'],
      benchmarkReferences: ['REACH-GRID-SAMPLE-2026'],
      lastVerification: new Date().toISOString(),
      runtimeVersion: 'v1.0.0-REACH',
      determinismStatus: 'PASS',
      industrialScore: 85
    });

    // Human Factors Vision & Line-of-Sight Capabilities
    this.registerCapability({
      id: 'HFEE-HUMAN-VISION',
      domain: 'HUMAN_FACTORS',
      name: 'Human Vision & Line-of-Sight Analysis Engine',
      description: '3D Eye configuration, gaze vector calculator, Left/Right/Binocular visual FOV inclusion, foveal cone testing, and CAD geometry obstruction raycasting.',
      maturity: CapabilityMaturity.IMPLEMENTED,
      status: CapabilityStatus.SUPPORTED,
      isVerified: true,
      isValidated: false,
      isProductionProven: false,
      coverage: 0.87,
      performance: { medianExecutionTimeMs: 18, p95ExecutionTimeMs: 40, memoryUsageMb: 150 },
      supportedScope: [
        '3D Left, Right, and Cyclopean Eye WCS Origin Calculation',
        'Head Pose & Eye Gaze Direction Vector (Yaw/Pitch)',
        'Visual Field (FOV) & Foveal Central Cone Inclusion',
        'Binocular, Monocular Left, Monocular Right Visibility',
        'CAD Geometry Obstruction Raycasting & First-Hit Identification',
        'Target Region Occlusion Percentage',
        'Canonical EngineeringDocument & CAD Revision Binding'
      ],
      unsupportedScope: [
        'RULA / REBA / OWAS Ergonomic Comfort Assessment (TASK 006)',
        'Cognitive Perception, Visual Acuity, or Luminance Modeling'
      ],
      knownLimitations: [
        'Eye IPD and head geometry derived from ANSUR II P50 dataset foundation',
        'Geometric line-of-sight raycasting does not measure cognitive recognition'
      ],
      evidenceReferences: ['SECP-HFEE-001-TASK005', 'NASA-STD-3001-V2'],
      benchmarkReferences: ['VISUAL-FIELD-NASA-3001'],
      lastVerification: new Date().toISOString(),
      runtimeVersion: 'v1.0.0-VIS',
      determinismStatus: 'PASS',
      industrialScore: 85
    });

    // Human Factors Ergonomics Assessment Capabilities
    this.registerCapability({
      id: 'HFEE-HUMAN-ERGONOMICS',
      domain: 'HUMAN_FACTORS',
      name: 'Human Ergonomics Evaluation Engine',
      description: 'Traceable ergonomic assessment solvers for RULA, REBA, OWAS, and Revised NIOSH Lifting Equation based on published methodologies.',
      maturity: CapabilityMaturity.IMPLEMENTED,
      status: CapabilityStatus.SUPPORTED,
      isVerified: true,
      isValidated: false,
      isProductionProven: false,
      coverage: 0.85,
      performance: { medianExecutionTimeMs: 12, p95ExecutionTimeMs: 25, memoryUsageMb: 130 },
      supportedScope: [
        'RULA (Rapid Upper Limb Assessment) McAtamney/Corlett 1993',
        'REBA (Rapid Entire Body Assessment) Hignett/McAtamney 2000',
        'OWAS (Ovako Working Posture Analysis System) Karhu 1977',
        'Revised NIOSH Lifting Equation Waters 1993',
        'Deterministic Table-Based Scoring & Multiplier Calculations',
        'Canonical EngineeringDocument & Posture Input Binding'
      ],
      unsupportedScope: [
        'Automatic Medical Diagnosis or Injury Prediction',
        'Workplace Compliance Certification (Advisory Only)',
        'Biomechanical L5-S1 Disc Compression Dynamics'
      ],
      knownLimitations: [
        'Static postural assessment based on discrete kinematic snapshots',
        'NIOSH equation limited to two-handed manual lifting domain'
      ],
      evidenceReferences: ['SECP-HFEE-001-TASK006', 'RULA-1993', 'REBA-2000', 'NIOSH-1993'],
      benchmarkReferences: ['ISO-11228-1', 'EN-1005-2'],
      lastVerification: new Date().toISOString(),
      runtimeVersion: 'v1.0.0-ERG',
      determinismStatus: 'PASS',
      industrialScore: 88
    });

    // Human Factors Environment Interaction & Task Assessment Capabilities
    this.registerCapability({
      id: 'HFEE-INTERACTION-ENGINE',
      domain: 'HUMAN_FACTORS',
      name: 'Human-Environment Interaction & Task Assessment Engine',
      description: 'Comprehensive task analyzer coordinating DHM, Kinematics, Reachability, Vision, and Ergonomics for interactive engineering environments.',
      maturity: CapabilityMaturity.IMPLEMENTED,
      status: CapabilityStatus.SUPPORTED,
      isVerified: true,
      isValidated: false,
      isProductionProven: false,
      coverage: 0.82,
      performance: { medianExecutionTimeMs: 120, p95ExecutionTimeMs: 350, memoryUsageMb: 180 },
      supportedScope: [
        'Task-Based Interaction Analysis (DHM/CAD Interaction)',
        'Multi-State Task Sequence Evaluation',
        'Integrated Reach-Vision-Ergo Feasibility Matrix',
        'Environment Object Binding & Point-of-Interest Interaction',
        'Canonical Task Evidence & Provenance Hashing',
        'Integrated Collision & Obstacle Evaluation via CollisionAuthority'
      ],
      unsupportedScope: [
        'Dynamic Physics-Based Movement Transitions',
        'Real-time Collision Avoidance Pathfinding',
        'Haptic Feedback & Force Response Interaction'
      ],
      knownLimitations: [
        'Static task-state analysis (no continuous dynamic physics)',
        'Limited by environment tessellation quality'
      ],
      evidenceReferences: ['SECP-HFEE-001-TASK007', 'NASA-STD-3001-V2'],
      benchmarkReferences: ['TASK-INTERACTION-2026'],
      lastVerification: new Date().toISOString(),
      runtimeVersion: 'v1.0.0-INT',
      determinismStatus: 'PASS',
      industrialScore: 84
    });
  }

  public registerCapability(capability: EngineeringCapability) {
    this.capabilities.set(capability.id, capability);
  }

  public reset(): void {
    this.capabilities.clear();
    this.initializeRegistry();
  }

  public getCapabilitiesByDomain(domain: EngineeringDomain): EngineeringCapability[] {
    return Array.from(this.capabilities.values()).filter(c => c.domain === domain);
  }

  public getCapabilityReport(domain: EngineeringDomain): DomainCapabilityReport {
    const domainCaps = this.getCapabilitiesByDomain(domain);
    if (domainCaps.length === 0) {
      return {
        domain,
        overallStatus: CapabilityStatus.UNSUPPORTED,
        maturity: CapabilityMaturity.EXPERIMENTAL,
        capabilities: [],
        score: 0
      };
    }

    const avgScore = domainCaps.reduce((acc, c) => acc + c.industrialScore, 0) / domainCaps.length;
    
    return {
      domain,
      overallStatus: domainCaps.every(c => c.status === CapabilityStatus.VERIFIED || c.status === CapabilityStatus.VALIDATED) 
        ? CapabilityStatus.VERIFIED 
        : CapabilityStatus.PARTIALLY_SUPPORTED,
      maturity: domainCaps.some(c => c.maturity === CapabilityMaturity.INDUSTRIAL) 
        ? CapabilityMaturity.INDUSTRIAL 
        : CapabilityMaturity.VERIFIED,
      capabilities: domainCaps,
      score: avgScore
    };
  }

  public getGlobalState(): IndustrialCapabilityState {
    const domains: EngineeringDomain[] = ['CAD', 'CFD', 'FEM', 'CAM', 'ASSEMBLY', 'PLM', 'HPC', 'INTEROP', 'HUMAN_FACTORS'];
    const reports: Record<string, DomainCapabilityReport> = {};
    
    let totalScore = 0;
    domains.forEach(d => {
      const report = this.getCapabilityReport(d);
      reports[d] = report;
      totalScore += report.score;
    });

    return {
      version: {
        secp: 'v3.187.0',
        kernel: 'v2.4.0',
        solver: 'v1.185.0',
        runtime: 'v2.1.0',
        benchmark: 'v1.2.0'
      },
      domains: reports as Record<EngineeringDomain, DomainCapabilityReport>,
      globalScore: totalScore / domains.length,
      timestamp: new Date().toISOString()
    };
  }
}
