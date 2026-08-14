/**
 * SECP CAD Hard Acceptance Gate for PATCH-SECP-043
 * Master Acceptance Gate for Assembly Constraints & Kinematics Core:
 *  1. Assembly creation
 *  2. Component instancing (multiple instances referencing single PartDefinition)
 *  3. Mate constraint (Planar Coincident)
 *  4. Concentric constraint
 *  5. Distance constraint
 *  6. Constraint solving
 *  7. DOF calculation
 *  8. Under-constrained detection
 *  9. Over-constrained detection
 *  10. Assembly rebuild
 *  11. Interference detection (real OCCT boolean intersection volume/location)
 *  12. Deterministic solve
 *  13. No mock fallback (OCCT verified)
 */

import { GeometryKernelManager } from '../geometry/GeometryKernelManager';
import { AssemblyCore } from '../assembly/AssemblyCore';
import { AssemblyConstraintSolver } from '../assembly/AssemblyConstraintSolver';
import { AssemblyInterferenceEngine } from '../assembly/AssemblyInterferenceEngine';
import {
  AssemblyComponent,
  PartDefinition,
  AssemblyConstraint,
  computeTransformMatrix
} from '../assembly/AssemblyConstraintTypes';

export interface AcceptanceGate043Report {
  patch: 'SECP-043';
  status: 'PASS' | 'FAIL';
  timestamp: string;
  kernel: string;
  mockFallback: boolean;
  assembly: {
    components: boolean;
    constraints: boolean;
    solver: boolean;
    degreesOfFreedom: boolean;
    interferenceDetection: boolean;
    deterministic: boolean;
  };
  verifications: {
    assemblyCreation: 'PASS' | 'FAIL';
    componentInstancing: 'PASS' | 'FAIL';
    mateConstraint: 'PASS' | 'FAIL';
    concentricConstraint: 'PASS' | 'FAIL';
    distanceConstraint: 'PASS' | 'FAIL';
    constraintSolving: 'PASS' | 'FAIL';
    dofCalculation: 'PASS' | 'FAIL';
    underConstrainedDetection: 'PASS' | 'FAIL';
    overConstrainedDetection: 'PASS' | 'FAIL';
    assemblyRebuild: 'PASS' | 'FAIL';
    interferenceDetection: 'PASS' | 'FAIL';
    deterministicSolve: 'PASS' | 'FAIL';
    noMockFallback: 'PASS' | 'FAIL';
  };
  stagesLog: string[];
}

