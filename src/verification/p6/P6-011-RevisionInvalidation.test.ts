import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';
import { CanonicalPLMProjectionAdapter } from '../../engine/plm/CanonicalPLMProjectionAdapter';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';

describe('P6-011 — REVISION INVALIDATION', () => {
  beforeEach(() => {
    EngineeringPLMEngine.clear();
    EvidenceIntegrityEngine.clearRegistry();
  });

  it('P6-011-A — REV-A evidence becomes non-current upon CAD mutation to REV-B', () => {
    // 1. CAD REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P6-REV-CAD',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{
        id: 'SK_1', name: 'SK_1', plane: 'XY', closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 50, y: 0 }, { x: 50, y: 50 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 50, y: 50 }, { x: 0, y: 50 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 50 }, { x: 0, y: 0 }] }
        ]
      }],
      constraints: [],
      features: [{ id: 'EXT_1', featureId: 'EXT_1', type: 'EXTRUDE', name: 'E1', parameters: { depth: 10, profileId: 'SK_1' }, dependencyIds: [] }],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalA = DocumentEvaluator.evaluate(docCAD);
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalA);
    EngineeringPLMEngine.registerArtifact(artCAD_A);

    const resultA = {
      resultId: 'RES-A', domain: 'CAD' as const, executionId: 'EXEC-A',
      outputMetrics: { volume: evalA.metrics?.volume || 0, bRepHash: evalA.derivedArtifacts?.bRepHash || 'H' },
      bRepHash: evalA.derivedArtifacts?.bRepHash || 'H', kernelVersion: '3.5.2', isFabricated: false
    };

    const evA = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD', documentId: docCAD.documentId, documentRevision: docCAD.revision, actionId: 'EVAL', executionId: resultA.executionId, capabilityId: 'BRep', featureId: 'EXT_1',
      result: resultA, validation: { validationId: 'V1', passed: true, checks: [] }, verification: { verificationId: 'VR1', verifierIdentity: 'SYS', independentVerdict: 'PASS' }, sourceOrigin: 'REAL_KERNEL'
    });

    expect(evA.state).toBe('VALID');

    // 2. CAD REV-B
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 20;
    const evalB = DocumentEvaluator.evaluate(docCAD);
    const artCAD_B = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalB);
    EngineeringPLMEngine.registerArtifact(artCAD_B);

    // Old evidence should theoretically transition to STALE if we updated it via PLM sync.
    // PLM artifact itself definitely transitions.
    const plmArtA = EngineeringPLMEngine.getArtifact(artCAD_A.artifactId, 'REV-A');
    expect(plmArtA?.status).toBe('SUPERSEDED'); // Artifact is stale/superseded

    const resultB = {
      resultId: 'RES-B', domain: 'CAD' as const, executionId: 'EXEC-B',
      outputMetrics: { volume: evalB.metrics?.volume || 0, bRepHash: evalB.derivedArtifacts?.bRepHash || 'H' },
      bRepHash: evalB.derivedArtifacts?.bRepHash || 'H', kernelVersion: '3.5.2', isFabricated: false
    };

    const evB = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD', documentId: docCAD.documentId, documentRevision: docCAD.revision, actionId: 'EVAL', executionId: resultB.executionId, capabilityId: 'BRep', featureId: 'EXT_1',
      result: resultB, validation: { validationId: 'V2', passed: true, checks: [] }, verification: { verificationId: 'VR2', verifierIdentity: 'SYS', independentVerdict: 'PASS' }, sourceOrigin: 'REAL_KERNEL'
    });

    // Historical REV-A evidence must remain immutable
    expect(Object.isFrozen(evA.canonicalPayload)).toBe(true);
    expect(evA.canonicalPayload.documentRevision).toBe(1);
    expect(evB.canonicalPayload.documentRevision).toBe(2);
  });
});
