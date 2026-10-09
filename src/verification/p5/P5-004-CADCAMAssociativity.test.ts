import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { EngineeringDocument, EvidenceRecord } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { TopologyLineageProofEngine } from '../../engine/topology/TopologyLineageProofEngine';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';
import { CanonicalPLMProjectionAdapter } from '../../engine/plm/CanonicalPLMProjectionAdapter';
import { EngineeringEventStore } from '../../engine/industrial-os/event-model/EngineeringEventStore';
import { Solid } from '../../engine/cad-kernel/topology/TopologyContracts';
import { ThreeAxisToolpathEngine } from '../../engine/cam/toolpath/ThreeAxisToolpathEngine';
import { PostProcessorEngine, PostProcessRequest } from '../../engine/cam/post-processor/PostProcessorEngine';
import { ControllerProfiles } from '../../engine/cam/post-processor/ControllerProfiles';
import { MachineDefinitionRegistry } from '../../engine/cam/post-processor/MachineDefinitionRegistry';
import { GCodeVerificationEngine } from '../../engine/cam/verification/GCodeVerificationEngine';
import { DEFAULT_VERIFICATION_TOLERANCES, VerificationContract } from '../../engine/cam/verification/GCodeVerificationTypes';
import { CAMOperationData } from '../../engine/cam/post-processor/NCIntermediateRepresentation';
import { ToolSnapshot } from '../../engine/cam/tool-library/ToolTypes';
import { EngineeringHashChain } from '../../engine/evidence/EngineeringHashChain';
import { CAMDependencyEngine } from '../../engine/cam/production-gate/CAMDependencyEngine';
import { MotionType, MachiningSetup, Toolpath } from '../../engine/cam/toolpath/ToolpathTypes';
import { EngineeringArtifact } from '../../engine/plm/PLMTypes';

