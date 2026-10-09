import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { InMemoryDocumentResolver } from '../../engine/cad-kernel/document/DocumentResolver';
import { TopologyLineageProofEngine } from '../../engine/topology/TopologyLineageProofEngine';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';
import { Solid } from '../../engine/cad-kernel/topology/TopologyContracts';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';
import { CanonicalPLMProjectionAdapter } from '../../engine/plm/CanonicalPLMProjectionAdapter';

describe('P6-006 — ASSEMBLY EVIDENCE', () => {
  beforeEach(() => {
    EngineeringPLMEngine.clear();
    EvidenceIntegrityEngine.clearRegistry();
  });

  it('P6-006-A — Assembly evidence bounds to CAD REV-A and invalidates on CAD mutation', () => {
    // 1. Create CAD Document REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P6-CAD-006',
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
      parameters: [{ id: 'depth', name: 'depth', value: 10, expression: '10' }],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalCAD = DocumentEvaluator.evaluate(docCAD);
    expect(evalCAD.success).toBe(true);
    const solidCAD = evalCAD.evaluatedShape as Solid;

    // Pick top face for assembly mate
    const topFace = solidCAD.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapEnd'))!.face;
    const canonicalRef = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_1', topFace);

    // 2. Create Assembly Document referencing CAD REV-A
    const docAsm: EngineeringDocument = {
      documentId: 'P6-ASM-006',
      revision: 1,
      type: 'ASSEMBLY',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      assemblyContext: {
        instances: [{ instanceId: 'INST_1', documentId: 'P6-CAD-006', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }],
        mates: [{ mateId: 'MATE_1', type: 'FIXED', instanceAId: 'INST_1', instanceBId: 'INST_1', entityA: { occurrencePath: 'INST_1', entityType: 'FACE', entityId: canonicalRef.topologyEntityIdentifier } }]
      },
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const resolver = new InMemoryDocumentResolver([docCAD, docAsm]);
    const evalAsm = DocumentEvaluator.evaluate(docAsm, { documentResolver: resolver });
    expect(evalAsm.success).toBe(true);

    // Register in PLM
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalCAD);
    const artAsm_A = CanonicalPLMProjectionAdapter.projectFromDocument(docAsm, evalAsm);
    EngineeringPLMEngine.registerArtifact(artCAD_A);
    EngineeringPLMEngine.registerArtifact(artAsm_A);
    EngineeringPLMEngine.addDependency(artAsm_A.artifactId, 'REV-A', artCAD_A.artifactId, 'REV-A');

    // 3. Generate Evidence for Assembly
    const asmResult = {
      resultId: 'RES-ASM-A',
      domain: 'ASSEMBLY' as const,
      executionId: 'EXEC-ASM-A',
      outputMetrics: { mateCount: 1, isResolved: true },
      kernelVersion: '3.5.2',
      isFabricated: false,
      topologyReferences: [
        {
          referenceId: canonicalRef.topologyEntityIdentifier,
          entityType: 'FACE',
          persistentTag: canonicalRef.persistentTag,
          geometricSignature: canonicalRef.geometricSignature,
          semanticRole: 'MATE_TARGET',
          lineageAncestors: []
        }
      ]
    };

    const evidenceAsm = EvidenceIntegrityEngine.generateEvidence({
      domain: 'ASSEMBLY',
      documentId: docAsm.documentId,
      documentRevision: docAsm.revision,
      actionId: 'EVALUATE',
      executionId: asmResult.executionId,
      capabilityId: 'AssemblySolver',
      featureId: 'MATE_1',
      result: asmResult,
      validation: { validationId: 'V1', passed: true, checks: [] },
      verification: { verificationId: 'VR1', verifierIdentity: 'SYS', independentVerdict: 'PASS' },
      sourceOrigin: 'REAL_KERNEL'
    });

    expect(evidenceAsm.state).toBe('VALID');

    // 4. Mutate CAD Source (REV-B)
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 20;
    docCAD.parameters[0].value = 20;

    const evalCAD_B = DocumentEvaluator.evaluate(docCAD);
    const artCAD_B = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalCAD_B);
    
    // Registering CAD REV-B should invalidate Assembly REV-A in PLM
    EngineeringPLMEngine.registerArtifact(artCAD_B);

    const asmMuted = EngineeringPLMEngine.getArtifact(artAsm_A.artifactId, 'REV-A');
    // Prove the assembly artifact is now OUTDATED
    expect(asmMuted?.status).toBe('OUTDATED');
  });
});
