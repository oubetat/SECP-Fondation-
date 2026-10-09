import { describe, expect, it } from "vitest";
import { ClosestPointProjector } from "../ClosestPointProjector";
import { ContactAdversarialSuite } from "../ContactAdversarialSuite";
import { ContactBenchmarkSuite } from "../ContactBenchmarkSuite";
import { ContactModel } from "../ContactModel";
import { ContactPair } from "../ContactPair";
import { ContactSearchEngine } from "../ContactSearchEngine";
import { ContactStateHasher } from "../ContactStateHasher";
import { ContactSurface, SurfaceFacet, SurfaceNode } from "../ContactSurface";
import { CoulombFrictionModel } from "../FrictionModel";
import { IndependentContactAudits } from "../IndependentContactAudits";
import { IndependentContactReference } from "../IndependentContactReference";
import { ContactPointState } from "../types";

describe("PATCH-081: Contact Mechanics Core Unit Tests", () => {

  it("1. ContactSurface constructs AABB and facet normals correctly", () => {
    const nodes: SurfaceNode[] = [
      { id: 'n1', index: 0, initialCoords: [0, 0], currentCoords: [0, 0] },
      { id: 'n2', index: 1, initialCoords: [2, 0], currentCoords: [2, 0] }
    ];
    const facets: SurfaceFacet[] = [{ facetId: 'f1', nodeIds: ['n1', 'n2'] }];

    const surf = new ContactSurface({
      surfaceId: 'surf1', bodyId: 'body1', nodeIds: ['n1', 'n2'],
      faceIds: ['f1'], elementIds: ['e1'], role: 'MASTER', normalConvention: 'OUTWARD'
    }, nodes, facets);

    const aabb = surf.computeAABB(0.1);
    expect(aabb.min[0]).toBeCloseTo(-0.1);
    expect(aabb.max[0]).toBeCloseTo(2.1);

    const normal = surf.computeFacetNormal(facets[0]);
    expect(normal[0]).toBeCloseTo(0);
    expect(normal[1]).toBeCloseTo(1); // Outward normal for [0,0] -> [2,0] segment facing upward
  });

  it("2. ClosestPointProjector computes exact 2D projection and signed gap", () => {
    const masterNodesMap = new Map([
      ['m1', { id: 'm1', index: 0, initialCoords: [0, 1], currentCoords: [0, 1] }],
      ['m2', { id: 'm2', index: 1, initialCoords: [2, 1], currentCoords: [2, 1] }]
    ]);
    const facet: SurfaceFacet = { facetId: 'mf1', nodeIds: ['m1', 'm2'] };

    // Slave node at (1.0, 0.99) -> 0.01 m penetration into master surface at y=1.0
    const projPenetration = ClosestPointProjector.projectPointToFacet('s1', [1.0, 0.99], facet, masterNodesMap, 'OUTWARD');
    expect(projPenetration.projectionStatus).toBe('SUCCESS');
    expect(projPenetration.gap).toBeLessThan(0); // Negative gap indicates penetration!
    expect(projPenetration.gap).toBeCloseTo(-0.01);

    // Slave node at (1.0, 1.05) -> 0.05 m separation above master surface
    const projOpen = ClosestPointProjector.projectPointToFacet('s1', [1.0, 1.05], facet, masterNodesMap, 'OUTWARD');
    expect(projOpen.projectionStatus).toBe('SUCCESS');
    expect(projOpen.gap).toBeGreaterThan(0); // Positive gap indicates separation
    expect(projOpen.gap).toBeCloseTo(0.05);
  });

  it("3. ContactModel enforces Kuhn-Tucker unilateral contact conditions", () => {
    const model = new ContactModel({ penaltyStiffness: 1e9, searchTolerance: 0.1, penetrationTolerance: 1e-4 }, 'PENALTY');

    const openProj = { gap: 0.005, normal: [0, 1], parametricCoords: [0.5], targetFacetId: 'mf1', sourcePointId: 's1', sourceCoords: [1, 1.005], targetCoords: [1, 1], distance: 0.005, projectionStatus: 'SUCCESS' as const, residualNorm: 0 };
    const openTraction = model.computeTraction(openProj);
    expect(openTraction.status).toBe('OPEN');
    expect(openTraction.normalPressure).toBe(0.0);

    const activeProj = { gap: -0.002, normal: [0, 1], parametricCoords: [0.5], targetFacetId: 'mf1', sourcePointId: 's1', sourceCoords: [1, 0.998], targetCoords: [1, 1], distance: 0.002, projectionStatus: 'SUCCESS' as const, residualNorm: 0 };
    const activeTraction = model.computeTraction(activeProj);
    expect(activeTraction.status).toBe('ACTIVE');
    expect(activeTraction.normalPressure).toBe(2e6); // 1e9 * 0.002 = 2e6 Pa
  });

  it("4. FrictionlessModel produces exactly zero tangential traction", () => {
    const fric = new CoulombFrictionModel(0.0);
    const res = fric.computeTangentialTraction(5e6, [0.01, -0.02]);
    expect(res.frictionStatus).toBe('FRICTIONLESS');
    expect(res.tangentialTraction[0]).toBe(0.0);
    expect(res.tangentialTraction[1]).toBe(0.0);
    expect(res.dissipationIncrement).toBe(0.0);
  });

  it("5. ContactStateHasher produces deterministic cryptographic hashes", () => {
    const pStates: ContactPointState[] = [
      { pointId: 's1', pairId: 'p1', gap: -0.001, normal: [0, 1], tangent: [1, 0], contactPressure: 1e6, tangentialTraction: [0, 0], penetration: 0.001, status: 'ACTIVE', stateMode: 'STICK', lagrangeMultiplier: 1e6, contactWork: 500, iteration: 1, step: 1 }
    ];
    const hashA = ContactStateHasher.computeStateHash('p1', pStates);
    const hashB = ContactStateHasher.computeStateHash('p1', pStates);
    expect(hashA).toBe(hashB);
    expect(hashA).toContain("SHA256_MOCK_");
  });

  it("6. IndependentContactAudits checks complementarity and force balance", () => {
    const pStates: ContactPointState[] = [
      { pointId: 's1', pairId: 'p1', gap: -0.001, normal: [0, 1], tangent: [1, 0], contactPressure: 1e6, tangentialTraction: [0, 0], penetration: 0.001, status: 'ACTIVE', stateMode: 'STICK', lagrangeMultiplier: 1e6, contactWork: 500, iteration: 1, step: 1 }
    ];

    const audit = IndependentContactAudits.auditAll(pStates, [[0, 1e6]], [[0, -1e6]], 1e9);
    expect(audit.isValid).toBe(true);
    expect(audit.actionReactionError).toBeCloseTo(0.0);
  });

  it("7. Runs all benchmarks in ContactBenchmarkSuite", () => {
    const benchResults = ContactBenchmarkSuite.runAll();
    expect(benchResults.length).toBe(7);
    for (const b of benchResults) {
      if (!b.passed) {
        console.error(`FAILED BENCHMARK: [${b.id}] ${b.name} - ${b.details}`);
      }
      expect(b.passed).toBe(true);
    }
  });

  it("8. Runs all adversarial tests in ContactAdversarialSuite", () => {
    const advResults = ContactAdversarialSuite.runAll();
    expect(advResults.length).toBe(6);
    for (const a of advResults) {
      expect(a.passed).toBe(true);
    }
  });
});
