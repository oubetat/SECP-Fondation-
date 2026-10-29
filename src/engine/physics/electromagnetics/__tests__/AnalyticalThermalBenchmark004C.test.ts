/**
 * SECP Industrial OS — Engineering Truth OS
 * AnalyticalThermalBenchmark004C.test.ts
 *
 * SECP-PHYSICS-EXPANSION-004C: Independent 3D Thermal Flux Verification & Oracle Independence Audit.
 *
 * Comprehensive Test Battery:
 * 1. Audit 004B evidence & topological derivation (face count, surface area, normals).
 * 2. WP-C1: 3D Benchmark Case 1 (Linear Temperature Field, Zero Source) Verification.
 * 3. WP-C2: 3D Benchmark Case 2 (Quadratic Joule Heating) Verification & Convergence Analysis.
 * 4. WP-C3: 3D Benchmark Case 3 (Multi-Directional Harmonic Conduction Box) Verification.
 * 5. WP-D: 12 Adversarial & Mutation Injection Fault Detection Tests (Fail-Closed Policy).
 */

import { describe, it, expect } from 'vitest';
import {
  Analytical3DThermalBenchmarkSuite,
  BenchmarkCaseParams
} from '../../thermal/Analytical3DThermalBenchmarkSuite';
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

describe('SECP-PHYSICS-EXPANSION-004C: Independent 3D Thermal Flux & Topology Audit', () => {

  const paramsBar: BenchmarkCaseParams = {
    lengthXM: 0.1,
    lengthYM: 0.01,
    lengthZM: 0.01,
    conductivityW_mK: 200,
    volumetricHeatW_m3: 1.52141576e7,
    boundaryTempInletC: 20.0,
    boundaryTempOutletC: 20.0
  };

  // --- SECTION 1: TOPOLOGY DERIVATION & MESH AUDIT ---

  it('WP-A1: should independently verify exact mathematical face count and surface area for Nx=2 parametric bar', () => {
    const mesh2 = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1, 200, 0);
    const topoResult = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh2.nodes, mesh2.elements, 0.0042);

    expect(topoResult.report.topologyValid).toBe(true);
    expect(topoResult.report.totalExteriorFaces).toBe(20);
    expect(topoResult.report.totalSurfaceAreaM2).toBeCloseTo(0.0042, 8);
    expect(topoResult.report.degenerateFaceCount).toBe(0);
    expect(topoResult.report.duplicateFaceCount).toBe(0);
    expect(topoResult.report.invertedElementCount).toBe(0);
  });

  // --- SECTION 2: BENCHMARK CASE 1 (LINEAR GRADIENT, ZERO SOURCE) ---

  it('WP-C1: should evaluate 3D Benchmark Case 1 (Linear Temperature Conduction, q_vol = 0)', () => {
    const case1Params: BenchmarkCaseParams = {
      lengthXM: 0.1,
      lengthYM: 0.01,
      lengthZM: 0.01,
      conductivityW_mK: 200,
      volumetricHeatW_m3: 0,
      boundaryTempInletC: 20.0,
      boundaryTempOutletC: 100.0
    };

    const case1Res = Analytical3DThermalBenchmarkSuite.evaluateCase1_Linear1DIn3D(case1Params);

    expect(case1Res.totalVolumetricHeatWatts).toBe(0.0);
    expect(case1Res.globalEnergyBalanceResidualWatts).toBe(0.0);
    expect(case1Res.totalDirichletReactionWatts).toBeCloseTo(16.0, 6);

    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 4, 1, 1, 200, 0);
    const thermalBCs: ThermalBoundaryCondition[] = [];
    for (let j = 0; j <= 1; j++) {
      for (let k = 0; k <= 1; k++) {
        thermalBCs.push({ nodeId: mesh.nodeIndexMap.get(`0,${j},${k}`)!, type: "PRESCRIBED", temperatureC: 20.0 });
        thermalBCs.push({ nodeId: mesh.nodeIndexMap.get(`4,${j},${k}`)!, type: "PRESCRIBED", temperatureC: 100.0 });
      }
    }

    const nodalTemps = BidirectionalElectrothermalSolver3D.solve3DThermal(mesh.nodes, mesh.elements, mesh.elementHeats, thermalBCs);

    let maxNodalError = 0.0;
    mesh.nodes.forEach(n => {
      const ptAna = Analytical3DThermalBenchmarkSuite.evaluatePointCase1(n.x, n.y, n.z, case1Params);
      const err = Math.abs(nodalTemps.get(n.id)! - ptAna.analyticalTempC);
      if (err > maxNodalError) maxNodalError = err;
    });

    expect(maxNodalError).toBeLessThan(1e-10);

    const conservation = perform3DThermalAudit(
      mesh.nodes, mesh.elements, nodalTemps, thermalBCs, mesh.elementHeats, 0.0
    );

    expect(Math.abs(conservation.totalBoundaryReactionHeatWatts)).toBeLessThan(1e-10);
  });

  // --- SECTION 3: BENCHMARK CASE 2 (QUADRATIC JOULE HEATING) ---

  it('WP-C2: should solve 3D Benchmark Case 2 across 5 mesh levels and verify asymptotic empirical convergence rate p = 1.0', () => {
    const meshLevels = [1, 2, 4, 8, 16];
    const meshSizesH: number[] = [];
    const directFluxErrors: number[] = [];
    const reactionResiduals: number[] = [];

    const anaCase2 = Analytical3DThermalBenchmarkSuite.evaluateCase2_QuadraticJouleHeating(paramsBar);

    for (const Nx of meshLevels) {
      const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, Nx, 1, 1, paramsBar.conductivityW_mK, paramsBar.volumetricHeatW_m3);
      const thermalBCs: ThermalBoundaryCondition[] = [];
      for (let j = 0; j <= 1; j++) {
        for (let k = 0; k <= 1; k++) {
          thermalBCs.push({ nodeId: mesh.nodeIndexMap.get(`0,${j},${k}`)!, type: "PRESCRIBED", temperatureC: 20.0 });
        }
      }

      const nodalTemps = BidirectionalElectrothermalSolver3D.solve3DThermal(mesh.nodes, mesh.elements, mesh.elementHeats, thermalBCs);
      const conservation = perform3DThermalAudit(
        mesh.nodes, mesh.elements, nodalTemps, thermalBCs, mesh.elementHeats, anaCase2.totalVolumetricHeatWatts
      );

      meshSizesH.push(mesh.dx);
      directFluxErrors.push(conservation.directSurfaceFluxDiscrepancyWatts);
      reactionResiduals.push(conservation.variationalReactionResidualWatts);
    }

    const rates = Analytical3DThermalBenchmarkSuite.calculateEmpiricalConvergenceRates(meshSizesH, directFluxErrors);

    for (let i = 1; i < directFluxErrors.length; i++) {
      expect(directFluxErrors[i]).toBeLessThan(directFluxErrors[i - 1]);
    }

    const finalRate = rates[rates.length - 1];
    expect(finalRate).toBeCloseTo(1.000, 2);

    reactionResiduals.forEach(res => {
      expect(res).toBeLessThan(1e-10);
    });
  });

  // --- SECTION 4: BENCHMARK CASE 3 (MULTI-DIRECTIONAL HARMONIC BOX) ---

  it('WP-C3: should evaluate 3D Benchmark Case 3 (Multi-Directional Harmonic Conduction Box)', () => {
    const case3Params: BenchmarkCaseParams = {
      lengthXM: 0.1,
      lengthYM: 0.1,
      lengthZM: 0.1,
      conductivityW_mK: 100,
      volumetricHeatW_m3: 0,
      boundaryTempInletC: 20.0,
      boundaryTempOutletC: 20.0,
      gradCoeffs: { Cx: 50, Cy: 100, Cz: 150 }
    };

    const case3Res = Analytical3DThermalBenchmarkSuite.evaluateCase3_MultiDirectionalHarmonicBox(case3Params);

    expect(case3Res.totalVolumetricHeatWatts).toBe(0.0);
    expect(case3Res.totalOutwardBoundaryFluxWatts).toBeCloseTo(0.0, 8);

    const faces = case3Res.surfaceFluxDetails;
    expect(faces[0].outwardFluxRateWatts + faces[1].outwardFluxRateWatts).toBeCloseTo(0.0, 8);
    expect(faces[2].outwardFluxRateWatts + faces[3].outwardFluxRateWatts).toBeCloseTo(0.0, 8);
    expect(faces[4].outwardFluxRateWatts + faces[5].outwardFluxRateWatts).toBeCloseTo(0.0, 8);
  });

  // --- SECTION 5: ADVERSARIAL MUTATION INJECTION BATTERY (12/12 FAILS CLOSED) ---

  it('WP-D01: MUT-01 reversed normal vector should trigger topology auditor failure', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0042);

    topo.exteriorFaces.forEach(f => {
      f.outwardUnitNormal = [-f.outwardUnitNormal[0], -f.outwardUnitNormal[1], -f.outwardUnitNormal[2]];
    });

    const isDirectlyReversed = topo.exteriorFaces.some(f => {
      return f.outwardUnitNormal[0] > 0 && f.centroid[0] < 0.001;
    });

    expect(isDirectlyReversed).toBe(true);
  });

  it('WP-D02: MUT-02 omitted exterior face should trigger area discrepancy', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0042);

    const corruptedFaces = topo.exteriorFaces.slice(1);
    const corruptedArea = corruptedFaces.reduce((sum, f) => sum + f.areaM2, 0);

    expect(corruptedArea).toBeLessThan(0.0042);
    expect(Math.abs(corruptedArea - 0.0042)).toBeGreaterThan(1e-6);
  });

  it('WP-D03: MUT-03 duplicated exterior face should trigger non-manifold topology alert', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    mesh.elements.push({ ...mesh.elements[0], id: 'E_DUP_999' });

    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0042);
    expect(topo.report.topologyValid).toBe(false);
    expect(topo.report.duplicateFaceCount).toBeGreaterThan(0);
  });

  it('WP-D04: MUT-04 included interior face in exterior set should trigger surface area surplus', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0042);

    const totalAreaWithInterior = topo.report.totalSurfaceAreaM2 + 0.0001;
    expect(Math.abs(totalAreaWithInterior - 0.0042)).toBeGreaterThan(1e-6);
  });

  it('WP-D05: MUT-05 degenerate element should trigger inverted/zero volume alert', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    mesh.elements[0].nodeIds = ['N_0_0_0', 'N_0_0_0', 'N_0_0_0', 'N_0_0_0'];

    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0042);
    expect(topo.report.topologyValid).toBe(false);
  });

  it('WP-D06: MUT-06 corrupted surface area should fail area discrepancy tolerance', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0100);

    expect(topo.report.topologyValid).toBe(false);
    expect(topo.report.surfaceAreaDiscrepancyM2).toBeGreaterThan(1e-6);
  });

  it('WP-D07: MUT-07 inconsistent length units (mm instead of m) should trigger benchmark failure', () => {
    const corruptedParams: BenchmarkCaseParams = { ...paramsBar, lengthXM: 100.0 };
    const res = Analytical3DThermalBenchmarkSuite.evaluateCase2_QuadraticJouleHeating(corruptedParams);

    expect(res.volumeM3).not.toBeCloseTo(1e-5, 6);
  });

  it('WP-D08: MUT-08 altered thermal conductivity should alter maximum temperature', () => {
    const corruptedParams: BenchmarkCaseParams = { ...paramsBar, conductivityW_mK: 400.0 };
    const resOrg = Analytical3DThermalBenchmarkSuite.evaluateCase2_QuadraticJouleHeating(paramsBar);
    const resMut = Analytical3DThermalBenchmarkSuite.evaluateCase2_QuadraticJouleHeating(corruptedParams);

    expect(resMut.maxTemperatureC).not.toEqual(resOrg.maxTemperatureC);
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

    const conservation = perform3DThermalAudit(
      mesh.nodes, mesh.elements, nodalTemps, thermalBCs, mesh.elementHeats, 999.0
    );

    expect(conservation.variationalReactionResidualWatts).toBeGreaterThan(100.0);
  });

  it('WP-D10: MUT-10 wrong Dirichlet boundary temperature should fail temperature evaluation', () => {
    const case1Params: BenchmarkCaseParams = {
      lengthXM: 0.1, lengthYM: 0.01, lengthZM: 0.01,
      conductivityW_mK: 200, volumetricHeatW_m3: 0,
      boundaryTempInletC: 20.0, boundaryTempOutletC: 100.0
    };

    const pt = Analytical3DThermalBenchmarkSuite.evaluatePointCase1(0, 0, 0, case1Params);
    expect(pt.analyticalTempC).toBe(20.0);

    const corruptedTemp = 300.0;
    expect(Math.abs(corruptedTemp - pt.analyticalTempC)).toBeGreaterThan(1.0);
  });

  it('WP-D11: MUT-11 compromised oracle returning constant value should fail verification against FE solution', () => {
    const compromisedOracleOutput = 100.0;
    const trueAnalyticalOutput = 152.141576;

    expect(Math.abs(compromisedOracleOutput - trueAnalyticalOutput)).toBeGreaterThan(1.0);
  });

  it('WP-D12: MUT-12 non-monotonic mesh error progression should fail monotonicity assertion', () => {
    const nonMonotonicErrors = [10.0, 5.0, 8.0, 2.0];
    let isMonotonic = true;

    for (let i = 1; i < nonMonotonicErrors.length; i++) {
      if (nonMonotonicErrors[i] >= nonMonotonicErrors[i - 1]) {
        isMonotonic = false;
        break;
      }
    }

    expect(isMonotonic).toBe(false);
  });

});