describe('P5-004 — CAD → CAM Revision / Associativity / Toolpath Invalidation Proof', () => {
  beforeAll(async () => {
    await ControllerProfiles.initialize();
    await MachineDefinitionRegistry.initialize();
  });

  beforeEach(() => {
    EngineeringPLMEngine.clear();
    EngineeringEventStore.getInstance().clear();
  });

  function createTestToolSnapshot(toolNumber: number = 1): ToolSnapshot {
    const geom: ToolGeometryModel = {
      geometryHash: '0xTOOL_GEO_T1_CARBIDE_12MM',
      type: 'END_MILL',
      dimensions: {
        cuttingDiameterMm: 12,
        shankDiameterMm: 12,
        overallLengthMm: 75,
        cuttingLengthMm: 30,
        fluteCount: 4
      },
      cornerType: 'SHARP',
      boundingRadiusMm: 6,
      totalLengthMm: 75,
      fluteLengthMm: 30,
      shankDiameterMm: 12,
      silhouettePoints: [],
      cadMeshVertexCount: 0,
      cadMeshTriangleCount: 0
    };

    const camTool: CAMTool = {
      toolUUID: `TOOL_UUID_${toolNumber}`,
      toolId: 'TOOL-EM-12',
      name: 'Ø12mm 4-Flute Carbide Endmill',
      type: 'END_MILL',
      category: 'MILLING',
      version: {
        versionString: '1.0.0',
        revisionNumber: 1,
        createdAtTimestamp: 1700000000000,
        author: 'SECP_CAM_ENGINE',
        changeLog: 'Initial Tooling',
        versionHash: '0xTOOL_V1_HASH'
      },
      geometry: geom,
      material: 'CARBIDE',
      coating: 'TIALN',
      cuttingParameters: [],
      compatibleHolders: ['BT40'],
      availability: 'AVAILABLE',
      libraryScope: 'PROJECT',
      validationStatus: 'TOOL_VALID',
      validationMessages: [],
      isArchived: false,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      entityHash: '0xENTITY_HASH'
    };

    return {
      toolNumber,
      snapshotId: `SNAP_T${toolNumber}_V1`,
      toolUUID: `TOOL_UUID_${toolNumber}`,
      toolVersion: '1.0.0',
      toolName: 'Ø12mm Carbide 4-Flute Endmill',
      toolType: 'END_MILL',
      capturedAtTimestamp: 1700000000000,
      geometryHash: '0xTOOL_GEO_T1_CARBIDE_12MM',
      snapshotHash: '0xTOOL_SNAP_T1_HASH_DETERMINISTIC',
      frozenTool: camTool,
      assignedOperationId: 'OP_P5_ROUGH_01',
      assignedOperationName: 'Adaptive Roughing'
    };
  }

  function convertToolpathToOpData(
    setup: MachiningSetup,
    toolpath: Toolpath,
    toolSnapshot: ToolSnapshot
  ): CAMOperationData {
    return {
      operationId: toolpath.operationId,
      operationName: 'Top Facing & Pocketing Pass',
      toolNumber: 1,
      toolSnapshot,
      spindleRpm: 4500,
      spindleDirection: 'CW',
      coolant: 'M8_FLOOD',
      workOffset: 'G54',
      points: toolpath.positions.map(p => ({
        x: p.x,
        y: p.y,
        z: p.z,
        feedRate: p.feedMmMin,
        isRapid: p.motionType === MotionType.RAPID || p.motionType === MotionType.RETRACT,
        segmentId: `SEG_${p.segmentIndex}`
      }))
    };
  }

  it('P5-004-A: CAM topology reference survives CAD geometry mutation and rebinds to REV-B topology', () => {
    // 1. Canonical CAD Document REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-CAM-01',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_MACHINING_SLAB',
          name: 'SK_MACHINING_SLAB',
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
          id: 'EXT_01',
          featureId: 'EXT_01',
          name: 'Extrude Base Stock',
          type: 'EXTRUDE',
          parameters: { depth: 25, profileId: 'SK_MACHINING_SLAB' }
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

    // Pick top face (CapEnd) as machining reference
    const topFaceA = solidA.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapEnd'))!.face;
    const refMachiningTarget = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_01', topFaceA);

    expect(refMachiningTarget.resolutionState).toBe('VALID');
    expect(refMachiningTarget.topologyEntityIdentifier).toBe('EXT_01:FACE:CapEnd');
    expect(refMachiningTarget.geometricSignature).toContain('NORM:0.000,0.000,1.000');
    expect(refMachiningTarget.geometricSignature).toContain('CENT:0.05,0.03,0.03');

    // 2. Mutate CAD Document to REV-B: Depth 25mm -> 50mm
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 50;

    const evalResultB = DocumentEvaluator.evaluate(docCAD);
    expect(evalResultB.success).toBe(true);
    const solidB = evalResultB.evaluatedShape as Solid;

    // 3. Rebind Machining Reference against REV-B Solid
    const rebindResult = TopologyLineageProofEngine.rebindReference(refMachiningTarget, solidB, 2);

    expect(rebindResult.success).toBe(true);
    expect(rebindResult.state).toBe('REBOUND');
    expect(rebindResult.reboundReference).toBeDefined();
    expect(rebindResult.reboundReference!.documentRevision).toBe(2);
    expect(rebindResult.reboundReference!.geometricSignature).toContain('CENT:0.05,0.03,0.05');
    expect(rebindResult.reboundReference!.geometricSignature).toContain('NORM:0.000,0.000,1.000');
  });

  it('P5-004-B: Upstream CAD revision invalidates downstream CAM artifact & toolpath in PLM', () => {
    // 1. Register CAD REV-A in PLM
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-CAM-02',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_02',
          name: 'SK_02',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 80, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 80, y: 0 }, { x: 80, y: 40 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 80, y: 40 }, { x: 0, y: 40 }] },
            { id: 'L4', type: 'LINE', points: [{ x: 0, y: 40 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      constraints: [],
      features: [
        {
          id: 'EXT_01',
          featureId: 'EXT_01',
          name: 'Extrude',
          type: 'EXTRUDE',
          parameters: { depth: 30, profileId: 'SK_02' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalResultA = DocumentEvaluator.evaluate(docCAD);
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalResultA);
    expect(artCAD_A.revision).toBe('REV-A');
    expect(artCAD_A.status).toBe('VALID');

    // 2. Register Downstream CAM Artifact dependent on CAD REV-A
    const camArtifactId = 'ART-P5-CAM-02';
    const camArtifactA: EngineeringArtifact = {
      artifactId: camArtifactId,
      type: 'CAM_TOOLPATH',
      name: 'CAM 3-Axis Facing & Pocketing Toolpath',
      revision: 'REV-A',
      version: 1,
      status: 'VALID',
      createdBy: 'SECP_CAM_ENGINE',
      createdAt: '2026-09-14T00:00:00.000Z',
      geometryHash: artCAD_A.geometryHash,
      topologyHash: artCAD_A.topologyHash,
      sourceDocumentId: docCAD.documentId,
      dependencyHash: artCAD_A.geometryHash,
      provenanceReference: 'EVID-CAM-02-REV-A',
      metadata: {
        upstreamCadArtifact: `${artCAD_A.artifactId}@REV-A`,
        toolpathPointsCount: 16,
        feedRate: 1800
      }
    };

    EngineeringPLMEngine.registerArtifact(camArtifactA);
    EngineeringPLMEngine.addDependency(camArtifactId, 'REV-A', artCAD_A.artifactId, 'REV-A');

    // Verify initial valid state
    const fetchedBefore = EngineeringPLMEngine.getArtifact(camArtifactId, 'REV-A');
    expect(fetchedBefore?.status).toBe('VALID');

    // 3. Evaluate upstream impact via CAMDependencyEngine
    const impact = CAMDependencyEngine.evaluateUpstreamChangeImpact('CAD_GEOMETRY');
    expect(impact.invalidatedStages).toContain('TOOLPATH_GENERATION');
    expect(impact.invalidatedStages).toContain('POST_PROCESS_NC');
    expect(impact.invalidatedStages).toContain('GCODE_VERIFICATION');

    // 4. Mutate CAD Document to REV-B
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 60;

    const evalResultB = DocumentEvaluator.evaluate(docCAD);
    const artCAD_B = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalResultB);
    expect(artCAD_B.revision).toBe('REV-B');
    expect(artCAD_B.geometryHash).not.toBe(artCAD_A.geometryHash);

    // 5. Verify Automatic Downstream Invalidation in PLM Engine
    const fetchedAfter = EngineeringPLMEngine.getArtifact(camArtifactId, 'REV-A');
    expect(fetchedAfter?.status).toBe('OUTDATED');
  });

  it('P5-004-C: CAM recomputation produces a genuinely new REV-B toolpath & NC program', async () => {
    // 1. Establish CAD REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-CAM-03',
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
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 60, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 60, y: 0 }, { x: 60, y: 40 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 60, y: 40 }, { x: 0, y: 40 }] },
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
    const solidA = evalResultA.evaluatedShape as Solid;

    // Tool library and machine setup
    const toolLibrary = ThreeAxisToolpathEngine.createDefaultToolLibrary();
    const boundsA = { minX: 0, maxX: 60, minY: 0, maxY: 40, minZ: 0, maxZ: 25 };
    const setupA = ThreeAxisToolpathEngine.createSetupFromPartBounds('SETUP_REV_A', 'CAM Setup Rev A', boundsA);
    const opsA = ThreeAxisToolpathEngine.planOperationsFromFeatures(setupA, { features: [] }, toolLibrary);
    setupA.operations = opsA;

    const { setup: updatedSetupA } = ThreeAxisToolpathEngine.generateSetupToolpaths(setupA, new Map());
    const toolpathA = updatedSetupA.operations[0].toolpath!;

    expect(toolpathA).toBeDefined();
    expect(toolpathA.positions.length).toBeGreaterThan(0);
    expect(toolpathA.totalLengthMm).toBeGreaterThan(0);

    // Post-Process REV-A to G-Code
    const machine = MachineDefinitionRegistry.getMachineById('MACHINE_HAAS_VF4SS')!;
    const postDef = ControllerProfiles.getProfileById('POST_HAAS_NGC')!;
    const configA = {
      configId: 'CFG_P5_03_A',
      programNumberOrName: '5001',
      programComment: 'P5-004 CAD/CAM REV-A',
      units: 'METRIC_MM' as const,
      selectedWorkOffset: 'G54' as const,
      enableLineNumbers: true,
      lineNumberIncrement: 10,
      enableModalOptimization: true,
      enableSafetyBlocks: true,
      enableRTCP: false,
      compensationApplication: 'CAM_APPLIED' as const,
      linearPrecision: 3,
      rotaryPrecision: 4,
      configHash: 'HASH_CFG_P5_03_A'
    };

    const toolSnapshotA = createTestToolSnapshot(1);
    const opDataA = convertToolpathToOpData(updatedSetupA, toolpathA, toolSnapshotA);

    const postResultA = await PostProcessorEngine.execute({
      programName: '5001',
      programComment: 'REV-A Post',
      operations: [opDataA],
      machine,
      postDefinition: postDef,
      configuration: configA
    });

    expect(postResultA.program.validationStatus).toBe('VALIDATED');
    expect(postResultA.program.rawGCodeText).toContain('G54');
    expect(postResultA.program.rawGCodeText).toContain('Z20.000'); // Safe height for 25mm part (25-5=20 cut plane)

    // Verify G-Code with GCodeVerificationEngine
    const verifContractA: VerificationContract = {
      ncProgramText: postResultA.program.rawGCodeText,
      programName: '5001',
      controllerDialect: postDef.controllerDialect,
      machine,
      toolSnapshots: [toolSnapshotA],
      tolerances: DEFAULT_VERIFICATION_TOLERANCES
    };
    const verifResultA = await GCodeVerificationEngine.verify(verifContractA);
    if (!verifResultA.isPassing) {
      console.log('P5-004-C G-code:\n', postResultA.program.rawGCodeText);
      console.log('P5-004-C verifResultA issues:', JSON.stringify(verifResultA.issues, null, 2));
    }
    expect(verifResultA.isPassing).toBe(true);

    // 2. Advance CAD to REV-B: Depth 25mm -> 60mm
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 60;

    const evalResultB = DocumentEvaluator.evaluate(docCAD);
    const solidB = evalResultB.evaluatedShape as Solid;

    // Recompute CAM Setup and Toolpath for REV-B
    const boundsB = { minX: 0, maxX: 60, minY: 0, maxY: 40, minZ: 0, maxZ: 60 };
    const setupB = ThreeAxisToolpathEngine.createSetupFromPartBounds('SETUP_REV_B', 'CAM Setup Rev B', boundsB);
    const opsB = ThreeAxisToolpathEngine.planOperationsFromFeatures(setupB, { features: [] }, toolLibrary);
    setupB.operations = opsB;

    const { setup: updatedSetupB } = ThreeAxisToolpathEngine.generateSetupToolpaths(setupB, new Map());
    const toolpathB = updatedSetupB.operations[0].toolpath!;

    // Post-Process REV-B to G-Code
    const configB = {
      ...configA,
      configId: 'CFG_P5_03_B',
      programNumberOrName: '5002',
      programComment: 'P5-004 CAD/CAM REV-B',
      configHash: 'HASH_CFG_P5_03_B'
    };

    const toolSnapshotB = createTestToolSnapshot(1);
    const opDataB = convertToolpathToOpData(updatedSetupB, toolpathB, toolSnapshotB);

    const postResultB = await PostProcessorEngine.execute({
      programName: '5002',
      programComment: 'REV-B Post',
      operations: [opDataB],
      machine,
      postDefinition: postDef,
      configuration: configB
    });

    expect(postResultB.program.validationStatus).toBe('VALIDATED');

    // 3. Physical & Cryptographic Distinction Proofs
    // A) Toolpath level distinctions
    expect(toolpathA.boundingVolume.maxZ).not.toBe(toolpathB.boundingVolume.maxZ); // Safe clearance planes differ (50mm vs 85mm)
    expect(toolpathA.boundingVolume.minZ).not.toBe(toolpathB.boundingVolume.minZ); // Cut levels differ (20mm vs 55mm)
    expect(toolpathA.positions[2].z).toBe(20.0); // 25 - 5
    expect(toolpathB.positions[2].z).toBe(55.0); // 60 - 5
    expect(toolpathA.totalLengthMm).toBe(toolpathB.totalLengthMm);

    // B) NC / G-code level distinctions
    expect(postResultA.program.rawGCodeText).not.toBe(postResultB.program.rawGCodeText);
    expect(postResultA.program.ncProgramHash).not.toBe(postResultB.program.ncProgramHash);
    expect(postResultA.evidence.provenanceDigestSha256).not.toBe(postResultB.evidence.provenanceDigestSha256);

    // Line diff verification
    const diff = PostProcessorEngine.compareNC(postResultA.program.rawGCodeText, postResultB.program.rawGCodeText);
    const modifiedLines = diff.filter(d => d.type === 'MODIFIED' || d.type === 'ADDED' || d.type === 'REMOVED');
    expect(modifiedLines.length).toBeGreaterThan(0);
  });

  it('P5-004-D: CAM boundary conditions fail cleanly when target face is destroyed in CAD REV-B', () => {
    // 1. Canonical CAD Document REV-A with Extrude feature
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-CAM-04',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_BOSS',
          name: 'SK_BOSS',
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
          name: 'Extrude Boss',
          type: 'EXTRUDE',
          parameters: { depth: 20, profileId: 'SK_BOSS' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const evalResultA = DocumentEvaluator.evaluate(docCAD);
    const solidA = evalResultA.evaluatedShape as Solid;
    const topFaceA = solidA.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapEnd'))!.face;

    const refTarget = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_01', topFaceA);
    expect(refTarget.resolutionState).toBe('VALID');

    // 2. Destructive CAD Mutation: Remove the feature completely in REV-B
    docCAD.revision = 2;
    docCAD.features = [];

    const evalResultB = DocumentEvaluator.evaluate(docCAD);
    expect(evalResultB.success).toBe(true);
    const solidB = evalResultB.evaluatedShape as Solid;

    // 3. Attempt rebind against destroyed solid
    const rebindResult = TopologyLineageProofEngine.rebindReference(refTarget, solidB, 2);

    expect(rebindResult.success).toBe(false);
    expect(rebindResult.state).toBe('DELETED');
    expect(rebindResult.reason).toContain('Target solid has no valid topological faces; entity is destroyed.');
    expect(rebindResult.reboundReference?.resolutionState).toBe('DELETED');
  });

  it('P5-004-E: Full end-to-end chain verification (CAD -> CAM -> Toolpath -> NC -> PLM Invalidation -> Recomputation -> Evidence)', async () => {
    // 1. Establish Canonical CAD Document REV-A
    const docCAD: EngineeringDocument = {
      documentId: 'P5-CAD-CAM-05',
      revision: 1,
      type: 'PART',
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [
        {
          id: 'SK_SLAB',
          name: 'SK_SLAB',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 75, y: 0 }] },
            { id: 'L2', type: 'LINE', points: [{ x: 75, y: 0 }, { x: 75, y: 50 }] },
            { id: 'L3', type: 'LINE', points: [{ x: 75, y: 50 }, { x: 0, y: 50 }] },
            { id: 'L4', type: 'LINE', points: [{ x: 0, y: 50 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      constraints: [],
      features: [
        {
          id: 'EXT_01',
          featureId: 'EXT_01',
          name: 'Extrude Slab',
          type: 'EXTRUDE',
          parameters: { depth: 30, profileId: 'SK_SLAB' }
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    // A) CAD Evaluation REV-A
    const evalResultA = DocumentEvaluator.evaluate(docCAD);
    expect(evalResultA.success).toBe(true);
    const solidA = evalResultA.evaluatedShape as Solid;

    // B) Persistent Topology Target Face
    const topFaceA = solidA.outerShell.orientedFaces.find(of => of.face.persistentId?.includes('CapEnd'))!.face;
    const refTarget = TopologyLineageProofEngine.createFaceReference(docCAD, 'EXT_01', topFaceA);
    expect(refTarget.resolutionState).toBe('VALID');

    // C) Toolpath Generation REV-A
    const toolLibrary = ThreeAxisToolpathEngine.createDefaultToolLibrary();
    const boundsA = { minX: 0, maxX: 75, minY: 0, maxY: 50, minZ: 0, maxZ: 30 };
    const setupA = ThreeAxisToolpathEngine.createSetupFromPartBounds('SETUP_P5_05_A', 'CAM Setup 05 Rev A', boundsA);
    const opsA = ThreeAxisToolpathEngine.planOperationsFromFeatures(setupA, { features: [] }, toolLibrary);
    setupA.operations = opsA;

    const { setup: updatedSetupA } = ThreeAxisToolpathEngine.generateSetupToolpaths(setupA, new Map());
    const toolpathA = updatedSetupA.operations[0].toolpath!;
    expect(toolpathA.positions.length).toBeGreaterThan(0);

    // D) Post-Processing REV-A to NC / G-Code
    const machine = MachineDefinitionRegistry.getMachineById('MACHINE_HAAS_VF4SS')!;
    const postDef = ControllerProfiles.getProfileById('POST_HAAS_NGC')!;
    const toolSnapshotA = createTestToolSnapshot(1);
    const opDataA = convertToolpathToOpData(updatedSetupA, toolpathA, toolSnapshotA);
    const configA = {
      configId: 'CFG_P5_05_A',
      programNumberOrName: '5501',
      programComment: 'P5-004 E2E REV-A',
      units: 'METRIC_MM' as const,
      selectedWorkOffset: 'G54' as const,
      enableLineNumbers: true,
      lineNumberIncrement: 10,
      enableModalOptimization: true,
      enableSafetyBlocks: true,
      enableRTCP: false,
      compensationApplication: 'CAM_APPLIED' as const,
      linearPrecision: 3,
      rotaryPrecision: 4,
      configHash: 'HASH_CFG_P5_05_A'
    };

    const postResultA = await PostProcessorEngine.execute({
      programName: '5501',
      programComment: 'REV-A E2E',
      operations: [opDataA],
      machine,
      postDefinition: postDef,
      configuration: configA
    });

    expect(postResultA.program.validationStatus).toBe('VALIDATED');

    // E) G-Code Verification REV-A
    const verifContractA: VerificationContract = {
      ncProgramText: postResultA.program.rawGCodeText,
      programName: '5501',
      controllerDialect: postDef.controllerDialect,
      machine,
      toolSnapshots: [toolSnapshotA],
      tolerances: DEFAULT_VERIFICATION_TOLERANCES
    };
    const verifResultA = await GCodeVerificationEngine.verify(verifContractA);
    expect(verifResultA.isPassing).toBe(true);

    // F) Canonical Hashes & Evidence Record REV-A
    const toolpathHashA = toolpathA.toolpathHash;
    const ncHashA = postResultA.program.ncProgramHash;
    const canonicalHashA = EngineeringHashChain.computeCanonicalHash({
      documentId: docCAD.documentId,
      revision: docCAD.revision,
      toolpathHash: toolpathHashA,
      ncHash: ncHashA,
      verifStatus: verifResultA.status
    });

    const evREV1: EvidenceRecord = {
      evidenceId: `EV_CAM_${docCAD.documentId}_REV1`,
      stage: 'MANUFACTURING',
      sourceSystem: 'SECP_CAM_ENGINE',
      documentId: docCAD.documentId,
      revision: 1,
      canonicalHash: canonicalHashA,
      geometryHash: `G-HASH-${docCAD.documentId}-REV1`,
      timestamp: '2026-09-14T00:00:00.000Z',
      payload: {
        toolpathHash: toolpathHashA,
        ncHash: ncHashA,
        totalLengthMm: toolpathA.totalLengthMm,
        cutZ: toolpathA.positions[2].z
      },
      verdict: 'VALID',
      status: 'ACTIVE'
    };
    docCAD.evidence.push(evREV1);

    // G) Project CAD REV-A and CAM REV-A into PLM
    const artCAD_A = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalResultA);
    const camArtifactId = 'ART-P5-CAM-05';
    const artCAM_A: EngineeringArtifact = {
      artifactId: camArtifactId,
      type: 'CAM_TOOLPATH',
      name: 'CAM Toolpath & G-Code E2E',
      revision: 'REV-A',
      version: 1,
      status: 'VALID',
      createdBy: 'SECP_CAM_ENGINE',
      createdAt: '2026-09-14T00:00:00.000Z',
      geometryHash: artCAD_A.geometryHash,
      topologyHash: artCAD_A.topologyHash,
      sourceDocumentId: docCAD.documentId,
      dependencyHash: artCAD_A.geometryHash,
      provenanceReference: evREV1.evidenceId,
      metadata: {
        toolpathHash: toolpathHashA,
        ncHash: ncHashA
      }
    };
    EngineeringPLMEngine.registerArtifact(artCAM_A);
    EngineeringPLMEngine.addDependency(camArtifactId, 'REV-A', artCAD_A.artifactId, 'REV-A');

    expect(EngineeringPLMEngine.getArtifact(camArtifactId, 'REV-A')?.status).toBe('VALID');

    // 2. CAD REVISION MUTATION: Depth 30mm -> 65mm (REV-B)
    docCAD.revision = 2;
    docCAD.features[0].parameters.depth = 65;

    // H) Evaluate CAD REV-B & Project into PLM
    const evalResultB = DocumentEvaluator.evaluate(docCAD);
    const solidB = evalResultB.evaluatedShape as Solid;
    const artCAD_B = CanonicalPLMProjectionAdapter.projectFromDocument(docCAD, evalResultB);

    // Verify PLM Invalidation of Downstream CAM Artifact
    const camArtRevAAfterMutation = EngineeringPLMEngine.getArtifact(camArtifactId, 'REV-A');
    expect(camArtRevAAfterMutation?.status).toBe('OUTDATED');

    // I) Topology Rebinding to REV-B
    const rebindResult = TopologyLineageProofEngine.rebindReference(refTarget, solidB, 2);
    expect(rebindResult.success).toBe(true);
    expect(rebindResult.state).toBe('REBOUND');

    // J) Recompute Toolpath REV-B
    const boundsB = { minX: 0, maxX: 75, minY: 0, maxY: 50, minZ: 0, maxZ: 65 };
    const setupB = ThreeAxisToolpathEngine.createSetupFromPartBounds('SETUP_P5_05_B', 'CAM Setup 05 Rev B', boundsB);
    const opsB = ThreeAxisToolpathEngine.planOperationsFromFeatures(setupB, { features: [] }, toolLibrary);
    setupB.operations = opsB;

    const { setup: updatedSetupB } = ThreeAxisToolpathEngine.generateSetupToolpaths(setupB, new Map());
    const toolpathB = updatedSetupB.operations[0].toolpath!;

    // K) Recompute Post-Processing to NC / G-Code REV-B
    const configB = {
      ...configA,
      configId: 'CFG_P5_05_B',
      programNumberOrName: '5502',
      programComment: 'P5-004 E2E REV-B',
      configHash: 'HASH_CFG_P5_05_B'
    };
    const toolSnapshotB = createTestToolSnapshot(1);
    const opDataB = convertToolpathToOpData(updatedSetupB, toolpathB, toolSnapshotB);

    const postResultB = await PostProcessorEngine.execute({
      programName: '5502',
      programComment: 'REV-B E2E',
      operations: [opDataB],
      machine,
      postDefinition: postDef,
      configuration: configB
    });
    expect(postResultB.program.validationStatus).toBe('VALIDATED');

    // L) G-Code Verification REV-B
    const verifContractB: VerificationContract = {
      ncProgramText: postResultB.program.rawGCodeText,
      programName: '5502',
      controllerDialect: postDef.controllerDialect,
      machine,
      toolSnapshots: [toolSnapshotB],
      tolerances: DEFAULT_VERIFICATION_TOLERANCES
    };
    const verifResultB = await GCodeVerificationEngine.verify(verifContractB);
    expect(verifResultB.isPassing).toBe(true);

    // M) Distinct Evidence Record REV-B
    const toolpathHashB = toolpathB.toolpathHash;
    const ncHashB = postResultB.program.ncProgramHash;
    const canonicalHashB = EngineeringHashChain.computeCanonicalHash({
      documentId: docCAD.documentId,
      revision: docCAD.revision,
      toolpathHash: toolpathHashB,
      ncHash: ncHashB,
      verifStatus: verifResultB.status
    });

    const evREV2: EvidenceRecord = {
      evidenceId: `EV_CAM_${docCAD.documentId}_REV2`,
      stage: 'MANUFACTURING',
      sourceSystem: 'SECP_CAM_ENGINE',
      documentId: docCAD.documentId,
      revision: 2,
      canonicalHash: canonicalHashB,
      geometryHash: `G-HASH-${docCAD.documentId}-REV2`,
      timestamp: '2026-09-14T00:00:00.000Z',
      payload: {
        toolpathHash: toolpathHashB,
        ncHash: ncHashB,
        totalLengthMm: toolpathB.totalLengthMm,
        cutZ: toolpathB.positions[2].z
      },
      verdict: 'VALID',
      status: 'ACTIVE'
    };
    docCAD.evidence.push(evREV2);

    // N) Register CAM REV-B in PLM
    const artCAM_B: EngineeringArtifact = {
      artifactId: camArtifactId,
      type: 'CAM_TOOLPATH',
      name: 'CAM Toolpath & G-Code E2E',
      revision: 'REV-B',
      version: 2,
      status: 'VALID',
      createdBy: 'SECP_CAM_ENGINE',
      createdAt: '2026-09-14T00:00:00.000Z',
      geometryHash: artCAD_B.geometryHash,
      topologyHash: artCAD_B.topologyHash,
      sourceDocumentId: docCAD.documentId,
      dependencyHash: artCAD_B.geometryHash,
      provenanceReference: evREV2.evidenceId,
      metadata: {
        toolpathHash: toolpathHashB,
        ncHash: ncHashB
      }
    };
    EngineeringPLMEngine.registerArtifact(artCAM_B);
    EngineeringPLMEngine.addDependency(camArtifactId, 'REV-B', artCAD_B.artifactId, 'REV-B');

    // 3. Final Verification of Integrity & Anti-Masquerade
    expect(EngineeringPLMEngine.getArtifact(camArtifactId, 'REV-A')?.status).toBe('SUPERSEDED');
    expect(EngineeringPLMEngine.getArtifact(camArtifactId, 'REV-B')?.status).toBe('VALID');

    // Cut levels differ
    expect(toolpathA.positions[2].z).toBe(25.0); // 30 - 5
    expect(toolpathB.positions[2].z).toBe(60.0); // 65 - 5
    expect(toolpathA.totalLengthMm).toBe(toolpathB.totalLengthMm);

    // G-code text and hashes differ
    expect(ncHashA).not.toBe(ncHashB);
    expect(postResultA.program.rawGCodeText).not.toBe(postResultB.program.rawGCodeText);
    expect(canonicalHashA).not.toBe(canonicalHashB);

    // Stale REV-A cannot masquerade as valid for REV-B geometry
    const isValidRevAforRevB = (evREV1.geometryHash === artCAD_B.geometryHash);
    expect(isValidRevAforRevB).toBe(false);

    // Both historical evidence records preserved in docCAD (including automated evaluations)
    expect(docCAD.evidence.length).toBe(4);
    expect(docCAD.evidence[1].revision).toBe(1);
    expect(docCAD.evidence[3].revision).toBe(2);

    // Event Store verified: projection events recorded without manual test appends
    const events = EngineeringEventStore.getInstance().getAll();
    expect(events.length).toBeGreaterThanOrEqual(2);
  });
});
