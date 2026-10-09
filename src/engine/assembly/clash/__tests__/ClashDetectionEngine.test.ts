import { describe, it, expect } from 'vitest';
import { ClashDetectionEngine } from '../ClashDetectionEngine';
import { ClashComponentDefinition, ClashResult } from '../ClashTypes';
import { createIdentityTransform, createKinematicBody } from '../../kinematics/KinematicBody';
import { KinematicState } from '../../kinematics/KinematicState';
import { KinematicConfiguration } from '../../kinematics/KinematicConfiguration';
import { ClashEvidenceEngine } from '../ClashEvidence';
import { BroadPhaseDetector } from '../BroadPhaseDetector';

describe('PATCH-032 Clash Detection Engine Test Suite (TEST 01 - TEST 10)', () => {
  it('TEST 01 — Clearly Separated Parts', () => {
    const compA: ClashComponentDefinition = {
      componentId: 'PART_A',
      geometryId: 'G_A',
      geometry: { id: 'G_A', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const compB: ClashComponentDefinition = {
      componentId: 'PART_B',
      geometryId: 'G_B',
      geometry: { id: 'G_B', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: [
        [1, 0, 0, 100],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    };

    const report = ClashDetectionEngine.detectClashes('ASSY_SEP', [compA, compB]);
    expect(report.verdict).toBe('NO_CLASH');
    expect(report.clashCount).toBe(0);
    expect(report.candidatePairsCount).toBe(0); // Separated in Broad Phase
  });

  it('TEST 02 — Obvious Penetration', () => {
    const compA: ClashComponentDefinition = {
      componentId: 'PART_A',
      geometryId: 'G_A',
      geometry: { id: 'G_A', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const compB: ClashComponentDefinition = {
      componentId: 'PART_B',
      geometryId: 'G_B',
      geometry: { id: 'G_B', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: [
        [1, 0, 0, 5],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ], // 5mm penetration
    };

    const report = ClashDetectionEngine.detectClashes('ASSY_PEN', [compA, compB]);
    expect(report.verdict).toBe('CLASH');
    expect(report.clashCount).toBe(1);
    expect(report.results[0].penetrationDepth).toBeCloseTo(5.0, 4);
    expect(report.results[0].severity).toBe('CRITICAL');
  });

  it('TEST 03 — Touching Parts', () => {
    const compA: ClashComponentDefinition = {
      componentId: 'PART_A',
      geometryId: 'G_A',
      geometry: { id: 'G_A', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const compB: ClashComponentDefinition = {
      componentId: 'PART_B',
      geometryId: 'G_B',
      geometry: { id: 'G_B', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: [
        [1, 0, 0, 10.0001],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    };

    const report = ClashDetectionEngine.detectClashes('ASSY_TOUCH', [compA, compB], {
      tolerance: 1e-3,
      requiredClearance: 0,
    });
    expect(report.verdict).toBe('NO_CLASH');
    expect(report.clashCount).toBe(0);
  });

  it('TEST 04 — Clearance Violation', () => {
    const compA: ClashComponentDefinition = {
      componentId: 'PART_A',
      geometryId: 'G_A',
      geometry: { id: 'G_A', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const compB: ClashComponentDefinition = {
      componentId: 'PART_B',
      geometryId: 'G_B',
      geometry: { id: 'G_B', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: [
        [1, 0, 0, 12],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ], // 2mm gap (12 - 10)
    };

    const report = ClashDetectionEngine.detectClashes('ASSY_CLEARANCE', [compA, compB], {
      requiredClearance: 5.0, // Needs 5mm
    });

    expect(report.verdict).toBe('CLEARANCE_VIOLATION');
    expect(report.clearanceViolationCount).toBe(1);
    expect(report.results[0].minimumClearance).toBeCloseTo(2.0, 4);
    expect(report.results[0].severity).toBe('WARNING');
  });

  it('TEST 05 — AABB False Positive Rejection', () => {
    const cos45 = Math.cos(Math.PI / 4);
    const sin45 = Math.sin(Math.PI / 4);

    const compA: ClashComponentDefinition = {
      componentId: 'PART_A',
      geometryId: 'G_A',
      geometry: { id: 'G_A', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: [
        [cos45, -sin45, 0, 0],
        [sin45, cos45, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    };
    const compB: ClashComponentDefinition = {
      componentId: 'PART_B',
      geometryId: 'G_B',
      geometry: { id: 'G_B', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: [
        [cos45, -sin45, 0, 12],
        [sin45, cos45, 0, 6],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    };

    // AABBs overlap due to diamond bounding boxes
    const bboxA = BroadPhaseDetector.computeWorldAABB(compA);
    const bboxB = BroadPhaseDetector.computeWorldAABB(compB);
    expect(BroadPhaseDetector.testAABBOverlap(bboxA, bboxB).overlaps).toBe(true);

    const report = ClashDetectionEngine.detectClashes('ASSY_AABB_FP', [compA, compB]);
    expect(report.candidatePairsCount).toBe(1);
    // Narrow Phase rejects false positive!
    expect(report.verdict).toBe('NO_CLASH');
    expect(report.clashCount).toBe(0);
  });

  it('TEST 06 — Tolerance Sensitivity', () => {
    const compA: ClashComponentDefinition = {
      componentId: 'PART_A',
      geometryId: 'G_A',
      geometry: { id: 'G_A', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const compB: ClashComponentDefinition = {
      componentId: 'PART_B',
      geometryId: 'G_B',
      geometry: { id: 'G_B', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: [
        [1, 0, 0, 9.9995],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ], // 0.0005 mm overlap
    };

    // Under tight tolerance (1e-4 = 0.0001 mm), 0.0005 mm is a CLASH
    const repTight = ClashDetectionEngine.detectClashes('ASSY_TIGHT', [compA, compB], {
      tolerance: 1e-4,
    });
    expect(repTight.verdict).toBe('CLASH');

    // Under looser tolerance (1e-2 = 0.01 mm), 0.0005 mm is classified as NO_CLASH touching
    const repLoose = ClashDetectionEngine.detectClashes('ASSY_LOOSE', [compA, compB], {
      tolerance: 1e-2,
    });
    expect(repLoose.verdict).toBe('NO_CLASH');
  });

  it('TEST 07 — Kinematic Configuration Analysis', () => {
    const state = new KinematicState('ASSY_KIN', 'REV-0');
    state.addBody(createKinematicBody('B1', 'C1', true));
    state.addBody(createKinematicBody('B2', 'C2', false));

    const geomMap = new Map();
    geomMap.set('C1', { id: 'G1', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } });
    geomMap.set('C2', { id: 'G2', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } });

    const config0: KinematicConfiguration = {
      jointCoordinates: { J1: 0 },
      bodyTransforms: {
        B1: createIdentityTransform(),
        B2: [
          [1, 0, 0, 30],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ],
      },
      configurationHash: 'H0',
    };

    const config1: KinematicConfiguration = {
      jointCoordinates: { J1: 15 },
      bodyTransforms: {
        B1: createIdentityTransform(),
        B2: [
          [1, 0, 0, 20],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ],
      },
      configurationHash: 'H1',
    };

    const config2: KinematicConfiguration = {
      jointCoordinates: { J1: 45 },
      bodyTransforms: {
        B1: createIdentityTransform(),
        B2: [
          [1, 0, 0, 5],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ],
      },
      configurationHash: 'H2',
    };

    const rep0 = ClashDetectionEngine.detectClashesAtConfiguration(state, config0, geomMap);
    const rep1 = ClashDetectionEngine.detectClashesAtConfiguration(state, config1, geomMap);
    const rep2 = ClashDetectionEngine.detectClashesAtConfiguration(state, config2, geomMap);

    expect(rep0.verdict).toBe('NO_CLASH');
    expect(rep1.verdict).toBe('NO_CLASH');
    expect(rep2.verdict).toBe('CLASH');

    const sweep = ClashDetectionEngine.sweepClashAnalysis(state, [config0, config1, config2], geomMap);
    expect(sweep.overallVerdict).toBe('CLASH');
    expect(sweep.firstClashIndex).toBe(2);
    expect(sweep.reports.length).toBe(3);
  });

  it('TEST 08 — Deterministic Replay', () => {
    const makeComps = () => [
      {
        componentId: 'COMP_1',
        geometryId: 'G1',
        geometry: { id: 'G1', type: 'SPHERE' as const, dimensions: { radius: 5 } },
        worldTransform: createIdentityTransform(),
      },
      {
        componentId: 'COMP_2',
        geometryId: 'G2',
        geometry: { id: 'G2', type: 'SPHERE' as const, dimensions: { radius: 5 } },
        worldTransform: [
          [1, 0, 0, 8],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ],
      },
    ];

    const repA = ClashDetectionEngine.detectClashes('ASSY_DET', makeComps());
    const repB = ClashDetectionEngine.detectClashes('ASSY_DET', makeComps());

    expect(repA.determinismHash).toBe(repB.determinismHash);
    expect(repA.verdict).toBe(repB.verdict);
    expect(repA.results[0].penetrationDepth).toBe(repB.results[0].penetrationDepth);
  });

  it('TEST 09 — Evidence Tampering Detection', () => {
    const compA: ClashComponentDefinition = {
      componentId: 'PART_A',
      geometryId: 'G_A',
      geometry: { id: 'G_A', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const compB: ClashComponentDefinition = {
      componentId: 'PART_B',
      geometryId: 'G_B',
      geometry: { id: 'G_B', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: [
        [1, 0, 0, 5],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ],
    };

    const rep = ClashDetectionEngine.detectClashes('ASSY_EVID_TEST', [compA, compB]);
    const res = rep.results[0];
    const evidence = ClashEvidenceEngine.createClashResultEvidence('ASSY_EVID_TEST', res);

    const validCheck = ClashEvidenceEngine.verifyEvidenceTampering(res, 'ASSY_EVID_TEST', evidence);
    expect(validCheck.valid).toBe(true);

    const tamperedRes: ClashResult = {
      ...res,
      geometryHashA: 'TAMPERED_HASH_999',
    };

    const invalidCheck = ClashEvidenceEngine.verifyEvidenceTampering(tamperedRes, 'ASSY_EVID_TEST', evidence);
    expect(invalidCheck.valid).toBe(false);
  });

  it('TEST 10 — Invalid Geometry Classification (Never NO_CLASH)', () => {
    const invalidComp: ClashComponentDefinition = {
      componentId: 'PART_NAN',
      geometryId: 'G_NAN',
      geometry: { id: 'G_NAN', type: 'BOX', dimensions: { dx: NaN, dy: 10, dz: 10 } },
      worldTransform: createIdentityTransform(),
    };
    const validComp: ClashComponentDefinition = {
      componentId: 'PART_OK',
      geometryId: 'G_OK',
      geometry: { id: 'G_OK', type: 'BOX', dimensions: { dx: 10, dy: 10, dz: 10 } },
      worldTransform: createIdentityTransform(),
    };

    const report = ClashDetectionEngine.detectClashes('ASSY_INV', [invalidComp, validComp]);
    expect(report.verdict).toBe('INVALID');
    expect(report.verdict).not.toBe('NO_CLASH');
  });
});
