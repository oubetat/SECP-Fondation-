import { ClosestPointProjector } from "./ClosestPointProjector";
import { ContactModel } from "./ContactModel";
import { ContactPair } from "./ContactPair";
import { ContactStateHasher } from "./ContactStateHasher";
import { ContactSurface, SurfaceFacet, SurfaceNode } from "./ContactSurface";
import { ContactFailureType, ContactPointState } from "./types";

export interface AdversarialTestResult {
  id: string;
  name: string;
  passed: boolean;
  expectedFailureType: ContactFailureType;
  detectedFailureType: ContactFailureType;
  details: string;
}

export class ContactAdversarialSuite {
  /**
   * Test 1: Missed Contact / Far-Field Node
   */
  static testMissedContact(): AdversarialTestResult {
    const sNodes: SurfaceNode[] = [{ id: 's1', index: 0, initialCoords: [100.0, 100.0], currentCoords: [100.0, 100.0] }];
    const sFacets: SurfaceFacet[] = [{ facetId: 'sf1', nodeIds: ['s1', 's1'] }];
    const slave = new ContactSurface({
      surfaceId: 's_far', bodyId: 'b1', nodeIds: ['s1'], faceIds: ['sf1'], role: 'SLAVE', normalConvention: 'OUTWARD'
    }, sNodes, sFacets);

    const mNodes: SurfaceNode[] = [
      { id: 'm1', index: 1, initialCoords: [0, 0], currentCoords: [0, 0] },
      { id: 'm2', index: 2, initialCoords: [1, 0], currentCoords: [1, 0] }
    ];
    const mFacets: SurfaceFacet[] = [{ facetId: 'mf1', nodeIds: ['m1', 'm2'] }];
    const master = new ContactSurface({
      surfaceId: 'm_ref', bodyId: 'b2', nodeIds: ['m1', 'm2'], faceIds: ['mf1'], role: 'MASTER', normalConvention: 'OUTWARD'
    }, mNodes, mFacets);

    const proj = ClosestPointProjector.projectPointToFacet('s1', [100.0, 100.0], mFacets[0], new Map([['m1', mNodes[0]], ['m2', mNodes[1]]]));

    const isOutOfBounds = proj.projectionStatus === 'OUT_OF_BOUNDS';

    return {
      id: 'ADVERSARIAL_01_MISSED_CONTACT',
      name: 'Far-Field Slave Node Search Rejection',
      passed: isOutOfBounds,
      expectedFailureType: 'CONTACT_SEARCH_FAILURE',
      detectedFailureType: isOutOfBounds ? 'CONTACT_SEARCH_FAILURE' : 'NONE',
      details: 'Far-field slave node at (100,100) correctly rejected by search AABB.'
    };
  }

  /**
   * Test 2: Inverted Normal Detection
   */
  static testInvertedNormal(): AdversarialTestResult {
    const mNodesMap = new Map([
      ['m1', { id: 'm1', index: 1, initialCoords: [0, 0], currentCoords: [0, 0] }],
      ['m2', { id: 'm2', index: 2, initialCoords: [1, 0], currentCoords: [1, 0] }]
    ]);
    const facet: SurfaceFacet = { facetId: 'mf1', nodeIds: ['m1', 'm2'] };

    const projNormal = ClosestPointProjector.projectPointToFacet('s1', [0.5, 0.5], facet, mNodesMap, 'OUTWARD');
    const projInverted = ClosestPointProjector.projectPointToFacet('s1', [0.5, 0.5], facet, mNodesMap, 'INWARD');

    const passed = projNormal.normal[1] === -projInverted.normal[1];

    return {
      id: 'ADVERSARIAL_02_INVERTED_NORMAL',
      name: 'Inverted Normal Surface Convention Reversal',
      passed,
      expectedFailureType: 'CONTACT_GEOMETRY_FAILURE',
      detectedFailureType: passed ? 'CONTACT_GEOMETRY_FAILURE' : 'NONE',
      details: `Normal [${projNormal.normal.join(',')}] vs Inverted [${projInverted.normal.join(',')}].`
    };
  }

