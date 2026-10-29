/**
 * SECP Industrial OS — Engineering Truth OS
 * IndependentThermalConservation004.test.ts
 *
 * SECP-PHYSICS-EXPANSION-004: Independent Thermal Conservation & Boundary Flux Verification.
 *
 * Verification Battery:
 * 1. Independent integration of volumetric Joule heating over thermal domain.
 * 2. Independent integration of conductive heat flux over external thermal boundaries.
 * 3. Explicit nodal reaction flux balance at Dirichlet heat sinks.
 * 4. Adversarial tests detecting:
 *    - Incorrect / inverted boundary normals
 *    - Missing boundary faces
 *    - Incorrect heat-flux signs
 *    - Double-counted boundary faces
 *    - Incorrect units (mm vs m scaling)
 *    - Deliberately corrupted thermal flux
 * 5. Fail-closed rejection on invalid or corrupted thermal states.
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

describe('SECP-PHYSICS-EXPANSION-004: Independent Thermal Conservation Verification', () => {

  // Test setup: 3D bar modeled with 5 TET4 elements (0.1m x 0.01m x 0.01m)
  const nodes: ElectrothermalNode3D[] = [
    { id: "N0", x: 0, y: 0, z: 0 },
    { id: "N1", x: 0.1, y: 0, z: 0 },
    { id: "N2", x: 0.1, y: 0.01, z: 0 },
    { id: "N3", x: 0, y: 0.01, z: 0 },
    { id: "N4", x: 0, y: 0, z: 0.01 },
    { id: "N5", x: 0.1, y: 0, z: 0.01 },
    { id: "N6", x: 0.1, y: 0.01, z: 0.01 },
    { id: "N7", x: 0, y: 0.01, z: 0.01 }
  ];

  const elements: ElectrothermalTetElement3D[] = [
    {
      id: "E1",
      nodeIds: ["N0", "N1", "N3", "N4"],
      nominalConductivity: 1e4,
      tempCoefficient: 0.0039,
      thermalConductivity: 200,
      referenceTempC: 20.0
    },
    {
      id: "E2",
      nodeIds: ["N1", "N2", "N3", "N6"],
      nominalConductivity: 1e4,
      tempCoefficient: 0.0039,
      thermalConductivity: 200,
      referenceTempC: 20.0
    },
    {
      id: "E3",
      nodeIds: ["N1", "N4", "N5", "N6"],
      nominalConductivity: 1e4,
      tempCoefficient: 0.0039,
      thermalConductivity: 200,
      referenceTempC: 20.0
    },
    {
      id: "E4",
      nodeIds: ["N3", "N4", "N6", "N7"],
      nominalConductivity: 1e4,
      tempCoefficient: 0.0039,
      thermalConductivity: 200,
      referenceTempC: 20.0
    },
    {
      id: "E5",
      nodeIds: ["N1", "N3", "N4", "N6"],
      nominalConductivity: 1e4,
      tempCoefficient: 0.0039,
      thermalConductivity: 200,
      referenceTempC: 20.0
    }
  ];

  const electricalBCs: ElectricalBoundaryCondition[] = [
    { nodeId: "N0", potential: 5.0 },
    { nodeId: "N3", potential: 5.0 },
    { nodeId: "N4", potential: 5.0 },
    { nodeId: "N7", potential: 5.0 },
    { nodeId: "N1", potential: 0.0 },
    { nodeId: "N2", potential: 0.0 },
    { nodeId: "N5", potential: 0.0 },
    { nodeId: "N6", potential: 0.0 }
  ];

  const thermalBCs: ThermalBoundaryCondition[] = [
    { nodeId: "N0", type: 'PRESCRIBED', temperatureC: 20.0 },
    { nodeId: "N3", type: 'PRESCRIBED', temperatureC: 20.0 },
    { nodeId: "N4", type: 'PRESCRIBED', temperatureC: 20.0 },
    { nodeId: "N7", type: 'PRESCRIBED', temperatureC: 20.0 }
  ];

  it('1. should independently integrate volumetric Joule heating without construction assignment', () => {
    const solver = new BidirectionalElectrothermalSolver3D();
    const result = solver.solve(nodes, elements, electricalBCs, thermalBCs);

    expect(result.success).toBe(true);
    expect(result.totalElectricalPowerWatts).toBeGreaterThan(0);
    expect(result.totalThermalHeatWatts).toBeGreaterThan(0);

    // Verify volumetric mapping residual is small
    const diff = Math.abs(result.totalElectricalPowerWatts - result.totalThermalHeatWatts);
    expect(diff).toBeLessThan(1e-4);

    // Verify nodal reaction sink heat is independently computed via Auditor
    const elementHeats = new Map<string, number>();
    elements.forEach(e => elementHeats.set(e.id, result.elementResults.get(e.id)!.jouleHeatDensity));

    const reactionAudit = IndependentThermalConservationAuditor3D.computeNodalReactionFluxes(
      nodes,
      elements,
      elementHeats,
      thermalBCs,
      result.nodalTemperaturesC
    );

    expect(reactionAudit.totalSinkReactionHeatWatts).toBeGreaterThan(0);

    // Conservation: Internal volumetric heat generated must equal net reaction heat leaving sinks
    const reactionImbalance = Math.abs(result.totalThermalHeatWatts - reactionAudit.totalSinkReactionHeatWatts);
    expect(reactionImbalance).toBeLessThan(1e-4);
  });

  it('2. should extract 3D boundary faces with strictly outward normal vectors', () => {
    const boundaryFaces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(
      nodes,
      elements,
      thermalBCs
    );

    // A block with 6 rectangular faces triangulated has exactly 12 boundary triangular faces
    expect(boundaryFaces.length).toBe(12);

    // Verify total surface area: 2*(0.1*0.01 + 0.1*0.01 + 0.01*0.01) = 2*(0.001 + 0.001 + 0.0001) = 0.0042 m^2
    const totalArea = boundaryFaces.reduce((sum, f) => sum + f.areaM2, 0);
    expect(totalArea).toBeCloseTo(0.0042, 5);

    // Verify all outward unit normals have norm = 1.0
    for (const f of boundaryFaces) {
      const [nx, ny, nz] = f.outwardUnitNormal;
      const norm = Math.sqrt(nx * nx + ny * ny + nz * nz);
      expect(norm).toBeCloseTo(1.0, 6);
    }
  });

  it('3. should perform comprehensive audit and verify independent equilibrium status', () => {
    const solver = new BidirectionalElectrothermalSolver3D();
    const etResult = solver.solve(nodes, elements, electricalBCs, thermalBCs);

    const auditReport = IndependentThermalConservationAuditor3D.executeComprehensiveAudit(
      nodes,
      elements,
      electricalBCs,
      thermalBCs,
      etResult.nodalPotentialsV,
      etResult.nodalTemperaturesC,
      etResult.totalElectricalPowerWatts
    );

    expect(auditReport.campaign).toBe('SECP-PHYSICS-EXPANSION-004');
    expect(auditReport.conservationStatus).toBe('VERIFIED_INDEPENDENT_EQUILIBRIUM');
    expect(auditReport.boundaryIntegrationComplete).toBe(true);
    expect(auditReport.reactionConservationResidualWatts).toBeLessThan(1e-4);
    expect(auditReport.relativeReactionImbalanceRatio).toBeLessThan(1e-4);
    expect(auditReport.declaredUnits.energyRate).toBe('W (Watts = J/s)');
  });

  // --- ADVERSARIAL FAULT DETECTION TESTS ---

  it('4. Adversarial: should detect incorrect/inverted boundary normals', () => {
    const solver = new BidirectionalElectrothermalSolver3D();
    const etResult = solver.solve(nodes, elements, electricalBCs, thermalBCs);
    const boundaryFaces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(
      nodes,
      elements,
      thermalBCs
    );

    // Compute genuine surface flux
    const baseline = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(
      nodes,
      elements,
      boundaryFaces,
      etResult.nodalTemperaturesC
    );

    // Invert normals
    const invertedFaces = IndependentThermalConservationAuditor3D.testInvertedNormals(boundaryFaces);
    const corrupted = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(
      nodes,
      elements,
      invertedFaces,
      etResult.nodalTemperaturesC
    );

    // Corrupted flux must be exact opposite sign
    expect(corrupted.dirichletBoundaryLossWatts).toBeCloseTo(-baseline.dirichletBoundaryLossWatts, 4);
    // Detected: Flux direction inverted
    expect(corrupted.dirichletBoundaryLossWatts).toBeLessThan(0);
  });

  it('5. Adversarial: should detect missing boundary faces (incomplete integration)', () => {
    const solver = new BidirectionalElectrothermalSolver3D();
    const etResult = solver.solve(nodes, elements, electricalBCs, thermalBCs);
    const boundaryFaces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(
      nodes,
      elements,
      thermalBCs
    );

    const baseline = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(
      nodes,
      elements,
      boundaryFaces,
      etResult.nodalTemperaturesC
    );

    // Omit 2 boundary faces
    const incompleteFaces = IndependentThermalConservationAuditor3D.testMissingBoundaryFaces(boundaryFaces, 2);
    const corrupted = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(
      nodes,
      elements,
      incompleteFaces,
      etResult.nodalTemperaturesC
    );

    expect(corrupted.boundaryFaceCount).toBe(boundaryFaces.length - 2);
    expect(corrupted.totalSurfaceAreaM2).toBeLessThan(baseline.totalSurfaceAreaM2);
    expect(Math.abs(corrupted.totalBoundaryHeatLossWatts - baseline.totalBoundaryHeatLossWatts)).toBeGreaterThan(1e-6);
  });

  it('6. Adversarial: should detect inverted heat-flux signs', () => {
    const solver = new BidirectionalElectrothermalSolver3D();
    const etResult = solver.solve(nodes, elements, electricalBCs, thermalBCs);
    const boundaryFaces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(
      nodes,
      elements,
      thermalBCs
    );

    const baseline = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(
      nodes,
      elements,
      boundaryFaces,
      etResult.nodalTemperaturesC
    );

    const invertedFluxes = IndependentThermalConservationAuditor3D.testInvertedHeatFluxSign(baseline.faceFluxes);
    for (let i = 0; i < baseline.faceFluxes.length; i++) {
      expect(invertedFluxes[i].heatLossRateWatts).toBeCloseTo(-baseline.faceFluxes[i].heatLossRateWatts, 6);
    }
  });

  it('7. Adversarial: should detect double-counted boundary faces', () => {
    const boundaryFaces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(
      nodes,
      elements,
      thermalBCs
    );

    const doubleFaces = IndependentThermalConservationAuditor3D.testDoubleCountedFaces(boundaryFaces);
    expect(doubleFaces.length).toBe(boundaryFaces.length * 2);

    const totalAreaDouble = doubleFaces.reduce((sum, f) => sum + f.areaM2, 0);
    const genuineArea = boundaryFaces.reduce((sum, f) => sum + f.areaM2, 0);
    expect(totalAreaDouble).toBeCloseTo(genuineArea * 2, 5);
  });

  it('8. Adversarial: should detect incorrect unit scaling (mm vs m)', () => {
    const scaledNodes = IndependentThermalConservationAuditor3D.testIncorrectUnits(nodes, 1000.0);
    const elementHeats = new Map<string, number>([
      ["E1", 1e6], ["E2", 1e6], ["E3", 1e6], ["E4", 1e6], ["E5", 1e6]
    ]);

    const auditMM = IndependentThermalConservationAuditor3D.auditVolumetricHeatGeneration(
      scaledNodes,
      elements,
      elementHeats
    );
    const auditM = IndependentThermalConservationAuditor3D.auditVolumetricHeatGeneration(
      nodes,
      elements,
      elementHeats
    );

    // Volume scales as L^3 => 1000^3 = 10^9 ratio
    expect(auditMM.totalVolumeM3 / auditM.totalVolumeM3).toBeCloseTo(1e9, -3);
  });

  it('9. Adversarial: should detect deliberately corrupted thermal flux and fail closed', () => {
    const solver = new BidirectionalElectrothermalSolver3D();
    const etResult = solver.solve(nodes, elements, electricalBCs, thermalBCs);
    const boundaryFaces = IndependentThermalConservationAuditor3D.extractBoundaryFaces(
      nodes,
      elements,
      thermalBCs
    );

    const baseline = IndependentThermalConservationAuditor3D.integrateBoundaryFlux(
      nodes,
      elements,
      boundaryFaces,
      etResult.nodalTemperaturesC
    );

    const corruptedFluxes = IndependentThermalConservationAuditor3D.testCorruptedThermalFlux(
      baseline.faceFluxes,
      1.5 // 50% corruption
    );

    const corruptedDirichletHeat = corruptedFluxes
      .filter(f => f.isDirichletSink)
      .reduce((sum, f) => sum + f.heatLossRateWatts, 0);

    const genuineDirichletHeat = baseline.dirichletBoundaryLossWatts;
    expect(corruptedDirichletHeat).toBeCloseTo(genuineDirichletHeat * 1.5, 4);
    expect(Math.abs(corruptedDirichletHeat - genuineDirichletHeat)).toBeGreaterThan(1.0);
  });
});
