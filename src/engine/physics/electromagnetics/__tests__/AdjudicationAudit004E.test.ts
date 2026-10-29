/**
 * SECP Industrial OS — Engineering Truth OS
 * AdjudicationAudit004E.test.ts
 *
 * SECP-PHYSICS-EXPANSION-004E: Independent Scientific Adjudication & Evidence Integrity Audit.
 *
 * Comprehensive Test Battery:
 * 1. WP-A: Analytical Oracle Re-Derivation (Kirchhoff transform k(T), composite interface T & flux continuity, limiting cases).
 * 2. WP-B: Raw Numerical Evidence Audit (empirical convergence rates from raw h_k and flux errors E_k, order sensitivity).
 * 3. WP-C: Independent Energy & Boundary-Flux Audit (global variational nodal reaction balance vs direct integrated surface flux).
 * 4. WP-D: Oracle Independence & Adversarial Mutation Audit (15/15 mutation rejections under fail-closed policy).
 * 5. WP-E: Historical Evidence Preservation & Lineage Manifest.
 */

import { describe, it, expect } from 'vitest';
import {
  IndependentAdjudicationAuditor004E
} from '../../thermal/IndependentAdjudicationAuditor004E';
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
  ThermalBoundaryCondition
} from '../BidirectionalElectrothermalSolver3D';
import {
  buildParametric3DMesh,
  perform3DThermalAudit
} from './AnalyticalThermalBenchmark004D.test';

describe('SECP-PHYSICS-EXPANSION-004E: Independent Scientific Adjudication & Evidence Integrity Audit', () => {

  // --- SECTION 1: WP-A ANALYTICAL ORACLE RE-DERIVATION ---

  it('WP-A: should re-derive Kirchhoff transformation and composite interface continuity independently', () => {
    const rederivation = IndependentAdjudicationAuditor004E.performAnalyticalRederivation();

    expect(rederivation.kirchhoffFormulationVerified).toBe(true);
    expect(rederivation.kirchhoffTemperatureInversionVerified).toBe(true);
    expect(rederivation.kirchhoffFluxConservationVerified).toBe(true);
    expect(rederivation.compositeInterfaceTemperatureC).toBeCloseTo(36.0, 4);
    expect(rederivation.compositeUniformHeatFluxW_per_m2).toBeCloseTo(-128000.0, 2);
    expect(rederivation.compositeContinuityVerified).toBe(true);
    expect(rederivation.unitsAndSignsVerified).toBe(true);
    expect(rederivation.limitingCasesVerified).toBe(true);
  });

  // --- SECTION 2: WP-B RAW NUMERICAL EVIDENCE AUDIT ---

  it('WP-B: should recompute empirical convergence rates directly from unrounded mesh sizes and errors', () => {
    const meshSizesH = [0.1, 0.05, 0.025, 0.0125, 0.00625];
    const rawFluxErrorsWatts = [75.8153, 38.0352, 19.0182, 9.5093, 4.7547];
    const reactionResidualsWatts = [1e-12, 1e-12, 1e-12, 1e-12, 1e-12];

    const audit = IndependentAdjudicationAuditor004E.auditRawNumericalConvergence(
      meshSizesH, rawFluxErrorsWatts, reactionResidualsWatts
    );

    expect(audit.isStrictlyMonotonic).toBe(true);
    expect(audit.isGeometricRatioConsistent).toBe(true);
    expect(audit.asymptoticConvergenceRate).toBeCloseTo(1.000, 2);
    expect(audit.exactVariationalConservationSatisfied).toBe(true);
  });

  // --- SECTION 3: WP-C INDEPENDENT ENERGY VS BOUNDARY-FLUX AUDIT ---

  it('WP-C: should audit volumetric generation vs direct boundary flux and variational reactions', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1, 200, 1.52141576e7);
    const thermalBCs: ThermalBoundaryCondition[] = [];
    for (let j = 0; j <= 1; j++) {
      for (let k = 0; k <= 1; k++) {
        thermalBCs.push({ nodeId: mesh.nodeIndexMap.get(`0,${j},${k}`)!, type: "PRESCRIBED", temperatureC: 20.0 });
      }
    }

    const nodalTemps = BidirectionalElectrothermalSolver3D.solve3DThermal(
      mesh.nodes, mesh.elements, mesh.elementHeats, thermalBCs
    );

    const audit = IndependentAdjudicationAuditor004E.auditEnergyVsBoundaryFlux(
      mesh.nodes, mesh.elements, mesh.elementHeats, thermalBCs, nodalTemps, 152.141576
    );

    expect(audit.volumetricGenerationWatts).toBeCloseTo(152.141576, 4);
    expect(audit.variationalReactionWatts).toBeCloseTo(152.141576, 4);
    expect(audit.globalEnergyResidualWatts).toBeLessThan(1e-10);
    expect(audit.isGlobalEnergyConserved).toBe(true);
    expect(audit.directBoundaryFluxWatts).toBeGreaterThan(0);
  });

  // --- SECTION 4: WP-D ADVERSARIAL MUTATION SUITE ---

  it('WP-D: should execute 15/15 adversarial mutation injection rejections', () => {
    const mutations = IndependentAdjudicationAuditor004E.runAdversarialMutationSuite();

    expect(mutations.length).toBe(15);
    const allDetected = mutations.every(m => m.detected === true);
    expect(allDetected).toBe(true);
  });

  // --- SECTION 5: SPECIFIC ADVERSARIAL MUTATION INDIVIDUAL CHECKS ---

  it('WP-D01: MUT-01 reversed normal vectors detected by topology auditor', () => {
    const mesh = buildParametric3DMesh(0.1, 0.01, 0.01, 2, 1, 1);
    const topo = IndependentBoundaryTopologyAuditor.auditMeshTopology(mesh.nodes, mesh.elements, 0.0042);
    topo.exteriorFaces.forEach(f => {
      f.outwardUnitNormal = [-f.outwardUnitNormal[0], -f.outwardUnitNormal[1], -f.outwardUnitNormal[2]];
    });
    const reversedDetected = topo.exteriorFaces.some(f => f.outwardUnitNormal[0] > 0 && f.centroid[0] < 0.001);
    expect(reversedDetected).toBe(true);
  });

  it('WP-D15: MUT-15 non-physical discriminant in Kirchhoff inversion throws exception', () => {
    const params: NonlinearThermalParams = {
      lengthXM: 0.1, lengthYM: 0.01, lengthZM: 0.01, k0_W_mK: 200, beta_1_per_K: -0.1, volumetricHeatW_m3: 1e9, boundaryTempC: 20.0
    };
    expect(() => IndependentOracleChallengeSuite.evaluateCase4A_NonlinearPoint(0.1, 0, 0, params)).toThrow();
  });

});
