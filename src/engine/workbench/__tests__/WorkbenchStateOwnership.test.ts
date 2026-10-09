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
});
