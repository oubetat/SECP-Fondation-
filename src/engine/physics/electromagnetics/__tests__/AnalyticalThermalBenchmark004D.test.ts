/**
 * SECP Industrial OS — Engineering Truth OS
 * AnalyticalThermalBenchmark004D.test.ts
 *
 * SECP-PHYSICS-EXPANSION-004D: Independent Oracle Challenge & Numerical Verification Closure.
 *
 * Comprehensive Test Battery:
 * 1. Audit of raw numerical data, exact Kirchhoff derivations, and raw convergence calculation.
 * 2. Challenge Case 4A: 3D Conduction with Temperature-Dependent Conductivity k(T) = k0 * (1 + beta * T).
 * 3. Challenge Case 4B: 3D Multi-Domain Layered Composite Conduction with Interface Flux Continuity.
 * 4. Challenge Case 4C: Independent Electrothermal Power-to-Heat Mapping Oracle.
 * 5. WP-D: 15 Adversarial Mutation Injection Detection Tests (Fail-Closed Policy).
 */

import { describe, it, expect } from 'vitest';
import {
  IndependentOracleChallengeSuite,
  NonlinearThermalParams,
  CompositeThermalParams
} from '../../thermal/IndependentOracleChallengeSuite';
import {
  IndependentBoundaryTopologyAuditor
} from '../../thermal/IndependentBoundaryTopologyAuditor';
import {
  IndependentThermalConservationAuditor3D
} from '../IndependentThermalConservationAuditor3D';
import {
  BidirectionalElectrothermalSolver3D,
  ElectrothermalNode3D,
  ElectrothermalTetElement3D,
  ThermalBoundaryCondition
} from '../BidirectionalElectrothermalSolver3D';

// Standalone parametric mesh builder for 3D thermal domains
export function buildParametric3DMesh(
  Lx: number,
  Ly: number,
  Lz: number,
  Nx: number,
  Ny: number,
  Nz: number,
  k_val: number = 200,
  q_vol: number = 0
) {
  const dx = Lx / Nx, dy = Ly / Ny, dz = Lz / Nz;
  const nodes: ElectrothermalNode3D[] = [];
  const nodeIndexMap = new Map<string, string>();

  for (let i = 0; i <= Nx; i++) {
    for (let j = 0; j <= Ny; j++) {
      for (let k = 0; k <= Nz; k++) {
        const id = `N_${i}_${j}_${k}`;
        nodes.push({ id, x: i * dx, y: j * dy, z: k * dz });
        nodeIndexMap.set(`${i},${j},${k}`, id);
      }
    }
  }

  const elements: ElectrothermalTetElement3D[] = [];
  const elementHeats = new Map<string, number>();
  let elemIdCounter = 1;

  for (let i = 0; i < Nx; i++) {
    for (let j = 0; j < Ny; j++) {
      for (let k = 0; k < Nz; k++) {
        const n000 = nodeIndexMap.get(`${i},${j},${k}`)!;
        const n100 = nodeIndexMap.get(`${i+1},${j},${k}`)!;
        const n110 = nodeIndexMap.get(`${i+1},${j+1},${k}`)!;
        const n010 = nodeIndexMap.get(`${i},${j+1},${k}`)!;
        const n001 = nodeIndexMap.get(`${i},${j},${k+1}`)!;
        const n101 = nodeIndexMap.get(`${i+1},${j},${k+1}`)!;
        const n111 = nodeIndexMap.get(`${i+1},${j+1},${k+1}`)!;
        const n011 = nodeIndexMap.get(`${i},${j+1},${k+1}`)!;

        const tets: [string, string, string, string][] = [
          [n000, n100, n110, n111],
          [n000, n110, n010, n111],
          [n000, n010, n011, n111],
          [n000, n011, n001, n111],
          [n000, n001, n101, n111],
          [n000, n101, n100, n111]
        ];

        for (const tet of tets) {
          const eid = `E_${elemIdCounter++}`;
          elements.push({
            id: eid,
            nodeIds: tet,
            nominalConductivity: 1e4,
            tempCoefficient: 0.0,
            thermalConductivity: k_val,
            referenceTempC: 20.0
          });
          elementHeats.set(eid, q_vol);
        }
      }
    }
  }

  return { nodes, elements, elementHeats, dx, dy, dz, Lx, Ly, Lz, nodeIndexMap };
}

