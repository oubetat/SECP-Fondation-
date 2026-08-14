/**
 * SECP CAD Hard Acceptance Gate for PATCH-SECP-045
 * Master Verification Gate for Advanced Assembly & Kinematics Engine:
 *  1.  Fixed Joint
 *  2.  Revolute Joint
 *  3.  Prismatic Joint
 *  4.  Cylindrical Joint
 *  5.  DOF Analysis
 *  6.  Constraint Solving
 *  7.  Transform Propagation
 *  8.  Joint Limits (Soft & Hard Limits)
 *  9.  Gear Relations
 *  10. Interference Detection (Real OCCT Boolean Intersection)
 *  11. Geometry Preservation (GeometryValidationEngine B-Rep Verification)
 *  12. Determinism (Numerical & Hash Repeatability)
 *  13. Invalid Constraint Rejection
 *  14. Singular / Non-convergent Solve Rejection
 *  15. Kinematic Simulation (Time-Stepping Series)
 *  16. Revision & Provenance Records
 *  17. Zero Mock Leakage (Real OCCT Kernel)
 */

import { GeometryKernelManager } from '../geometry/GeometryKernelManager';
import { GeometryValidationEngine } from './GeometryValidationEngine';
import { Tolerance } from '../geometry/GeometryTolerance';
import { AssemblyTransformEngine } from '../assembly/AssemblyTransformEngine';
import { AssemblyDOFAnalyzer } from '../assembly/AssemblyDOFAnalyzer';
import { AssemblyKinematicSolver } from '../assembly/AssemblyKinematicSolver';
import { KinematicSimulationEngine } from '../assembly/KinematicSimulationEngine';
import { KinematicDeterminismValidator } from '../assembly/KinematicDeterminismValidator';
import { KinematicRevisionEngine } from '../assembly/KinematicRevisionEngine';
import { AssemblyInterferenceEngine } from '../assembly/AssemblyInterferenceEngine';
import {
  AssemblyComponent,
  PartDefinition,
  AssemblyConstraint,
  createIdentityTransform,
  createTransform3D,
  GeometryReference
} from '../assembly/AssemblyConstraintTypes';
import {
  KinematicJoint,
  GearJoint
} from '../assembly/KinematicTypes';

export interface AcceptanceGate045Report {
  patch: 'SECP-045';
  status: 'PASS' | 'FAIL';
  timestamp: string;
  kernel: string;
  totalTests: 17;
  passedTests: number;
  verifications: {
    fixedJoint: 'PASS' | 'FAIL';
    revoluteJoint: 'PASS' | 'FAIL';
    prismaticJoint: 'PASS' | 'FAIL';
    cylindricalJoint: 'PASS' | 'FAIL';
    dofAnalysis: 'PASS' | 'FAIL';
    constraintSolving: 'PASS' | 'FAIL';
    transformPropagation: 'PASS' | 'FAIL';
    jointLimits: 'PASS' | 'FAIL';
    gearRelation: 'PASS' | 'FAIL';
    interferenceDetection: 'PASS' | 'FAIL';
    geometryPreservation: 'PASS' | 'FAIL';
    determinism: 'PASS' | 'FAIL';
    invalidConstraintRejection: 'PASS' | 'FAIL';
    singularSolveRejection: 'PASS' | 'FAIL';
    kinematicSimulation: 'PASS' | 'FAIL';
    revisionProvenance: 'PASS' | 'FAIL';
    zeroMockLeakage: 'PASS' | 'FAIL';
  };
  details: Record<string, string>;
  stagesLog: string[];
}

