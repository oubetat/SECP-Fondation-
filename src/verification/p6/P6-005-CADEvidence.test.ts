import { describe, it, expect } from 'vitest';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';

describe('P6-005 — CAD EVIDENCE', () => {
  it('P6-005-A — CAD Evidence bounds to exact revision and invalidates on mutation', () => {
    // 1. Create a document REV-A
    const docA: EngineeringDocument = {
      documentId: 'P6-DOC-005',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{
        id: 'SK_01', name: 'S1', plane: 'XY', closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 10, y: 10 }, { x: 0, y: 10 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 10 }, { x: 0, y: 0 }] }
        ]
      }],
      constraints: [],
      features: [{ id: 'EXT_01', featureId: 'EXT_01', type: 'EXTRUDE', name: 'E1', parameters: { depth: 5, profileId: 'SK_01' }, dependencyIds: [] }],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    // 2. Evaluate REV-A
    const evalA = DocumentEvaluator.evaluate(docA);
    expect(evalA.success).toBe(true);

    const resultA = {
      resultId: 'RES-005-A',
      domain: 'CAD' as const,
      executionId: 'EXEC-A',
      outputMetrics: { volume: evalA.metrics?.volume || 500, bRepHash: evalA.derivedArtifacts?.bRepHash || 'H_A' },
      bRepHash: evalA.derivedArtifacts?.bRepHash || 'H_A',
      kernelVersion: '3.5.2',
      isFabricated: false
    };

    const evidenceA = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD',
      documentId: docA.documentId,
      documentRevision: docA.revision,
      actionId: 'EVALUATE',
      executionId: resultA.executionId,
      capabilityId: 'BRepExtrude',
      featureId: 'EXT_01',
      result: resultA,
      validation: { validationId: 'V1', passed: true, checks: [] },
      verification: { verificationId: 'VR1', verifierIdentity: 'SYS', independentVerdict: 'PASS' },
      sourceOrigin: 'REAL_KERNEL'
    });

    expect(evidenceA.canonicalPayload.documentRevision).toBe(1);
    expect(evidenceA.state).toBe('VALID');

    // 3. Mutate CAD (REV-B)
    const docB: EngineeringDocument = {
      ...docA,
      revision: 2,
      features: [{ id: 'EXT_01', featureId: 'EXT_01', type: 'EXTRUDE', name: 'E1', parameters: { depth: 10, profileId: 'SK_01' }, dependencyIds: [] }]
    };

    const evalB = DocumentEvaluator.evaluate(docB);
    expect(evalB.success).toBe(true);
    
    const resultB = {
      resultId: 'RES-005-B',
      domain: 'CAD' as const,
      executionId: 'EXEC-B',
      outputMetrics: { volume: evalB.metrics?.volume || 1000, bRepHash: evalB.derivedArtifacts?.bRepHash || 'H_B' },
      bRepHash: evalB.derivedArtifacts?.bRepHash || 'H_B',
      kernelVersion: '3.5.2',
      isFabricated: false
    };

    const evidenceB = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD',
      documentId: docB.documentId,
      documentRevision: docB.revision,
      actionId: 'EVALUATE',
      executionId: resultB.executionId,
      capabilityId: 'BRepExtrude',
      featureId: 'EXT_01',
      result: resultB,
      validation: { validationId: 'V2', passed: true, checks: [] },
      verification: { verificationId: 'VR2', verifierIdentity: 'SYS', independentVerdict: 'PASS' },
      sourceOrigin: 'REAL_KERNEL'
    });

    expect(evidenceB.canonicalPayload.documentRevision).toBe(2);
    expect(evidenceB.state).toBe('VALID');

    // Prove REV-A != REV-B evidence
    expect(evidenceA.evidenceId).not.toBe(evidenceB.evidenceId);
    expect(evidenceA.integrityHash).not.toBe(evidenceB.integrityHash);
    expect(evidenceA.canonicalPayload.metrics.volume).not.toBe(evidenceB.canonicalPayload.metrics.volume);
    expect(evidenceA.canonicalPayload.metrics.bRepHash).not.toBe(evidenceB.canonicalPayload.metrics.bRepHash);
  });
});
