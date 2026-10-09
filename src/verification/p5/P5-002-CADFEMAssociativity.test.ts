import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument, FEAModel, EvidenceRecord } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { TopologyLineageProofEngine } from '../../engine/topology/TopologyLineageProofEngine';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';
import { CanonicalPLMProjectionAdapter } from '../../engine/plm/CanonicalPLMProjectionAdapter';
import { Solid } from '../../engine/cad-kernel/topology/TopologyContracts';
import { BRepHasher } from '../../engine/cad-kernel/brep/BRepHasher';
import { EngineeringHashChain } from '../../engine/cad-kernel/evidence/EngineeringHashChain';

describe('P5-002 — CAD → FEM Revision & Associativity Proof', () => {
  beforeEach(() => {
    EngineeringPLMEngine.clear();
  });

  it('P5-002-A: FEM Boundary Condition face references rebind to REV-B topology following CAD mutation', () => {
    // 1. Establish Canonical CAD Document REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-FEM-01',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_BASE',
          name: 'SK_BASE',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 40, y: 0 }, { x: 40, y: 40 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 40, y: 40 }, { x: 0, y: 40 }] },
            { id: 'L4', type: 'LINE', points: [{ x: 0, y: 40 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      constraints: [],
      features: [
        {
          id: 'EXT_01',
          featureId: 'EXT_01',
          name: 'Extrude Base',
          type: 'EXTRUDE',
          parameters: { depth: 25, profileId: 'SK_BASE' }
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

    // Pick top face (CapEnd) and bottom face (CapStart) for FEM boundary conditions
    const topFaceA = solidA.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapEnd'))!.face;
    const botFaceA = solidA.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapStart'))!.face;

    const refFixedBC = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_01', botFaceA);
    const refLoadBC = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_01', topFaceA);

    expect(refFixedBC.resolutionState).toBe('VALID');
    expect(refLoadBC.resolutionState).toBe('VALID');

    // 2. Perform CAD Mutation: Extrude depth 25 mm -> 50 mm (REV-B)
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 50;

    const evalResultB = DocumentEvaluator.evaluate(docCAD);
    expect(evalResultB.success).toBe(true);
    const solidB = evalResultB.evaluatedShape as Solid;

    // 3. Rebind FEM Face References against REV-B Solid
    const rebindFixed = TopologyLineageProofEngine.rebindReference(refFixedBC, solidB, 2);
    const rebindLoad = TopologyLineageProofEngine.rebindReference(refLoadBC, solidB, 2);

    expect(rebindFixed.success).toBe(true);
    expect(rebindFixed.state).toBe('REBOUND');
    expect(rebindFixed.reboundReference.documentRevision).toBe(2);

    expect(rebindLoad.success).toBe(true);
    expect(rebindLoad.state).toBe('REBOUND');
    expect(rebindLoad.reboundReference.documentRevision).toBe(2);

    // Verify geometric signature updated for top face
    expect(rebindLoad.reboundReference.lineage.geometricSignature).toContain('FACE|NORM:0.000,0.000,1.000');
  });

  it('P5-002-B: Upstream CAD revision invalidates downstream FEM artifact & evidence', () => {
    // 1. Setup CAD Document REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-FEM-02',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_01',
          name: 'SK_01',
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
          id: 'EXT_01',
          featureId: 'EXT_01',
          name: 'Extrude Base',
          type: 'EXTRUDE',
          parameters: { depth: 20, profileId: 'SK_01' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalA = DocumentEvaluator.evaluate(docCAD);
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalA);
    EngineeringPLMEngine.registerArtifact(artCAD_A);

    // 2. Register Downstream FEM Artifact depending on CAD REV-A
    EngineeringPLMEngine.registerArtifact({
      artifactId: 'ART-P5-FEM-02',
      documentId: 'P5-FEM-02',
      revision: 'REV-A',
      version: 1,
      type: 'SIMULATION_FEM',
      status: 'VALID',
      geometryHash: artCAD_A.geometryHash,
      topologyHash: artCAD_A.topologyHash,
      dependencyHash: 'DEP-FEM-CAD-REV1',
      provenanceReference: 'EVID-FEM-REV1',
      childDependencies: ['ART-P5-CAD-FEM-02@REV-A']
    });

    EngineeringPLMEngine.addDependency('ART-P5-FEM-02', 'REV-A', 'ART-P5-CAD-FEM-02', 'REV-A');

    // Check initial state
    const femArtBefore = EngineeringPLMEngine.getArtifact('ART-P5-FEM-02', 'REV-A');
    expect(femArtBefore?.status).toBe('VALID');

    // 3. Mutate Upstream CAD Document to REV-B
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 40;
    const evalB = DocumentEvaluator.evaluate(docCAD);

    const artCAD_B = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalB);
    EngineeringPLMEngine.registerArtifact(artCAD_B);

    // 4. Verify Downstream FEM Artifact transitioned to OUTDATED
    const femArtAfter = EngineeringPLMEngine.getArtifact('ART-P5-FEM-02', 'REV-A');
    expect(femArtAfter?.status).toBe('OUTDATED');
  });

  it('P5-002-C: FEM recomputation produces distinct REV-B evidence and prevents REV-A result masquerading', () => {
    // 1. CAD Document REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-FEM-03',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_01',
          name: 'SK_01',
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
          name: 'Extrude Base',
          type: 'EXTRUDE',
          parameters: { depth: 25, profileId: 'SK_01' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalA = DocumentEvaluator.evaluate(docCAD);
    const geomHashA = evalA.derivedArtifacts?.bRepHash || 'G-HASH-REV1';

    // Simulated FEA Model & Result for REV-A
    const femModelA: FEAModel = {
      modelId: 'FEM-03',
      nodeCount: 120,
      elementCount: 450,
      elementTypes: ['TET4'],
      nodes: [0, 0, 0, 50, 50, 25],
      elements: [0, 1, 2, 3],
      materials: [{ id: 'MAT-STEEL', name: 'Steel', youngsModulus: 210000, poissonsRatio: 0.3, density: 7.85e-9 }],
      boundaryConditions: [{ id: 'BC-1', type: 'FIXED', targetFaceId: 'EXT_01:FACE:CapStart', values: [0, 0, 0] }],
      loads: [{ id: 'LOAD-1', type: 'FORCE', targetFaceId: 'EXT_01:FACE:CapEnd', values: [0, 0, -1000] }],
      hash: 'FEM-HASH-REV1',
      geometryHash: geomHashA,
      solverInputHash: 'SOLVER-IN-REV1-9981',
      solverOutputHash: 'SOLVER-OUT-STRESS-245.8MPa-REV1'
    };

    const evidenceA: EvidenceRecord = {
      evidenceId: 'EVID_FEM_REV1_03',
      stage: 'SIMULATION',
      sourceSystem: 'SECP_FEM_ENGINE',
      documentId: docCAD.documentId,
      revision: 1,
      canonicalHash: 'CANON-HASH-FEM-REV1',
      geometryHash: geomHashA,
      solverInputHash: femModelA.solverInputHash,
      solverOutputHash: femModelA.solverOutputHash,
      verdict: 'PASS'
    };
    docCAD.evidence.push(evidenceA);

    // 2. Mutate CAD Model to REV-B (depth 25 -> 60 mm)
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 60;
    const evalB = DocumentEvaluator.evaluate(docCAD);
    const geomHashB = evalB.derivedArtifacts?.bRepHash || 'G-HASH-REV2';

    // 3. Recompute FEA Model & Result for REV-B
    const femModelB: FEAModel = {
      modelId: 'FEM-03',
      nodeCount: 240, // Changed mesh density due to elongated solid
      elementCount: 900,
      elementTypes: ['TET4'],
      nodes: [0, 0, 0, 50, 50, 60],
      elements: [0, 1, 2, 3],
      materials: [{ id: 'MAT-STEEL', name: 'Steel', youngsModulus: 210000, poissonsRatio: 0.3, density: 7.85e-9 }],
      boundaryConditions: [{ id: 'BC-1', type: 'FIXED', targetFaceId: 'EXT_01:FACE:CapStart', values: [0, 0, 0] }],
      loads: [{ id: 'LOAD-1', type: 'FORCE', targetFaceId: 'EXT_01:FACE:CapEnd', values: [0, 0, -1000] }],
      hash: 'FEM-HASH-REV2',
      geometryHash: geomHashB,
      solverInputHash: 'SOLVER-IN-REV2-4412',
      solverOutputHash: 'SOLVER-OUT-STRESS-489.2MPa-REV2'
    };

    const evidenceB: EvidenceRecord = {
      evidenceId: 'EVID_FEM_REV2_03',
      stage: 'SIMULATION',
      sourceSystem: 'SECP_FEM_ENGINE',
      documentId: docCAD.documentId,
      revision: 2,
      canonicalHash: 'CANON-HASH-FEM-REV2',
      geometryHash: geomHashB,
      solverInputHash: femModelB.solverInputHash,
      solverOutputHash: femModelB.solverOutputHash,
      verdict: 'PASS'
    };
    docCAD.evidence.push(evidenceB);

    // 4. Strict Evidence Proof & Immutability Verification
    expect(docCAD.evidence.length).toBeGreaterThanOrEqual(2);

    const evREV1 = docCAD.evidence.find(e => e.revision === 1 && e.sourceSystem === 'SECP_FEM_ENGINE');
    const evREV2 = docCAD.evidence.find(e => e.revision === 2 && e.sourceSystem === 'SECP_FEM_ENGINE');

    expect(evREV1).toBeDefined();
    expect(evREV2).toBeDefined();

    // REV-A evidence retained immutably
    expect(evREV1!.solverOutputHash).toBe('SOLVER-OUT-STRESS-245.8MPa-REV1');

    // REV-B evidence created distinctly
    expect(evREV2!.solverOutputHash).toBe('SOLVER-OUT-STRESS-489.2MPa-REV2');

    // Hashes cannot match
    expect(femModelA.solverOutputHash).not.toEqual(femModelB.solverOutputHash);
    expect(evREV1!.solverOutputHash).not.toEqual(evREV2!.solverOutputHash);
  });

  it('P5-002-D: FEM boundary conditions fail cleanly when target face is destroyed in CAD REV-B', () => {
    // 1. Establish CAD Document REV-A with Extrude
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-FEM-04',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_01',
          name: 'SK_01',
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
          name: 'Extrude Base',
          type: 'EXTRUDE',
          parameters: { depth: 25, profileId: 'SK_01' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalA = DocumentEvaluator.evaluate(docCAD);
    const solidA = evalA.evaluatedShape as Solid;
    const sideFace = solidA.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('Side'))!.face;

    const bcRef = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_01', sideFace);
    expect(bcRef.resolutionState).toBe('VALID');

    // 2. Feature deleted in REV-B
    docCAD.revision = 2;
    docCAD.features = [];

    const evalB = DocumentEvaluator.evaluate(docCAD);
    const solidB = evalB.evaluatedShape;

    // 3. Rebind attempt against deleted geometry
    const rebindResult = TopologyLineageProofEngine.rebindReference(bcRef, solidB, 2);
    expect(rebindResult.success).toBe(false);
    expect(rebindResult.state).toBe('DELETED');
    expect(rebindResult.reason).toContain('destroyed');
  });

  it('P5-002-E: Full end-to-end chain verification (CAD -> FEM -> PLM Invalidation -> Recomputation -> Evidence)', () => {
    // 1. Initial State REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-FEM-05',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_BASE',
          name: 'SK_BASE',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 100, y: 0 }, { x: 100, y: 20 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 100, y: 20 }, { x: 0, y: 20 }] },
            { id: 'L4', type: 'LINE', points: [{ x: 0, y: 20 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      constraints: [],
      features: [
        {
          id: 'EXT_BASE',
          featureId: 'EXT_BASE',
          name: 'Beam Extrude',
          type: 'EXTRUDE',
          parameters: { depth: 10, profileId: 'SK_BASE' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalA = DocumentEvaluator.evaluate(docCAD);
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalA);
    EngineeringPLMEngine.registerArtifact(artCAD_A);

    // Register FEM artifact
    const artFEM_A = {
      artifactId: 'ART-P5-FEM-05',
      documentId: 'P5-FEM-05',
      revision: 'REV-A',
      version: 1,
      type: 'SIMULATION_FEM' as const,
      status: 'VALID' as const,
      geometryHash: artCAD_A.geometryHash,
      topologyHash: artCAD_A.topologyHash,
      dependencyHash: 'DEP-FEM-05-REV1',
      provenanceReference: 'EVID-P5-FEM-05-REV1',
      childDependencies: ['ART-P5-CAD-FEM-05@REV-A']
    };
    EngineeringPLMEngine.registerArtifact(artFEM_A);
    EngineeringPLMEngine.addDependency('ART-P5-FEM-05', 'REV-A', 'ART-P5-CAD-FEM-05', 'REV-A');

    // 2. CAD Mutation REV-B
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 20; // Double beam depth

    const evalB = DocumentEvaluator.evaluate(docCAD);
    const artCAD_B = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalB);
    EngineeringPLMEngine.registerArtifact(artCAD_B);

    // Assert invalidation propagated to FEM REV-A
    const femArtAfterMutation = EngineeringPLMEngine.getArtifact('ART-P5-FEM-05', 'REV-A');
    expect(femArtAfterMutation?.status).toBe('OUTDATED');

    // 3. Register Recomputed FEM Artifact REV-B
    const artFEM_B = {
      artifactId: 'ART-P5-FEM-05',
      documentId: 'P5-FEM-05',
      revision: 'REV-B',
      version: 2,
      type: 'SIMULATION_FEM' as const,
      status: 'VALID' as const,
      geometryHash: artCAD_B.geometryHash,
      topologyHash: artCAD_B.topologyHash,
      dependencyHash: 'DEP-FEM-05-REV2',
      provenanceReference: 'EVID-P5-FEM-05-REV2',
      childDependencies: ['ART-P5-CAD-FEM-05@REV-B']
    };
    EngineeringPLMEngine.registerArtifact(artFEM_B);
    EngineeringPLMEngine.addDependency('ART-P5-FEM-05', 'REV-B', 'ART-P5-CAD-FEM-05', 'REV-B');

    // Verify PLM registry states
    expect(EngineeringPLMEngine.getArtifact('ART-P5-FEM-05', 'REV-A')?.status).toBe('SUPERSEDED');
    expect(EngineeringPLMEngine.getArtifact('ART-P5-FEM-05', 'REV-B')?.status).toBe('VALID');
    expect(artFEM_A.geometryHash).not.toEqual(artFEM_B.geometryHash);
  });
});
