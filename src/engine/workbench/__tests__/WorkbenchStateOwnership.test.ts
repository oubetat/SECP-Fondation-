import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorkbenchStateOwnershipEngine,
  StateCategory,
  StandardStateEntity,
  MutationVerdict,
} from '../WorkbenchStateOwnershipEngine';
import { EngineeringDocument, DEFAULT_UNIT_SYSTEM_MM } from '../../cad-kernel/document/CADDocument';
import { FeatureTreeManager } from '../../patch035/FeatureTreeManager';

describe('Workbench State Ownership & Invalidation Architecture Audit', () => {
  let engine: WorkbenchStateOwnershipEngine;
  let sampleDoc: EngineeringDocument;

  beforeEach(() => {
    engine = WorkbenchStateOwnershipEngine.getInstance();
    engine.resetAuditState();

    sampleDoc = {
      documentId: 'DOC-AUDIT-101',
      revision: 1,
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [
        {
          featureId: 'EXTRUDE-1',
          name: 'Base Pad',
          type: 'EXTRUDE',
          status: 'VALID',
          parameters: { depth: 25 },
        },
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: [],
    };

    engine.registerCanonicalDocument(sampleDoc);
  });

  describe('1. Taxonomy & Classification Matrix Verification', () => {
    it('should classify EngineeringDocument strictly as CANONICAL_SOT', () => {
      expect(engine.classifyState('EngineeringDocument')).toBe('CANONICAL_SOT');
    });

    it('should classify derived artifacts (evaluated B-Rep, render mesh, selection, feature tree projection) strictly as DERIVED', () => {
      const derivedEntities: StandardStateEntity[] = [
        'evaluated B-Rep',
        'render mesh',
        'selection',
        'feature tree projection',
      ];

      derivedEntities.forEach((entity) => {
        expect(engine.classifyState(entity)).toBe('DERIVED');
      });
    });

    it('should classify sessions (PatternEngine session, DirectModeling transaction, FeatureRecognitionSession, Reconstruction session) strictly as SESSION', () => {
      const sessionEntities: StandardStateEntity[] = [
        'PatternEngine session',
        'DirectModeling transaction',
        'FeatureRecognitionSession',
        'Reconstruction session',
      ];

      sessionEntities.forEach((entity) => {
        expect(engine.classifyState(entity)).toBe('SESSION');
      });
    });

    it('should classify UI panel state strictly as UI', () => {
      expect(engine.classifyState('UI panel state')).toBe('UI');
    });

    it('should classify legacy FeatureTreeManager strictly as LEGACY', () => {
      expect(engine.classifyState('legacy FeatureTreeManager')).toBe('LEGACY');
    });
  });

  describe('2. Mutation Decision Tree & Gate Execution', () => {
    it('should evaluate SOT modification on EngineeringDocument as CANONICAL_MUTATION', () => {
      const audit = engine.auditStateMutation({
        workbenchId: 'PARAMETRIC_FEATURE_WORKBENCH',
        entityName: 'EngineeringDocument',
        modifiesSOT: true,
      });

      expect(audit.verdict).toBe('CANONICAL_MUTATION');
      expect(audit.isAcceptable).toBe(true);
      expect(audit.invalidatedEntities).toEqual([
        'evaluated B-Rep',
        'render mesh',
        'selection',
        'feature tree projection',
      ]);
    });

    it('should evaluate state mutation on DERIVED entities as DERIVED_UPDATE', () => {
      const audit = engine.auditStateMutation({
        workbenchId: 'VIEWPORT_WORKBENCH',
        entityName: 'render mesh',
        modifiesSOT: false,
      });

      expect(audit.verdict).toBe('DERIVED_UPDATE');
      expect(audit.isAcceptable).toBe(true);
    });

    it('should evaluate state mutation on SESSION entities as SESSION_MUTATION', () => {
      const audit = engine.auditStateMutation({
        workbenchId: 'PATTERN_WORKBENCH',
        entityName: 'PatternEngine session',
        modifiesSOT: false,
      });

      expect(audit.verdict).toBe('SESSION_MUTATION');
      expect(audit.isAcceptable).toBe(true);
    });

    it('should evaluate state mutation on UI entities as UI_STATE_UPDATE', () => {
      const audit = engine.auditStateMutation({
        workbenchId: 'UI_PANEL_WORKBENCH',
        entityName: 'UI panel state',
        modifiesSOT: false,
      });

      expect(audit.verdict).toBe('UI_STATE_UPDATE');
      expect(audit.isAcceptable).toBe(true);
    });

    it('should flag state mutation on legacy unbacked managers as ARCHITECTURAL_GAP', () => {
      const audit = engine.auditStateMutation({
        workbenchId: 'UNBACKED_LEGACY_WORKBENCH',
        entityName: 'legacy FeatureTreeManager',
        modifiesSOT: false,
      });

      expect(audit.verdict).toBe('ARCHITECTURAL_GAP');
      expect(audit.isAcceptable).toBe(false);
    });

    it('should flag unauthorized non-SOT mutations attempting to bypass SOT as ARCHITECTURAL_GAP', () => {
      const audit = engine.auditStateMutation({
        workbenchId: 'ROGUE_WORKBENCH',
        entityName: 'render mesh',
        modifiesSOT: true, // Claiming to modify SOT while targeting render mesh
      });

      expect(audit.verdict).toBe('ARCHITECTURAL_GAP');
      expect(audit.isAcceptable).toBe(false);
    });
  });

  describe('3. Canonical SOT Mutation & Invalidation Propagation', () => {
    it('should increment document revision and notify invalidation subscribers upon canonical mutation', () => {
      let subscriberNotified = false;
      let invalidatedList: StandardStateEntity[] = [];

      engine.subscribeInvalidation((doc, entities) => {
        subscriberNotified = true;
        invalidatedList = entities;
      });

      const initialRev = sampleDoc.revision;

      const result = engine.mutateCanonicalDocument(
        'DOC-AUDIT-101',
        (doc) => {
          doc.features.push({
            featureId: 'FILLET-1',
            name: 'Edge Fillet',
            type: 'FILLET',
            parameters: { radius: 3 },
          });
        },
        'Add Fillet Feature',
        'PARAMETRIC_WORKBENCH'
      );

      expect(result.revision).toBe((initialRev as number) + 1);
      expect(result.updatedDoc.features).toHaveLength(2);
      expect(subscriberNotified).toBe(true);
      expect(invalidatedList).toContain('evaluated B-Rep');
      expect(invalidatedList).toContain('render mesh');
      expect(invalidatedList).toContain('selection');
      expect(invalidatedList).toContain('feature tree projection');
    });
  });

  describe('4. Session Staging & Canonical Commitment Flow', () => {
    it('should manage PatternEngine session and commit changes to EngineeringDocument SOT', () => {
      const session = engine.createSession(
        'PATTERN_WORKBENCH',
        'PatternEngine session',
        'DOC-AUDIT-101'
      );

      expect(session.sessionId).toBeDefined();
      expect(session.isCommitted).toBe(false);

      // Stage pattern parameters
      engine.stageSessionChange(session.sessionId, {
        patternName: 'Linear Array 4x',
        count: 4,
        spacing: 15,
      });

      // Commit session to Canonical SOT
      const commitResult = engine.commitSessionToCanonicalSOT(
        session.sessionId,
        'DOC-AUDIT-101',
        (doc, staged) => {
          doc.features.push({
            featureId: 'PATTERN-1',
            name: staged[0].patternName,
            type: 'PATTERN',
            parameters: staged[0],
          });
        }
      );

      expect(commitResult.updatedDoc.features).toHaveLength(2);
      expect(commitResult.revision).toBe(2);
      expect(session.isCommitted).toBe(true);
    });

    it('should manage DirectModeling transaction and commit B-Rep changes to SOT', () => {
      const session = engine.createSession(
        'DIRECT_MODELING_WORKBENCH',
        'DirectModeling transaction',
        'DOC-AUDIT-101'
      );

      engine.stageSessionChange(session.sessionId, {
        operation: 'PUSH_PULL',
        faceId: 'FACE-TOP-1',
        distance: 12.5,
      });

      const result = engine.commitSessionToCanonicalSOT(
        session.sessionId,
        'DOC-AUDIT-101',
        (doc, staged) => {
          doc.features.push({
            featureId: 'DM-TX-1',
            name: 'Push/Pull Face',
            type: 'DIRECT_MODELING',
            parameters: staged[0],
          });
        }
      );

      expect(result.updatedDoc.features.some((f: any) => f.featureId === 'DM-TX-1')).toBe(true);
    });
  });

  describe('5. Legacy FeatureTreeManager Bridge', () => {
    it('should bridge legacy FeatureTreeManager operations to EngineeringDocument SOT', () => {
      const legacyManager = new FeatureTreeManager();
      legacyManager.addFeature({
        domain: 'SOLID' as any,
        command: 'EXTRUDE_BOSS',
        parameters: { height: 50 },
        timestamp: new Date().toISOString(),
        source: 'LEGACY_TREE',
      });

      engine.bridgeLegacyFeatureTreeManager(legacyManager, sampleDoc);

      expect(sampleDoc.features).toHaveLength(1);
      expect(sampleDoc.features[0].name).toBe('EXTRUDE_BOSS');
      expect(sampleDoc.revision).toBe(2);
    });
  });

  describe('6. Full System State Ownership & Audit Gate', () => {
    it('should run auditAllWorkbenches and confirm PASS_COMPLIANT when all operations follow canonical rules', () => {
      // Register workbenches
      engine.registerWorkbench('PARAMETRIC_FEATURE_WORKBENCH', [
        { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
        { name: 'feature tree projection', category: 'DERIVED' },
      ]);

      engine.registerWorkbench('PATTERN_WORKBENCH', [
        { name: 'PatternEngine session', category: 'SESSION' },
        { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
      ]);

      // Execute compliant mutations
      engine.auditStateMutation({
        workbenchId: 'PARAMETRIC_FEATURE_WORKBENCH',
        entityName: 'EngineeringDocument',
        modifiesSOT: true,
      });

      engine.auditStateMutation({
        workbenchId: 'PATTERN_WORKBENCH',
        entityName: 'PatternEngine session',
        modifiesSOT: false,
      });

      const report = engine.auditAllWorkbenches();
      expect(report.overallStatus).toBe('PASS_COMPLIANT');
      expect(report.architecturalGapCount).toBe(0);
      expect(report.compliantWorkbenches).toBeGreaterThan(0);
    });
  });

  describe('7. Rigorous Transactional Atomicity & Adversarial Invariant Suite', () => {
    it('GATE 1: should atomically rollback document in-place when mutatorFn fails midway with no partial state and no revision bump', () => {
      const initialFeatureCount = sampleDoc.features.length;
      const initialRev = sampleDoc.revision;
      let subscriberNotified = false;

      engine.subscribeInvalidation(() => {
        subscriberNotified = true;
      });

      // Populate derived cache beforehand to verify it is NOT touched on rollback
      engine.setDerivedCache('DOC-AUDIT-101', 'evaluated B-Rep', { meshId: 'PRE_MUTATION_BREP' });

      // Attempt a mutatorFn that writes half-way and throws
      expect(() => {
        engine.mutateCanonicalDocument(
          'DOC-AUDIT-101',
          (doc) => {
            // Partial write 1
            doc.features.push({
              featureId: 'HALF_BAKED_FEATURE',
              name: 'Corrupted Feature',
              type: 'INVALID',
              parameters: {},
            });
            // Explode midway
            throw new Error('Geometric kernel panic: Non-manifold topology detected midway!');
          },
          'Corrupted Mutation Attempt',
          'PARAMETRIC_WORKBENCH'
        );
      }).toThrow(/Canonical mutation transaction failed and was rolled back atomically/);

      // Verify document was restored in-place
      expect(sampleDoc.features).toHaveLength(initialFeatureCount);
      expect(sampleDoc.features.some((f: any) => f.featureId === 'HALF_BAKED_FEATURE')).toBe(false);
      expect(sampleDoc.revision).toBe(initialRev);

      // Verify subscriber was NEVER notified of aborted transaction
      expect(subscriberNotified).toBe(false);

      // Verify derived cache was preserved (not falsely invalidated)
      expect(engine.getDerivedCache('DOC-AUDIT-101', 'evaluated B-Rep')).toEqual({
        meshId: 'PRE_MUTATION_BREP',
      });
    });

    it('GATE 2: should reject non-canonical direct mutation attempts on CANONICAL_SOT without any state or revision change', () => {
      const initialRev = sampleDoc.revision;
      const initialFeatures = [...sampleDoc.features];

      const audit = engine.auditStateMutation({
        workbenchId: 'ROGUE_BYPASS_WORKBENCH',
        entityName: 'EngineeringDocument',
        modifiesSOT: false, // Illegal direct access without canonical SOT flow
      });

      expect(audit.verdict).toBe('ARCHITECTURAL_GAP');
      expect(audit.isAcceptable).toBe(false);
      expect(sampleDoc.revision).toBe(initialRev);
      expect(sampleDoc.features).toEqual(initialFeatures);
    });

    it('GATE 3: should commit session with multiple staged changes in a single atomic revision bump and invalidate all derived artifacts', () => {
      const session = engine.createSession(
        'PATTERN_WORKBENCH',
        'PatternEngine session',
        'DOC-AUDIT-101'
      );

      // Stage 5 separate changes in session
      for (let i = 1; i <= 5; i++) {
        engine.stageSessionChange(session.sessionId, { instanceIndex: i, offsetMm: i * 10 });
      }

      const initialRev = sampleDoc.revision as number;

      // Seed derived cache
      engine.setDerivedCache('DOC-AUDIT-101', 'evaluated B-Rep', { brep: 'stale' });
      engine.setDerivedCache('DOC-AUDIT-101', 'render mesh', { mesh: 'stale' });
      engine.setDerivedCache('DOC-AUDIT-101', 'selection', { selectedFace: 12 });
      engine.setDerivedCache('DOC-AUDIT-101', 'feature tree projection', { tree: 'stale' });

      let invalidationEvents: StandardStateEntity[] = [];
      engine.subscribeInvalidation((_, entities) => {
        invalidationEvents = entities;
      });

      const commitResult = engine.commitSessionToCanonicalSOT(
        session.sessionId,
        'DOC-AUDIT-101',
        (doc, staged) => {
          doc.features.push({
            featureId: 'PATTERN-BATCH-1',
            name: 'Linear Pattern Array',
            type: 'PATTERN',
            parameters: { instances: staged },
          });
        }
      );

      // Exactly ONE revision increment
      expect(commitResult.revision).toBe(initialRev + 1);
      expect(session.isCommitted).toBe(true);

      // Invalidation occurred across all 4 derived artifacts
      expect(invalidationEvents).toEqual([
        'evaluated B-Rep',
        'render mesh',
        'selection',
        'feature tree projection',
      ]);
    });

    it('GATE 4: should discard/rollback uncommitted session with zero impact on Canonical SOT, revision, or document state', () => {
      const session = engine.createSession(
        'DIRECT_MODELING_WORKBENCH',
        'DirectModeling transaction',
        'DOC-AUDIT-101'
      );

      // Stage heavy modifications
      engine.stageSessionChange(session.sessionId, { deltaX: 100, deltaY: -50, deltaZ: 25 });
      engine.stageSessionChange(session.sessionId, { deltaX: 200, deltaY: -100, deltaZ: 50 });

      const initialRev = sampleDoc.revision;
      const initialFeatureCount = sampleDoc.features.length;

      // Discard session
      const discardResult = engine.discardSession(session.sessionId);
      expect(discardResult.discardedSession.sessionId).toBe(session.sessionId);
      expect(engine.getActiveSession(session.sessionId)).toBeUndefined();

      // Zero impact on document
      expect(sampleDoc.revision).toBe(initialRev);
      expect(sampleDoc.features).toHaveLength(initialFeatureCount);
    });

    it('GATE 5: should strictly prevent consumption of stale derived state by wiping derived cache on canonical mutation', () => {
      engine.setDerivedCache('DOC-AUDIT-101', 'evaluated B-Rep', { vertices: [0, 1, 2] });
      engine.setDerivedCache('DOC-AUDIT-101', 'render mesh', { triangles: [1, 2, 3] });
      engine.setDerivedCache('DOC-AUDIT-101', 'selection', { faceId: 'FACE-99' });

      expect(engine.getDerivedCache('DOC-AUDIT-101', 'evaluated B-Rep')).toBeDefined();
      expect(engine.getDerivedCache('DOC-AUDIT-101', 'render mesh')).toBeDefined();
      expect(engine.getDerivedCache('DOC-AUDIT-101', 'selection')).toBeDefined();

      // Execute legitimate canonical mutation
      engine.mutateCanonicalDocument(
        'DOC-AUDIT-101',
        (doc) => {
          doc.parameters = [{ id: 'P1', name: 'Length', value: 100 }];
        },
        'Update Parameter P1',
        'PARAMETER_WORKBENCH'
      );

      // Verify all stale caches are completely wiped
      expect(engine.getDerivedCache('DOC-AUDIT-101', 'evaluated B-Rep')).toBeUndefined();
      expect(engine.getDerivedCache('DOC-AUDIT-101', 'render mesh')).toBeUndefined();
      expect(engine.getDerivedCache('DOC-AUDIT-101', 'selection')).toBeUndefined();
    });
  });
});
