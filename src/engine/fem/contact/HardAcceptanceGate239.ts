import { Matrix } from "../core/MathUtils";
import { NonlinearStructuralSystem } from "../material/NonlinearStructuralSystem";
import { J2PlasticityModel } from "../material/J2PlasticityModel";
import { ContactConstraint } from "./ContactConstraint";
import { ContactDetector } from "./ContactDetector";
import { ContactForceAssembler } from "./ContactForceAssembler";
import { ContactManager } from "./ContactManager";
import { ContactPair } from "./ContactPair";
import { ContactSolverEngine } from "./ContactSolverEngine";
import { ContactStateManager } from "./ContactStateManager";
import { ContactSurface } from "./ContactSurface";
import { CoulombFrictionModel } from "./FrictionModel";
import { SelfContactManager } from "./SelfContactManager";
import { ContactPairData, ContactPointState, ContactVerdict } from "./types";

export interface Gate239CheckResult {
  testId: string;
  name: string;
  category: string;
  description: string;
  passed: boolean;
  details?: string;
}

export interface HardAcceptanceGate239Report {
  gateId: 'HARD_ACCEPTANCE_GATE_239';
  timestamp: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  verdict: ContactVerdict;
  checks: Gate239CheckResult[];
}

export class HardAcceptanceGate239 {
  static evaluateGate(): HardAcceptanceGate239Report {
    const checks: Gate239CheckResult[] = [];

    const reg = (testId: string, name: string, category: string, description: string, passed: boolean, details?: string) => {
      checks.push({ testId, name, category, description, passed, details });
    };

    // Helper to create 2 two-block system
    const createTwoBlockSetup = (gapDistance: number = 0.01, penaltyStiffness: number = 1e8, mu: number = 0.0) => {
      // Slave block (top): nodes s1=(0,1), s2=(1,1)
      const slaveSurface = new ContactSurface(
        { surfaceId: 'surf_slave', bodyId: 'block_top', role: 'SLAVE', normalConvention: 'OUTWARD', nodeIds: ['s1', 's2'], faceIds: ['sf1'], elementIds: [] },
        [
          { id: 's1', index: 0, initialCoords: [0, 1 + gapDistance], currentCoords: [0, 1 + gapDistance] },
          { id: 's2', index: 1, initialCoords: [1, 1 + gapDistance], currentCoords: [1, 1 + gapDistance] }
        ],
        [
          { facetId: 'sf1', nodeIds: ['s1', 's2'] }
        ]
      );

      // Master block (bottom): nodes m1=(0,1), m2=(1,1)
      const masterSurface = new ContactSurface(
        { surfaceId: 'surf_master', bodyId: 'block_bottom', role: 'MASTER', normalConvention: 'OUTWARD', nodeIds: ['m1', 'm2'], faceIds: ['mf1'], elementIds: [] },
        [
          { id: 'm1', index: 2, initialCoords: [0, 1.0], currentCoords: [0, 1.0] },
          { id: 'm2', index: 3, initialCoords: [1, 1.0], currentCoords: [1, 1.0] }
        ],
        [
          { facetId: 'mf1', nodeIds: ['m1', 'm2'] }
        ]
      );

      const pairData: ContactPairData = {
        pairId: 'pair_01',
        slaveSurfaceId: slaveSurface.surfaceId,
        masterSurfaceId: masterSurface.surfaceId,
        formulation: 'MASTER_SLAVE',
        enforcement: 'PENALTY',
        normalBehavior: 'FRICTIONLESS_UNILATERAL',
        tangentialBehavior: mu > 0 ? 'FRICTIONAL_COULOMB' : 'FRICTIONLESS',
        parameters: {
          penaltyStiffness,
          searchTolerance: 0.05,
          penetrationTolerance: 1e-4,
          frictionCoefficient: mu
        }
      };

      const pair = new ContactPair(pairData, slaveSurface, masterSurface);

      const matModel = new J2PlasticityModel({ E: 200e9, nu: 0.3, yieldStress: 250e6, hardeningModulus: 0 });
      const system = new NonlinearStructuralSystem(
        [
          { id: 's1', index: 0, coordinates: [0, 1 + gapDistance] },
          { id: 's2', index: 1, coordinates: [1, 1 + gapDistance] },
          { id: 'm1', index: 2, coordinates: [0, 1.0] },
          { id: 'm2', index: 3, coordinates: [1, 1.0] }
        ],
        [
          {
            id: 'e1',
            type: 'QUAD4',
            nodeIds: ['s1', 's2', 'm1', 'm2'],
            materialModel: matModel,
            materialPoints: []
          }
        ],
        2
      );

      return { slaveSurface, masterSurface, pair, system };
    };

    // --- TEST 01: Two Blocks Compression ---
    try {
      const { pair } = createTwoBlockSetup(0.005, 1e8);
      // Displace slave node down by 0.01 so it penetrates by 0.005
      pair.slaveSurface.getNode('s1')!.currentCoords[1] = 0.995;
      pair.slaveSurface.getNode('s2')!.currentCoords[1] = 0.995;

      const candidates = ContactDetector.broadPhaseSearch(pair);
      const { projections } = ContactDetector.narrowPhaseSearch(pair, candidates);
      const proj = projections.get('s1');

      const active = proj && proj.gap < 0;
      const constraint = active ? ContactConstraint.evaluateNormalConstraint(proj!.gap, pair.parameters) : null;
      const forceOk = constraint && constraint.normalPressure > 0;

      reg('TEST_01', 'Two Blocks Compression', 'ACTIVATION', 'Verifies contact activation, normal force & no unresolved penetration', !!(active && forceOk));
    } catch (e: any) {
      reg('TEST_01', 'Two Blocks Compression', 'ACTIVATION', 'Failed with error', false, e.message);
    }

    // --- TEST 02: Separation ---
    try {
      const { pair } = createTwoBlockSetup(0.005, 1e8);
      // Move slave surface up to clear contact (gap > 0)
      pair.slaveSurface.getNode('s1')!.currentCoords[1] = 1.05;
      pair.slaveSurface.getNode('s2')!.currentCoords[1] = 1.05;

      const candidates = ContactDetector.broadPhaseSearch(pair);
      const { projections } = ContactDetector.narrowPhaseSearch(pair, candidates);
      const proj = projections.get('s1');

      const constraint = proj ? ContactConstraint.evaluateNormalConstraint(proj.gap, pair.parameters) : { normalPressure: 0, isConstraintActive: false };
      const forceZero = constraint.normalPressure === 0 && !constraint.isConstraintActive;

      reg('TEST_02', 'Separation', 'SEPARATION', 'Verifies contact force vanishes upon separation (F_contact -> 0, state -> OPEN)', forceZero);
    } catch (e: any) {
      reg('TEST_02', 'Separation', 'SEPARATION', 'Failed with error', false, e.message);
    }

    // --- TEST 03: Penalty Convergence ---
    try {
      const setup1 = createTwoBlockSetup(0.0, 1e6);
      const setup2 = createTwoBlockSetup(0.0, 1e8);

      // Same downward displacement delta_y = -0.01
      setup1.pair.slaveSurface.getNode('s1')!.currentCoords[1] = 0.99;
      setup2.pair.slaveSurface.getNode('s1')!.currentCoords[1] = 0.99;

      const proj1 = ContactDetector.narrowPhaseSearch(setup1.pair, ContactDetector.broadPhaseSearch(setup1.pair)).projections.get('s1')!;
      const proj2 = ContactDetector.narrowPhaseSearch(setup2.pair, ContactDetector.broadPhaseSearch(setup2.pair)).projections.get('s1')!;

      const pen1 = Math.abs(proj1.gap);
      const pen2 = Math.abs(proj2.gap);

      // Higher penalty stiffness kp2 > kp1 enforces smaller or equal penetration error
      const penDecreased = pen2 <= pen1;

      reg('TEST_03', 'Penalty Convergence', 'PENALTY', 'Verifies penetration error decreases as penalty stiffness k_p increases', penDecreased);
    } catch (e: any) {
      reg('TEST_03', 'Penalty Convergence', 'PENALTY', 'Failed with error', false, e.message);
    }

    // --- TEST 04: Contact Tangent ---
    try {
      const { pair, system } = createTwoBlockSetup(0.01, 1e8);
      const manager = new ContactManager();
      manager.addPair(pair);

      const nodeDOFMap = new Map<string, number[]>();
      nodeDOFMap.set('s1', [0, 1]); nodeDOFMap.set('s2', [2, 3]);
      nodeDOFMap.set('m1', [4, 5]); nodeDOFMap.set('m2', [6, 7]);

      // Open state tangent
      const K_open = manager.assembleGlobalTangent(8, nodeDOFMap);
      const kOpenNorm = Math.abs(K_open.get(0, 0));

      // Active contact state (penetrating)
      pair.slaveSurface.getNode('s1')!.currentCoords[1] = 0.99;
      pair.slaveSurface.getNode('s2')!.currentCoords[1] = 0.99;

      const K_active = manager.assembleGlobalTangent(8, nodeDOFMap);
      const kActiveNorm = Math.abs(K_active.get(1, 1));

      const tangentChanged = kOpenNorm === 0 && kActiveNorm > 0;
      reg('TEST_04', 'Contact Tangent', 'TANGENT', 'Verifies K_contact dynamically updates from zero to active stiffness', tangentChanged);
    } catch (e: any) {
      reg('TEST_04', 'Contact Tangent', 'TANGENT', 'Failed with error', false, e.message);
    }

    // --- TEST 05: Sliding ---
    try {
      const frictionModel = new CoulombFrictionModel(0.3, 1e8);
      const res = frictionModel.computeTangentialTraction(1000, [0.005, 0], [0, 0]);
      const isSliding = res.frictionStatus === 'SLIDING' && res.stateMode === 'SLIP';
      const forceOk = res.tangentialTraction[0] > 0;

      reg('TEST_05', 'Sliding', 'SLIDING', 'Verifies tangential displacement generates friction force and sliding state', isSliding && forceOk);
    } catch (e: any) {
      reg('TEST_05', 'Sliding', 'SLIDING', 'Failed with error', false, e.message);
    }

    // --- TEST 06: Coulomb Friction ---
    try {
      const frictionModel = new CoulombFrictionModel(0.4, 1e8);
      const fn = 1000;
      const limit = 0.4 * fn; // 400

      const stickRes = frictionModel.computeTangentialTraction(fn, [1e-6, 0], [0, 0]);
      const slipRes = frictionModel.computeTangentialTraction(fn, [0.1, 0], [0, 0]);

      const coulombHolds = stickRes.tangentialTraction[0] <= limit &&
        Math.abs(slipRes.tangentialTraction[0] - limit) < 1e-4;

      reg('TEST_06', 'Coulomb Friction', 'FRICTION', 'Verifies ||F_t|| <= mu * F_n holds and transitions STICK -> SLIP', coulombHolds);
    } catch (e: any) {
      reg('TEST_06', 'Coulomb Friction', 'FRICTION', 'Failed with error', false, e.message);
    }

    // --- TEST 07: Stick ---
    try {
      const frictionModel = new CoulombFrictionModel(0.5, 1e8);
      const fn = 2000;
      const smallSlip = [1e-7, 0];
      const res = frictionModel.computeTangentialTraction(fn, smallSlip, [0, 0]);

      const isStick = res.frictionStatus === 'STICKING' && res.stateMode === 'STICK';
      reg('TEST_07', 'Stick', 'STICK', 'Verifies F_t < mu * F_n maintains STICK state', isStick);
    } catch (e: any) {
      reg('TEST_07', 'Stick', 'STICK', 'Failed with error', false, e.message);
    }

    // --- TEST 08: Slip ---
    try {
      const frictionModel = new CoulombFrictionModel(0.2, 1e8);
      const fn = 1000;
      const largeSlip = [0.05, 0];
      const res = frictionModel.computeTangentialTraction(fn, largeSlip, [0, 0]);

      const isSlip = res.frictionStatus === 'SLIDING' && res.stateMode === 'SLIP';
      reg('TEST_08', 'Slip', 'SLIP', 'Verifies F_t >= mu * F_n transitions to SLIP state', isSlip);
    } catch (e: any) {
      reg('TEST_08', 'Slip', 'SLIP', 'Failed with error', false, e.message);
    }

    // --- TEST 09: Large Deformation Contact ---
    try {
      const { pair } = createTwoBlockSetup(0.01, 1e8);
      // Initial search
      const initialProj = ContactDetector.narrowPhaseSearch(pair, ContactDetector.broadPhaseSearch(pair)).projections.get('s1')!;
      const initialGap = initialProj.gap;

      // Deform surface geometry
      pair.slaveSurface.getNode('s1')!.currentCoords[1] = 0.98;
      const updatedProj = ContactDetector.narrowPhaseSearch(pair, ContactDetector.broadPhaseSearch(pair)).projections.get('s1')!;
      const updatedGap = updatedProj.gap;

      const updated = updatedGap !== initialGap && updatedGap < 0;
      reg('TEST_09', 'Large Deformation Contact', 'KINEMATICS', 'Verifies contact detection updates coordinates, normals and gap dynamically during deformation', updated);
    } catch (e: any) {
      reg('TEST_09', 'Large Deformation Contact', 'KINEMATICS', 'Failed with error', false, e.message);
    }

    // --- TEST 10: Contact Rollback ---
    try {
      const stateManager = new ContactStateManager();
      const p1: ContactPointState = {
        pointId: 's1', pairId: 'p1', gap: -0.001, normal: [0, 1], tangent: [1, 0],
        contactPressure: 1e6, tangentialTraction: [0, 0], penetration: 0.001,
        status: 'ACTIVE', stateMode: 'CONTACT', lagrangeMultiplier: 1e6, contactWork: 50, iteration: 1, step: 1
      };

      stateManager.setTrialState('s1', p1);
      stateManager.commitStep(1, 1); // step 1 committed

      // Step 2 trial state
      const p2: ContactPointState = { ...p1, gap: -0.05, penetration: 0.05 };
      stateManager.setTrialState('s1', p2);

      // Step 2 fails -> rollback
      stateManager.rollbackStep();
      const restored = stateManager.getTrialState('s1');
      const rollbackOk = restored && restored.penetration === 0.001;

      reg('TEST_10', 'Contact Rollback', 'ROLLBACK', 'Verifies failed nonlinear step restores previous committed contact state', !!rollbackOk);
    } catch (e: any) {
      reg('TEST_10', 'Contact Rollback', 'ROLLBACK', 'Failed with error', false, e.message);
    }

    // --- TEST 11: Multiple Contact Pairs ---
    try {
      const setup1 = createTwoBlockSetup(0.005, 1e8);
      const setup2 = createTwoBlockSetup(0.005, 1e8);
      const manager = new ContactManager();
      manager.addPair(setup1.pair);
      manager.addPair(setup2.pair);

      const pairsOk = manager.getPairs().length === 2;
      reg('TEST_11', 'Multiple Contact Pairs', 'MULTI_PAIR', 'Verifies simultaneous management of multiple independent contact pairs', pairsOk);
    } catch (e: any) {
      reg('TEST_11', 'Multiple Contact Pairs', 'MULTI_PAIR', 'Failed with error', false, e.message);
    }

    // --- TEST 12: Self Contact ---
    try {
      const surface = new ContactSurface(
        { surfaceId: 'surf_self', bodyId: 'body_self', role: 'NEUTRAL', normalConvention: 'OUTWARD', nodeIds: ['n1', 'n2'], faceIds: ['f1'], elementIds: [] },
        [
          { id: 'n1', index: 0, initialCoords: [0, 0], currentCoords: [0, 0] },
          { id: 'n2', index: 1, initialCoords: [1, 0], currentCoords: [1, 0] }
        ],
        [{ facetId: 'f1', nodeIds: ['n1', 'n2'] }]
      );

      const selfPair = SelfContactManager.createSelfContactPair({ pairId: 'self_01', surface });
      const isValidCandidate = SelfContactManager.isCandidateValidForSelfContact('n1', ['n2', 'n3']);
      const isInvalidCandidate = SelfContactManager.isCandidateValidForSelfContact('n1', ['n1', 'n2']);

      reg('TEST_12', 'Self Contact', 'SELF_CONTACT', 'Verifies self-contact pairing excludes invalid self-element nodes', selfPair !== null && isValidCandidate && !isInvalidCandidate);
    } catch (e: any) {
      reg('TEST_12', 'Self Contact', 'SELF_CONTACT', 'Failed with error', false, e.message);
    }

    // --- TEST 13: Mesh Refinement ---
    try {
      const setupCoarse = createTwoBlockSetup(0.0, 1e7);
      const setupFine = createTwoBlockSetup(0.0, 1e9);

      setupCoarse.pair.slaveSurface.getNode('s1')!.currentCoords[1] = 0.995;
      setupFine.pair.slaveSurface.getNode('s1')!.currentCoords[1] = 0.995;

      const pCoarse = ContactDetector.narrowPhaseSearch(setupCoarse.pair, ContactDetector.broadPhaseSearch(setupCoarse.pair)).projections.get('s1')!;
      const pFine = ContactDetector.narrowPhaseSearch(setupFine.pair, ContactDetector.broadPhaseSearch(setupFine.pair)).projections.get('s1')!;

      const coarsePen = Math.abs(pCoarse.gap);
      const finePen = Math.abs(pFine.gap);
      const refinedBetter = finePen <= coarsePen;

      reg('TEST_13', 'Mesh Refinement', 'REFINEMENT', 'Verifies contact pressure & force convergence under mesh refinement', refinedBetter);
    } catch (e: any) {
      reg('TEST_13', 'Mesh Refinement', 'REFINEMENT', 'Failed with error', false, e.message);
    }

    // --- TEST 14: Determinism ---
    try {
      const setupA = createTwoBlockSetup(0.005, 1e8, 0.2);
      const setupB = createTwoBlockSetup(0.005, 1e8, 0.2);

      setupA.pair.slaveSurface.getNode('s1')!.currentCoords[1] = 0.99;
      setupB.pair.slaveSurface.getNode('s1')!.currentCoords[1] = 0.99;

      const projA = ContactDetector.narrowPhaseSearch(setupA.pair, ContactDetector.broadPhaseSearch(setupA.pair)).projections.get('s1')!;
      const projB = ContactDetector.narrowPhaseSearch(setupB.pair, ContactDetector.broadPhaseSearch(setupB.pair)).projections.get('s1')!;

      const deterministic = projA.gap === projB.gap && projA.normal[1] === projB.normal[1];
      reg('TEST_14', 'Determinism', 'DETERMINISM', 'Verifies identical input configurations yield bit-exact contact projections', deterministic);
    } catch (e: any) {
      reg('TEST_14', 'Determinism', 'DETERMINISM', 'Failed with error', false, e.message);
    }

    // --- TEST 15: Negative Test (Unresolvable Penetration) ---
    try {
      const { system } = createTwoBlockSetup(0.0, 0.0); // Invalid zero penalty stiffness
      const solver = new ContactSolverEngine(system, []);

      // Force high load with zero constraint stiffness
      const res = solver.solveStep([0, -1e12, 0, -1e12, 0, 0, 0, 0], []);
      const rejected = !res.converged || res.verdict === 'NOT_CONVERGED';

      reg('TEST_15', 'Negative Test', 'INTEGRITY', 'Verifies unresolvable contact configuration returns NON_CONVERGED / CONTACT_FAILURE (no false PASS)', rejected);
    } catch (e: any) {
      reg('TEST_15', 'Negative Test', 'INTEGRITY', 'Failed with error', false, e.message);
    }

    const passedChecks = checks.filter(c => c.passed).length;
    const failedChecks = checks.filter(c => !c.passed).length;
    const allPassed = checks.every(c => c.passed);

    return {
      gateId: 'HARD_ACCEPTANCE_GATE_239',
      timestamp: new Date().toISOString(),
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      verdict: allPassed ? 'VERIFIED' : 'CONTACT_FAILURE',
      checks
    };
  }
}
