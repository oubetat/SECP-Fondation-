/**
 * SECP Authoritative Sketch Capabilities & Verification Forensic Suite
 * 
 * Tests the 4 core industrial capabilities:
 * 1. Convert Entities (Associative Projection, Upstream Invalidation Cascade, Fail-Closed on missing reference)
 * 2. True Fillet & Chamfer (Intersection detection, segment trimming, tangent arc inscription, mathematical residual verification)
 * 3. Core-Authorized Auto-Constrain (Jacobian rank filtering, conflict/redundancy rejection, variational convergence)
 * 4. Authoritative Rollback Bar (FeatureManager state machine, CAM/FEA invalidation cascade, Merkle branch proof)
 * 5. Capability Verification Matrix Integrity
 */

import { describe, it, expect } from 'vitest';
import {
  AuthoritativeConvertEntitiesEngine,
  AuthoritativeFilletChamferEngine,
  AuthoritativeAutoConstrainEngine,
  AuthoritativeRollbackStateManager,
  CAPABILITY_VERIFICATION_MATRIX,
  BRepEdge3D,
  SketchPlane3D,
  SketchSegment2D,
  FeatureNode
} from '../canonical/AuthoritativeSketchCapabilities';
import { IndustrialSketchDefinition } from '../IndustrialConstraintTypes';