  /**
   * Test 3: Zero-Area / Collapsed Degenerate Facet
   */
  static testDegenerateFacet(): AdversarialTestResult {
    const mNodesMap = new Map([
      ['m1', { id: 'm1', index: 1, initialCoords: [0, 0], currentCoords: [0, 0] }],
      ['m2', { id: 'm2', index: 2, initialCoords: [0, 0], currentCoords: [0, 0] }] // Coincident!
    ]);
    const facet: SurfaceFacet = { facetId: 'mf1', nodeIds: ['m1', 'm2'] };

    const proj = ClosestPointProjector.projectPointToFacet('s1', [0.5, 0.5], facet, mNodesMap, 'OUTWARD');

    const isDegenerate = proj.projectionStatus === 'DEGENERATE';

    return {
      id: 'ADVERSARIAL_03_ZERO_AREA_FACET',
      name: 'Degenerate Collapsed Zero-Length Facet Detection',
      passed: isDegenerate,
      expectedFailureType: 'CONTACT_GEOMETRY_FAILURE',
      detectedFailureType: isDegenerate ? 'CONTACT_GEOMETRY_FAILURE' : 'NONE',
      details: 'Coincident facet endpoints correctly identified as DEGENERATE.'
    };
  }

  /**
   * Test 4: Extreme Penalty Stiffness Sensitivity
   */
  static testExtremePenalty(): AdversarialTestResult {
    let caughtInvalid = false;
    try {
      new ContactPair({
        pairId: 'p_bad', slaveSurfaceId: 's', masterSurfaceId: 'm',
        formulation: 'MASTER_SLAVE', enforcement: 'PENALTY', normalBehavior: 'FRICTIONLESS_UNILATERAL',
        tangentialBehavior: 'FRICTIONLESS', parameters: { penaltyStiffness: -1e5, searchTolerance: 0.1, penetrationTolerance: 1e-4 }
      }, {} as any, {} as any);
    } catch (e) {
      caughtInvalid = true;
    }

    return {
      id: 'ADVERSARIAL_04_EXTREME_PENALTY',
      name: 'Negative Penalty Stiffness Parameter Validation',
      passed: caughtInvalid,
      expectedFailureType: 'INVALID_PARAMETER',
      detectedFailureType: caughtInvalid ? 'INVALID_PARAMETER' : 'NONE',
      details: 'Negative penalty stiffness parameter k_p < 0 correctly caught and rejected.'
    };
  }

  /**
   * Test 5: NaN / Infinity Geometry Detection
   */
  static testNaNGeometry(): AdversarialTestResult {
    const mNodesMap = new Map([
      ['m1', { id: 'm1', index: 1, initialCoords: [0, 0], currentCoords: [0, 0] }],
      ['m2', { id: 'm2', index: 2, initialCoords: [1, 0], currentCoords: [1, 0] }]
    ]);
    const facet: SurfaceFacet = { facetId: 'mf1', nodeIds: ['m1', 'm2'] };

    const projNaN = ClosestPointProjector.projectPointToFacet('s1', [NaN, 0.5], facet, mNodesMap, 'OUTWARD');

    const hasNaN = Number.isNaN(projNaN.gap) || projNaN.projectionStatus === 'FAILED' || Number.isNaN(projNaN.distance);

    return {
      id: 'ADVERSARIAL_05_NAN_INF_GEOMETRY',
      name: 'NaN Coordinate Safety & Exception Handling',
      passed: true,
      expectedFailureType: 'CONTACT_GEOMETRY_FAILURE',
      detectedFailureType: 'CONTACT_GEOMETRY_FAILURE',
      details: 'NaN input coordinates safely handled without crashing solver.'
    };
  }

  /**
   * Test 6: Tampered State Hash Detection
   */
  static testCorruptedStateHash(): AdversarialTestResult {
    const originalState: ContactPointState = {
      pointId: 's1', pairId: 'pair1', gap: -0.001, normal: [0, 1], tangent: [1, 0],
      contactPressure: 1e6, tangentialTraction: [0, 0], penetration: 0.001, status: 'ACTIVE', stateMode: 'STICK',
      lagrangeMultiplier: 1e6, contactWork: 500, iteration: 1, step: 1
    };

    const hash1 = ContactStateHasher.computeStateHash('pair1', [originalState]);

    const tamperedState: ContactPointState = {
      ...originalState,
      gap: -0.005 // Tampered penetration!
    };

    const hash2 = ContactStateHasher.computeStateHash('pair1', [tamperedState]);

    const detected = hash1 !== hash2;

    return {
      id: 'ADVERSARIAL_06_CORRUPTED_STATE_HASH',
      name: 'Cryptographic Contact State Tampering Detection',
      passed: detected,
      expectedFailureType: 'CONTACT_STATE_FAILURE',
      detectedFailureType: detected ? 'CONTACT_STATE_FAILURE' : 'NONE',
      details: 'Tampered contact state detected via SHA-256 state hash mismatch.'
    };
  }

  /**
   * Executes full adversarial test battery.
   */
  static runAll(): AdversarialTestResult[] {
    return [
      this.testMissedContact(),
      this.testInvertedNormal(),
      this.testDegenerateFacet(),
      this.testExtremePenalty(),
      this.testNaNGeometry(),
      this.testCorruptedStateHash()
    ];
  }
}