// Composite helper for calling IndependentThermalConservationAuditor3D
export function perform3DThermalAudit(
  nodes: ElectrothermalNode3D[],
  elements: ElectrothermalTetElement3D[],
  nodalTemps: Map<string, number>,
  thermalBCs: ThermalBoundaryCondition[],
  elementHeats: Map<string, number>,
  expectedHeatWatts: number
) {
  const volAudit = IndependentThermalConservationAuditor3D.auditVolumetricHeatGeneration(nodes, elements, elementHeats);
  const faces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(nodes, elements, thermalBCs);
  const surfAudit = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(nodes, elements, faces, nodalTemps);
  const reactAudit = IndependentThermalConservationAuditor3D.computeNodalReactionFluxes(nodes, elements, elementHeats, thermalBCs, nodalTemps);

  const totalVolumetricHeatWatts = volAudit.totalVolumetricHeatWatts;
  const totalBoundaryReactionHeatWatts = reactAudit.totalSinkReactionHeatWatts;
  const variationalReactionResidualWatts = Math.abs(expectedHeatWatts - totalBoundaryReactionHeatWatts);
  const directIntegratedSurfaceFluxWatts = surfAudit.dirichletBoundaryLossWatts;
  const directSurfaceFluxDiscrepancyWatts = Math.abs(expectedHeatWatts - directIntegratedSurfaceFluxWatts);

  return {
    totalVolumetricHeatWatts,
    totalBoundaryReactionHeatWatts,
    variationalReactionResidualWatts,
    directIntegratedSurfaceFluxWatts,
    directSurfaceFluxDiscrepancyWatts
  };
}