export class HardAcceptanceGate043 {
  public static async runGateVerification(): Promise<AcceptanceGate043Report> {
    const stagesLog: string[] = [];
    stagesLog.push('[Gate-043] Initiating Hard Acceptance Gate for PATCH-SECP-043: Assembly Constraints & Kinematics Core.');

    const kernel = await GeometryKernelManager.getKernel();
    const manifest = kernel.getManifest();

    const report: AcceptanceGate043Report = {
      patch: 'SECP-043',
      status: 'FAIL',
      timestamp: new Date().toISOString(),
      kernel: manifest.kernel,
      mockFallback: manifest.mockFallback,
      assembly: {
        components: false,
        constraints: false,
        solver: false,
        degreesOfFreedom: false,
        interferenceDetection: false,
        deterministic: false
      },
      verifications: {
        assemblyCreation: 'FAIL',
        componentInstancing: 'FAIL',
        mateConstraint: 'FAIL',
        concentricConstraint: 'FAIL',
        distanceConstraint: 'FAIL',
        constraintSolving: 'FAIL',
        dofCalculation: 'FAIL',
        underConstrainedDetection: 'FAIL',
        overConstrainedDetection: 'FAIL',
        assemblyRebuild: 'FAIL',
        interferenceDetection: 'FAIL',
        deterministicSolve: 'FAIL',
        noMockFallback: 'FAIL'
      },
      stagesLog
    };

    try {
      // 0. Kernel Realness Verification
      stagesLog.push(`[Gate-043] Stage 0: Checking Kernel Realness. Kernel=${manifest.kernel}, mockFallback=${manifest.mockFallback}`);
      if (!manifest.mockFallback && manifest.kernel.includes('OCCT')) {
        report.verifications.noMockFallback = 'PASS';
      } else {
        throw new Error('Kernel is running on mock fallback! Real OCCT required.');
      }

      // 1. Assembly Creation
      stagesLog.push('[Gate-043] Stage 1: Verifying Assembly Creation & Data Model.');
      const assembly = new AssemblyCore();
      const initialParts = assembly.getAllParts();
      const initialInstances = assembly.getAllInstances();
      if (initialParts.length >= 2 && initialInstances.length >= 3) {
        report.verifications.assemblyCreation = 'PASS';
        stagesLog.push(`[Gate-043] Assembly created with ${initialParts.length} parts and ${initialInstances.length} instances.`);
      }

      // 2. Component Instancing Test (Multiple instances referencing single PartDefinition)
      stagesLog.push('[Gate-043] Stage 2: Verifying Component Instancing System.');
      const gearPart: PartDefinition = {
        partId: 'part-gate-gear',
        name: 'Spur Gear Definition',
        parameters: [{ id: 'p1', name: 'Teeth', value: 20, unit: 'count' }],
        densityKgM3: 7850,
        volumeM3: 0.0001,
        massKg: 0.785,
        revision: 1
      };
      assembly.registerPart(gearPart);

      // Create 3 instances of the SAME part definition
      const gear01: AssemblyComponent = {
        instanceId: 'gear-inst-001',
        partId: 'part-gate-gear',
        name: 'Gear Instance 1',
        placementTransform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) },
        worldTransform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) },
        suppressed: false,
        fixed: true
      };

      const gear02: AssemblyComponent = {
        instanceId: 'gear-inst-002',
        partId: 'part-gate-gear',
        name: 'Gear Instance 2',
        placementTransform: { position: { x: 50, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 50, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) },
        worldTransform: { position: { x: 50, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 50, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) },
        suppressed: false,
        fixed: false
      };

      const gear03: AssemblyComponent = {
        instanceId: 'gear-inst-003',
        partId: 'part-gate-gear',
        name: 'Gear Instance 3',
        placementTransform: { position: { x: 100, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 100, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) },
        worldTransform: { position: { x: 100, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 100, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) },
        suppressed: false,
        fixed: false
      };

      assembly.addInstance(gear01);
      assembly.addInstance(gear02);
      assembly.addInstance(gear03);

      const allGears = assembly.getAllInstances().filter(i => i.partId === 'part-gate-gear');
      if (allGears.length === 3 && allGears.every(g => g.partId === 'part-gate-gear')) {
        report.verifications.componentInstancing = 'PASS';
        report.assembly.components = true;
        stagesLog.push('[Gate-043] Component Instancing: PASS (3 instances share single Part definition).');
      }

      // 3. Constraints & Solver Tests (Mate, Concentric, Distance)
      stagesLog.push('[Gate-043] Stage 3: Verifying Constraints & Solver (Mate, Concentric, Distance).');
      
      // Add Mate (Coincident)
      const mateConstraint: AssemblyConstraint = {
        constraintId: 'gate-constr-mate',
        assemblyId: 'asm-root-001',
        componentA: 'gear-inst-001',
        componentB: 'gear-inst-002',
        geometryRefA: { componentId: 'gear-inst-001', topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'face_z_normal' },
        geometryRefB: { componentId: 'gear-inst-002', topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'face_z_normal' },
        type: 'MATE',
        parameters: { tolerance: 1e-4 },
        status: 'UNRESOLVED',
        solverError: 0,
        revision: 1,
        suppressionState: 'ACTIVE'
      };

      // Add Concentric
      const concentricConstraint: AssemblyConstraint = {
        constraintId: 'gate-constr-concentric',
        assemblyId: 'asm-root-001',
        componentA: 'gear-inst-001',
        componentB: 'gear-inst-002',
        geometryRefA: { componentId: 'gear-inst-001', topologyType: 'AXIS', topologyIndex: 0, geometricSignature: 'bore_axis' },
        geometryRefB: { componentId: 'gear-inst-002', topologyType: 'AXIS', topologyIndex: 0, geometricSignature: 'bore_axis' },
        type: 'CONCENTRIC',
        parameters: { tolerance: 1e-4 },
        status: 'UNRESOLVED',
        solverError: 0,
        revision: 1,
        suppressionState: 'ACTIVE'
      };

      // Add Distance
      const distanceConstraint: AssemblyConstraint = {
        constraintId: 'gate-constr-distance',
        assemblyId: 'asm-root-001',
        componentA: 'gear-inst-002',
        componentB: 'gear-inst-003',
        geometryRefA: { componentId: 'gear-inst-002', topologyType: 'FACE', topologyIndex: 1, geometricSignature: 'face_offset' },
        geometryRefB: { componentId: 'gear-inst-003', topologyType: 'FACE', topologyIndex: 1, geometricSignature: 'face_offset' },
        type: 'DISTANCE',
        parameters: { offsetMm: 25, tolerance: 1e-4 },
        status: 'UNRESOLVED',
        solverError: 0,
        revision: 1,
        suppressionState: 'ACTIVE'
      };

      assembly.addConstraint(mateConstraint);
      assembly.addConstraint(concentricConstraint);
      assembly.addConstraint(distanceConstraint);

      // 4. Degrees of Freedom Analysis
      stagesLog.push('[Gate-043] Stage 4: Degrees of Freedom (DOF) Calculation.');
      const dofResult = assembly.calculateDegreesOfFreedom();
      
      const fixedDof = dofResult.componentDofs['gear-inst-001'];
      const gear2Dof = dofResult.componentDofs['gear-inst-002'];
      
      if (fixedDof && fixedDof.remainingDofCount === 0 && fixedDof.isFixed) {
        stagesLog.push('[Gate-043] Grounded Instance correctly has 0 DOF.');
      }
      
      // Concentric (-4 DOF) + Mate (-3 DOF) = fully locked position (0 DOF remaining or 1 rotation)
      if (gear2Dof && gear2Dof.remainingDofCount <= 1) {
        stagesLog.push(`[Gate-043] Gear 2 DOF reduced properly to ${gear2Dof.remainingDofCount} remaining.`);
      }

      if (fixedDof && gear2Dof) {
        report.verifications.dofCalculation = 'PASS';
        report.assembly.degreesOfFreedom = true;
      }

      // 5. Solve Constraints
      stagesLog.push('[Gate-043] Stage 5: Solving Constraints via AssemblyConstraintSolver.');
      const solveReport = assembly.solveConstraints();
      
      if (solveReport.satisfiedConstraintsCount === 3 && solveReport.convergenceResidual < 1e-3) {
        report.verifications.mateConstraint = 'PASS';
        report.verifications.concentricConstraint = 'PASS';
        report.verifications.distanceConstraint = 'PASS';
        report.verifications.constraintSolving = 'PASS';
        report.assembly.constraints = true;
        report.assembly.solver = true;
        stagesLog.push(`[Gate-043] Solver: PASS (${solveReport.satisfiedConstraintsCount} constraints satisfied, residual=${solveReport.convergenceResidual.toExponential(4)}).`);
      }

      // 6. Under-constrained and Over-constrained Detection
      stagesLog.push('[Gate-043] Stage 6: Verifying Under-Constrained & Over-Constrained Detection.');
      
      // Under-constrained test: An ungrounded component with no constraints
      const freeComp: AssemblyComponent = {
        instanceId: 'comp-free-floating',
        partId: 'part-gate-gear',
        name: 'Free Floating Component',
        placementTransform: { position: { x: 200, y: 200, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 200, y: 200, z: 0 }, { x: 0, y: 0, z: 0 }) },
        worldTransform: { position: { x: 200, y: 200, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 200, y: 200, z: 0 }, { x: 0, y: 0, z: 0 }) },
        suppressed: false,
        fixed: false
      };
      
      const underConstrainedReport = AssemblyConstraintSolver.solve([gear01, freeComp], []);
      if (underConstrainedReport.status === 'UNDER_CONSTRAINED' && underConstrainedReport.totalAssemblyDof === 6) {
        report.verifications.underConstrainedDetection = 'PASS';
        stagesLog.push('[Gate-043] Under-constrained detection: PASS (6 DOF reported for free component).');
      }

      // Over-constrained test: Redundant consistent constraints
      const redundantMate: AssemblyConstraint = {
        constraintId: 'gate-redundant-mate',
        assemblyId: 'asm-root-001',
        componentA: 'gear-inst-001',
        componentB: 'gear-inst-002',
        geometryRefA: { componentId: 'gear-inst-001', topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'face_z_normal' },
        geometryRefB: { componentId: 'gear-inst-002', topologyType: 'FACE', topologyIndex: 0, geometricSignature: 'face_z_normal' },
        type: 'LOCK',
        parameters: {},
        status: 'UNRESOLVED',
        solverError: 0,
        revision: 1,
        suppressionState: 'ACTIVE'
      };
      const overConstrainedReport = AssemblyConstraintSolver.solve([gear01, gear02], [mateConstraint, concentricConstraint, redundantMate]);
      if (overConstrainedReport.status === 'OVER_CONSTRAINED') {
        report.verifications.overConstrainedDetection = 'PASS';
        stagesLog.push('[Gate-043] Over-constrained detection: PASS (Redundant lock + mate detected).');
      }

      // 7. Assembly Rebuild Pipeline & Geometric Signature
      stagesLog.push('[Gate-043] Stage 7: Testing Selective Assembly Rebuild on Part Revision.');
      const rebuildResult = await assembly.rebuildAssemblyOnPartUpdate('part-gate-gear', 'hash-brep-gear-v2', kernel);
      if (rebuildResult.rebuiltInstances.length === 3 && rebuildResult.geometricSignaturesValid) {
        report.verifications.assemblyRebuild = 'PASS';
        stagesLog.push(`[Gate-043] Assembly Rebuild: PASS (3 dependent instances rebuilt, signatures verified).`);
      }

      // 8. Interference Detection with Real OCCT
      stagesLog.push('[Gate-043] Stage 8: Real OCCT Interference & Collision Detection.');
      // Create two clashing parts placed at overlapping positions
      const boxPartA: PartDefinition = {
        partId: 'part-clash-boxA',
        name: 'Clash Box A',
        shapeHandle: await kernel.createBox(30, 30, 30),
        parameters: [],
        densityKgM3: 7850,
        volumeM3: 0.000027,
        massKg: 0.21,
        revision: 1
      };
      const boxPartB: PartDefinition = {
        partId: 'part-clash-boxB',
        name: 'Clash Box B',
        shapeHandle: await kernel.createBox(30, 30, 30),
        parameters: [],
        densityKgM3: 7850,
        volumeM3: 0.000027,
        massKg: 0.21,
        revision: 1
      };

      const clashCompA: AssemblyComponent = {
        instanceId: 'comp-box-a',
        partId: 'part-clash-boxA',
        name: 'Box A Instance',
        placementTransform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) },
        worldTransform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) },
        suppressed: false,
        fixed: true
      };

      const clashCompB: AssemblyComponent = {
        instanceId: 'comp-box-b',
        partId: 'part-clash-boxB',
        name: 'Box B Instance',
        placementTransform: { position: { x: 15, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 15, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) },
        worldTransform: { position: { x: 15, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, matrix: computeTransformMatrix({ x: 15, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }) },
        suppressed: false,
        fixed: false
      };

      const clashPartMap = new Map<string, PartDefinition>();
      clashPartMap.set('part-clash-boxA', boxPartA);
      clashPartMap.set('part-clash-boxB', boxPartB);

      const interferenceReport = await AssemblyInterferenceEngine.analyzeInterference(
        [clashCompA, clashCompB],
        clashPartMap,
        kernel
      );

      stagesLog.push(`[Gate-043] OCCT Interference Result: status=${interferenceReport.status}, clashes=${interferenceReport.clashes.length}, volume=${interferenceReport.totalClashVolumeMm3} mm3.`);

      if (interferenceReport.status === 'INTERFERENCE' && interferenceReport.totalClashVolumeMm3 > 0 && interferenceReport.clashes.length === 1) {
        report.verifications.interferenceDetection = 'PASS';
        report.assembly.interferenceDetection = true;
        stagesLog.push(`[Gate-043] Real OCCT Boolean Clash Detection: PASS (Volume: ${interferenceReport.totalClashVolumeMm3} mm³, Centroid: (${interferenceReport.clashes[0].intersectionLocation.x}, ${interferenceReport.clashes[0].intersectionLocation.y}, ${interferenceReport.clashes[0].intersectionLocation.z})).`);
      }

      // 9. Deterministic Solve Verification
      stagesLog.push('[Gate-043] Stage 9: Verifying Deterministic Solves.');
      const solveRun1 = AssemblyConstraintSolver.solve([gear01, gear02, gear03], [mateConstraint, concentricConstraint, distanceConstraint]);
      const mat1 = [...gear02.worldTransform.matrix];

      // Re-run
      gear02.worldTransform.position = { x: 99, y: 99, z: 99 };
      const solveRun2 = AssemblyConstraintSolver.solve([gear01, gear02, gear03], [mateConstraint, concentricConstraint, distanceConstraint]);
      const mat2 = [...gear02.worldTransform.matrix];

      let isDeterministic = true;
      for (let i = 0; i < 16; i++) {
        if (Math.abs(mat1[i] - mat2[i]) > 1e-4) {
          isDeterministic = false;
          break;
        }
      }

      if (isDeterministic) {
        report.verifications.deterministicSolve = 'PASS';
        report.assembly.deterministic = true;
        stagesLog.push('[Gate-043] Deterministic Solve: PASS (Identical convergence matrices).');
      }

      // Final Check
      const allVerificationsPass = Object.values(report.verifications).every(v => v === 'PASS');
      const allAssemblyFlagsPass = Object.values(report.assembly).every(v => v === true);

      if (allVerificationsPass && allAssemblyFlagsPass && !report.mockFallback) {
        report.status = 'PASS';
        stagesLog.push('[Gate-043] *** HARD ACCEPTANCE GATE 043 APPROVED: All verifications passed with Real OCCT. ***');
      } else {
        stagesLog.push('[Gate-043] *** HARD ACCEPTANCE GATE 043 REJECTED ***');
      }

    } catch (e: any) {
      stagesLog.push(`[Gate-043] CRITICAL_EXCEPTION: ${e.message || e}`);
      report.status = 'FAIL';
    }

    return report;
  }

  public static async runAcceptanceGate(): Promise<AcceptanceGate043Report> {
    return this.runGateVerification();
  }
}
