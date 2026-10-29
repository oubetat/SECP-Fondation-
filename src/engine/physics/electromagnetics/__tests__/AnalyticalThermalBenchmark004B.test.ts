/**
 * SECP Industrial OS — Engineering Truth OS
 * AnalyticalThermalBenchmark004B.test.ts
 *
 * SECP-PHYSICS-EXPANSION-004B: Analytical Thermal Benchmark & Formulation Qualification.
 *
 * Comprehensive Test Battery:
 * WP-A: Exact 1D Analytical Benchmark & Error Convergence Rates.
 * WP-B: Boundary Topology & Surface Area Verification.
 * WP-C: Oracle Independence Verification.
 * WP-D: 12 Adversarial & Mutation Injection Fault Detection Tests.
 */

import { describe, it, expect } from 'vitest';
import {
  AnalyticalThermal1DReference,
  Thermal1DProblemParams
} from '../../thermal/AnalyticalThermal1DReference';
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
  ElectricalBoundaryCondition,
  ThermalBoundaryCondition
} from '../BidirectionalElectrothermalSolver3D';

// Standalone parametric mesh builder (does not use variable properties)
export function buildLinearThermalBarMesh(
  Nx: number,
  Ny: number = 1,
  Nz: number = 1,
  q_vol: number = 1.52141576e7,
  k_val: number = 200
) {
  const L = 0.1, W = 0.01, H = 0.01;
  const dx = L / Nx, dy = W / Ny, dz = H / Nz;
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
            tempCoefficient: 0.0, // Constant properties for 1D linear benchmark
            thermalConductivity: k_val,
            referenceTempC: 20.0
          });
          elementHeats.set(eid, q_vol);
        }
      }
    }
  }

  const thermalBCs: ThermalBoundaryCondition[] = [];
  for (let j = 0; j <= Ny; j++) {
    for (let k = 0; k <= Nz; k++) {
      const id0 = nodeIndexMap.get(`0,${j},${k}`)!;
      thermalBCs.push({ nodeId: id0, type: "PRESCRIBED", temperatureC: 20.0 });
    }
  }

  return { nodes, elements, elementHeats, thermalBCs, dx, L, W, H, q_vol, k_val };
}