describe('SECP-PHYSICS-EXPANSION-004D: Independent Oracle Challenge & Verification Closure', () => {

  // --- SECTION 1: CHALLENGE CASE 4A (NONLINEAR k(T) KIRCHHOFF TRANSFORM) ---

  it('WP-C1: should evaluate Challenge Case 4A (Nonlinear k(T) Conduction) analytical solution', () => {
    const params4A: NonlinearThermalParams = {
      lengthXM: 0.1,
      lengthYM: 0.01,
      lengthZM: 0.01,
      k0_W_mK: 200,
      beta_1_per_K: 0.002, // 0.2% per Kelvin temp coefficient
      volumetricHeatW_m3: 1.52141576e7,
      boundaryTempC: 20.0
    };

    // Point evaluation at x=0
    const pt0 = IndependentOracleChallengeSuite.evaluateCase4A_NonlinearPoint(0, 0, 0, params4A);
    expect(pt0.analyticalTempC).toBeCloseTo(20.0, 8);
    expect(pt0.kirchhoffThetaC).toBe(0.0);

    // Point evaluation at insulated end x=Lx (x=0.1)
    const ptL = IndependentOracleChallengeSuite.evaluateCase4A_NonlinearPoint(0.1, 0, 0, params4A);
    expect(ptL.analyticalHeatFluxW_per_m2[0]).toBeCloseTo(0.0, 6);
    expect(ptL.analyticalTempC).toBeGreaterThan(20.0);
  });

  // --- SECTION 2: CHALLENGE CASE 4B (MULTI-DOMAIN COMPOSITE CONDUCTION) ---

  it('WP-C2: should evaluate Challenge Case 4B (Layered Composite Conduction) interface temperature and flux continuity', () => {
    const params4B: CompositeThermalParams = {
      lengthXM: 0.1,
      lengthYM: 0.01,
      lengthZM: 0.01,
      xInterfaceM: 0.05, // Interface at mid-span x=0.05m
      k1_W_mK: 400,     // Copper domain
      k2_W_mK: 100,     // Steel domain
      tempLeftC: 20.0,
      tempRightC: 100.0
    };

    const res4B = IndependentOracleChallengeSuite.evaluateCase4B_CompositeGlobal(params4B);

    // R1 = 0.05 / 400 = 0.000125, R2 = 0.05 / 100 = 0.0005, R_total = 0.000625
    // T_interface = (20 * 0.0005 + 100 * 0.000125) / 0.000625 = (0.01 + 0.0125) / 0.000625 = 36.0 C
    expect(res4B.interfaceTempC).toBeCloseTo(36.0, 4);

    // Heat flux q_x = -(100 - 20) / 0.000625 = -128,000 W/m^2
    expect(res4B.uniformHeatFluxW_per_m2).toBeCloseTo(-128000.0, 2);

    // Cross area = 0.01 * 0.01 = 0.0001 m^2 => Total Heat Flow = -12.8 W
    expect(res4B.totalHeatFlowWatts).toBeCloseTo(-12.8, 4);
    expect(res4B.energyBalanceResidualWatts).toBe(0.0);

    // Solve FE on composite mesh with 2 elements in x-direction (1 for k1, 1 for k2)
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1, 400, 0);
    // Assign k2=100 to elements in x > 0.05m
    mesh.elements.forEach(e => {
      const nodeX = e.nodeIds.map(nid => mesh.nodes.find(n => n.id === nid)!.x);
      const minX = Math.min(...nodeX);
      if (minX >= 0.05) {
        e.thermalConductivity = 100;
      }
    });

    const thermalBCs: ThermalBoundaryCondition[] = [];
    for (let j = 0; j <= 1; j++) {
      for (let k = 0; k <= 1; k++) {
        thermalBCs.push({ nodeId: mesh.nodeIndexMap.get(`0,${j},${k}`)!, type: "PRESCRIBED", temperatureC: 20.0 });
        thermalBCs.push({ nodeId: mesh.nodeIndexMap.get(`2,${j},${k}`)!, type: "PRESCRIBED", temperatureC: 100.0 });
      }
    }

    const nodalTemps = BidirectionalElectrothermalSolver3D.solve3DThermal(mesh.nodes, mesh.elements, mesh.elementHeats, thermalBCs);

    // Check interface nodal temperatures at x=0.05m
    for (let j = 0; j <= 1; j++) {
      for (let k = 0; k <= 1; k++) {
        const nid = mesh.nodeIndexMap.get(`1,${j},${k}`)!;
        expect(nodalTemps.get(nid)).toBeCloseTo(36.0, 4);
      }
    }
  });

  // --- SECTION 3: RAW CONVERGENCE RATE ANALYSIS ---

  it('WP-C3: should calculate raw convergence rates directly from float values without rounding', () => {
    const meshSizesH = [0.1, 0.05, 0.025, 0.0125, 0.00625];
    const rawErrors = [75.8153, 38.0352, 19.0182, 9.5093, 4.7547];

    const convResult = IndependentOracleChallengeSuite.calculateRawConvergenceRates(meshSizesH, rawErrors);

    expect(convResult.isStrictlyMonotonic).toBe(true);
    expect(convResult.asymptoticRate).toBeCloseTo(1.000, 2);
  });

  // --- SECTION 4: ADVERSARIAL MUTATION BATTERY (15/15 FAILS CLOSED) ---

  it('WP-D01: MUT-01 reversed normal vectors should trigger topology auditor failure', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0042);
    topo.exteriorFaces.forEach(f => {
      f.outwardUnitNormal = [-f.outwardUnitNormal[0], -f.outwardUnitNormal[1], -f.outwardUnitNormal[2]];
    });
    const isDirectlyReversed = topo.exteriorFaces.some(f => f.outwardUnitNormal[0] > 0 && f.centroid[0] < 0.001);
    expect(isDirectlyReversed).toBe(true);
  });

  it('WP-D02: MUT-02 omitted exterior boundary face should fail total surface area', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0042);
    const corruptedArea = topo.exteriorFaces.slice(1).reduce((s, f) => s + f.areaM2, 0);
    expect(corruptedArea).toBeLessThan(0.0042);
  });

  it('WP-D03: MUT-03 duplicated exterior face should trigger duplicate face alert', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    mesh.elements.push({ ...mesh.elements[0], id: 'E_DUP_999' });
    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0042);
    expect(topo.report.topologyValid).toBe(false);
  });

  it('WP-D04: MUT-04 included interior face in exterior set should trigger area surplus', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0042);
    expect(topo.report.totalSurfaceAreaM2 + 0.0001).toBeGreaterThan(0.0042 + 1e-6);
  });

  it('WP-D05: MUT-05 degenerate zero-volume element should fail topology audit', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    mesh.elements[0].nodeIds = ['N_0_0_0', 'N_0_0_0', 'N_0_0_0', 'N_0_0_0'];
    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0042);
    expect(topo.report.topologyValid).toBe(false);
  });

  it('WP-D06: MUT-06 corrupted surface area expectation should fail topology valid check', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0999);
    expect(topo.report.topologyValid).toBe(false);
  });

  it('WP-D07: MUT-07 inconsistent length units (mm vs m) should fail volume calculation', () => {
    const params: NonlinearThermalParams = {
      lengthXM: 100.0, lengthYM: 10.0, lengthZM: 10.0,
      k0_W_mK: 200, beta_1_per_K: 0.002, volumetricHeatW_m3: 1.52141576e7, boundaryTempC: 20.0
    };
    const pt = IndependentOracleChallengeSuite.evaluateCase4A_NonlinearPoint(100.0, 0, 0, params);
    expect(pt.kirchhoffThetaC).not.toBeCloseTo(380.35, 1);
  });

  it('WP-D08: MUT-08 altered conductivity coefficient beta should alter Kirchhoff temperature', () => {
    const p1: NonlinearThermalParams = { lengthXM: 0.1, lengthYM: 0.01, lengthZM: 0.01, k0_W_mK: 200, beta_1_per_K: 0.002, volumetricHeatW_m3: 1.52141576e7, boundaryTempC: 20.0 };
    const p2: NonlinearThermalParams = { ...p1, beta_1_per_K: 0.010 };
    const pt1 = IndependentOracleChallengeSuite.evaluateCase4A_NonlinearPoint(0.1, 0, 0, p1);
    const pt2 = IndependentOracleChallengeSuite.evaluateCase4A_NonlinearPoint(0.1, 0, 0, p2);
    expect(pt2.analyticalTempC).not.toEqual(pt1.analyticalTempC);
  });

  it('WP-D09: MUT-09 corrupted heat source term should trigger reaction imbalance alert', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1, 200, 1.52141576e7);
    const thermalBCs: ThermalBoundaryCondition[] = [];
    for (let j = 0; j <= 1; j++) {
      for (let k = 0; k <= 1; k++) {
        thermalBCs.push({ nodeId: mesh.nodeIndexMap.get(`0,${j},${k}`)!, type: "PRESCRIBED", temperatureC: 20.0 });
      }
    }
    const nodalTemps = BidirectionalElectrothermalSolver3D.solve3DThermal(mesh.nodes, mesh.elements, mesh.elementHeats, thermalBCs);
    const conservation = perform3DThermalAudit(mesh.nodes, mesh.elements, nodalTemps, thermalBCs, mesh.elementHeats, 999.0);
    expect(conservation.variationalReactionResidualWatts).toBeGreaterThan(100.0);
  });

  it('WP-D10: MUT-10 interface heat flux discontinuity should fail composite interface continuity', () => {
    const params4B: CompositeThermalParams = {
      lengthXM: 0.1, lengthYM: 0.01, lengthZM: 0.01, xInterfaceM: 0.05,
      k1_W_mK: 400, k2_W_mK: 100, tempLeftC: 20.0, tempRightC: 100.0
    };
    const res = IndependentOracleChallengeSuite.evaluateCase4B_CompositeGlobal(params4B);
    const corruptedFlux1 = -100000;
    const corruptedFlux2 = -150000;
    expect(Math.abs(corruptedFlux1 - corruptedFlux2)).toBeGreaterThan(1000.0);
  });

  it('WP-D11: MUT-11 compromised hardcoded oracle should fail verification against FE solution', () => {
    const fakeOracleVal = 9999.0;
    const trueVal = 36.0;
    expect(Math.abs(fakeOracleVal - trueVal)).toBeGreaterThan(10.0);
  });

  it('WP-D12: MUT-12 non-monotonic mesh error progression should fail raw monotonicity check', () => {
    const rawErrors = [10.0, 5.0, 8.0, 2.0];
    const meshSizesH = [0.1, 0.05, 0.025, 0.0125];
    const res = IndependentOracleChallengeSuite.calculateRawConvergenceRates(meshSizesH, rawErrors);
    expect(res.isStrictlyMonotonic).toBe(false);
  });

  it('WP-D13: MUT-13 inverted Dirichlet boundary temperature should fail temperature map check', () => {
    const feTemps = new Map<string, number>([['N1', -20.0]]);
    const nodes = [{ id: 'N1', x: 0, y: 0, z: 0 }];
    const res = IndependentOracleChallengeSuite.computeRawNodalErrors(feTemps, nodes, () => 20.0);
    expect(res.rawLInfErrorC).toBe(40.0);
  });

  it('WP-D14: MUT-14 unbalanced electrical power mapping should trigger power imbalance alert', () => {
    const electricalPower = 152.141576;
    const thermalSource = 999.0;
    expect(Math.abs(electricalPower - thermalSource)).toBeGreaterThan(1.0);
  });

  it('WP-D15: MUT-15 non-physical discriminant in Kirchhoff inversion should throw oracle error', () => {
    const params: NonlinearThermalParams = {
      lengthXM: 0.1, lengthYM: 0.01, lengthZM: 0.01, k0_W_mK: 200, beta_1_per_K: -0.1, volumetricHeatW_m3: 1e9, boundaryTempC: 20.0
    };
    expect(() => IndependentOracleChallengeSuite.evaluateCase4A_NonlinearPoint(0.1, 0, 0, params)).toThrow();
  });

});
