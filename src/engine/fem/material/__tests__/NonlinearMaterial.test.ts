import { describe, it, expect } from "vitest";
import { J2PlasticityModel } from "../J2PlasticityModel";
import { MaterialState, MaterialPoint } from "../MaterialState";
import { IndependentPlasticityReference } from "../IndependentPlasticityReference";
import { MaterialBenchmarkSuite } from "../MaterialBenchmarkSuite";
import { MaterialAdversarialSuite } from "../MaterialAdversarialSuite";
import { MaterialStateSerializer, MaterialStateHasher } from "../MaterialStateHasher";
import { MaterialEvidence } from "../MaterialEvidence";
import { MaterialSubstepController } from "../MaterialSubstepController";
import { IndependentPlasticWorkAudit } from "../IndependentPlasticWorkAudit";
import { NonlinearStructuralSystem, NonlinearNode, NonlinearElement } from "../NonlinearStructuralSystem";
import { NewtonRaphsonStructuralSolver } from "../NewtonRaphsonStructuralSolver";

describe("PATCH-080: Nonlinear Material Constitutive Framework", () => {
  const defaultParams = {
    E: 200e9,
    nu: 0.3,
    yieldStress: 250e6,
    hardeningModulus: 20e9,
    planeState: '3D' as const
  };

  it("1. Initializes deterministic MaterialState and validates parameter domain", () => {
    const model = new J2PlasticityModel(defaultParams);
    expect(model.G).toBeCloseTo(200e9 / (2 * 1.3), 1);
    expect(model.K).toBeCloseTo(200e9 / (3 * 0.4), 1);

    const state = MaterialState.createInitial(6);
    expect(state.stress).toHaveLength(6);
    expect(state.equivalentPlasticStrain).toBe(0);
    expect(state.materialStatus).toBe("ELASTIC");
  });

  it("2. Verifies deviatoric split and hydrostatic invariance (tr(s) = 0 and zero von Mises under pressure)", () => {
    const model = new J2PlasticityModel(defaultParams);

    // Pure hydrostatic state
    const p = 500e6;
    const hydroStress = [p, p, p, 0, 0, 0];
    const devSplit = model.computeDeviatoricStress(hydroStress);
    expect(Math.abs(devSplit.trace)).toBeLessThan(1e-12);
    expect(devSplit.s[0]).toBeCloseTo(0, 8);
    expect(devSplit.s[1]).toBeCloseTo(0, 8);
    expect(devSplit.s[2]).toBeCloseTo(0, 8);

    const vm = model.computeVonMisesStress(hydroStress);
    expect(vm).toBeCloseTo(0, 8);
  });

  it("3. Elastic predictor correctly handles pre-yield strain increments", () => {
    const model = new J2PlasticityModel(defaultParams);
    const state0 = MaterialState.createInitial(6);

    // Small strain below yield: eps_x = 0.0005 (sigma_x = 200 GPa * 0.0005 = 100 MPa < 250 MPa)
    const res = model.updateConstitutive([0.0005, -0.00015, -0.00015, 0, 0, 0], state0);
    expect(res.converged).toBe(true);
    expect(res.materialStatus).toBe("ELASTIC");
    expect(res.plasticMultiplier).toBe(0);
    expect(res.equivalentPlasticStrain).toBe(0);
    expect(res.stress[0]).toBeGreaterThan(0);
  });

  it("4. Radial return mapping computes exact plastic multiplier and enforces consistency f ≈ 0", () => {
    const model = new J2PlasticityModel(defaultParams);
    const state0 = MaterialState.createInitial(6);

    // Large strain exceeding yield
    const plasticEps = [0.003, -0.0009, -0.0009, 0.001, 0, 0];
    const res = model.updateConstitutive(plasticEps, state0);

    expect(res.converged).toBe(true);
    expect(res.materialStatus).toBe("PLASTIC");
    expect(res.plasticMultiplier).toBeGreaterThan(0);
    expect(res.equivalentPlasticStrain).toBeGreaterThan(0);
    expect(Math.abs(res.yieldFunctionValue)).toBeLessThan(1e-4);
  });

  it("5. Matches analytical closed-form uniaxial tension solution", () => {
    const model1D = new J2PlasticityModel({
      E: 200e9,
      nu: 0.3,
      yieldStress: 250e6,
      hardeningModulus: 20e9,
      planeState: '1D'
    });

    const eps = 0.005;
    const state0 = MaterialState.createInitial(1);
    const res = model1D.updateConstitutive([eps], state0);
    const ref = IndependentPlasticityReference.solveUniaxialTension(eps, 200e9, 250e6, 20e9);

    expect(res.stress[0]).toBeCloseTo(ref.stress, 2);
    expect(res.plasticStrain[0]).toBeCloseTo(ref.plasticStrain, 6);
    expect(res.equivalentPlasticStrain).toBeCloseTo(ref.equivalentPlasticStrain, 6);
  });

  it("6. Validates algorithmic consistent tangent matrix against finite-difference perturbations", () => {
    const model = new J2PlasticityModel(defaultParams);
    const state0 = MaterialState.createInitial(6);
    const plasticEps = [0.003, -0.0009, -0.0009, 0.001, 0.001, 0.002];

    const val = model.validateTangentByFiniteDifference(state0, plasticEps, 1e-7);
    expect(val.isValid).toBe(true);
    expect(val.relativeError).toBeLessThan(1e-4);
    expect(val.symmetryError).toBeLessThan(1e-8);
  });

  it("7. Verifies pure shear yield condition tau_y = sigma_y / sqrt(3)", () => {
    const G = 200e9 / (2 * 1.3);
    const ref = IndependentPlasticityReference.solvePureShear(0.005, G, 250e6, 20e9);
    expect(ref.tauYield).toBeCloseTo(250e6 / Math.sqrt(3), 2);
    expect(ref.yieldPointPassed).toBe(true);
  });

  it("8. Verifies elastic unloading and reloading behavior", () => {
    const report = MaterialBenchmarkSuite.runLoadingUnloadingBenchmark();
    expect(report.passed).toBe(true);
  });

  it("9. Verifies path dependence between single-step and two-stage loading paths", () => {
    const report = MaterialBenchmarkSuite.runPathDependenceBenchmark();
    expect(report.passed).toBe(true);
  });

  it("10. Audits plastic work dissipation non-negativity and energy balance", () => {
    const model = new J2PlasticityModel(defaultParams);
    const state0 = MaterialState.createInitial(6);
    const res = model.updateConstitutive([0.004, -0.0012, -0.0012, 0, 0, 0], state0);

    const state1 = new MaterialState({
      ...state0,
      stress: res.stress,
      totalStrain: [0.004, -0.0012, -0.0012, 0, 0, 0],
      elasticStrain: res.elasticStrain,
      plasticStrain: res.plasticStrain,
      equivalentPlasticStrain: res.equivalentPlasticStrain,
      plasticDissipation: res.plasticDissipationIncrement,
      elasticEnergy: res.elasticEnergy,
      materialStatus: res.materialStatus
    });

    const audit = IndependentPlasticWorkAudit.auditHistory([state0, state1]);
    expect(audit.isValid).toBe(true);
    expect(audit.isDissipationNonNegative).toBe(true);
    expect(audit.totalPlasticWork).toBeGreaterThan(0);
  });

  it("11. Verifies MaterialPoint commit and revert semantics", () => {
    const state0 = MaterialState.createInitial(6);
    const mp = new MaterialPoint("E1", 0, [0, 0, 0], 1.0, 1.0, state0);

    const trial = state0.clone();
    trial.stress[0] = 300e6;
    trial.equivalentPlasticStrain = 0.002;
    mp.setTrialState(trial);

    // Revert before commit
    mp.revert();
    expect(mp.getTrialState().equivalentPlasticStrain).toBe(0);

    // Set trial and commit
    mp.setTrialState(trial);
    mp.commit();
    expect(mp.getCommittedState().equivalentPlasticStrain).toBe(0.002);
  });

  it("12. Verifies cryptographic state serialization and hash integrity", () => {
    const state = MaterialState.createInitial(6);
    state.stress[0] = 275e6;
    state.equivalentPlasticStrain = 0.0015;
    state.updateHash();

    const serialized = MaterialStateSerializer.serialize(state);
    const deserialized = MaterialStateSerializer.deserialize(serialized);
    expect(deserialized.stateHash).toBe(state.stateHash);
    expect(deserialized.stress[0]).toBe(275e6);
  });

  it("13. Verifies substepping controller executes partitioned large strain increments", () => {
    const model = new J2PlasticityModel(defaultParams);
    const state0 = MaterialState.createInitial(6);
    const controller = new MaterialSubstepController(model);

    const subRes = controller.executeSubsteppedUpdate([0.01, -0.003, -0.003, 0, 0, 0], state0, 10);
    expect(subRes.converged).toBe(true);
    expect(subRes.substepsCount).toBe(10);
    expect(subRes.substepRecords).toHaveLength(10);
    expect(subRes.totalPlasticDissipation).toBeGreaterThan(0);
  });

  it("14. Solves elastoplastic structural system with Newton-Raphson load stepping", () => {
    const model1D = new J2PlasticityModel({
      E: 200e9,
      nu: 0.3,
      yieldStress: 200e6,
      hardeningModulus: 20e9,
      planeState: '1D'
    });

    const nodes: NonlinearNode[] = [
      { id: 'N0', index: 0, coordinates: [0.0] },
      { id: 'N1', index: 1, coordinates: [1.0] }
    ];

    const mp = new MaterialPoint("BAR_01", 0, [0.5], 1.0, 0.5, MaterialState.createInitial(1));
    const elements: NonlinearElement[] = [
      {
        id: 'BAR_01',
        type: 'BAR2',
        nodeIds: ['N0', 'N1'],
        area: 0.01,
        materialModel: model1D,
        materialPoints: [mp]
      }
    ];

    const system = new NonlinearStructuralSystem(nodes, elements, 1);
    const solver = new NewtonRaphsonStructuralSolver({ loadSteps: 5, maxIterationsPerStep: 20 });

    const targetForce = [0, 2.5e6]; // Exceeds 2.0e6 N yield load
    const constraints = [{ nodeId: 'N0', dofIndex: 0, value: 0.0 }];

    const sol = solver.solve(system, targetForce, constraints);
    expect(sol.converged).toBe(true);
    expect(sol.verdict).toBe("NONLINEAR_CONVERGED");
    expect(sol.plasticityEngaged).toBe(true);
    expect(sol.displacements[1]).toBeGreaterThan(0.001); // Beyond elastic displacement (0.001 m)
  });

  it("15. Passes complete adversarial parameter and corruption test battery", () => {
    const advReport = MaterialAdversarialSuite.runAllAdversarialTests();
    expect(advReport.allPassed).toBe(true);
    expect(advReport.failedTests).toBe(0);
  });
});
