import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument, EvidenceRecord } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { TopologyLineageProofEngine } from '../../engine/topology/TopologyLineageProofEngine';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';
import { CanonicalPLMProjectionAdapter } from '../../engine/plm/CanonicalPLMProjectionAdapter';
import { Solid } from '../../engine/cad-kernel/topology/TopologyContracts';
import { CFDAdapter } from '../../engine/cad-kernel/cfd/CFDAdapter';
import { Fvm3DNavierStokesSolver } from '../../engine/cfd3d/Fvm3DNavierStokesSolver';
import { EngineeringHashChain } from '../../engine/evidence/EngineeringHashChain';
import { EngineeringEventStore } from '../../engine/industrial-os/event-model/EngineeringEventStore';
import { FluidProperties3D, SolverConfig3D } from '../../engine/cfd3d/Fvm3DTypes';

describe('P5-003 — CAD → CFD Revision / Associativity / Invalidation Proof', () => {
  const standardFluid: FluidProperties3D = {
    densityKgM3: 1.225,
    viscosityPaS: 1.8e-5
  };

  const solverConfig: SolverConfig3D = {
    maxIterations: 10,
    continuityTol: 1e-4,
    momentumTol: 1e-4,
    underRelaxationVelocity: 0.7,
    underRelaxationPressure: 0.3,
    useTurbulenceModel: false,
    turbulenceScheme: 'LAMINAR',
    upwindScheme: 'FIRST_ORDER_UPWIND'
  };

  beforeEach(() => {
    EngineeringPLMEngine.clear();
    EngineeringEventStore.getInstance().clear();
  });

  it('P5-003-A: CFD boundary references survive CAD geometry mutation and rebind to REV-B topology', () => {
    // 1. Establish Canonical CAD Document REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-CFD-01',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_FLOW_CHANNEL',
          name: 'SK_FLOW_CHANNEL',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 30, y: 0 }, { x: 30, y: 20 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 30, y: 20 }, { x: 0, y: 20 }] },
            { id: 'L4', type: 'LINE', points: [{ x: 0, y: 20 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      constraints: [],
      features: [
        {
          id: 'EXT_01',
          featureId: 'EXT_01',
          name: 'Extrude Flow Duct',
          type: 'EXTRUDE',
          parameters: { depth: 25, profileId: 'SK_FLOW_CHANNEL' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalResultA = DocumentEvaluator.evaluate(docCAD, { generateCFD: true });
    expect(evalResultA.success).toBe(true);
    const solidA = evalResultA.evaluatedShape as Solid;

    // Pick top face (CapEnd - outlet boundary) and bottom face (CapStart - inlet boundary)
    const outFaceA = solidA.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapEnd'))!.face;
    const inFaceA = solidA.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapStart'))!.face;

    const refInlet = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_01', inFaceA);
    const refOutlet = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_01', outFaceA);

    expect(refInlet.resolutionState).toBe('VALID');
    expect(refOutlet.resolutionState).toBe('VALID');

    // 2. Perform CAD Mutation: Extrude depth 25 mm -> 50 mm (REV-B)
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 50;

    const evalResultB = DocumentEvaluator.evaluate(docCAD, { generateCFD: true });
    expect(evalResultB.success).toBe(true);
    const solidB = evalResultB.evaluatedShape as Solid;

    // 3. Rebind CFD Face References against REV-B Solid
    const rebindInlet = TopologyLineageProofEngine.rebindReference(refInlet, solidB, 2);
    const rebindOutlet = TopologyLineageProofEngine.rebindReference(refOutlet, solidB, 2);

    expect(rebindInlet.success).toBe(true);
    expect(rebindInlet.state).toBe('REBOUND');
    expect(rebindInlet.reboundReference.documentRevision).toBe(2);

    expect(rebindOutlet.success).toBe(true);
    expect(rebindOutlet.state).toBe('REBOUND');
    expect(rebindOutlet.reboundReference.documentRevision).toBe(2);

    // Verify geometric signature recomputed for top/outlet face at Z = 50 mm
    expect(rebindOutlet.reboundReference.lineage.geometricSignature).toContain('FACE|NORM:0.000,0.000,1.000');
  });

  it('P5-003-B: Upstream CAD revision invalidates downstream CFD artifact & evidence in PLM', () => {
    // 1. Setup CAD Document REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-CFD-02',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_DUCT',
          name: 'SK_DUCT',
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
          name: 'Extrude Base Duct',
          type: 'EXTRUDE',
          parameters: { depth: 30, profileId: 'SK_DUCT' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalA = DocumentEvaluator.evaluate(docCAD, { generateCFD: true });
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalA);
    EngineeringPLMEngine.registerArtifact(artCAD_A);

    // 2. Register Downstream CFD Artifact depending on CAD REV-A
    EngineeringPLMEngine.registerArtifact({
      artifactId: 'ART-P5-CFD-02',
      name: 'CFD Fluid Flow Analysis',
      revision: 'REV-A',
      version: 1,
      type: 'CFD_RESULT',
      status: 'VALID',
      createdBy: 'SECP_CFD_SOLVER',
      createdAt: '2026-01-01T00:00:00.000Z',
      geometryHash: artCAD_A.geometryHash,
      topologyHash: artCAD_A.topologyHash,
      dependencyHash: 'DEP-CFD-CAD-REV1',
      provenanceReference: 'EVID-CFD-REV1',
      metadata: {
        solver: 'Fvm3DNavierStokesSolver',
        meshType: 'STRUCTURED_FVM'
      }
    });

    EngineeringPLMEngine.addDependency('ART-P5-CFD-02', 'REV-A', 'ART-P5-CAD-CFD-02', 'REV-A');

    // Check initial state
    const cfdArtBefore = EngineeringPLMEngine.getArtifact('ART-P5-CFD-02', 'REV-A');
    expect(cfdArtBefore).toBeDefined();
    expect(cfdArtBefore?.status).toBe('VALID');

    // 3. Mutate CAD to REV-B (Extrude depth: 30 mm -> 60 mm)
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 60;

    const evalB = DocumentEvaluator.evaluate(docCAD, { generateCFD: true });
    const artCAD_B = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalB);
    EngineeringPLMEngine.registerArtifact(artCAD_B);

    // 4. Assert Downstream Invalidation in PLM
    const cfdArtAfter = EngineeringPLMEngine.getArtifact('ART-P5-CFD-02', 'REV-A');
    expect(cfdArtAfter?.status).toBe('OUTDATED');
  });

  it('P5-003-C: CFD recomputation produces distinct REV-B evidence and prevents REV-A result masquerading', () => {
    // 1. Establish CAD Document REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-CFD-03',
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
          name: 'Extrude Duct',
          type: 'EXTRUDE',
          parameters: { depth: 25, profileId: 'SK_01' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalA = DocumentEvaluator.evaluate(docCAD, { generateCFD: true });
    const solidA = evalA.evaluatedShape as Solid;
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalA);

    // 2. CFD Discretization & Solver Execution on REV-A
    const { mesh: meshA, meshHash: meshHashA } = CFDAdapter.meshFromBRep(solidA, {
      nx: 6,
      ny: 4,
      nz: 4,
      inletVelocity: { x: 1.0, y: 0, z: 0 },
      outletPressure: 0
    });

    const cfdSolA = Fvm3DNavierStokesSolver.solve(meshA, standardFluid, solverConfig);
    expect(cfdSolA.converged || cfdSolA.totalIterations > 0).toBe(true);

    const solverOutputHashA = EngineeringHashChain.computeCanonicalHash({
      pressureDrop: cfdSolA.monitors.pressureDropPa,
      maxVelocity: cfdSolA.iterationHistory[cfdSolA.iterationHistory.length - 1]?.maxVelocityMS,
      uSample: cfdSolA.velocity.u.slice(0, 5)
    }).canonicalHash;

    const evidenceA: EvidenceRecord = {
      evidenceId: 'EVID_CFD_REV1_03',
      stage: 'SIMULATION',
      sourceSystem: 'SECP_CFD_ENGINE',
      documentId: docCAD.documentId,
      revision: 1,
      canonicalHash: solverOutputHashA,
      geometryHash: artCAD_A.geometryHash,
      topologyHash: artCAD_A.topologyHash,
      meshHash: meshHashA,
      solverOutputHash: `SOLVER-CFD-DP-${cfdSolA.monitors.pressureDropPa.toFixed(6)}-REV1`,
      payload: {
        solver: 'Fvm3DNavierStokesSolver',
        totalCells: meshA.cells.length,
        pressureDropPa: cfdSolA.monitors.pressureDropPa
      },
      verdict: 'VALID'
    };
    docCAD.evidence.push(evidenceA);

    // 3. Mutate CAD to REV-B (Extrude depth: 25 mm -> 60 mm)
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 60;

    const evalB = DocumentEvaluator.evaluate(docCAD, { generateCFD: true });
    const solidB = evalB.evaluatedShape as Solid;
    const artCAD_B = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalB);

    // 4. CFD Discretization & Solver Execution on REV-B
    const { mesh: meshB, meshHash: meshHashB } = CFDAdapter.meshFromBRep(solidB, {
      nx: 6,
      ny: 4,
      nz: 4,
      inletVelocity: { x: 1.0, y: 0, z: 0 },
      outletPressure: 0
    });

    const cfdSolB = Fvm3DNavierStokesSolver.solve(meshB, standardFluid, solverConfig);
    expect(cfdSolB.converged || cfdSolB.totalIterations > 0).toBe(true);

    const solverOutputHashB = EngineeringHashChain.computeCanonicalHash({
      pressureDrop: cfdSolB.monitors.pressureDropPa,
      maxVelocity: cfdSolB.iterationHistory[cfdSolB.iterationHistory.length - 1]?.maxVelocityMS,
      uSample: cfdSolB.velocity.u.slice(0, 5)
    }).canonicalHash;

    const evidenceB: EvidenceRecord = {
      evidenceId: 'EVID_CFD_REV2_03',
      stage: 'SIMULATION',
      sourceSystem: 'SECP_CFD_ENGINE',
      documentId: docCAD.documentId,
      revision: 2,
      canonicalHash: solverOutputHashB,
      geometryHash: artCAD_B.geometryHash,
      topologyHash: artCAD_B.topologyHash,
      meshHash: meshHashB,
      solverOutputHash: `SOLVER-CFD-DP-${cfdSolB.monitors.pressureDropPa.toFixed(6)}-REV2`,
      payload: {
        solver: 'Fvm3DNavierStokesSolver',
        totalCells: meshB.cells.length,
        pressureDropPa: cfdSolB.monitors.pressureDropPa
      },
      verdict: 'VALID'
    };
    docCAD.evidence.push(evidenceB);

    // 5. Strict Physical & Evidence Discretization Proof
    expect(meshA.cells[0].volume).not.toEqual(meshB.cells[0].volume);
    expect(meshA.boundingBox).not.toEqual(meshB.boundingBox);
    expect(meshHashA).not.toEqual(meshHashB);
    expect(cfdSolA.monitors.pressureDropPa).not.toEqual(cfdSolB.monitors.pressureDropPa);
    expect(solverOutputHashA).not.toEqual(solverOutputHashB);

    // 6. Immutability & Anti-Masquerade Proof
    const evREV1 = docCAD.evidence.find(e => e.revision === 1 && e.sourceSystem === 'SECP_CFD_ENGINE');
    const evREV2 = docCAD.evidence.find(e => e.revision === 2 && e.sourceSystem === 'SECP_CFD_ENGINE');

    expect(evREV1).toBeDefined();
    expect(evREV2).toBeDefined();
    expect(evREV1!.solverOutputHash).not.toEqual(evREV2!.solverOutputHash);

    // An attempt to represent REV-A result as valid for REV-B fails
    const isValidRevAforRevB = (evREV1!.geometryHash === artCAD_B.geometryHash);
    expect(isValidRevAforRevB).toBe(false);
  });

  it('P5-003-D: CFD boundary conditions fail cleanly when target face is destroyed in CAD REV-B', () => {
    // 1. Establish CAD Document REV-A with Extrude
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-CFD-04',
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
          name: 'Extrude Base Duct',
          type: 'EXTRUDE',
          parameters: { depth: 30, profileId: 'SK_01' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalA = DocumentEvaluator.evaluate(docCAD, { generateCFD: true });
    const solidA = evalA.evaluatedShape as Solid;
    const topFace = solidA.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapEnd'))!.face;

    // Create CFD outlet face reference
    const refOutlet = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_01', topFace);
    expect(refOutlet.resolutionState).toBe('VALID');

    // 2. CAD REV-B: Destroy the feature producing the target face
    docCAD.revision = 2;
    docCAD.features = []; // Feature deleted

    const evalB = DocumentEvaluator.evaluate(docCAD, { generateCFD: true });
    const solidB = (evalB.evaluatedShape || { outerShell: { orientedFaces: [] } }) as Solid;

    // 3. Rebind attempt against destroyed topology
    const rebindResult = TopologyLineageProofEngine.rebindReference(refOutlet, solidB, 2);

    expect(rebindResult.success).toBe(false);
    expect(rebindResult.state).toBe('DELETED');
    expect(rebindResult.reason).toContain('destroyed');
    expect(rebindResult.reboundReference.resolutionState).toBe('DELETED');
  });

  it('P5-003-E: Full end-to-end chain verification (CAD -> CFD -> PLM Invalidation -> Recomputation -> Evidence)', () => {
    // 1. Establish Initial CAD REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-CFD-05',
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
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 50, y: 0 }, { x: 50, y: 25 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 50, y: 25 }, { x: 0, y: 25 }] },
            { id: 'L4', type: 'LINE', points: [{ x: 0, y: 25 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      constraints: [],
      features: [
        {
          id: 'EXT_01',
          featureId: 'EXT_01',
          name: 'Extrude Flow Domain',
          type: 'EXTRUDE',
          parameters: { depth: 25, profileId: 'SK_BASE' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    // Step 1: CAD Evaluation REV-A
    const evalA = DocumentEvaluator.evaluate(docCAD, { generateCFD: true });
    expect(evalA.success).toBe(true);
    const solidA = evalA.evaluatedShape as Solid;

    // Step 2: PLM Projection REV-A
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalA);
    EngineeringPLMEngine.registerArtifact(artCAD_A);

    // Step 3: CFD Discretization & Solver Execution REV-A
    const topFaceA = solidA.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapEnd'))!.face;
    const refOutlet = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_01', topFaceA);

    const { mesh: meshA, meshHash: meshHashA } = CFDAdapter.meshFromBRep(solidA, {
      nx: 6, ny: 4, nz: 4,
      inletVelocity: { x: 1.2, y: 0, z: 0 },
      outletPressure: 0
    });
    const solA = Fvm3DNavierStokesSolver.solve(meshA, standardFluid, solverConfig);

    const hashSolA = EngineeringHashChain.computeCanonicalHash({
      dp: solA.monitors.pressureDropPa,
      cells: meshA.cells.length
    }).canonicalHash;

    const evidenceA: EvidenceRecord = {
      evidenceId: 'EVID_CFD_REV1_05',
      stage: 'SIMULATION',
      sourceSystem: 'SECP_CFD_ENGINE',
      documentId: docCAD.documentId,
      revision: 1,
      canonicalHash: hashSolA,
      geometryHash: artCAD_A.geometryHash,
      topologyHash: artCAD_A.topologyHash,
      meshHash: meshHashA,
      solverOutputHash: `SOLVER-CFD-DP-${solA.monitors.pressureDropPa.toFixed(6)}-REV1`,
      payload: { pressureDropPa: solA.monitors.pressureDropPa },
      verdict: 'VALID'
    };
    docCAD.evidence.push(evidenceA);

    // Step 4: Register CFD Artifact in PLM with dependency
    EngineeringPLMEngine.registerArtifact({
      artifactId: 'ART-P5-CFD-05',
      name: 'CFD Fluid Flow Analysis',
      revision: 'REV-A',
      version: 1,
      type: 'CFD_RESULT',
      status: 'VALID',
      createdBy: 'SECP_CFD_SOLVER',
      createdAt: '2026-01-01T00:00:00.000Z',
      geometryHash: artCAD_A.geometryHash,
      topologyHash: artCAD_A.topologyHash,
      dependencyHash: 'DEP-CFD-REV1',
      provenanceReference: 'EVID-CFD-REV1',
      metadata: { solver: 'Fvm3DNavierStokesSolver' }
    });
    EngineeringPLMEngine.addDependency('ART-P5-CFD-05', 'REV-A', 'ART-P5-CAD-CFD-05', 'REV-A');

    // Step 5: CAD Geometry Mutation -> REV-B
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 50;

    const evalB = DocumentEvaluator.evaluate(docCAD, { generateCFD: true });
    expect(evalB.success).toBe(true);
    const solidB = evalB.evaluatedShape as Solid;

    const artCAD_B = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalB);
    EngineeringPLMEngine.registerArtifact(artCAD_B);

    // Step 6: Verify Automatic PLM Invalidation of REV-A CFD
    expect(EngineeringPLMEngine.getArtifact('ART-P5-CFD-05', 'REV-A')?.status).toBe('OUTDATED');

    // Step 7: Topology Lineage Rebind
    const rebindOutlet = TopologyLineageProofEngine.rebindReference(refOutlet, solidB, 2);
    expect(rebindOutlet.success).toBe(true);
    expect(rebindOutlet.state).toBe('REBOUND');

    // Step 8: CFD Recomputation on REV-B Geometry
    const { mesh: meshB, meshHash: meshHashB } = CFDAdapter.meshFromBRep(solidB, {
      nx: 6, ny: 4, nz: 4,
      inletVelocity: { x: 1.2, y: 0, z: 0 },
      outletPressure: 0
    });
    const solB = Fvm3DNavierStokesSolver.solve(meshB, standardFluid, solverConfig);

    const hashSolB = EngineeringHashChain.computeCanonicalHash({
      dp: solB.monitors.pressureDropPa,
      cells: meshB.cells.length
    }).canonicalHash;

    const evidenceB: EvidenceRecord = {
      evidenceId: 'EVID_CFD_REV2_05',
      stage: 'SIMULATION',
      sourceSystem: 'SECP_CFD_ENGINE',
      documentId: docCAD.documentId,
      revision: 2,
      canonicalHash: hashSolB,
      geometryHash: artCAD_B.geometryHash,
      topologyHash: artCAD_B.topologyHash,
      meshHash: meshHashB,
      solverOutputHash: `SOLVER-CFD-DP-${solB.monitors.pressureDropPa.toFixed(6)}-REV2`,
      payload: { pressureDropPa: solB.monitors.pressureDropPa },
      verdict: 'VALID'
    };
    docCAD.evidence.push(evidenceB);

    // Step 9: Register REV-B CFD Artifact in PLM
    EngineeringPLMEngine.registerArtifact({
      artifactId: 'ART-P5-CFD-05',
      name: 'CFD Fluid Flow Analysis',
      revision: 'REV-B',
      version: 2,
      type: 'CFD_RESULT',
      status: 'VALID',
      createdBy: 'SECP_CFD_SOLVER',
      createdAt: '2026-01-01T00:00:00.000Z',
      geometryHash: artCAD_B.geometryHash,
      topologyHash: artCAD_B.topologyHash,
      dependencyHash: 'DEP-CFD-REV2',
      provenanceReference: 'EVID-CFD-REV2',
      metadata: { solver: 'Fvm3DNavierStokesSolver' }
    });
    EngineeringPLMEngine.addDependency('ART-P5-CFD-05', 'REV-B', 'ART-P5-CAD-CFD-05', 'REV-B');

    // Step 10: Verify Final PLM States & Event Store Projection
    expect(EngineeringPLMEngine.getArtifact('ART-P5-CFD-05', 'REV-A')?.status).toBe('SUPERSEDED');
    expect(EngineeringPLMEngine.getArtifact('ART-P5-CFD-05', 'REV-B')?.status).toBe('VALID');
    expect(solA.monitors.pressureDropPa).not.toEqual(solB.monitors.pressureDropPa);
    expect(meshHashA).not.toEqual(meshHashB);

    // Verify EventStore was populated by canonical PLM projection adapter without direct mutation from test
    const events = EngineeringEventStore.getInstance().getAll();
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some(e => e.eventType === 'OBJECT_CREATED')).toBe(true);
    expect(events.some(e => e.eventType === 'OBJECT_REVISED')).toBe(true);
  });
});
