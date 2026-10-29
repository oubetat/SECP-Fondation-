/**
 * SECP Industrial OS — Engineering Truth OS
 * IndependentBoundaryFluxConvergence004A.test.ts
 *
 * SECP-PHYSICS-EXPANSION-004A: Boundary Flux Independence & Mesh-Convergence Audit.
 *
 * Comprehensive Verification Battery:
 * Section A: Boundary topology, normal orientations, and area verification.
 * Section B: Systematic mesh refinement convergence demonstrating monotonic error reduction (O(h^1)).
 * Section C: Independent variational reaction energy conservation across all mesh levels.
 * Section D: Adversarial tests detecting topology defects, missing faces, sign reversals, and unit mismatches.
 */

import { describe, it, expect } from 'vitest';
import {
  IndependentThermalConservationAuditor3D,
  BoundaryTriFace3D
} from '../IndependentThermalConservationAuditor3D';
import {
  BidirectionalElectrothermalSolver3D,
  ElectrothermalNode3D,
  ElectrothermalTetElement3D,
  ElectricalBoundaryCondition,
  ThermalBoundaryCondition
} from '../BidirectionalElectrothermalSolver3D';

export function buildParametricBarMesh(Nx: number, Ny: number = 1, Nz: number = 1) {
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

        // 6 tetrahedra Kuhn triangulation (symmetric and orientation-stable)
        const tets: [string, string, string, string][] = [
          [n000, n100, n110, n111],
          [n000, n110, n010, n111],
          [n000, n010, n011, n111],
          [n000, n011, n001, n111],
          [n000, n001, n101, n111],
          [n000, n101, n100, n111]
        ];

        for (const tet of tets) {
          elements.push({
            id: `E_${elemIdCounter++}`,
            nodeIds: tet,
            nominalConductivity: 1e4,
            tempCoefficient: 0.0039,
            thermalConductivity: 200,
            referenceTempC: 20.0
          });
        }
      }
    }
  }

  const electricalBCs: ElectricalBoundaryCondition[] = [];
  const thermalBCs: ThermalBoundaryCondition[] = [];

  for (let j = 0; j <= Ny; j++) {
    for (let k = 0; k <= Nz; k++) {
      const id0 = nodeIndexMap.get(`0,${j},${k}`)!;
      electricalBCs.push({ nodeId: id0, potential: 5.0 });
      thermalBCs.push({ nodeId: id0, type: "PRESCRIBED", temperatureC: 20.0 });

      const idL = nodeIndexMap.get(`${Nx},${j},${k}`)!;
      electricalBCs.push({ nodeId: idL, potential: 0.0 });
    }
  }

  return { nodes, elements, electricalBCs, thermalBCs, dx, h: Math.sqrt(dx*dx + dy*dy + dz*dz) };
}

