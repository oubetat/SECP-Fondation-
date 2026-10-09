/**
 * P5-005: Cross-Domain Dependency Graph & Multi-Workbench Invalidation Proof
 * 
 * CORE THESIS:
 * "When the canonical engineering truth changes once, the entire dependent
 * engineering ecosystem changes correctly — and no stale, disconnected,
 * fabricated, or parallel state can survive as current truth."
 * 
 * STRICT ENGINEERING CONSTRAINTS:
 * - No `any`, no `unknown`, no `@ts-ignore`, no unsafe casts.
 * - No `Date.now()`, `Math.random()`, or nondeterministic timestamps.
 * - No fixture-only dependency graphs or synthetic state bypass.
 * - Single Canonical Authority: EngineeringDocument -> DocumentEvaluator -> EngineeringPLMEngine.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EngineeringDocument,
  AssemblyInstance,
  AssemblyMate
} from '../../engine/cad-kernel/document/CADDocument';
import {
  DocumentEvaluator,
  DocumentEvaluationResult
} from '../../engine/cad-kernel/document/DocumentEvaluator';
import { InMemoryDocumentResolver } from '../../engine/cad-kernel/document/DocumentResolver';
import {
  TopologyLineageProofEngine,
  CanonicalTopologyReference
} from '../../engine/topology/TopologyLineageProofEngine';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';
import { CanonicalPLMProjectionAdapter } from '../../engine/plm/CanonicalPLMProjectionAdapter';
import { EngineeringEventStore } from '../../engine/industrial-os/event-model/EngineeringEventStore';
import { Solid, Face, TopoShapeEnum } from '../../engine/cad-kernel/topology/TopologyContracts';
import { EngineeringArtifact } from '../../engine/plm/PLMTypes';

// ============================================================================
// Deterministic Test Fixtures & Construction Helpers
// ============================================================================

function createCanonicalCADDocument(docId: string, depth: number, rev: number = 1): EngineeringDocument {
  return {
    documentId: docId,
    revision: rev,
    type: 'PART',
    units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
    sketches: [
      {
        id: `SK_BASE_${docId}`,
        name: 'SK_BASE',
        plane: 'XY',
        closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 100, y: 0 }, { x: 100, y: 60 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 100, y: 60 }, { x: 0, y: 60 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 60 }, { x: 0, y: 0 }] }
        ]
      }
    ],
    constraints: [],
    features: [
      {
        id: 'FEAT_EXT_01',
        featureId: 'FEAT_EXT_01',
        name: 'Extrude Base Block',
        type: 'EXTRUDE',
        parameters: { depth, profileId: `SK_BASE_${docId}` }
      }
    ],
    parameters: [
      { id: 'P_DEPTH', name: 'depth', expression: String(depth), value: depth }
    ],
    topologyMap: { version: rev },
    derived: {},
    evidence: [],
    metadata: {
      author: 'SECP_CAD_KERNEL',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  };
}

function createAssemblyDocument(asmDocId: string, cadDocId: string, rev: number = 1): EngineeringDocument {
  const revCode = rev === 1 ? 'REV-A' : 'REV-B';
  const instance: AssemblyInstance = {
    instanceId: `INST_${cadDocId}`,
    documentId: cadDocId,
    partDocumentId: cadDocId,
    revision: revCode,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  };

  const mate: AssemblyMate = {
    mateId: `MATE_${asmDocId}_01`,
    name: 'Planar Mate to CAD Top Face',
    type: 'FIXED',
    instanceAId: `INST_${cadDocId}`,
    instanceBId: `INST_${cadDocId}`
  };

  return {
    documentId: asmDocId,
    revision: rev,
    type: 'ASSEMBLY',
    units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
    sketches: [],
    constraints: [],
    features: [],
    parameters: [],
    topologyMap: { version: rev },
    assembly: {
      instances: [instance],
      mates: [mate]
    },
    derived: {},
    evidence: [],
    metadata: {
      author: 'SECP_ASSEMBLY_KERNEL',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  };
}

function createIndependentDocument(docId: string): EngineeringDocument {
  return {
    documentId: docId,
    revision: 1,
    type: 'PART',
    units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
    sketches: [
      {
        id: `SK_${docId}`,
        name: 'SK_INDEP',
        plane: 'XY',
        closedProfile: true,
        entities: [
          { id: 'IL1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] },
          { id: 'IL2', type: 'LINE', points: [{ x: 50, y: 0 }, { x: 50, y: 50 }] },
          { id: 'IL3', type: 'LINE', points: [{ x: 50, y: 50 }, { x: 0, y: 50 }] },
          { id: 'IL4', type: 'LINE', points: [{ x: 0, y: 50 }, { x: 0, y: 0 }] }
        ]
      }
    ],
    constraints: [],
    features: [
      {
        id: 'FEAT_INDEP_01',
        featureId: 'FEAT_INDEP_01',
        name: 'Extrude Fixture Block',
        type: 'EXTRUDE',
        parameters: { depth: 15, profileId: `SK_${docId}` }
      }
    ],
    parameters: [],
    topologyMap: { version: 1 },
    derived: {},
    evidence: [],
    metadata: {
      author: 'SECP_INDEP_KERNEL',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  };
}

describe('P5-005 — Cross-Domain Dependency Graph & Multi-Workbench Invalidation Proof', () => {
  beforeEach(() => {
    EngineeringPLMEngine.clear();
    EngineeringEventStore.getInstance().clear();
  });

  // ==========================================================================
  // P5-005-A through P5-005-F: Establish Full Multi-Domain Ecosystem
  // ==========================================================================

  it('P5-005-A through P5-005-F: Canonical CAD REV-A baseline & multi-workbench registration', () => {
    const cadDocId = 'P5-CAD-MAIN-01';
    const asmDocId = 'P5-ASM-MAIN-01';

    // 1. P5-005-A: Canonical CAD REV-A Baseline
    const docCAD_A = createCanonicalCADDocument(cadDocId, 20, 1);
    const evalCAD_A = DocumentEvaluator.evaluate(docCAD_A, {
      generateMesh: true,
      generateFEA: true,
      generateCFD: true,
      generateCAM: true
    });

    expect(evalCAD_A.success).toBe(true);
    expect(evalCAD_A.evaluatedShape).toBeDefined();
    const solidA = evalCAD_A.evaluatedShape as Solid;
    expect(solidA.outerShell.orientedFaces.length).toBe(6);

    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_A, evalCAD_A);
    expect(artCAD_A.artifactId).toBe(`ART-${cadDocId}`);
    expect(artCAD_A.revision).toBe('REV-A');
    expect(artCAD_A.status).toBe('VALID');
    expect(artCAD_A.geometryHash).toBeDefined();
    expect(artCAD_A.topologyHash).toBeDefined();

    // 2. P5-005-B: Real Assembly Dependent
    const docASM_A = createAssemblyDocument(asmDocId, cadDocId, 1);
    const resolver = new InMemoryDocumentResolver();
    resolver.register(docCAD_A);
    const evalASM_A = DocumentEvaluator.evaluate(docASM_A, {
      context: { resolver }
    });
    expect(evalASM_A.success).toBe(true);

    const artASM_A = CanonicalPLMProjectionAdapter.projectFromDocument(docASM_A, evalASM_A);
    expect(artASM_A.artifactId).toBe(`ART-${asmDocId}`);
    expect(artASM_A.revision).toBe('REV-A');
    expect(artASM_A.status).toBe('VALID');

    // 3. P5-005-C, D, E: Real FEM, CFD, CAM Workbench Dependents (automatically projected from derived)
    const artFEM_A = EngineeringPLMEngine.getArtifact(`ART-FEM-${cadDocId}`, 'REV-A');
    const artCFD_A = EngineeringPLMEngine.getArtifact(`ART-CFD-${cadDocId}`, 'REV-A');
    const artCAM_A = EngineeringPLMEngine.getArtifact(`ART-CAM-${cadDocId}`, 'REV-A');

    expect(artFEM_A).toBeDefined();
    expect(artFEM_A?.type).toBe('FEA_RESULT');
    expect(artFEM_A?.status).toBe('VALID');

    expect(artCFD_A).toBeDefined();
    expect(artCFD_A?.type).toBe('CFD_RESULT');
    expect(artCFD_A?.status).toBe('VALID');

    expect(artCAM_A).toBeDefined();
    expect(artCAM_A?.type).toBe('CAM_TOOLPATH');
    expect(artCAM_A?.status).toBe('VALID');

    // 4. P5-005-F: Dependency Graph Verification in PLM
    const directDependents = EngineeringPLMEngine.getDependents(artCAD_A.artifactId, 'REV-A');
    expect(directDependents).toContain(`${artASM_A.artifactId}@REV-A`);
    expect(directDependents).toContain(`ART-FEM-${cadDocId}@REV-A`);
    expect(directDependents).toContain(`ART-CFD-${cadDocId}@REV-A`);
    expect(directDependents).toContain(`ART-CAM-${cadDocId}@REV-A`);
    expect(directDependents.length).toBe(4);
  });

  // ==========================================================================
  // P5-005-G through P5-005-J: Mutation, Cross-Domain Invalidation & Transitivity
  // ==========================================================================

  it('P5-005-G through P5-005-J: CAD REV-B mutation triggers cross-domain and transitive invalidation', () => {
    const cadDocId = 'P5-CAD-MAIN-02';
    const asmDocId = 'P5-ASM-MAIN-02';
    const indepDocId = 'P5-CAD-INDEP-02';

    // 1. Establish CAD REV-A and Downstream Dependents
    const docCAD_A = createCanonicalCADDocument(cadDocId, 20, 1);
    const evalCAD_A = DocumentEvaluator.evaluate(docCAD_A, {
      generateMesh: true,
      generateFEA: true,
      generateCFD: true,
      generateCAM: true
    });
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_A, evalCAD_A);

    const docASM_A = createAssemblyDocument(asmDocId, cadDocId, 1);
    const resolver = new InMemoryDocumentResolver();
    resolver.register(docCAD_A);
    const evalASM_A = DocumentEvaluator.evaluate(docASM_A, { context: { resolver } });
    const artASM_A = CanonicalPLMProjectionAdapter.projectFromDocument(docASM_A, evalASM_A);

    // Register Transitive Dependent: BOM depending on Assembly REV-A
    const artBOM_A = CanonicalPLMProjectionAdapter.projectBOMArtifact(artASM_A, {
      bomId: 'BOM-02-A',
      itemsCount: 1,
      hash: 'HASH-BOM-REV-A'
    });
    expect(artBOM_A.status).toBe('VALID');

    // 2. P5-005-G: Unaffected Artifact Control
    const docIndep = createIndependentDocument(indepDocId);
    const evalIndep = DocumentEvaluator.evaluate(docIndep, { generateMesh: true });
    const artIndep = CanonicalPLMProjectionAdapter.projectFromDocument(docIndep, evalIndep);
    expect(artIndep.status).toBe('VALID');

    // 3. P5-005-H: Mutate CAD truth to REV-B (depth: 20 mm -> 40 mm)
    // CAD alone is mutated; downstream consumers have not yet recomputed!
    const docCAD_B = createCanonicalCADDocument(cadDocId, 40, 2);
    const evalCAD_B = DocumentEvaluator.evaluate(docCAD_B, {
      generateMesh: true
    });
    expect(evalCAD_B.success).toBe(true);

    const artCAD_B = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_B, evalCAD_B);
    expect(artCAD_B.revision).toBe('REV-B');
    expect(artCAD_B.status).toBe('VALID');
    expect(artCAD_B.geometryHash).not.toBe(artCAD_A.geometryHash);

    // 4. P5-005-I: Verify Cross-Domain Invalidation in PLM
    // CAD REV-A is now SUPERSEDED
    const cadA_After = EngineeringPLMEngine.getArtifact(artCAD_A.artifactId, 'REV-A');
    expect(cadA_After?.status).toBe('SUPERSEDED');

    // All direct downstream consumers are OUTDATED
    const asmA_After = EngineeringPLMEngine.getArtifact(artASM_A.artifactId, 'REV-A');
    const femA_After = EngineeringPLMEngine.getArtifact(`ART-FEM-${cadDocId}`, 'REV-A');
    const cfdA_After = EngineeringPLMEngine.getArtifact(`ART-CFD-${cadDocId}`, 'REV-A');
    const camA_After = EngineeringPLMEngine.getArtifact(`ART-CAM-${cadDocId}`, 'REV-A');

    expect(asmA_After?.status).toBe('OUTDATED');
    expect(femA_After?.status).toBe('OUTDATED');
    expect(cfdA_After?.status).toBe('OUTDATED');
    expect(camA_After?.status).toBe('OUTDATED');

    // 5. P5-005-J: Transitive Invalidation
    // BOM depended on Assembly REV-A, which was invalidated by CAD REV-A
    const bomA_After = EngineeringPLMEngine.getArtifact(artBOM_A.artifactId, 'REV-A');
    expect(bomA_After?.status).toBe('OUTDATED');

    // Unaffected artifact remains VALID
    const indep_After = EngineeringPLMEngine.getArtifact(artIndep.artifactId, 'REV-A');
    expect(indep_After?.status).toBe('VALID');
  });

  // ==========================================================================
  // P5-005-K through P5-005-N: Multi-Workbench Topology Rebinding
  // ==========================================================================

  it('P5-005-K through P5-005-N: Topology references across Assembly, FEM, CFD, and CAM rebind cleanly to REV-B', () => {
    const cadDocId = 'P5-CAD-TOPO-03';

    // 1. Evaluate CAD REV-A
    const docCAD_A = createCanonicalCADDocument(cadDocId, 20, 1);
    const evalCAD_A = DocumentEvaluator.evaluate(docCAD_A, { generateMesh: true });
    expect(evalCAD_A.success).toBe(true);
    const solidA = evalCAD_A.evaluatedShape as Solid;

    // Find faces by persistentId
    const topFaceA = solidA.outerShell.orientedFaces.find(of =>
      of.face.persistentId?.includes('CapEnd')
    )!.face;
    const bottomFaceA = solidA.outerShell.orientedFaces.find(of =>
      of.face.persistentId?.includes('CapStart')
    )!.face;

    expect(topFaceA).toBeDefined();
    expect(bottomFaceA).toBeDefined();

    // 2. Create Canonical Topology References
    // Assembly Mate Reference (Top Face)
    const asmRefA = TopologyLineageProofEngine.createFaceReference(docCAD_A, 'FEAT_EXT_01', topFaceA);
    // FEM Constraint Reference (Bottom Face)
    const femRefA = TopologyLineageProofEngine.createFaceReference(docCAD_A, 'FEAT_EXT_01', bottomFaceA);
    // CFD Inlet Reference (Top Face)
    const cfdRefA = TopologyLineageProofEngine.createFaceReference(docCAD_A, 'FEAT_EXT_01', topFaceA);
    // CAM Machining Reference (Top Face)
    const camRefA = TopologyLineageProofEngine.createFaceReference(docCAD_A, 'FEAT_EXT_01', topFaceA);

    // 3. Mutate CAD to REV-B (depth: 20 mm -> 50 mm)
    const docCAD_B = createCanonicalCADDocument(cadDocId, 50, 2);
    const evalCAD_B = DocumentEvaluator.evaluate(docCAD_B, { generateMesh: true });
    expect(evalCAD_B.success).toBe(true);
    const solidB = evalCAD_B.evaluatedShape as Solid;

    // 4. P5-005-K: Assembly Topology Rebind
    const asmRebind = TopologyLineageProofEngine.rebindReference(asmRefA, solidB, 2);
    expect(asmRebind.success).toBe(true);
    expect(asmRebind.state).toBe('REBOUND');
    expect(asmRebind.reboundEntity).toBeDefined();

    // 5. P5-005-L: FEM Topology Rebind
    const femRebind = TopologyLineageProofEngine.rebindReference(femRefA, solidB, 2);
    expect(femRebind.success).toBe(true);
    expect(femRebind.state).toBe('REBOUND');
    expect(femRebind.reboundEntity).toBeDefined();

    // 6. P5-005-M: CFD Topology Rebind
    const cfdRebind = TopologyLineageProofEngine.rebindReference(cfdRefA, solidB, 2);
    expect(cfdRebind.success).toBe(true);
    expect(cfdRebind.state).toBe('REBOUND');
    expect(cfdRebind.reboundEntity).toBeDefined();

    // 7. P5-005-N: CAM Topology Rebind
    const camRebind = TopologyLineageProofEngine.rebindReference(camRefA, solidB, 2);
    expect(camRebind.success).toBe(true);
    expect(camRebind.state).toBe('REBOUND');
    expect(camRebind.reboundEntity).toBeDefined();
  });

  // ==========================================================================
  // P5-005-O: Stale Result Consumption Rejection
  // ==========================================================================

  it('P5-005-O: Stale result consumption and publication are strictly blocked', () => {
    const cadDocId = 'P5-CAD-STALE-04';
    const asmDocId = 'P5-ASM-STALE-04';

    // 1. Establish REV-A Ecosystem
    const docCAD_A = createCanonicalCADDocument(cadDocId, 20, 1);
    const evalCAD_A = DocumentEvaluator.evaluate(docCAD_A, {
      generateMesh: true,
      generateFEA: true,
      generateCFD: true,
      generateCAM: true
    });
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_A, evalCAD_A);

    const docASM_A = createAssemblyDocument(asmDocId, cadDocId, 1);
    const resolver = new InMemoryDocumentResolver();
    resolver.register(docCAD_A);
    const evalASM_A = DocumentEvaluator.evaluate(docASM_A, { context: { resolver } });
    const artASM_A = CanonicalPLMProjectionAdapter.projectFromDocument(docASM_A, evalASM_A);

    // 2. Mutate CAD to REV-B
    const docCAD_B = createCanonicalCADDocument(cadDocId, 35, 2);
    const evalCAD_B = DocumentEvaluator.evaluate(docCAD_B, { generateMesh: true });
    CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_B, evalCAD_B);

    // 3. Attempt to verify stale REV-A CAD artifact against current CAD REV-B document
    const cadIntegrityCheck = CanonicalPLMProjectionAdapter.verifyArtifactIntegrity(
      artCAD_A.artifactId,
      'REV-A',
      docCAD_B
    );
    expect(cadIntegrityCheck.valid).toBe(false);
    expect(cadIntegrityCheck.reason).toContain('Cryptographic Geometry Hash Mismatch');

    // 4. Attempt to verify stale REV-A Assembly artifact dependencies
    const asmDependencyCheck = CanonicalPLMProjectionAdapter.verifyArtifactDependencies(
      artASM_A.artifactId,
      'REV-A'
    );
    expect(asmDependencyCheck.valid).toBe(false);
    expect(asmDependencyCheck.reason).toContain('Upstream dependencies are stale or superseded');

    // 5. Attempt to publish release manifest containing stale/outdated artifact
    EngineeringPLMEngine.createECO({
      ecoId: 'ECO-FAIL-TEST',
      title: 'Attempt Release of Outdated Assembly',
      reason: 'Validation of release block gate',
      status: 'APPROVED',
      approvalStatus: 'APPROVED',
      affectedArtifacts: [artASM_A.artifactId],
      requestedBy: 'SECP_USER',
      requestTimestamp: '2026-01-01T00:00:00.000Z'
    });

    expect(() => {
      EngineeringPLMEngine.generateReleaseManifest('PROD-01', 'Product 01', 'ECO-FAIL-TEST');
    }).toThrow(/Release Blocked: Missing valid/);
  });

  // ==========================================================================
  // P5-005-P & P5-005-Q: REV-B Recomputation & Revision Isolation
  // ==========================================================================

  it('P5-005-P & P5-005-Q: Multi-workbench recomputation produces distinct REV-B evidence with complete revision isolation', () => {
    const cadDocId = 'P5-CAD-RECOMP-05';
    const asmDocId = 'P5-ASM-RECOMP-05';

    // 1. Establish and Evaluate REV-A
    const docCAD_A = createCanonicalCADDocument(cadDocId, 20, 1);
    const evalCAD_A = DocumentEvaluator.evaluate(docCAD_A, {
      generateMesh: true,
      generateFEA: true,
      generateCFD: true,
      generateCAM: true
    });
    CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_A, evalCAD_A);

    const docASM_A = createAssemblyDocument(asmDocId, cadDocId, 1);
    const resolverA = new InMemoryDocumentResolver();
    resolverA.register(docCAD_A);
    const evalASM_A = DocumentEvaluator.evaluate(docASM_A, { context: { resolver: resolverA } });
    const artASM_A = CanonicalPLMProjectionAdapter.projectFromDocument(docASM_A, evalASM_A);
    CanonicalPLMProjectionAdapter.projectBOMArtifact(artASM_A, {
      bomId: 'BOM-05-A',
      itemsCount: 1,
      hash: 'HASH-BOM-A'
    });

    const artCAD_A = EngineeringPLMEngine.getArtifact(`ART-${cadDocId}`, 'REV-A')!;
    const artFEM_A = EngineeringPLMEngine.getArtifact(`ART-FEM-${cadDocId}`, 'REV-A')!;
    const artCFD_A = EngineeringPLMEngine.getArtifact(`ART-CFD-${cadDocId}`, 'REV-A')!;
    const artCAM_A = EngineeringPLMEngine.getArtifact(`ART-CAM-${cadDocId}`, 'REV-A')!;
    const artBOM_A = EngineeringPLMEngine.getArtifact(`ART-BOM-${asmDocId}`, 'REV-A')!;

    // 2. Mutate and Recompute CAD REV-B with downstream derivations
    const docCAD_B = createCanonicalCADDocument(cadDocId, 45, 2);
    const evalCAD_B = DocumentEvaluator.evaluate(docCAD_B, {
      generateMesh: true,
      generateFEA: true,
      generateCFD: true,
      generateCAM: true
    });
    CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_B, evalCAD_B);

    // 3. Recompute Assembly REV-B
    const docASM_B = createAssemblyDocument(asmDocId, cadDocId, 2);
    const resolverB = new InMemoryDocumentResolver();
    resolverB.register(docCAD_B);
    const evalASM_B = DocumentEvaluator.evaluate(docASM_B, { context: { resolver: resolverB } });
    const artASM_B = CanonicalPLMProjectionAdapter.projectFromDocument(docASM_B, evalASM_B);

    // 4. Recompute BOM REV-B
    CanonicalPLMProjectionAdapter.projectBOMArtifact(artASM_B, {
      bomId: 'BOM-05-B',
      itemsCount: 1,
      hash: 'HASH-BOM-B'
    });

    // 5. Query REV-B Artifacts
    const artCAD_B = EngineeringPLMEngine.getArtifact(`ART-${cadDocId}`, 'REV-B')!;
    const artASM_B_PLM = EngineeringPLMEngine.getArtifact(`ART-${asmDocId}`, 'REV-B')!;
    const artFEM_B = EngineeringPLMEngine.getArtifact(`ART-FEM-${cadDocId}`, 'REV-B')!;
    const artCFD_B = EngineeringPLMEngine.getArtifact(`ART-CFD-${cadDocId}`, 'REV-B')!;
    const artCAM_B = EngineeringPLMEngine.getArtifact(`ART-CAM-${cadDocId}`, 'REV-B')!;
    const artBOM_B = EngineeringPLMEngine.getArtifact(`ART-BOM-${asmDocId}`, 'REV-B')!;

    // Assert REV-B Validity
    expect(artCAD_B.status).toBe('VALID');
    expect(artASM_B_PLM.status).toBe('VALID');
    expect(artFEM_B.status).toBe('VALID');
    expect(artCFD_B.status).toBe('VALID');
    expect(artCAM_B.status).toBe('VALID');
    expect(artBOM_B.status).toBe('VALID');

    // Assert Distinct Evidence Hashes (P5-005-P)
    expect(artCAD_B.geometryHash).not.toBe(artCAD_A.geometryHash);
    expect(artFEM_B.geometryHash).not.toBe(artFEM_A.geometryHash);
    expect(artCFD_B.geometryHash).not.toBe(artCFD_A.geometryHash);
    expect(artCAM_B.geometryHash).not.toBe(artCAM_A.geometryHash);
    expect(artBOM_B.geometryHash).not.toBe(artBOM_A.geometryHash);

    // Assert Revision Isolation (P5-005-Q)
    // REV-A artifacts must be preserved without corruption or mutation
    const preservedCAD_A = EngineeringPLMEngine.getArtifact(`ART-${cadDocId}`, 'REV-A')!;
    const preservedASM_A = EngineeringPLMEngine.getArtifact(`ART-${asmDocId}`, 'REV-A')!;
    const preservedFEM_A = EngineeringPLMEngine.getArtifact(`ART-FEM-${cadDocId}`, 'REV-A')!;
    const preservedCFD_A = EngineeringPLMEngine.getArtifact(`ART-CFD-${cadDocId}`, 'REV-A')!;
    const preservedCAM_A = EngineeringPLMEngine.getArtifact(`ART-CAM-${cadDocId}`, 'REV-A')!;
    const preservedBOM_A = EngineeringPLMEngine.getArtifact(`ART-BOM-${asmDocId}`, 'REV-A')!;

    // In PLM, once REV-B is created and registered, REV-A artifacts become SUPERSEDED
    expect(preservedCAD_A.status).toBe('SUPERSEDED');
    expect(preservedASM_A.status).toBe('SUPERSEDED');
    expect(preservedFEM_A.status).toBe('SUPERSEDED');
    expect(preservedCFD_A.status).toBe('SUPERSEDED');
    expect(preservedCAM_A.status).toBe('SUPERSEDED');
    expect(preservedBOM_A.status).toBe('SUPERSEDED');

    expect(preservedCAD_A.geometryHash).toBe(artCAD_A.geometryHash);
    expect(preservedFEM_A.geometryHash).toBe(artFEM_A.geometryHash);
    expect(preservedCFD_A.geometryHash).toBe(artCFD_A.geometryHash);
    expect(preservedCAM_A.geometryHash).toBe(artCAM_A.geometryHash);
    expect(preservedBOM_A.geometryHash).toBe(artBOM_A.geometryHash);
  });

  // ==========================================================================
  // P5-005-R: Causal Event Lineage
  // ==========================================================================

  it('P5-005-R: Causal event lineage records unbroken chronological history in EventStore', () => {
    const cadDocId = 'P5-CAD-EVENT-06';

    const docCAD_A = createCanonicalCADDocument(cadDocId, 20, 1);
    const evalCAD_A = DocumentEvaluator.evaluate(docCAD_A, {
      generateMesh: true,
      generateFEA: true,
      generateCFD: true,
      generateCAM: true
    });
    CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_A, evalCAD_A);

    const docCAD_B = createCanonicalCADDocument(cadDocId, 30, 2);
    const evalCAD_B = DocumentEvaluator.evaluate(docCAD_B, {
      generateMesh: true,
      generateFEA: true,
      generateCFD: true,
      generateCAM: true
    });
    CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_B, evalCAD_B);

    const events = EngineeringEventStore.getInstance().getAll();
    expect(events.length).toBeGreaterThan(4);

    // Initial creations
    const createdEvents = events.filter(e => e.eventType === 'OBJECT_CREATED');
    expect(createdEvents.length).toBeGreaterThanOrEqual(4);

    // Revisions
    const revisedEvents = events.filter(e => e.eventType === 'OBJECT_REVISED');
    expect(revisedEvents.length).toBeGreaterThanOrEqual(4);

    // Correlation IDs exist and link to artifacts
    for (const ev of events) {
      expect(ev.correlationId).toBeDefined();
      expect(ev.entityIdentityId).toBeDefined();
      expect(ev.source.service).toBeDefined();
    }
  });

  // ==========================================================================
  // P5-005-S & P5-005-T: Negative Topology Rebind (Deleted / Ambiguous)
  // ==========================================================================

  it('P5-005-S & P5-005-T: Deleted and ambiguous topology references fail cleanly without silent synthesis', () => {
    const cadDocId = 'P5-CAD-TOPO-FAIL-07';

    const docCAD_A = createCanonicalCADDocument(cadDocId, 20, 1);
    const evalCAD_A = DocumentEvaluator.evaluate(docCAD_A, { generateMesh: true });
    expect(evalCAD_A.success).toBe(true);
    const solidA = evalCAD_A.evaluatedShape as Solid;
    const topFaceA = solidA.outerShell.orientedFaces[0].face;

    const refA = TopologyLineageProofEngine.createFaceReference(docCAD_A, 'FEAT_EXT_01', topFaceA);

    // Evaluate empty/distinct solid where the face does not exist
    const emptySolid: Solid = {
      id: 'SOLID_EMPTY',
      shapeType: TopoShapeEnum.SOLID,
      outerShell: {
        id: 'SHELL_EMPTY',
        shapeType: TopoShapeEnum.SHELL,
        orientedFaces: []
      }
    };

    // P5-005-S: Deleted Topology
    const deleteRebind = TopologyLineageProofEngine.rebindReference(refA, emptySolid, 2);
    expect(deleteRebind.success).toBe(false);
    expect(deleteRebind.state).toBe('DELETED');
    expect(deleteRebind.reboundEntity).toBeUndefined();

    // P5-005-T: Ambiguous Topology (two identical candidate faces in solid)
    const ambiguousSolid: Solid = {
      id: 'S_AMBIG',
      shapeType: TopoShapeEnum.SOLID,
      outerShell: {
        id: 'SH_AMBIG',
        shapeType: TopoShapeEnum.SHELL,
        orientedFaces: [
          { face: { ...topFaceA, id: 'F_DUP_1', persistentId: refA.topologyEntityIdentifier }, orientation: 1 },
          { face: { ...topFaceA, id: 'F_DUP_2', persistentId: refA.topologyEntityIdentifier }, orientation: 1 }
        ]
      }
    };

    const ambiguousRebind = TopologyLineageProofEngine.rebindReference(refA, ambiguousSolid, 2);
    expect(ambiguousRebind.success).toBe(false);
    expect(ambiguousRebind.state).toBe('AMBIGUOUS');
    expect(ambiguousRebind.reboundEntity).toBeUndefined();
  });

  // ==========================================================================
  // P5-005-U through P5-005-W: Missing Dependency, Revision Mismatch, Parallel Authority
  // ==========================================================================

  it('P5-005-U through P5-005-W: Missing dependencies, revision mismatches, and authority audit pass', () => {
    // 1. P5-005-U: Missing Dependency Behavior
    EngineeringPLMEngine.registerArtifact({
      artifactId: 'ART-ORPHAN-08',
      name: 'Orphan Dependent',
      revision: 'REV-A',
      version: 1,
      type: 'FEA_RESULT',
      status: 'VALID',
      createdBy: 'SECP_TEST',
      createdAt: '2026-01-01T00:00:00.000Z',
      geometryHash: 'G-HASH-ORPHAN',
      topologyHash: 'T-HASH-ORPHAN',
      dependencyHash: 'DEP-HASH',
      provenanceReference: 'EVID-ORPHAN'
    });
    // Add dependency to non-existent upstream
    EngineeringPLMEngine.addDependency('ART-ORPHAN-08', 'REV-A', 'ART-NONEXISTENT', 'REV-A');

    const missingCheck = CanonicalPLMProjectionAdapter.verifyArtifactDependencies(
      'ART-ORPHAN-08',
      'REV-A'
    );
    expect(missingCheck.valid).toBe(false);
    expect(missingCheck.missingDependencies).toContain('ART-NONEXISTENT@REV-A');

    // 2. P5-005-V: Revision Mismatch Detection
    const docCAD_A = createCanonicalCADDocument('P5-CAD-REV-08', 20, 1);
    const evalCAD_A = DocumentEvaluator.evaluate(docCAD_A, { generateMesh: true });
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_A, evalCAD_A);

    const docCAD_B = createCanonicalCADDocument('P5-CAD-REV-08', 30, 2);
    const evalCAD_B = DocumentEvaluator.evaluate(docCAD_B, { generateMesh: true });
    expect(evalCAD_B.success).toBe(true);

    const mismatchCheck = CanonicalPLMProjectionAdapter.verifyArtifactIntegrity(
      artCAD_A.artifactId,
      'REV-A',
      docCAD_B
    );
    expect(mismatchCheck.valid).toBe(false);
    expect(mismatchCheck.reason).toContain('Cryptographic Geometry Hash Mismatch');

    // 3. P5-005-W: Parallel Authority Audit
    // Assert EngineeringPLMEngine is the single authoritative source of dependency status
    const upstreams = EngineeringPLMEngine.getDependencies('ART-ORPHAN-08', 'REV-A');
    expect(upstreams).toEqual(['ART-NONEXISTENT@REV-A']);

    const dependents = EngineeringPLMEngine.getDependents('ART-NONEXISTENT', 'REV-A');
    expect(dependents).toEqual(['ART-ORPHAN-08@REV-A']);
  });

  // ==========================================================================
  // P5-005-X: Three-Run Determinism
  // ==========================================================================

  it('P5-005-X: Full cross-domain lifecycle exhibits 100% bit-for-bit three-run determinism', () => {
    interface WorkflowSnapshot {
      cadGeometryHashA: string;
      cadGeometryHashB: string;
      femHashA: string;
      femHashB: string;
      cfdHashA: string;
      cfdHashB: string;
      camHashA: string;
      camHashB: string;
      asmStatusA_After: string;
      femStatusA_After: string;
      cfdStatusA_After: string;
      camStatusA_After: string;
      rebindState: string;
    }

    function runWorkflow(): WorkflowSnapshot {
      EngineeringPLMEngine.clear();
      EngineeringEventStore.getInstance().clear();

      const cadDocId = 'P5-CAD-DET-09';
      const asmDocId = 'P5-ASM-DET-09';

      // 1. REV-A
      const docCAD_A = createCanonicalCADDocument(cadDocId, 25, 1);
      const evalCAD_A = DocumentEvaluator.evaluate(docCAD_A, {
        generateMesh: true,
        generateFEA: true,
        generateCFD: true,
        generateCAM: true
      });
      const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_A, evalCAD_A);

      const docASM_A = createAssemblyDocument(asmDocId, cadDocId, 1);
      const resolver = new InMemoryDocumentResolver();
      resolver.register(docCAD_A);
      const evalASM_A = DocumentEvaluator.evaluate(docASM_A, { context: { resolver } });
      CanonicalPLMProjectionAdapter.projectFromDocument(docASM_A, evalASM_A);

      const artFEM_A = EngineeringPLMEngine.getArtifact(`ART-FEM-${cadDocId}`, 'REV-A')!;
      const artCFD_A = EngineeringPLMEngine.getArtifact(`ART-CFD-${cadDocId}`, 'REV-A')!;
      const artCAM_A = EngineeringPLMEngine.getArtifact(`ART-CAM-${cadDocId}`, 'REV-A')!;

      // Topology Reference
      const solidA = evalCAD_A.evaluatedShape as Solid;
      const topFaceA = solidA.outerShell.orientedFaces[0].face;
      const topoRef = TopologyLineageProofEngine.createFaceReference(docCAD_A, 'FEAT_EXT_01', topFaceA);

      // 2. REV-B (CAD only mutated, downstream consumers invalidated before recomputing)
      const docCAD_B = createCanonicalCADDocument(cadDocId, 55, 2);
      const evalCAD_B = DocumentEvaluator.evaluate(docCAD_B, {
        generateMesh: true
      });
      const artCAD_B = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_B, evalCAD_B);

      const asmA_After = EngineeringPLMEngine.getArtifact(`ART-${asmDocId}`, 'REV-A')!;
      const femA_After = EngineeringPLMEngine.getArtifact(`ART-FEM-${cadDocId}`, 'REV-A')!;
      const cfdA_After = EngineeringPLMEngine.getArtifact(`ART-CFD-${cadDocId}`, 'REV-A')!;
      const camA_After = EngineeringPLMEngine.getArtifact(`ART-CAM-${cadDocId}`, 'REV-A')!;

      // Capture invalidation state before downstream recomputation
      const asmStatusA_Outdated = asmA_After.status;
      const femStatusA_Outdated = femA_After.status;
      const cfdStatusA_Outdated = cfdA_After.status;
      const camStatusA_Outdated = camA_After.status;

      const solidB = evalCAD_B.evaluatedShape as Solid;
      const rebind = TopologyLineageProofEngine.rebindReference(topoRef, solidB, 2);

      // Downstream consumers recompute
      const evalCAD_B_Full = DocumentEvaluator.evaluate(docCAD_B, {
        generateMesh: true,
        generateFEA: true,
        generateCFD: true,
        generateCAM: true
      });
      CanonicalPLMProjectionAdapter.projectFromDocument(docCAD_B, evalCAD_B_Full);

      const artFEM_B = EngineeringPLMEngine.getArtifact(`ART-FEM-${cadDocId}`, 'REV-B')!;
      const artCFD_B = EngineeringPLMEngine.getArtifact(`ART-CFD-${cadDocId}`, 'REV-B')!;
      const artCAM_B = EngineeringPLMEngine.getArtifact(`ART-CAM-${cadDocId}`, 'REV-B')!;

      return {
        cadGeometryHashA: artCAD_A.geometryHash,
        cadGeometryHashB: artCAD_B.geometryHash,
        femHashA: artFEM_A.geometryHash,
        femHashB: artFEM_B.geometryHash,
        cfdHashA: artCFD_A.geometryHash,
        cfdHashB: artCFD_B.geometryHash,
        camHashA: artCAM_A.geometryHash,
        camHashB: artCAM_B.geometryHash,
        asmStatusA_Outdated,
        femStatusA_Outdated,
        cfdStatusA_Outdated,
        camStatusA_Outdated,
        femStatusA_AfterRecomp: femA_After.status,
        rebindState: rebind.state
      };
    }

    const run1 = runWorkflow();
    const run2 = runWorkflow();
    const run3 = runWorkflow();

    expect(run1).toEqual(run2);
    expect(run2).toEqual(run3);

    expect(run1.cadGeometryHashA).not.toBe(run1.cadGeometryHashB);
    expect(run1.femHashA).not.toBe(run1.femHashB);
    expect(run1.cfdHashA).not.toBe(run1.cfdHashB);
    expect(run1.camHashA).not.toBe(run1.camHashB);
    expect(run1.asmStatusA_Outdated).toBe('OUTDATED');
    expect(run1.femStatusA_Outdated).toBe('OUTDATED');
    expect(run1.cfdStatusA_Outdated).toBe('OUTDATED');
    expect(run1.camStatusA_Outdated).toBe('OUTDATED');
    expect(run1.femStatusA_AfterRecomp).toBe('SUPERSEDED');
    expect(run1.rebindState).toBe('REBOUND');
  });
});