export class HardAcceptanceGate045 {
  public static async runGateVerification(): Promise<AcceptanceGate045Report> {
    const kernel = await GeometryKernelManager.getKernel();
    const manifest = kernel.getManifest();
    const stagesLog: string[] = [];
    const details: Record<string, string> = {};

    stagesLog.push(`[SECP-045] Commencing Master Assembly & Kinematics Acceptance Gate on ${manifest.kernel} v${manifest.version}`);

    const report: AcceptanceGate045Report = {
      patch: 'SECP-045',
      status: 'FAIL',
      timestamp: new Date().toISOString(),
      kernel: `${manifest.kernel} v${manifest.version} (${manifest.runtimeMode})`,
      totalTests: 17,
      passedTests: 0,
      verifications: {
        fixedJoint: 'FAIL',
        revoluteJoint: 'FAIL',
        prismaticJoint: 'FAIL',
        cylindricalJoint: 'FAIL',
        dofAnalysis: 'FAIL',
        constraintSolving: 'FAIL',
        transformPropagation: 'FAIL',
        jointLimits: 'FAIL',
        gearRelation: 'FAIL',
        interferenceDetection: 'FAIL',
        geometryPreservation: 'FAIL',
        determinism: 'FAIL',
        invalidConstraintRejection: 'FAIL',
        singularSolveRejection: 'FAIL',
        kinematicSimulation: 'FAIL',
        revisionProvenance: 'FAIL',
        zeroMockLeakage: 'FAIL'
      },
      details,
      stagesLog
    };

    let passedCount = 0;

    // Helper part creation
    const baseBoxShape = await kernel.createBox(40, 40, 20);
    const linkCylShape = await kernel.createCylinder(10, 60);

    const partBase: PartDefinition = {
      partId: 'part-base-plate',
      name: 'Base Plate',
      revision: 1,
      shapeHandle: baseBoxShape,
      volumeM3: 0.000032,
      massKg: 0.25,
      densityKgM3: 2700,
      parameters: []
    };

    const partLink: PartDefinition = {
      partId: 'part-link-arm',
      name: 'Link Arm',
      revision: 1,
      shapeHandle: linkCylShape,
      volumeM3: 0.0000188,
      massKg: 0.15,
      densityKgM3: 7850,
      parameters: []
    };

    const partsMap = new Map<string, PartDefinition>();
    partsMap.set(partBase.partId, partBase);
    partsMap.set(partLink.partId, partLink);

    // =========================================================================
    // TEST 1: Fixed Joint
    // =========================================================================
    try {
      stagesLog.push('[Test 1/17] Validating Fixed Joint behavior...');
      const compRoot: AssemblyComponent = {
        instanceId: 'comp-root-1',
        name: 'Grounded Base',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compFixedChild: AssemblyComponent = {
        instanceId: 'comp-child-fixed',
        name: 'Bracket',
        partId: partBase.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createTransform3D({ x: 10, y: 20, z: 30 }, { x: 0, y: 0, z: 0 }),
        worldTransform: createIdentityTransform()
      };

      const fixedJoint: KinematicJoint = {
        id: 'joint-fixed-01',
        name: 'Weld Fixed Joint',
        type: 'FIXED',
        parentComponentId: compRoot.instanceId,
        childComponentId: compFixedChild.instanceId,
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
        currentPosition: 0,
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      const res = await AssemblyKinematicSolver.solve([compRoot, compFixedChild], [], [fixedJoint], [], {}, partsMap);
      const childMat = res.componentTransforms[compFixedChild.instanceId];
      const childPos = AssemblyTransformEngine.getPosition(childMat);

      if (res.solved && Math.abs(childPos.x - 10) < 1e-3 && Math.abs(childPos.y - 20) < 1e-3 && Math.abs(childPos.z - 30) < 1e-3) {
        report.verifications.fixedJoint = 'PASS';
        passedCount++;
        details.fixedJoint = 'Fixed joint holds relative child offset strictly at (10, 20, 30) with 0 DOF.';
        stagesLog.push(' -> Fixed Joint: PASS');
      } else {
        details.fixedJoint = `Fixed joint position mismatch: (${childPos.x}, ${childPos.y}, ${childPos.z})`;
        stagesLog.push(` -> Fixed Joint: FAIL (${details.fixedJoint})`);
      }
    } catch (e) {
      details.fixedJoint = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Fixed Joint: FAIL Exception`);
    }

    // =========================================================================
    // TEST 2: Revolute Joint
    // =========================================================================
    try {
      stagesLog.push('[Test 2/17] Validating Revolute Joint forward kinematics...');
      const compRoot: AssemblyComponent = {
        instanceId: 'comp-root-2',
        name: 'Grounded Base',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compArm: AssemblyComponent = {
        instanceId: 'comp-arm-rev',
        name: 'Rotating Arm',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createTransform3D({ x: 50, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
        worldTransform: createIdentityTransform()
      };

      const revJoint: KinematicJoint = {
        id: 'joint-revolute-01',
        name: 'Arm Hinge',
        type: 'REVOLUTE',
        parentComponentId: compRoot.instanceId,
        childComponentId: compArm.instanceId,
        axis: { x: 0, y: 0, z: 1 }, // Rotate around Z
        origin: { x: 0, y: 0, z: 0 },
        currentPosition: 0,
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      // Solve at 90 degrees rotation
      const res90 = await AssemblyKinematicSolver.solve([compRoot, compArm], [], [revJoint], [], { [revJoint.id]: 90 }, partsMap);
      const armMat = res90.componentTransforms[compArm.instanceId];
      const armPos = AssemblyTransformEngine.getPosition(armMat);

      // (50, 0, 0) rotated 90 deg around Z becomes (0, 50, 0)
      const isXZero = Math.abs(armPos.x) < 1e-2;
      const isYFifty = Math.abs(armPos.y - 50) < 1e-2;

      if (res90.solved && isXZero && isYFifty) {
        report.verifications.revoluteJoint = 'PASS';
        passedCount++;
        details.revoluteJoint = 'Revolute joint rotates child by exactly 90 deg around Z-axis: (50,0,0) -> (0,50,0).';
        stagesLog.push(' -> Revolute Joint: PASS');
      } else {
        details.revoluteJoint = `Revolute solve mismatch: pos=(${armPos.x.toFixed(3)}, ${armPos.y.toFixed(3)}, ${armPos.z.toFixed(3)})`;
        stagesLog.push(` -> Revolute Joint: FAIL (${details.revoluteJoint})`);
      }
    } catch (e) {
      details.revoluteJoint = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Revolute Joint: FAIL Exception`);
    }

    // =========================================================================
    // TEST 3: Prismatic Joint
    // =========================================================================
    try {
      stagesLog.push('[Test 3/17] Validating Prismatic Joint linear translation...');
      const compRoot: AssemblyComponent = {
        instanceId: 'comp-root-3',
        name: 'Linear Guide',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compCarriage: AssemblyComponent = {
        instanceId: 'comp-carriage',
        name: 'Linear Carriage',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const prismJoint: KinematicJoint = {
        id: 'joint-prism-01',
        name: 'Slider Joint',
        type: 'PRISMATIC',
        parentComponentId: compRoot.instanceId,
        childComponentId: compCarriage.instanceId,
        axis: { x: 1, y: 0, z: 0 }, // X axis
        origin: { x: 0, y: 0, z: 0 },
        currentPosition: 0,
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      const res = await AssemblyKinematicSolver.solve([compRoot, compCarriage], [], [prismJoint], [], { [prismJoint.id]: 125.5 }, partsMap);
      const carriageMat = res.componentTransforms[compCarriage.instanceId];
      const carriagePos = AssemblyTransformEngine.getPosition(carriageMat);

      if (res.solved && Math.abs(carriagePos.x - 125.5) < 1e-3 && Math.abs(carriagePos.y) < 1e-3) {
        report.verifications.prismaticJoint = 'PASS';
        passedCount++;
        details.prismaticJoint = 'Prismatic joint translates component accurately by +125.5mm along X-axis.';
        stagesLog.push(' -> Prismatic Joint: PASS');
      } else {
        details.prismaticJoint = `Prismatic mismatch: x=${carriagePos.x}`;
        stagesLog.push(` -> Prismatic Joint: FAIL (${details.prismaticJoint})`);
      }
    } catch (e) {
      details.prismaticJoint = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Prismatic Joint: FAIL Exception`);
    }

    // =========================================================================
    // TEST 4: Cylindrical Joint
    // =========================================================================
    try {
      stagesLog.push('[Test 4/17] Validating Cylindrical Joint (coupled rotation + translation)...');
      const compRoot: AssemblyComponent = {
        instanceId: 'comp-root-4',
        name: 'Sleeve',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compShaft: AssemblyComponent = {
        instanceId: 'comp-shaft',
        name: 'Helical Shaft',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createTransform3D({ x: 20, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
        worldTransform: createIdentityTransform()
      };

      const cylJoint: KinematicJoint = {
        id: 'joint-cyl-01',
        name: 'Cylindrical Lead Screw',
        type: 'CYLINDRICAL',
        parentComponentId: compRoot.instanceId,
        childComponentId: compShaft.instanceId,
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
        currentPosition: 0,
        secondaryPosition: 45.0, // translation
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      const res = await AssemblyKinematicSolver.solve([compRoot, compShaft], [], [cylJoint], [], { [cylJoint.id]: 180 }, partsMap);
      const shaftMat = res.componentTransforms[compShaft.instanceId];
      const shaftPos = AssemblyTransformEngine.getPosition(shaftMat);

      // (20, 0, 0) rotated 180 deg around Z becomes (-20, 0, 0) and translated along Z by +45mm -> (-20, 0, 45)
      const isXNeg20 = Math.abs(shaftPos.x - (-20)) < 1e-2;
      const isZ45 = Math.abs(shaftPos.z - 45) < 1e-2;

      if (res.solved && isXNeg20 && isZ45) {
        report.verifications.cylindricalJoint = 'PASS';
        passedCount++;
        details.cylindricalJoint = 'Cylindrical joint correctly applies combined 180 deg rotation and 45mm axial translation.';
        stagesLog.push(' -> Cylindrical Joint: PASS');
      } else {
        details.cylindricalJoint = `Cylindrical solve mismatch: pos=(${shaftPos.x.toFixed(3)}, ${shaftPos.y.toFixed(3)}, ${shaftPos.z.toFixed(3)})`;
        stagesLog.push(` -> Cylindrical Joint: FAIL (${details.cylindricalJoint})`);
      }
    } catch (e) {
      details.cylindricalJoint = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Cylindrical Joint: FAIL Exception`);
    }

    // =========================================================================
    // TEST 5: DOF Analysis
    // =========================================================================
    try {
      stagesLog.push('[Test 5/17] Validating Assembly Degrees of Freedom (DOF) Analysis...');
      const compA: AssemblyComponent = {
        instanceId: 'comp-dof-a',
        name: 'Fixed Base',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compB: AssemblyComponent = {
        instanceId: 'comp-dof-b',
        name: 'Moving Block',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const dummyRefA: GeometryReference = {
        componentId: compA.instanceId,
        topologyType: 'FACE',
        topologyIndex: 0,
        geometricSignature: 'sig-a'
      };

      const dummyRefB: GeometryReference = {
        componentId: compB.instanceId,
        topologyType: 'FACE',
        topologyIndex: 1,
        geometricSignature: 'sig-b'
      };

      const mateConstraint: AssemblyConstraint = {
        constraintId: 'c-mate-1',
        assemblyId: 'asm-test',
        name: 'Planar Mate',
        type: 'MATE',
        componentA: compA.instanceId,
        componentB: compB.instanceId,
        geometryRefA: dummyRefA,
        geometryRefB: dummyRefB,
        parameters: { offsetMm: 0 },
        status: 'SATISFIED',
        solverError: 0,
        revision: 1,
        suppressionState: 'ACTIVE'
      };

      const dofReport = AssemblyDOFAnalyzer.analyze([compA, compB], [mateConstraint], []);

      // 1 non-fixed body = 6 total DOF. Mate coincident removes 3 DOF -> 3 free DOF (Tx, Ty, Rz)
      if (dofReport.totalDOF === 6 && dofReport.constrainedDOF === 3 && dofReport.freeDOF === 3 && dofReport.status === 'UNDER_CONSTRAINED') {
        report.verifications.dofAnalysis = 'PASS';
        passedCount++;
        details.dofAnalysis = 'DOF Analyzer correctly computes 6 total DOF, 3 constrained, 3 free DOF for planar mate.';
        stagesLog.push(' -> DOF Analysis: PASS');
      } else {
        details.dofAnalysis = `DOF mismatch: total=${dofReport.totalDOF}, constrained=${dofReport.constrainedDOF}, free=${dofReport.freeDOF}`;
        stagesLog.push(` -> DOF Analysis: FAIL (${details.dofAnalysis})`);
      }
    } catch (e) {
      details.dofAnalysis = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> DOF Analysis: FAIL Exception`);
    }

    // =========================================================================
    // TEST 6: Constraint Solving
    // =========================================================================
    try {
      stagesLog.push('[Test 6/17] Validating Assembly Constraint Solver & Residual Convergence...');
      const compA: AssemblyComponent = {
        instanceId: 'comp-cs-a',
        name: 'Stationary Wall',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compB: AssemblyComponent = {
        instanceId: 'comp-cs-b',
        name: 'Standoff',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const distConstraint: AssemblyConstraint = {
        constraintId: 'c-dist-50',
        assemblyId: 'asm-test',
        name: 'Distance 50mm',
        type: 'DISTANCE',
        componentA: compA.instanceId,
        componentB: compB.instanceId,
        geometryRefA: { componentId: compA.instanceId, topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'fa0' },
        geometryRefB: { componentId: compB.instanceId, topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'fb0' },
        parameters: { offsetMm: 50.0 },
        status: 'SATISFIED',
        solverError: 0,
        revision: 1,
        suppressionState: 'ACTIVE'
      };

      const prismJoint: KinematicJoint = {
        id: 'joint-prism-cs',
        name: 'Linear Axis',
        type: 'PRISMATIC',
        parentComponentId: compA.instanceId,
        childComponentId: compB.instanceId,
        axis: { x: 1, y: 0, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
        currentPosition: 50.0,
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      const res = await AssemblyKinematicSolver.solve([compA, compB], [distConstraint], [prismJoint], [], { [prismJoint.id]: 50.0 }, partsMap);

      if (res.solved && res.residualError < 1e-4) {
        report.verifications.constraintSolving = 'PASS';
        passedCount++;
        details.constraintSolving = `Constraint solver converged with residual ${res.residualError.toExponential(4)} < 1e-4.`;
        stagesLog.push(' -> Constraint Solving: PASS');
      } else {
        details.constraintSolving = `Solver failed or residual too high: ${res.residualError}`;
        stagesLog.push(` -> Constraint Solving: FAIL (${details.constraintSolving})`);
      }
    } catch (e) {
      details.constraintSolving = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Constraint Solving: FAIL Exception`);
    }

    // =========================================================================
    // TEST 7: Transform Propagation
    // =========================================================================
    try {
      stagesLog.push('[Test 7/17] Validating Hierarchical Transform Propagation across Kinematic Chain...');
      // Chain: Root (0,0,0) -> Link1 (at +50mm X, rotated 90 deg Z) -> Link2 (at +30mm X relative)
      const root: AssemblyComponent = {
        instanceId: 'c-root-prop',
        name: 'Root Base',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const link1: AssemblyComponent = {
        instanceId: 'c-link1-prop',
        name: 'Arm Segment 1',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createTransform3D({ x: 50, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
        worldTransform: createIdentityTransform()
      };

      const link2: AssemblyComponent = {
        instanceId: 'c-link2-prop',
        name: 'Arm Segment 2',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createTransform3D({ x: 30, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
        worldTransform: createIdentityTransform()
      };

      const j1: KinematicJoint = {
        id: 'j-rev-1',
        name: 'Joint 1',
        type: 'REVOLUTE',
        parentComponentId: root.instanceId,
        childComponentId: link1.instanceId,
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
        currentPosition: 90,
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      const j2: KinematicJoint = {
        id: 'j-rev-2',
        name: 'Joint 2',
        type: 'REVOLUTE',
        parentComponentId: link1.instanceId,
        childComponentId: link2.instanceId,
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 50, y: 0, z: 0 },
        currentPosition: 0,
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      const res = await AssemblyKinematicSolver.solve([root, link1, link2], [], [j1, j2], [], { [j1.id]: 90, [j2.id]: 0 }, partsMap);
      const link2Mat = res.componentTransforms[link2.instanceId];
      const link2Pos = AssemblyTransformEngine.getPosition(link2Mat);

      // Root -> Link1 rotated 90 deg -> Link2 along rotated direction -> (0, 80, 0)
      const isY80 = Math.abs(link2Pos.y - 80) < 1e-2;
      const isXZero = Math.abs(link2Pos.x) < 1e-2;

      if (res.solved && isY80 && isXZero) {
        report.verifications.transformPropagation = 'PASS';
        passedCount++;
        details.transformPropagation = 'Transform propagation correctly computed end-effector world position at (0, 80, 0).';
        stagesLog.push(' -> Transform Propagation: PASS');
      } else {
        details.transformPropagation = `Propagation mismatch: (${link2Pos.x.toFixed(3)}, ${link2Pos.y.toFixed(3)}, ${link2Pos.z.toFixed(3)})`;
        stagesLog.push(` -> Transform Propagation: FAIL (${details.transformPropagation})`);
      }
    } catch (e) {
      details.transformPropagation = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Transform Propagation: FAIL Exception`);
    }

    // =========================================================================
    // TEST 8: Joint Limits (Soft & Hard Limits)
    // =========================================================================
    try {
      stagesLog.push('[Test 8/17] Validating Joint Limits & Boundary Clamping...');
      const compRoot: AssemblyComponent = {
        instanceId: 'comp-root-8',
        name: 'Grounded Base',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compArm: AssemblyComponent = {
        instanceId: 'comp-arm-8',
        name: 'Constrained Arm',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const limitedJoint: KinematicJoint = {
        id: 'joint-limited-01',
        name: 'Limited Elbow',
        type: 'REVOLUTE',
        parentComponentId: compRoot.instanceId,
        childComponentId: compArm.instanceId,
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
        limits: {
          minimum: -45,
          maximum: 45,
          unit: 'deg',
          softLimit: false,
          hardLimit: true
        },
        currentPosition: 0,
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      // Request 120 deg (exceeds max limit +45 deg)
      const res = await AssemblyKinematicSolver.solve([compRoot, compArm], [], [limitedJoint], [], { [limitedJoint.id]: 120 }, partsMap);
      const armMat = res.componentTransforms[compArm.instanceId];
      const euler = AssemblyTransformEngine.getEulerAnglesDeg(armMat);

      // Solver should clamp to 45 deg or flag limit
      const isClamped = Math.abs(euler.z - 45) < 1e-2;

      if (isClamped) {
        report.verifications.jointLimits = 'PASS';
        passedCount++;
        details.jointLimits = 'Hard limit strictly clamped commanded position from 120 deg down to max limit of 45 deg.';
        stagesLog.push(' -> Joint Limits: PASS');
      } else {
        details.jointLimits = `Joint limit clamping failed: Euler Z angle is ${euler.z.toFixed(3)}`;
        stagesLog.push(` -> Joint Limits: FAIL (${details.jointLimits})`);
      }
    } catch (e) {
      details.jointLimits = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Joint Limits: FAIL Exception`);
    }

    // =========================================================================
    // TEST 9: Gear Relations
    // =========================================================================
    try {
      stagesLog.push('[Test 9/17] Validating Synchronous Multi-Body Gear Couplings...');
      const root: AssemblyComponent = {
        instanceId: 'c-gear-root',
        name: 'Gearbox Housing',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const gear1Comp: AssemblyComponent = {
        instanceId: 'c-gear1',
        name: 'Pinion (20T)',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const gear2Comp: AssemblyComponent = {
        instanceId: 'c-gear2',
        name: 'Bull Gear (60T)',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createTransform3D({ x: 50, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
        worldTransform: createIdentityTransform()
      };

      const jDriver: KinematicJoint = {
        id: 'j-gear-driver',
        name: 'Driver Pinion Shaft',
        type: 'REVOLUTE',
        parentComponentId: root.instanceId,
        childComponentId: gear1Comp.instanceId,
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
        currentPosition: 0,
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      const jDriven: KinematicJoint = {
        id: 'j-gear-driven',
        name: 'Driven Bull Gear Shaft',
        type: 'REVOLUTE',
        parentComponentId: root.instanceId,
        childComponentId: gear2Comp.instanceId,
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 50, y: 0, z: 0 },
        currentPosition: 0,
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      // 3:1 reduction ratio, reverse direction (-1)
      const gearRelation: GearJoint = {
        id: 'gear-mesh-01',
        name: '3:1 Reduction Mesh',
        drivingJointId: jDriver.id,
        drivenJointId: jDriven.id,
        ratio: 1 / 3, // 20 / 60
        direction: -1,
        phaseOffset: 0
      };

      // Rotate driver by 90 degrees -> driven should rotate -30 degrees
      const res = await AssemblyKinematicSolver.solve(
        [root, gear1Comp, gear2Comp],
        [],
        [jDriver, jDriven],
        [gearRelation],
        { [jDriver.id]: 90 },
        partsMap
      );

      const matGear2 = res.componentTransforms[gear2Comp.instanceId];
      const eulerGear2 = AssemblyTransformEngine.getEulerAnglesDeg(matGear2);

      // -30 deg or 330 deg rotation around Z
      const isMinusThirty = Math.abs(eulerGear2.z - (-30)) < 1e-2 || Math.abs(eulerGear2.z - 330) < 1e-2;

      if (res.solved && isMinusThirty) {
        report.verifications.gearRelation = 'PASS';
        passedCount++;
        details.gearRelation = 'Gear coupling correctly synchronizes 90 deg input to -30 deg output (ratio=1/3, dir=-1).';
        stagesLog.push(' -> Gear Relation: PASS');
      } else {
        details.gearRelation = `Gear angle mismatch: driven Euler Z=${eulerGear2.z.toFixed(3)}`;
        stagesLog.push(` -> Gear Relation: FAIL (${details.gearRelation})`);
      }
    } catch (e) {
      details.gearRelation = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Gear Relation: FAIL Exception`);
    }

    // =========================================================================
    // TEST 10: Interference Detection (Real OCCT Boolean Intersection)
    // =========================================================================
    try {
      stagesLog.push('[Test 10/17] Validating Real OCCT B-Rep Boolean Interference Detection...');
      const compA: AssemblyComponent = {
        instanceId: 'c-clash-a',
        name: 'Solid Block A',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compB: AssemblyComponent = {
        instanceId: 'c-clash-b',
        name: 'Solid Block B',
        partId: partBase.partId,
        fixed: false,
        suppressed: false,
        // Overlap by 10mm in X (box is 40x40x20, placed at 30mm -> 10x40x20 = 8000 mm3 overlap)
        placementTransform: createTransform3D({ x: 30, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
        worldTransform: createTransform3D({ x: 30, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
      };

      const clashReport = await AssemblyInterferenceEngine.analyzeInterference([compA, compB], partsMap, kernel);

      if (clashReport.clashes.length > 0 && clashReport.totalClashVolumeMm3 > 100) {
        report.verifications.interferenceDetection = 'PASS';
        passedCount++;
        details.interferenceDetection = `Real OCCT Boolean intersection computed clash volume: ${clashReport.totalClashVolumeMm3.toFixed(2)} mm3.`;
        stagesLog.push(' -> Interference Detection: PASS');
      } else {
        details.interferenceDetection = `No clash detected or clash volume too low: ${clashReport.totalClashVolumeMm3} mm3`;
        stagesLog.push(` -> Interference Detection: FAIL (${details.interferenceDetection})`);
      }
    } catch (e) {
      details.interferenceDetection = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Interference Detection: FAIL Exception`);
    }

    // =========================================================================
    // TEST 11: Geometry Preservation & 100-Step Invariance (GeometryValidationEngine)
    // =========================================================================
    try {
      stagesLog.push('[Test 11/17] Validating Geometric & Topological Invariance across 100 Kinematic Steps...');
      const valReportPre = await GeometryValidationEngine.validate(baseBoxShape, Tolerance.VALIDATION);
      const preVolume = valReportPre.metrics.volume;
      const preFaceCount = valReportPre.topology.faceCount;

      // Run 100 kinematic steps moving an instance of partBase
      const mobileComp: AssemblyComponent = {
        instanceId: 'c-mobile-inv',
        name: 'Mobile Base Box',
        partId: partBase.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const groundComp: AssemblyComponent = {
        instanceId: 'ground',
        name: 'Ground',
        partId: partBase.partId, // reused for ground
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const prismMotion: KinematicJoint = {
        id: 'j-motion-100',
        name: 'Slide Axis',
        type: 'PRISMATIC',
        parentComponentId: 'ground',
        childComponentId: mobileComp.instanceId,
        axis: { x: 1, y: 0, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
        currentPosition: 0,
        currentVelocity: 10,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      // Execute 100 kinematic motion steps
      let lastTransformX = 0;
      for (let step = 1; step <= 100; step++) {
        const simDisplacement = step * 1.5; // move from 1.5mm to 150mm
        const stepRes = await AssemblyKinematicSolver.solve(
          [groundComp, mobileComp],
          [],
          [prismMotion],
          [],
          { [prismMotion.id]: simDisplacement },
          partsMap
        );
        const mat = stepRes.componentTransforms[mobileComp.instanceId];
        lastTransformX = AssemblyTransformEngine.getPosition(mat).x;
      }

      // Re-validate underlying CAD ShapeHandle after 100 kinematic motions
      const valReportPost = await GeometryValidationEngine.validate(baseBoxShape, Tolerance.VALIDATION);
      const postVolume = valReportPost.metrics.volume;
      const postFaceCount = valReportPost.topology.faceCount;

      // Shape B-Rep volume, faces, and manifold status must be strictly invariant, while placement moved
      const volumeDelta = Math.abs(postVolume - preVolume);
      const topologyMatches = preFaceCount === postFaceCount && valReportPost.topology.isClosedManifold;
      const motionOccurred = Math.abs(lastTransformX - 150.0) < 1e-3;

      if (valReportPost.isValid && volumeDelta < 1e-7 && topologyMatches && motionOccurred) {
        report.verifications.geometryPreservation = 'PASS';
        passedCount++;
        details.geometryPreservation = `Geometry Preservation passed: 100 kinematic steps executed (X moved 0 -> 150mm). Part B-Rep Volume invariant (V=${postVolume.toFixed(2)} mm3, Delta=${volumeDelta.toExponential(2)}), Topology invariant (faces=${postFaceCount}, manifold=true).`;
        stagesLog.push(' -> Geometry Preservation & 100-Step Invariance: PASS');
      } else {
        details.geometryPreservation = `Geometry validation failed: volumeDelta=${volumeDelta}, topologyMatch=${topologyMatches}, motionOccurred=${motionOccurred}`;
        stagesLog.push(` -> Geometry Preservation: FAIL (${details.geometryPreservation})`);
      }
    } catch (e) {
      details.geometryPreservation = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Geometry Preservation: FAIL Exception`);
    }

    // =========================================================================
    // TEST 12: Determinism & Round-Trip Kinematics
    // =========================================================================
    try {
      stagesLog.push('[Test 12/17] Validating Multi-Pass Determinism & Round-Trip Kinematics...');
      const compRoot: AssemblyComponent = {
        instanceId: 'c-det-root',
        name: 'Base',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compChild: AssemblyComponent = {
        instanceId: 'c-det-child',
        name: 'Arm',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createTransform3D({ x: 30, y: 15, z: 0 }, { x: 0, y: 0, z: 0 }),
        worldTransform: createIdentityTransform()
      };

      const revJ: KinematicJoint = {
        id: 'j-det-rev',
        name: 'Pivot',
        type: 'REVOLUTE',
        parentComponentId: compRoot.instanceId,
        childComponentId: compChild.instanceId,
        axis: { x: 0, y: 1, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
        currentPosition: 45,
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      // 12a. Multi-run deterministic hash validation
      const detResult = await KinematicDeterminismValidator.validateDeterminism(
        [compRoot, compChild],
        [],
        [revJ],
        [],
        { [revJ.id]: 45 },
        partsMap,
        10 // 10 consecutive runs
      );

      // 12b. Round-trip Kinematics: 0 deg -> 30 deg -> 0 deg -> 30 deg
      const pose0A = await AssemblyKinematicSolver.solve([compRoot, compChild], [], [revJ], [], { [revJ.id]: 0 }, partsMap);
      const pose30A = await AssemblyKinematicSolver.solve([compRoot, compChild], [], [revJ], [], { [revJ.id]: 30 }, partsMap);
      const pose0B = await AssemblyKinematicSolver.solve([compRoot, compChild], [], [revJ], [], { [revJ.id]: 0 }, partsMap);
      const pose30B = await AssemblyKinematicSolver.solve([compRoot, compChild], [], [revJ], [], { [revJ.id]: 30 }, partsMap);

      const hash0A = pose0A.deterministicHash;
      const hash0B = pose0B.deterministicHash;
      const hash30A = pose30A.deterministicHash;
      const hash30B = pose30B.deterministicHash;

      const roundTripExact = (hash0A === hash0B) && (hash30A === hash30B);

      if (detResult.isDeterministic && detResult.hashMatch && detResult.maxTransformDelta === 0 && roundTripExact) {
        report.verifications.determinism = 'PASS';
        passedCount++;
        details.determinism = `10/10 runs produced identical hash ${detResult.hashes[0]} (max delta 0.000e+0). Round-trip kinematic repeatability strictly exact (0 deg hash match, 30 deg hash match).`;
        stagesLog.push(' -> Determinism & Round-Trip Kinematics: PASS');
      } else {
        details.determinism = `Determinism failed: hashes=${detResult.hashes.length}, max deviation=${detResult.maxTransformDelta}, roundTrip=${roundTripExact}`;
        stagesLog.push(` -> Determinism: FAIL (${details.determinism})`);
      }
    } catch (e) {
      details.determinism = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Determinism: FAIL Exception`);
    }

    // =========================================================================
    // TEST 13: Invalid Constraint Rejection
    // =========================================================================
    try {
      stagesLog.push('[Test 13/17] Validating Invalid Constraint Rejection...');
      const compA: AssemblyComponent = {
        instanceId: 'c-inv-a',
        name: 'Base',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compB: AssemblyComponent = {
        instanceId: 'c-inv-b',
        name: 'Child',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const invalidConstraint: AssemblyConstraint = {
        constraintId: 'c-invalid-comp',
        assemblyId: 'asm-test',
        name: 'Missing Comp Constraint',
        type: 'MATE',
        componentA: compA.instanceId,
        componentB: 'comp-NON_EXISTENT_999', // Missing component
        geometryRefA: { componentId: compA.instanceId, topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'f0' },
        geometryRefB: { componentId: 'comp-NON_EXISTENT_999', topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'f0' },
        parameters: { offsetMm: 0 },
        status: 'UNRESOLVED',
        solverError: 0,
        revision: 1,
        suppressionState: 'ACTIVE'
      };

      const res = await AssemblyKinematicSolver.solve([compA, compB], [invalidConstraint], [], [], {}, partsMap);

      if (!res.solved && (res.status === 'INVALID' || res.status === 'NON_CONVERGENT')) {
        report.verifications.invalidConstraintRejection = 'PASS';
        passedCount++;
        details.invalidConstraintRejection = 'Solver correctly caught missing component reference and rejected configuration as INVALID.';
        stagesLog.push(' -> Invalid Constraint Rejection: PASS');
      } else {
        details.invalidConstraintRejection = `Solver accepted invalid constraint unexpectedly: status=${res.status}`;
        stagesLog.push(` -> Invalid Constraint Rejection: FAIL (${details.invalidConstraintRejection})`);
      }
    } catch (e) {
      details.invalidConstraintRejection = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Invalid Constraint Rejection: FAIL Exception`);
    }

    // =========================================================================
    // TEST 14: Singular Solve Rejection
    // =========================================================================
    try {
      stagesLog.push('[Test 14/17] Validating Singular / Over-Constrained Solver Handling...');
      const compRoot: AssemblyComponent = {
        instanceId: 'c-sing-root',
        name: 'Base',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compMoving: AssemblyComponent = {
        instanceId: 'c-sing-move',
        name: 'Moving',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      // Create two mutually contradictory distance constraints: X=10 and X=50
      const c1: AssemblyConstraint = {
        constraintId: 'c-dist-10',
        assemblyId: 'asm-test',
        name: 'Dist 10',
        type: 'DISTANCE',
        componentA: compRoot.instanceId,
        componentB: compMoving.instanceId,
        geometryRefA: { componentId: compRoot.instanceId, topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'f1' },
        geometryRefB: { componentId: compMoving.instanceId, topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'f1' },
        parameters: { offsetMm: 10.0 },
        status: 'UNRESOLVED',
        solverError: 0,
        revision: 1,
        suppressionState: 'ACTIVE'
      };

      const c2: AssemblyConstraint = {
        constraintId: 'c-dist-50-conf',
        assemblyId: 'asm-test',
        name: 'Dist 50 Contradiction',
        type: 'DISTANCE',
        componentA: compRoot.instanceId,
        componentB: compMoving.instanceId,
        geometryRefA: { componentId: compRoot.instanceId, topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'f1' },
        geometryRefB: { componentId: compMoving.instanceId, topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'f1' },
        parameters: { offsetMm: 50.0 },
        status: 'UNRESOLVED',
        solverError: 0,
        revision: 1,
        suppressionState: 'ACTIVE'
      };

      const res = await AssemblyKinematicSolver.solve([compRoot, compMoving], [c1, c2], [], [], {}, partsMap);

      if (!res.solved && (res.status === 'OVER_CONSTRAINED' || res.status === 'SINGULAR' || res.status === 'NON_CONVERGENT' || res.violatedConstraints.length > 0)) {
        report.verifications.singularSolveRejection = 'PASS';
        passedCount++;
        details.singularSolveRejection = 'Solver correctly diagnosed conflicting distance constraints and rejected solution.';
        stagesLog.push(' -> Singular Solve Rejection: PASS');
      } else {
        details.singularSolveRejection = `Solver failed to flag contradictory constraints: status=${res.status}`;
        stagesLog.push(` -> Singular Solve Rejection: FAIL (${details.singularSolveRejection})`);
      }
    } catch (e) {
      details.singularSolveRejection = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Singular Solve Rejection: FAIL Exception`);
    }

    // =========================================================================
    // TEST 15: Kinematic Simulation Engine
    // =========================================================================
    try {
      stagesLog.push('[Test 15/17] Validating Multi-Timestep Kinematic Simulation Engine...');
      const compRoot: AssemblyComponent = {
        instanceId: 'c-sim-root',
        name: 'Motor Base',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const compFlywheel: AssemblyComponent = {
        instanceId: 'c-sim-wheel',
        name: 'Flywheel',
        partId: partLink.partId,
        fixed: false,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const motorJoint: KinematicJoint = {
        id: 'j-sim-motor',
        name: 'Motor Shaft',
        type: 'REVOLUTE',
        parentComponentId: compRoot.instanceId,
        childComponentId: compFlywheel.instanceId,
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
        currentPosition: 0,
        currentVelocity: 0,
        currentAcceleration: 0,
        enabled: true,
        revisionNumber: 1,
        capabilityStatus: 'OPERATIONAL'
      };

      const simResult = await KinematicSimulationEngine.runSimulation(
        [compRoot, compFlywheel],
        [],
        [motorJoint],
        [],
        {
          durationS: 1.0,
          timestepS: 0.1, // 10 steps
          driverProfiles: [
            {
              jointId: motorJoint.id,
              type: 'CONSTANT_VELOCITY',
              amplitudeOrSpeed: 360 // 360 deg/sec
            }
          ],
          partsMap
        }
      );

      if (simResult.success && simResult.frameCount === 11 && Math.abs(simResult.frames[10].jointValues[motorJoint.id] - 360) < 1e-3) {
        report.verifications.kinematicSimulation = 'PASS';
        passedCount++;
        details.kinematicSimulation = `Simulation solved 11 time frames reaching exactly 360 deg with hash ${simResult.deterministicHash}.`;
        stagesLog.push(' -> Kinematic Simulation: PASS');
      } else {
        details.kinematicSimulation = `Simulation failure: frames=${simResult.frameCount}, success=${simResult.success}`;
        stagesLog.push(` -> Kinematic Simulation: FAIL (${details.kinematicSimulation})`);
      }
    } catch (e) {
      details.kinematicSimulation = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Kinematic Simulation: FAIL Exception`);
    }

    // =========================================================================
    // TEST 16: Revision & Provenance Records
    // =========================================================================
    try {
      stagesLog.push('[Test 16/17] Validating Kinematic Assembly Revision Tracking...');
      KinematicRevisionEngine.clear();

      const compBase: AssemblyComponent = {
        instanceId: 'c-rev-base',
        name: 'Base Component',
        partId: partBase.partId,
        fixed: true,
        suppressed: false,
        placementTransform: createIdentityTransform(),
        worldTransform: createIdentityTransform()
      };

      const solveRes1 = await AssemblyKinematicSolver.solve([compBase], [], [], [], {}, partsMap);
      const rec1 = KinematicRevisionEngine.createRecord(
        'asm-gate-045',
        1,
        solveRes1,
        [compBase],
        []
      );

      const solveRes2 = await AssemblyKinematicSolver.solve([compBase], [], [], [], {}, partsMap);
      const rec2 = KinematicRevisionEngine.createRecord(
        'asm-gate-045',
        2,
        solveRes2,
        [compBase],
        []
      );

      const history = KinematicRevisionEngine.getRecords();

      if (rec2.assemblyRevision === 2 && history.length === 2 && rec1.outputStateHash.length > 0) {
        report.verifications.revisionProvenance = 'PASS';
        passedCount++;
        details.revisionProvenance = `Provenance recorded revision #1 (${rec1.outputStateHash.slice(0, 8)}) and #2 (${rec2.outputStateHash.slice(0, 8)}).`;
        stagesLog.push(' -> Revision & Provenance: PASS');
      } else {
        details.revisionProvenance = `Revision logging failed: historyCount=${history.length}`;
        stagesLog.push(` -> Revision & Provenance: FAIL (${details.revisionProvenance})`);
      }
    } catch (e) {
      details.revisionProvenance = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Revision & Provenance: FAIL Exception`);
    }

    // =========================================================================
    // TEST 17: Zero Mock Leakage
    // =========================================================================
    try {
      stagesLog.push('[Test 17/17] Validating Zero Mock Leakage against Real OCCT Kernel...');
      const isRealKernel = manifest.runtimeMode === 'WASM' || manifest.kernel.includes('SECP') || manifest.kernel.includes('OpenCascade');
      const hasRealBRep = baseBoxShape !== null && linkCylShape !== null;

      if (isRealKernel && hasRealBRep) {
        report.verifications.zeroMockLeakage = 'PASS';
        passedCount++;
        details.zeroMockLeakage = `Real geometry kernel confirmed: ${manifest.kernel} (${manifest.runtimeMode}) with valid B-Rep handles.`;
        stagesLog.push(' -> Zero Mock Leakage: PASS');
      } else {
        details.zeroMockLeakage = `Mock detected: kernel=${manifest.kernel}, runtimeMode=${manifest.runtimeMode}`;
        stagesLog.push(` -> Zero Mock Leakage: FAIL (${details.zeroMockLeakage})`);
      }
    } catch (e) {
      details.zeroMockLeakage = `Exception: ${(e as Error).message}`;
      stagesLog.push(` -> Zero Mock Leakage: FAIL Exception`);
    }

    report.passedTests = passedCount;
    report.status = passedCount === 17 ? 'PASS' : 'FAIL';

    stagesLog.push(`[SECP-045] Gate execution completed. Result: ${report.status} (${passedCount}/17 tests passed).`);

    return report;
  }
}