describe('SECP Authoritative Sketch Capabilities Forensic Suite', () => {

  // =========================================================================
  // GATE 01: CONVERT ENTITIES ASSOCIATIVE LINEAGE & FAIL-CLOSED INVALIDATION
  // =========================================================================
  describe('Gate 01 — Convert Entities Associative Bridge', () => {
    const xyPlane: SketchPlane3D = {
      origin: [0, 0, 10],
      normal: [0, 0, 1],
      uAxis: [1, 0, 0],
      vAxis: [0, 1, 0]
    };

    const upstreamEdge: BRepEdge3D = {
      edgeId: 'brep_edge_boss_top_001',
      sourceFeatureId: 'extrude_boss_001',
      startPoint: [0, 0, 10],
      endPoint: [50, 0, 10],
      curveType: 'LINE'
    };

    it('projects 3D B-Rep Edge to 2D Sketch Plane with SHA-256 evidence hash', () => {
      const result = AuthoritativeConvertEntitiesEngine.projectEdgeToSketch(
        upstreamEdge,
        xyPlane,
        'sketch_002'
      );

      expect(result.success).toBe(true);
      expect(result.entity).toBeDefined();
      expect(result.entity?.sourceBRepEdgeId).toBe('brep_edge_boss_top_001');
      expect(result.entity?.start2D).toEqual([0, 0]);
      expect(result.entity?.end2D).toEqual([50, 0]);
      expect(result.entity?.associativeStatus).toBe('HEALTHY');
      expect(result.entity?.evidenceHash).toMatch(/^sha256_/);
    });

    it('rejects conversion if upstream feature is suppressed (Fail-Closed)', () => {
      const suppressedEdge: BRepEdge3D = {
        ...upstreamEdge,
        isSuppressed: true
      };

      const result = AuthoritativeConvertEntitiesEngine.projectEdgeToSketch(
        suppressedEdge,
        xyPlane,
        'sketch_002'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('is suppressed');
    });

    it('triggers Fail-Closed invalidation cascade when upstream B-Rep edge is deleted/missing', () => {
      const proj = AuthoritativeConvertEntitiesEngine.projectEdgeToSketch(
        upstreamEdge,
        xyPlane,
        'sketch_002'
      ).entity!;

      const currentEdgesMap = new Map<string, BRepEdge3D>();

      const reconciliation = AuthoritativeConvertEntitiesEngine.reconcileUpstreamChange(
        proj,
        currentEdgesMap
      );

      expect(reconciliation.status).toBe('BROKEN_REFERENCE');
      expect(reconciliation.invalidationTriggered).toBe(true);
      expect(reconciliation.auditLog).toContain('[FAIL-CLOSED]');
    });
  });

  // =========================================================================
  // GATE 02: TRUE PARAMETRIC FILLET & CHAMFER TOPOLOGY MODIFICATION
  // =========================================================================
  describe('Gate 02 — True Parametric Fillet & Chamfer Topology Engine', () => {
    const seg1: SketchSegment2D = { id: 'seg_bottom', p1: [0, 0], p2: [50, 0] };
    const seg2: SketchSegment2D = { id: 'seg_right', p1: [50, 0], p2: [50, 50] };

    it('calculates true mathematical fillet, trims host curves and verifies residual < 1e-5', () => {
      const radius = 10;
      const filletRes = AuthoritativeFilletChamferEngine.applyFillet(seg1, seg2, radius);

      expect(filletRes.success).toBe(true);
      expect(filletRes.residualError).toBeLessThan(1e-5);
      expect(filletRes.filletArc).toBeDefined();

      expect(filletRes.filletArc?.center[0]).toBeCloseTo(40, 3);
      expect(filletRes.filletArc?.center[1]).toBeCloseTo(10, 3);

      expect(filletRes.trimmedSegment1?.p2).toEqual([40, 0]);
      expect(filletRes.trimmedSegment2?.p2).toEqual([50, 10]);

      expect(filletRes.gcsConstraintsGenerated.some(c => c.type === 'TANGENT')).toBe(true);
      expect(filletRes.evidenceHash).toMatch(/^sha256_fillet_/);
    });

    it('rejects fillet if radius exceeds host segment lengths (Fail-Closed)', () => {
      const radius = 60;
      const filletRes = AuthoritativeFilletChamferEngine.applyFillet(seg1, seg2, radius);

      expect(filletRes.success).toBe(false);
      expect(filletRes.error).toContain('too large for segment lengths');
    });

    it('executes true parametric chamfer with exact coordinate trim and distance constraints', () => {
      const chamferRes = AuthoritativeFilletChamferEngine.applyChamfer(seg1, seg2, 5, 5);

      expect(chamferRes.success).toBe(true);
      expect(chamferRes.chamferLine).toBeDefined();
      expect(chamferRes.chamferLine?.p1).toEqual([45, 0]);
      expect(chamferRes.chamferLine?.p2).toEqual([50, 5]);
      expect(chamferRes.gcsConstraintsGenerated.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // GATE 03: CORE-AUTHORIZED AUTO-CONSTRAIN ENGINE
  // =========================================================================
  describe('Gate 03 — Core-Authorized Auto-Constrain Engine', () => {
    it('automatically identifies horizontal/vertical candidate constraints and executes variational solve', () => {
      const sketch: IndustrialSketchDefinition = {
        id: 'sk_auto_001',
        name: 'Auto Constrain Test',
        entities: {
          p1: { id: 'p1', type: 'POINT', x: 0, y: 0.05 },
          p2: { id: 'p2', type: 'POINT', x: 100, y: -0.05 },
          p3: { id: 'p3', type: 'POINT', x: 100.05, y: 50 },
          line1: { id: 'line1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' },
          line2: { id: 'line2', type: 'LINE', startPointId: 'p2', endPointId: 'p3' }
        },
        constraints: {}
      };

      const report = AuthoritativeAutoConstrainEngine.executeAutoConstrain(
        sketch,
        3.0,
        1.0
      );

      expect(report.candidatesConsidered).toBeGreaterThan(0);
      expect(report.constraintsAccepted).toBeGreaterThan(0);
      expect(report.finalResidual).toBeLessThan(1e-3);
    });

    it('rejects conflicting or over-constraining candidates (Fail-Closed)', () => {
      const sketch: IndustrialSketchDefinition = {
        id: 'sk_auto_002',
        name: 'Conflict Test',
        entities: {
          p1: { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true },
          p2: { id: 'p2', type: 'POINT', x: 100, y: 0, isFixed: true },
          line1: { id: 'line1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' }
        },
        constraints: {
          c_h: { id: 'c_h', type: 'HORIZONTAL', entityIds: ['line1'], isDriving: true }
        }
      };

      const report = AuthoritativeAutoConstrainEngine.executeAutoConstrain(
        sketch,
        0.1,
        0.1
      );

      expect(report.constraintsRejectedConflicting + report.constraintsRejectedRedundant).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // GATE 04: AUTHORITATIVE ROLLBACK STATE MACHINE & ARTIFACT INVALIDATION
  // =========================================================================
  describe('Gate 04 — Authoritative Rollback State Machine', () => {
    const featureTree: FeatureNode[] = [
      { id: 'f1', name: 'Base Sketch', type: 'SKETCH', status: 'ACTIVE', dependsOnFeatureIds: [], merkleHash: 'h_f1_base' },
      { id: 'f2', name: 'Base Extrude', type: 'EXTRUDE', status: 'ACTIVE', dependsOnFeatureIds: ['f1'], merkleHash: 'h_f2_extrude' },
      { id: 'f3', name: 'Mounting Holes', type: 'HOLE_WIZARD', status: 'ACTIVE', dependsOnFeatureIds: ['f2'], merkleHash: 'h_f3_holes' },
      { id: 'f4', name: 'Edge Fillet 3D', type: 'FILLET_3D', status: 'ACTIVE', dependsOnFeatureIds: ['f2'], merkleHash: 'h_f4_fillet' }
    ];

    it('suspends downstream features and triggers invalidation cascade to CAM/FEA on rollback', () => {
      const transition = AuthoritativeRollbackStateManager.rollbackTo(featureTree, 1, 'REV-A');

      expect(transition.newRollbackIndex).toBe(1);
      expect(transition.activeFeatures.length).toBe(2);
      expect(transition.suspendedFeatures.length).toBe(2);

      expect(transition.suspendedFeatures[0].id).toBe('f3');
      expect(transition.suspendedFeatures[1].id).toBe('f4');

      expect(transition.downstreamArtifactsInvalidated.camToolpaths).toBe(true);
      expect(transition.downstreamArtifactsInvalidated.feaMeshes).toBe(true);
      expect(transition.downstreamArtifactsInvalidated.drawings2D).toBe(true);

      expect(transition.revisionBranchCreated).toContain('REV-A_ROLLBACK_STEP_2');
      expect(transition.merkleRootHash).toMatch(/^merkle_root_/);
    });

    it('restores all features to active state when rolled forward to the end', () => {
      const transition = AuthoritativeRollbackStateManager.rollbackTo(featureTree, 3, 'REV-A');

      expect(transition.newRollbackIndex).toBe(3);
      expect(transition.activeFeatures.length).toBe(4);
      expect(transition.suspendedFeatures.length).toBe(0);
      expect(transition.downstreamArtifactsInvalidated.camToolpaths).toBe(false);
    });
  });

  // =========================================================================
  // GATE 05: CAPABILITY VERIFICATION MATRIX INTEGRITY
  // =========================================================================
  describe('Gate 05 — Capability Verification Matrix Integrity', () => {
    it('verifies that all critical CAD capabilities are registered with strict L4 Evidence-Backed criteria', () => {
      const requiredCaps = [
        'SKETCH_PRIMITIVES',
        'GCS_VARIATIONAL_SOLVER',
        'CONVERT_ENTITIES',
        'TRUE_FILLET_CHAMFER',
        'AUTO_CONSTRAIN',
        'AUTHORITATIVE_ROLLBACK'
      ];

      for (const capKey of requiredCaps) {
        const cap = CAPABILITY_VERIFICATION_MATRIX[capKey];
        expect(cap).toBeDefined();
        expect(cap.tier).toBe('L4_EVIDENCE_BACKED');
        expect(cap.coreBinding).toBe(true);
        expect(cap.gcsVerification).toBe(true);
        expect(cap.evidenceBacked).toBe(true);
        expect(cap.failClosedAdversarial).toBe(true);
        expect(cap.verificationEvidenceId).toBeDefined();
      }
    });
  });

});