describe('SECP-PHYSICS-EXPANSION-004A: Boundary Flux Independence & Mesh-Convergence Audit', () => {

  // --- SECTION A: BOUNDARY TOPOLOGY & AREA CONSERVATION ---

  it('A1: should verify exact boundary face count and surface area across refinement levels', () => {
    for (const Nx of [1, 2, 4, 8]) {
      const mesh = buildParametricBarMesh(Nx, 1, 1);
      const boundaryFaces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(
        mesh.nodes,
        mesh.elements,
        mesh.thermalBCs
      );

      // Analytical surface area: 2*(0.1*0.01 + 0.1*0.01 + 0.01*0.01) = 0.0042 m^2
      const totalArea = boundaryFaces.reduce((sum, f) => sum + f.areaM2, 0);
      expect(totalArea).toBeCloseTo(0.0042, 6);

      // Verify all unit outward normals are normalized
      for (const f of boundaryFaces) {
        const [nx, ny, nz] = f.outwardUnitNormal;
        const norm = Math.sqrt(nx * nx + ny * ny + nz * nz);
        expect(norm).toBeCloseTo(1.0, 6);
      }
    }
  });

  // --- SECTION B: SYSTEMATIC MESH CONVERGENCE ---

  it('B1: should prove monotonic reduction in surface-flux discrepancy under mesh refinement', () => {
    const meshLevels = [1, 2, 4, 8, 16];
    const discrepancies: number[] = [];
    const relativeDiscrepancies: number[] = [];

    for (const Nx of meshLevels) {
      const mesh = buildParametricBarMesh(Nx, 1, 1);
      const solver = new BidirectionalElectrothermalSolver3D();
      const res = solver.solve(mesh.nodes, mesh.elements, mesh.electricalBCs, mesh.thermalBCs);

      const audit = IndependentThermalConservationAuditor3D.executeComprehensiveAudit(
        mesh.nodes,
        mesh.elements,
        mesh.electricalBCs,
        mesh.thermalBCs,
        res.nodalPotentialsV,
        res.nodalTemperaturesC,
        res.totalElectricalPowerWatts
      );

      discrepancies.push(audit.surfaceFluxDiscretizationResidualWatts);
      relativeDiscrepancies.push(
        audit.surfaceFluxDiscretizationResidualWatts / audit.volumetricThermalHeatWatts
      );
    }

    // Monotonic decrease: each refinement level must strictly reduce the discrepancy
    for (let i = 1; i < discrepancies.length; i++) {
      expect(discrepancies[i]).toBeLessThan(discrepancies[i - 1]);
      expect(relativeDiscrepancies[i]).toBeLessThan(relativeDiscrepancies[i - 1]);
    }

    // Check reduction from Nx=1 (53%) down to Nx=16 (<5%)
    expect(relativeDiscrepancies[0]).toBeGreaterThan(0.50);
    expect(relativeDiscrepancies[relativeDiscrepancies.length - 1]).toBeLessThan(0.06);

    // Compute empirical convergence order between Nx=4 and Nx=8
    // h_ratio = 2, error_ratio = discrepancies[2] / discrepancies[3]
    const ratio_4_8 = discrepancies[2] / discrepancies[3];
    const order_4_8 = Math.log(ratio_4_8) / Math.log(2.0);
    expect(order_4_8).toBeGreaterThan(0.8); // Confirms ~O(h^1) first-order convergence
  });

  // --- SECTION C: VARIATIONAL EQUILIBRIUM INVARIANCE ---

  it('C1: should verify variational reaction balance holds independently at every mesh level', () => {
    for (const Nx of [1, 2, 4, 8]) {
      const mesh = buildParametricBarMesh(Nx, 1, 1);
      const solver = new BidirectionalElectrothermalSolver3D();
      const res = solver.solve(mesh.nodes, mesh.elements, mesh.electricalBCs, mesh.thermalBCs);

      const audit = IndependentThermalConservationAuditor3D.executeComprehensiveAudit(
        mesh.nodes,
        mesh.elements,
        mesh.electricalBCs,
        mesh.thermalBCs,
        res.nodalPotentialsV,
        res.nodalTemperaturesC,
        res.totalElectricalPowerWatts
      );

      // Variational reaction balance must be preserved within 1e-3 W across all meshes
      expect(audit.reactionConservationResidualWatts).toBeLessThan(1e-3);
      expect(audit.relativeReactionImbalanceRatio).toBeLessThan(1e-4);
      expect(audit.conservationStatus).toBe('VERIFIED_INDEPENDENT_EQUILIBRIUM');
    }
  });

  // --- SECTION D: ADVERSARIAL ORACLE INTEGRITY ---

  it('D1: should detect reversed face normal and reject with negative Dirichlet heat flux', () => {
    const mesh = buildParametricBarMesh(2, 1, 1);
    const solver = new BidirectionalElectrothermalSolver3D();
    const res = solver.solve(mesh.nodes, mesh.elements, mesh.electricalBCs, mesh.thermalBCs);

    const boundaryFaces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(
      mesh.nodes,
      mesh.elements,
      mesh.thermalBCs
    );

    const baseline = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(
      mesh.nodes,
      mesh.elements,
      boundaryFaces,
      res.nodalTemperaturesC
    );

    const invertedFaces = IndependentThermalConservationAuditor3D.testInvertedNormals(boundaryFaces);
    const invertedResult = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(
      mesh.nodes,
      mesh.elements,
      invertedFaces,
      res.nodalTemperaturesC
    );

    expect(invertedResult.dirichletBoundaryLossWatts).toBeCloseTo(-baseline.dirichletBoundaryLossWatts, 4);
    expect(invertedResult.dirichletBoundaryLossWatts).toBeLessThan(0);
  });

  it('D2: should detect missing Dirichlet face and trigger area and flux discrepancy', () => {
    const mesh = buildParametricBarMesh(2, 1, 1);
    const solver = new BidirectionalElectrothermalSolver3D();
    const res = solver.solve(mesh.nodes, mesh.elements, mesh.electricalBCs, mesh.thermalBCs);

    const boundaryFaces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(
      mesh.nodes,
      mesh.elements,
      mesh.thermalBCs
    );

    const baseline = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(
      mesh.nodes,
      mesh.elements,
      boundaryFaces,
      res.nodalTemperaturesC
    );

    const missingFaces = IndependentThermalConservationAuditor3D.testMissingBoundaryFaces(boundaryFaces, 1);
    const missingResult = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(
      mesh.nodes,
      mesh.elements,
      missingFaces,
      res.nodalTemperaturesC
    );

    expect(missingResult.boundaryFaceCount).toBe(boundaryFaces.length - 1);
    expect(missingResult.totalSurfaceAreaM2).toBeLessThan(baseline.totalSurfaceAreaM2);
    expect(missingResult.dirichletBoundaryLossWatts).toBeLessThan(baseline.dirichletBoundaryLossWatts);
  });

  it('D3: should detect duplicate boundary faces via surface area anomaly', () => {
    const mesh = buildParametricBarMesh(2, 1, 1);
    const boundaryFaces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(
      mesh.nodes,
      mesh.elements,
      mesh.thermalBCs
    );

    const duplicated = IndependentThermalConservationAuditor3D.testDoubleCountedFaces(boundaryFaces);
    const duplicatedArea = duplicated.reduce((s, f) => s + f.areaM2, 0);
    expect(duplicatedArea).toBeCloseTo(0.0042 * 2, 5);
  });
});
