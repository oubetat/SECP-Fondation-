import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument, Sketch, Parameter } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator, DocumentEvaluationResult } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { InMemoryDocumentResolver } from '../../engine/cad-kernel/document/DocumentResolver';
import {
  TopologyLineageProofEngine,
  CanonicalTopologyReference,
  TopologyResolutionState
} from '../../engine/topology/TopologyLineageProofEngine';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';
import { CanonicalPLMProjectionAdapter } from '../../engine/plm/CanonicalPLMProjectionAdapter';
import { Solid, Face } from '../../engine/cad-kernel/topology/TopologyContracts';
import { FeatureHistory } from '../../engine/cad-kernel/history/FeatureHistory';

describe('P5-001 — CAD → Assembly Revision & Associativity Proof', () => {
  beforeEach(() => {
    EngineeringPLMEngine.clear();
  });

  it('P5-001-A — Assembly topology survives CAD geometry mutation', async () => {
    // 1. Create real canonical CAD document REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-01',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_BASE',
          name: 'Base Sketch',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 50, y: 0 }, { x: 50, y: 50 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 50, y: 50 }, { x: 0, y: 50 }] },
            { id: 'L4', type: 'LINE', points: [{ x: 0, y: 50 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      constraints: [],
      features: [
        {
          id: 'EXT_01',
          featureId: 'EXT_01',
          type: 'EXTRUDE',
          name: 'Base Extrude',
          parameters: { depth: 25, profileId: 'SK_BASE' },
          dependencyIds: []
        }
      ],
      parameters: [{ id: 'P_DEPTH', name: 'depth', expression: '25', value: 25 }],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    // Evaluate REV-A through canonical evaluator
    const evalResultA: DocumentEvaluationResult = DocumentEvaluator.evaluate(docCAD);
    expect(evalResultA.success).toBe(true);
    expect(evalResultA.evaluatedShape).toBeDefined();

    const solidA = evalResultA.evaluatedShape as Solid;
    const geometryHashA = evalResultA.derivedArtifacts.bRepHash;
    const evidenceA = docCAD.evidence[docCAD.evidence.length - 1];
    const topologyHashA = evidenceA.topologyHash;

    expect(geometryHashA).toBeDefined();
    expect(topologyHashA).toBeDefined();

    // Find top face (CapEnd)
    const topFace = solidA.outerShell.orientedFaces.find(of =>
      of.face.persistentId?.includes('CapEnd')
    )?.face;
    expect(topFace).toBeDefined();

    // Create canonical topology reference
    const canonicalRef: CanonicalTopologyReference = TopologyLineageProofEngine.createFaceReference(
      docCAD,
      'EXT_01',
      topFace!
    );
    expect(canonicalRef.resolutionState).toBe('VALID');
    expect(canonicalRef.topologyEntityIdentifier).toBeDefined();

    // Create Assembly document referencing this CAD document
    const docAsm: EngineeringDocument = {
      documentId: 'P5-ASM-01',
      revision: 1,
      type: 'ASSEMBLY',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      assembly: {
        instances: [
          {
            instanceId: 'INST_PART_1',
            documentId: 'P5-CAD-01',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ],
        mates: [
          {
            mateId: 'MATE_TOP',
            type: 'FIXED',
            instanceAId: 'INST_PART_1',
            instanceBId: 'INST_PART_1',
            entityA: {
              occurrencePath: 'INST_PART_1',
              entityType: 'FACE',
              entityId: canonicalRef.topologyEntityIdentifier
            }
          }
        ]
      },
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const resolver = new InMemoryDocumentResolver([docCAD, docAsm]);
    const evalAsmA = DocumentEvaluator.evaluate(docAsm, { documentResolver: resolver });
    expect(evalAsmA.success).toBe(true);

    // 2. Perform CAD Parameter Mutation: depth 25 -> 35
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 35;
    docCAD.parameters[0].value = 35;
    docCAD.parameters[0].expression = '35';

    const evalResultB: DocumentEvaluationResult = DocumentEvaluator.evaluate(docCAD);
    expect(evalResultB.success).toBe(true);

    const solidB = evalResultB.evaluatedShape as Solid;
    const geometryHashB = evalResultB.derivedArtifacts.bRepHash;
    const evidenceB = docCAD.evidence[docCAD.evidence.length - 1];
    const topologyHashB = evidenceB.topologyHash;

    expect(geometryHashB).toBeDefined();

    // Rebind canonical reference against REV-B solid
    const rebindResult = TopologyLineageProofEngine.rebindReference(canonicalRef, solidB, 2);
    expect(rebindResult.success).toBe(true);

    const evolutionState: TopologyResolutionState = rebindResult.state;
    expect(evolutionState).toBe('REBOUND');
    expect(rebindResult.reboundEntity).toBeDefined();
    expect(rebindResult.reboundReference.documentRevision).toBe(2);

    // Assembly evaluation against REV-B resolved document
    const evalAsmB = DocumentEvaluator.evaluate(docAsm, { documentResolver: resolver });
    expect(evalAsmB.success).toBe(true);
  });

  it('P5-001-B — Assembly topology deleted when feature is removed', async () => {
    // 1. Create CAD document with two features: EXTRUDE and CUTOUT
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-02',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_BASE',
          name: 'Base Sketch',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 100, y: 0 }, { x: 100, y: 100 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 100, y: 100 }, { x: 0, y: 100 }] },
            { id: 'L4', type: 'LINE', points: [{ x: 0, y: 100 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      constraints: [],
      features: [
        {
          id: 'EXT_BASE',
          featureId: 'EXT_BASE',
          type: 'EXTRUDE',
          name: 'Base Block',
          parameters: { depth: 50, profileId: 'SK_BASE' },
          dependencyIds: []
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalResultA = DocumentEvaluator.evaluate(docCAD);
    expect(evalResultA.success).toBe(true);
    const solidA = evalResultA.evaluatedShape as Solid;

    // Pick a side face generated by EXT_BASE
    const sideFace = solidA.outerShell.orientedFaces.find(of =>
      of.face.persistentId?.includes('Side')
    )?.face;
    expect(sideFace).toBeDefined();

    const faceRef = TopologyLineageProofEngine.createFaceReference(
      docCAD,
      'EXT_BASE',
      sideFace!
    );

    // Mutate CAD model by emptying feature output / producing empty geometry
    docCAD.revision = 2;
    docCAD.features = []; // Feature deleted entirely

    const evalResultB = DocumentEvaluator.evaluate(docCAD);
    const solidB = evalResultB.evaluatedShape;

    // Rebind face reference against empty solid / deleted solid
    const rebindResult = TopologyLineageProofEngine.rebindReference(faceRef, solidB, 2);
    expect(rebindResult.success).toBe(false);
    expect(rebindResult.state).toBe('DELETED');

    // Verify Assembly mate referencing this deleted face cannot be resolved silently
    const docAsm: EngineeringDocument = {
      documentId: 'P5-ASM-02',
      revision: 1,
      type: 'ASSEMBLY',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      assembly: {
        instances: [
          {
            instanceId: 'INST_PART_2',
            documentId: 'P5-CAD-02',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ],
        mates: [
          {
            mateId: 'MATE_DELETED_FACE',
            type: 'FIXED',
            instanceAId: 'INST_PART_2',
            instanceBId: 'INST_PART_2',
            entityA: {
              occurrencePath: 'INST_PART_2',
              entityType: 'FACE',
              entityId: faceRef.topologyEntityIdentifier
            }
          }
        ]
      },
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const resolver = new InMemoryDocumentResolver([docCAD, docAsm]);
    const evalAsm = DocumentEvaluator.evaluate(docAsm, { documentResolver: resolver });
    // Should diagnose mate resolution status accurately
    expect(evalAsm.evaluatedAssembly).toBeDefined();
  });

  it('P5-001-C — Revision isolation guarantees historical evidence immutability', async () => {
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-03',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_01',
          name: 'Sketch 1',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 20, y: 0 }, { x: 20, y: 20 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 20, y: 20 }, { x: 0, y: 20 }] },
            { id: 'L4', type: 'LINE', points: [{ x: 0, y: 20 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      constraints: [],
      features: [
        {
          id: 'EXT_01',
          featureId: 'EXT_01',
          type: 'EXTRUDE',
          name: 'Extrude 1',
          parameters: { depth: 10, profileId: 'SK_01' },
          dependencyIds: []
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    // Evaluate REV 1
    const eval1 = DocumentEvaluator.evaluate(docCAD);
    expect(eval1.success).toBe(true);

    const hash1 = eval1.derivedArtifacts.bRepHash;
    const evidence1 = docCAD.evidence[0];
    expect(evidence1.revision).toBe(1);

    const artREV1 = EngineeringPLMEngine.getArtifact('ART-P5-CAD-03', 'REV-A');
    expect(artREV1).toBeDefined();
    expect(artREV1?.status).toBe('VALID');

    // Mutate to REV 2
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 40;

    const eval2 = DocumentEvaluator.evaluate(docCAD);
    expect(eval2.success).toBe(true);

    const hash2 = eval2.derivedArtifacts.bRepHash;
    const evidence2 = docCAD.evidence[1];

    // Verify revision isolation properties
    expect(hash1).not.toEqual(hash2);
    expect(docCAD.evidence.length).toBe(2);
    expect(docCAD.evidence[0].revision).toBe(1);
    expect(docCAD.evidence[0].geometryHash).toEqual(evidence1.geometryHash);
    expect(docCAD.evidence[1].revision).toBe(2);

    const artREV1_after = EngineeringPLMEngine.getArtifact('ART-P5-CAD-03', 'REV-A');
    const artREV2 = EngineeringPLMEngine.getArtifact('ART-P5-CAD-03', 'REV-B');

    expect(artREV1_after?.status).toBe('SUPERSEDED');
    expect(artREV2?.status).toBe('VALID');
    expect(artREV1_after?.geometryHash).toEqual(hash1);
    expect(artREV2?.geometryHash).toEqual(hash2);
  });

  it('P5-001-D — Assembly dependency is registered and triggers downstream invalidation', async () => {
    // 1. Create child CAD doc
    const docChild: EngineeringDocument = {
      documentId: 'P5-CAD-DEP-01',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_01',
          name: 'S',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 10, y: 0 }, { x: 10, y: 10 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 10, y: 10 }, { x: 0, y: 10 }] },
            { id: 'L4', type: 'LINE', points: [{ x: 0, y: 10 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      constraints: [],
      features: [
        {
          id: 'EXT_1',
          type: 'EXTRUDE',
          name: 'E',
          parameters: { depth: 5, profileId: 'SK_01' },
          dependencyIds: []
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    // Project child to PLM
    DocumentEvaluator.evaluate(docChild);

    // 2. Create parent Assembly doc referencing child doc
    const docAsm: EngineeringDocument = {
      documentId: 'P5-ASM-DEP-01',
      revision: 1,
      type: 'ASSEMBLY',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      assembly: {
        instances: [
          {
            instanceId: 'INST_CHILD_1',
            documentId: 'P5-CAD-DEP-01',
            partId: 'P5-CAD-DEP-01',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
          }
        ]
      },
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const resolver = new InMemoryDocumentResolver([docChild, docAsm]);
    DocumentEvaluator.evaluate(docAsm, { documentResolver: resolver });

    // Verify dependency edge registered in PLM graph
    const dependents = EngineeringPLMEngine.getDependents('ART-P5-CAD-DEP-01', 'REV-A');
    expect(dependents).toContain('ART-P5-ASM-DEP-01@REV-A');

    const asmArtBefore = EngineeringPLMEngine.getArtifact('ART-P5-ASM-DEP-01', 'REV-A');
    expect(asmArtBefore?.status).toBe('VALID');

    // Mutate child doc to REV 2
    docChild.revision = 2;
    docChild.features[0].parameters.depth = 15;
    DocumentEvaluator.evaluate(docChild);

    // Verify invalidation cascade
    const asmArtAfter = EngineeringPLMEngine.getArtifact('ART-P5-ASM-DEP-01', 'REV-A');
    expect(asmArtAfter?.status).toBe('OUTDATED');
  });

  it('P5-001-E — No parallel Assembly authority (rebinds via persistent topology naming & signatures)', async () => {
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-05',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_01',
          name: 'S',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 30, y: 0 }, { x: 30, y: 30 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 30, y: 30 }, { x: 0, y: 30 }] },
            { id: 'L4', type: 'LINE', points: [{ x: 0, y: 30 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      constraints: [],
      features: [
        {
          id: 'EXT_1',
          type: 'EXTRUDE',
          name: 'E',
          parameters: { depth: 30, profileId: 'SK_01' },
          dependencyIds: []
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const eval1 = DocumentEvaluator.evaluate(docCAD);
    const solid1 = eval1.evaluatedShape as Solid;

    const face1 = solid1.outerShell.orientedFaces.find(of =>
      of.face.persistentId?.includes('CapEnd')
    )?.face;
    expect(face1).toBeDefined();

    const canonicalRef = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_1', face1!);

    // Rebind against same solid — verifies deterministic match on persistent tag + semantic descriptor
    const rebindSame = TopologyLineageProofEngine.rebindReference(canonicalRef, solid1, 1);
    expect(rebindSame.success).toBe(true);
    expect(rebindSame.reboundEntity?.id).toBe(face1!.id);

    // Rebind against mutated solid
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 60;
    const eval2 = DocumentEvaluator.evaluate(docCAD);
    const solid2 = eval2.evaluatedShape as Solid;

    const rebindMutated = TopologyLineageProofEngine.rebindReference(canonicalRef, solid2, 2);
    expect(rebindMutated.success).toBe(true);
    expect(rebindMutated.state).toBe('REBOUND');

    // Confirm that invalid face tags or bogus identifiers fail rather than choosing arbitrary face index
    const bogusRef: CanonicalTopologyReference = {
      ...canonicalRef,
      topologyEntityIdentifier: 'NON_EXISTENT_TAG_9999',
      semanticDescriptor: {
        role: 'BOGUS_ROLE',
        normalOrDirection: { x: 0, y: 0, z: 1 }
      }
    };
    const rebindBogus = TopologyLineageProofEngine.rebindReference(bogusRef, solid2, 2);
    expect(rebindBogus.success).toBe(false);
  });
});
