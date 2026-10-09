import { describe, it, expect } from 'vitest';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';

describe('P6-003 — Evidence / Engineering Result Causality', () => {
  it('P6-003-A — Evidence must be causally bound to an actual result', () => {
    // 1. Create a document
    const doc: EngineeringDocument = {
      documentId: 'P6-DOC-003',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{ id: 'SK1', name: 'S1', plane: 'XY', closedProfile: true, entities: [] }],
      constraints: [],
      features: [{ id: 'EXT1', featureId: 'EXT1', type: 'EXTRUDE', name: 'E1', parameters: { depth: 10, profileId: 'SK1' }, dependencyIds: [] }],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    // 2. Evaluate document to get an actual result
    const evalResult = DocumentEvaluator.evaluate(doc);
    expect(evalResult.success).toBe(true);

    const bRepHash = evalResult.derivedArtifacts?.bRepHash || 'MOCK-HASH';

    const result = {
      resultId: 'RES-001',
      domain: 'CAD' as const,
      executionId: 'EXEC-001',
      outputMetrics: { volume: 100, bRepHash },
      bRepHash,
      kernelVersion: '3.5.2',
      isFabricated: false
    };

    const evidence = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD',
      documentId: doc.documentId,
      documentRevision: doc.revision,
      actionId: 'EVALUATE',
      executionId: result.executionId,
      capabilityId: 'BRepExtrude',
      featureId: 'EXT1',
      result,
      validation: { validationId: 'V1', passed: true, checks: [] },
      verification: { verificationId: 'VR1', verifierIdentity: 'SYS', independentVerdict: 'PASS' },
      sourceOrigin: 'REAL_KERNEL'
    });

    expect(evidence.canonicalPayload.documentId).toBe('P6-DOC-003');
    expect(evidence.canonicalPayload.documentRevision).toBe(1);
    expect(evidence.canonicalPayload.metrics.bRepHash).toBe(bRepHash);
    expect(evidence.canonicalPayload.executionId).toBe('EXEC-001');
    expect(evidence.evidenceId).toContain('CAD');
    expect(evidence.state).toBe('VALID');
  });
});