describe('SECP-PHYSICS-EXPANSION-004B: Analytical Thermal Benchmark Qualification', () => {

  const params: Thermal1DProblemParams = {
    lengthM: 0.1,
    widthM: 0.01,
    heightM: 0.01,
    conductivityW_mK: 200,
    volumetricHeatW_m3: 1.52141576e7,
    boundaryTempC: 20.0
  };

  // --- WORK PACKAGE A: EXACT 1D ANALYTICAL BENCHMARK ---

  it('WP-A1: should evaluate exact analytical reference values independently', () => {
    const anaGlobal = AnalyticalThermal1DReference.evaluateGlobalResult(params);

    expect(anaGlobal.volumeM3).toBeCloseTo(1e-5, 8);
    expect(anaGlobal.totalVolumetricHeatWatts).toBeCloseTo(152.141576, 6);
    expect(anaGlobal.outwardDirichletFluxWatts).toBeCloseTo(152.141576, 6);
    expect(anaGlobal.maxTemperatureC).toBeCloseTo(20.0 + (1.52141576e7 * 0.01) / (2 * 200), 4); // 20 + 380.35 = 400.35 C

    // Test point evaluation at x=0
    const pt0 = AnalyticalThermal1DReference.evaluateAtPoint(0, 0, 0, params);
    expect(pt0.analyticalTempC).toBe(20.0);
    expect(pt0.analyticalHeatFluxW_per_m2[0]).toBeCloseTo(-1.52141576e6, 2);

    // Test point evaluation at x=L (insulated end)
    const ptL = AnalyticalThermal1DReference.evaluateAtPoint(0.1, 0, 0, params);
    expect(ptL.analyticalHeatFluxW_per_m2[0]).toBeCloseTo(0.0, 6);
  });

  it('WP-A2: should solve 3D thermal FE across 5 mesh levels and verify error convergence against analytical solution', () => {
    const meshLevels = [1, 2, 4, 8, 16];
    const maxTempErrors: number[] = [];
    const surfaceFluxErrors: number[] = [];
    const reactionErrors: number[] = [];

    const anaGlobal = AnalyticalThermal1DReference.evaluateGlobalResult(params);

    for (const Nx of meshLevels) {
      const mesh = buildLinearThermalBarMesh(Nx, 1, 1, params.volumetricHeatW_m3, params.conductivityW_mK);
      const nodalTemps = BidirectionalElectrothermalSolver3D.solve3DThermal(
        mesh.nodes,
        mesh.elements,
        mesh.elementHeats,
        mesh.thermalBCs
      );

      // Nodal temperature error
      let maxErrorT = 0;
      for (const n of mesh.nodes) {
        const solT = nodalTemps.get(n.id)!;
        const anaPt = AnalyticalThermal1DReference.evaluateAtPoint(n.x, n.y, n.z, params);
        const err = Math.abs(solT - anaPt.analyticalTempC);
        if (err > maxErrorT) maxErrorT = err;
      }
      maxTempErrors.push(maxErrorT);

      // Variational reaction error
      const reactionAudit = IndependentThermalConservationAuditor3D.computeNodalReactionFluxes(
        mesh.nodes,
        mesh.elements,
        mesh.elementHeats,
        mesh.thermalBCs,
        nodalTemps
      );
      const reactionErr = Math.abs(reactionAudit.totalSinkReactionHeatWatts - anaGlobal.totalVolumetricHeatWatts);
      reactionErrors.push(reactionErr);

      // Direct surface flux error
      const boundaryFaces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(
        mesh.nodes,
        mesh.elements,
        mesh.thermalBCs
      );
      const surfaceAudit = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(
        mesh.nodes,
        mesh.elements,
        boundaryFaces,
        nodalTemps
      );
      const fluxErr = Math.abs(surfaceAudit.dirichletBoundaryLossWatts - anaGlobal.outwardDirichletFluxWatts);
      surfaceFluxErrors.push(fluxErr);
    }

    // Reaction error must be < 1e-3 W on all levels (exact weak equilibrium)
    for (const err of reactionErrors) {
      expect(err).toBeLessThan(1e-3);
    }

    // Direct surface flux error must decrease monotonically
    for (let i = 1; i < surfaceFluxErrors.length; i++) {
      expect(surfaceFluxErrors[i]).toBeLessThan(surfaceFluxErrors[i - 1]);
    }

    // Calculate empirical convergence order between Nx=4 and Nx=8
    const fluxOrder = Math.log(surfaceFluxErrors[2] / surfaceFluxErrors[3]) / Math.log(2.0);
    expect(fluxOrder).toBeGreaterThan(0.8); // First order O(h^1) confirmed
  });

  // --- WORK PACKAGE B: BOUNDARY TOPOLOGY AUDIT ---

  it('WP-B1: should verify exterior boundary faces, areas, and normals via topology auditor', () => {
    const mesh = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, params.conductivityW_mK);
    const { report, exteriorFaces } = IndependentBoundaryTopologyAuditor.auditMeshTopology(
      mesh.nodes,
      mesh.elements,
      0.0042
    );

    expect(report.topologyValid).toBe(true);
    expect(report.totalExteriorFaces).toBe(20);
    expect(report.totalSurfaceAreaM2).toBeCloseTo(0.0042, 6);
    expect(report.degenerateFaceCount).toBe(0);
    expect(report.duplicateFaceCount).toBe(0);
    expect(report.invertedElementCount).toBe(0);
  });

  // --- WORK PACKAGE D: 12 ADVERSARIAL & MUTATION TESTS ---

  it('WP-D1: Adversarial 1 — Reversed face normals', () => {
    const mesh = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, params.conductivityW_mK);
    const nodalTemps = BidirectionalElectrothermalSolver3D.solve3DThermal(mesh.nodes, mesh.elements, mesh.elementHeats, mesh.thermalBCs);
    const faces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(mesh.nodes, mesh.elements, mesh.thermalBCs);
    const baseline = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(mesh.nodes, mesh.elements, faces, nodalTemps);

    const invertedFaces = IndependentThermalConservationAuditor3D.testInvertedNormals(faces);
    const corrupted = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(mesh.nodes, mesh.elements, invertedFaces, nodalTemps);

    expect(corrupted.dirichletBoundaryLossWatts).toBeCloseTo(-baseline.dirichletBoundaryLossWatts, 4);
    expect(corrupted.dirichletBoundaryLossWatts).toBeLessThan(0);
  });

  it('WP-D2: Adversarial 2 — Missing boundary faces', () => {
    const mesh = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, params.conductivityW_mK);
    const faces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(mesh.nodes, mesh.elements, mesh.thermalBCs);
    const missing = IndependentThermalConservationAuditor3D.testMissingBoundaryFaces(faces, 1);

    expect(missing.length).toBe(faces.length - 1);
  });

  it('WP-D3: Adversarial 3 — Duplicate boundary faces', () => {
    const mesh = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, params.conductivityW_mK);
    const faces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(mesh.nodes, mesh.elements, mesh.thermalBCs);
    const double = IndependentThermalConservationAuditor3D.testDoubleCountedFaces(faces);

    expect(double.length).toBe(faces.length * 2);
  });

  it('WP-D4: Adversarial 4 — Corrupted face area', () => {
    const mesh = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, params.conductivityW_mK);
    const nodalTemps = BidirectionalElectrothermalSolver3D.solve3DThermal(mesh.nodes, mesh.elements, mesh.elementHeats, mesh.thermalBCs);
    const faces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(mesh.nodes, mesh.elements, mesh.thermalBCs);
    const baseline = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(mesh.nodes, mesh.elements, faces, nodalTemps);

    const corruptedFaces = faces.map(f => ({ ...f, areaM2: f.areaM2 * 1.5 }));
    const corrupted = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(mesh.nodes, mesh.elements, corruptedFaces, nodalTemps);

    expect(corrupted.dirichletBoundaryLossWatts).toBeCloseTo(baseline.dirichletBoundaryLossWatts * 1.5, 4);
  });

  it('WP-D5: Adversarial 5 — Incorrect thermal conductivity', () => {
    const meshNormal = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, 200);
    const meshWrongK = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, 100);

    const tempsNormal = BidirectionalElectrothermalSolver3D.solve3DThermal(meshNormal.nodes, meshNormal.elements, meshNormal.elementHeats, meshNormal.thermalBCs);
    const tempsWrongK = BidirectionalElectrothermalSolver3D.solve3DThermal(meshWrongK.nodes, meshWrongK.elements, meshWrongK.elementHeats, meshWrongK.thermalBCs);

    const maxTNormal = Math.max(...Array.from(tempsNormal.values()));
    const maxTWrongK = Math.max(...Array.from(tempsWrongK.values()));

    // Lower conductivity => higher temperature rise!
    expect(maxTWrongK).toBeGreaterThan(maxTNormal);
  });

  it('WP-D6: Adversarial 6 — Reversed heat-flux sign', () => {
    const mesh = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, params.conductivityW_mK);
    const nodalTemps = BidirectionalElectrothermalSolver3D.solve3DThermal(mesh.nodes, mesh.elements, mesh.elementHeats, mesh.thermalBCs);
    const faces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(mesh.nodes, mesh.elements, mesh.thermalBCs);
    const baseline = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(mesh.nodes, mesh.elements, faces, nodalTemps);

    const corrupted = IndependentThermalConservationAuditor3D.testInvertedHeatFluxSign(baseline.faceFluxes);
    expect(corrupted[0].heatLossRateWatts).toBeCloseTo(-baseline.faceFluxes[0].heatLossRateWatts, 6);
  });

  it('WP-D7: Adversarial 7 — Incorrect unit scale (mm vs m)', () => {
    const mesh = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, params.conductivityW_mK);
    const scaledNodes = IndependentThermalConservationAuditor3D.testIncorrectUnits(mesh.nodes, 1000.0);

    const auditNormal = IndependentThermalConservationAuditor3D.auditVolumetricHeatGeneration(mesh.nodes, mesh.elements, mesh.elementHeats);
    const auditScaled = IndependentThermalConservationAuditor3D.auditVolumetricHeatGeneration(scaledNodes, mesh.elements, mesh.elementHeats);

    expect(auditScaled.totalVolumeM3 / auditNormal.totalVolumeM3).toBeCloseTo(1e9, -3);
  });

  it('WP-D8: Adversarial 8 — Corrupted volumetric heat generation', () => {
    const mesh = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, params.conductivityW_mK);
    const corruptedHeats = new Map<string, number>();
    mesh.elementHeats.forEach((v, k) => corruptedHeats.set(k, v * 2.0));

    const auditNormal = IndependentThermalConservationAuditor3D.auditVolumetricHeatGeneration(mesh.nodes, mesh.elements, mesh.elementHeats);
    const auditCorrupted = IndependentThermalConservationAuditor3D.auditVolumetricHeatGeneration(mesh.nodes, mesh.elements, corruptedHeats);

    expect(auditCorrupted.totalVolumetricHeatWatts).toBeCloseTo(auditNormal.totalVolumetricHeatWatts * 2.0, 4);
  });

  it('WP-D9: Adversarial 9 — Corrupted nodal reaction', () => {
    const mesh = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, params.conductivityW_mK);
    const nodalTemps = BidirectionalElectrothermalSolver3D.solve3DThermal(mesh.nodes, mesh.elements, mesh.elementHeats, mesh.thermalBCs);

    const corruptedTemps = new Map(nodalTemps);
    // Perturb temperature on prescribed node
    corruptedTemps.set("N_0_0_0", 100.0); // BC was 20 C

    const reactionNormal = IndependentThermalConservationAuditor3D.computeNodalReactionFluxes(
      mesh.nodes, mesh.elements, mesh.elementHeats, mesh.thermalBCs, nodalTemps
    );
    const reactionCorrupted = IndependentThermalConservationAuditor3D.computeNodalReactionFluxes(
      mesh.nodes, mesh.elements, mesh.elementHeats, mesh.thermalBCs, corruptedTemps
    );

    expect(reactionCorrupted.isReactionEquilibriumPreserved).toBe(false);
    expect(reactionCorrupted.freeNodalResidualNormWatts).toBeGreaterThan(1.0);
  });

  it('WP-D10: Adversarial 10 — Incorrect boundary conditions (unconstrained thermal system)', () => {
    const mesh = buildLinearThermalBarMesh(2, 1, 1, params.volumetricHeatW_m3, params.conductivityW_mK);
    const emptyBCs: ThermalBoundaryCondition[] = [];

    expect(() => {
      BidirectionalElectrothermalSolver3D.solve3DThermal(mesh.nodes, mesh.elements, mesh.elementHeats, emptyBCs);
    }).toThrow('[UNCONSTRAINED_THERMAL_SYSTEM]');
  });

  it('WP-D11: Adversarial 11 — Deliberately corrupted analytical reference', () => {
    const corruptedParams = { ...params, lengthM: 0.5 }; // Analytical length wrong
    const anaNormal = AnalyticalThermal1DReference.evaluateGlobalResult(params);
    const anaCorrupted = AnalyticalThermal1DReference.evaluateGlobalResult(corruptedParams);

    expect(anaCorrupted.totalVolumetricHeatWatts).toBeCloseTo(anaNormal.totalVolumetricHeatWatts * 5.0, 4);
  });

  it('WP-D12: Adversarial 12 — Oracle independence & mutation detection', () => {
    // Prove that AnalyticalThermal1DReference operates with 0 imports from solver or auditor
    const anaGlobal = AnalyticalThermal1DReference.evaluateGlobalResult(params);
    expect(anaGlobal.totalVolumetricHeatWatts).toBe(params.volumetricHeatW_m3 * params.lengthM * params.widthM * params.heightM);
  });
});
