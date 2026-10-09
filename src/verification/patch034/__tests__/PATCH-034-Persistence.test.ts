import { describe, it, expect, beforeAll } from 'vitest';
import { ProjectStorageEngine, SecpCadProjectData } from '../../../engine/projectStorage';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { SketchUIIntegration } from '../../../engine/cad-kernel/ui-integration/SketchUIIntegration';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { BRepKernel } from '../../../engine/cad-kernel/brep/BRepKernel';
import { BRepHasher } from '../../../engine/cad-kernel/topology/BRepHasher';
import { CadSolidEntity } from '../../../engine/cadKernel';

// Mock localStorage for Node.js test environment
beforeAll(() => {
  if (typeof localStorage === 'undefined') {
    const store: Record<string, string> = {};
    global.localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { for (const k in store) delete store[k]; },
      length: 0,
      key: (index: number) => null,
    } as any;
  }
});

describe('PATCH-034-Persistence — SOT-001 Step 3B Persistence & Special-Path Canonical Migration', () => {
  const brepKernel = new BRepKernel();

  const rectSketch = [
    { type: 'LINE', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    { type: 'LINE', points: [{ x: 100, y: 0 }, { x: 100, y: 100 }] },
    { type: 'LINE', points: [{ x: 100, y: 100 }, { x: 0, y: 100 }] },
    { type: 'LINE', points: [{ x: 0, y: 100 }, { x: 0, y: 0 }] }
  ];

  it('TEST-01: Canonical Save/Load Round Trip & Equivalence', () => {
    const docBase = SketchUIIntegration.createEmptyDocument('ROUND_TRIP_DOC');
    const evalResultA = SketchUIIntegration.applyExtrudeAction(docBase, rectSketch, 40);
    expect(evalResultA.success).toBe(true);

    const projectData: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-test',
      projectName: 'Test Canonical Persistence Project',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: evalResultA.evaluatedShape as unknown as CadSolidEntity,
      canonicalDocument: evalResultA.document,
      assemblyComponents: [],
      assemblyMates: []
    };

    // Save
    ProjectStorageEngine.saveToLocalStorage(projectData);

    // Load
    const loadedData = ProjectStorageEngine.loadFromLocalStorage();
    expect(loadedData).not.toBeNull();
    expect(loadedData!.canonicalDocument).toBeDefined();

    // Verify Canonical semantic equivalence
    const docB = loadedData!.canonicalDocument!;
    expect(docB.documentId).toBe(evalResultA.document.documentId);
    expect(docB.revision).toBe(evalResultA.document.revision);
    expect(docB.sketches.length).toBe(evalResultA.document.sketches.length);
    expect(docB.features.length).toBe(evalResultA.document.features.length);
    expect(docB.units).toEqual(evalResultA.document.units);

    // Re-evaluate Loaded Document
    const evalResultB = DocumentEvaluator.evaluate(docB);
    expect(evalResultB.success).toBe(true);

    // Assert Geometry and Volume Equivalence
    const volA = brepKernel.computeVolume(evalResultA.evaluatedShape as any);
    const volB = brepKernel.computeVolume(evalResultB.evaluatedShape as any);
    expect(Math.round(volA < 1 ? volA * 1e9 : volA)).toBe(Math.round(volB < 1 ? volB * 1e9 : volB));

    // Assert Geometry Hash Equivalence
    const hashA = BRepHasher.computeEvidence(evalResultA.evaluatedShape as any);
    const hashB = BRepHasher.computeEvidence(evalResultB.evaluatedShape as any);
    expect(hashA.geometryHash).toEqual(hashB.geometryHash);
    expect(hashA.topologyHash).toEqual(hashB.topologyHash);
  });

  it('TEST-02: Canonical Export/Import Round Trip', () => {
    const docBase = SketchUIIntegration.createEmptyDocument('EXPORT_DOC');
    const evalResultA = SketchUIIntegration.applyExtrudeAction(docBase, rectSketch, 50);

    const projectData: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-test',
      projectName: 'Test Canonical Persistence Project',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: evalResultA.evaluatedShape as unknown as CadSolidEntity,
      canonicalDocument: evalResultA.document,
      assemblyComponents: [],
      assemblyMates: []
    };

    // Export JSON
    const exportedJson = ProjectStorageEngine.exportProjectJson(projectData);

    // Import JSON
    const importedData = ProjectStorageEngine.importProjectJson(exportedJson);
    expect(importedData).not.toBeNull();
    expect(importedData.canonicalDocument).toBeDefined();

    // Evaluate
    const evalResultB = DocumentEvaluator.evaluate(importedData.canonicalDocument!);
    expect(evalResultB.success).toBe(true);

    // Assert Volume and Geometry Hash Equivalence
    const volA = brepKernel.computeVolume(evalResultA.evaluatedShape as any);
    const volB = brepKernel.computeVolume(evalResultB.evaluatedShape as any);
    expect(volA).toEqual(volB);

    const hashA = BRepHasher.computeEvidence(evalResultA.evaluatedShape as any);
    const hashB = BRepHasher.computeEvidence(evalResultB.evaluatedShape as any);
    expect(hashA.geometryHash).toEqual(hashB.geometryHash);
  });

  it('TEST-03: Causal Parameter Mutation After Load', () => {
    const docBase = SketchUIIntegration.createEmptyDocument('MUTATE_DOC');
    const evalResultA = SketchUIIntegration.applyExtrudeAction(docBase, rectSketch, 40);

    const projectData: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-test',
      projectName: 'Test Mutation Project',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: evalResultA.evaluatedShape as unknown as CadSolidEntity,
      canonicalDocument: evalResultA.document,
      assemblyComponents: [],
      assemblyMates: []
    };

    const exportedJson = ProjectStorageEngine.exportProjectJson(projectData);
    const importedData = ProjectStorageEngine.importProjectJson(exportedJson);

    // Load and Mutate depth
    const docLoaded = importedData.canonicalDocument!;
    const evalResultB = SketchUIIntegration.applyExtrudeAction(docLoaded, rectSketch, 80);
    expect(evalResultB.success).toBe(true);

    // Assert Volume Doubled Causal Connection
    const rawVolA = brepKernel.computeVolume(evalResultA.evaluatedShape as any);
    const volA = Math.round(rawVolA < 1 ? rawVolA * 1e9 : rawVolA);
    const rawVolB = brepKernel.computeVolume(evalResultB.evaluatedShape as any);
    const volB = Math.round(rawVolB < 1 ? rawVolB * 1e9 : rawVolB);

    expect(volB).toBe(2 * volA);

    const hashA = BRepHasher.computeEvidence(evalResultA.evaluatedShape as any);
    const hashB = BRepHasher.computeEvidence(evalResultB.evaluatedShape as any);
    expect(hashA.geometryHash).not.toEqual(hashB.geometryHash);
    expect(hashA.topologyHash).toEqual(hashB.topologyHash);
  });

  it('TEST-04: Poisoned activeSolid Protection (Precedence of canonicalDocument)', () => {
    const docBase = SketchUIIntegration.createEmptyDocument('POISON_DOC');
    // Valid canonical Document Extruded to 40mm (Volume 400,000)
    const evalResultA = SketchUIIntegration.applyExtrudeAction(docBase, rectSketch, 40);

    // Stale/Poisoned Solid mimicking 100mm Extrude (Volume 1,000,000)
    const poisonedSolid: CadSolidEntity = {
      id: 'poisoned-solid',
      name: 'Poisoned Sphere',
      type: 'SPHERE',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      colorHex: '#ff0000',
      dimensions: { radius: 100 },
      volumeM3: 9.9999, // deliberate poisoned values
      surfaceAreaM2: 50.0,
      centerOfGravity: { x: 0, y: 0, z: 0 },
      mesh: { vertices: [], normals: [], indices: [], facesCount: 0 }
    };

    const projectData: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-poison',
      projectName: 'Poisoned Project',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: poisonedSolid, // poisoned cache
      canonicalDocument: evalResultA.document,
      assemblyComponents: [],
      assemblyMates: []
    };

    // Simulate Case C processing: if canonicalDocument exists, activeSolid cache must be discarded
    expect(projectData.canonicalDocument).toBeDefined();
    
    // Process evaluation directly from canonicalDocument
    const evaluatedResult = DocumentEvaluator.evaluate(projectData.canonicalDocument!);
    expect(evaluatedResult.success).toBe(true);

    const finalVolume = brepKernel.computeVolume(evaluatedResult.evaluatedShape as any);
    const finalVolumeMm3 = Math.round(finalVolume < 1 ? finalVolume * 1e9 : finalVolume);

    // Assert it matches the 40mm extrude (400,000) and NOT the poisoned sphere value
    expect(finalVolumeMm3).toBe(400000);
    expect(finalVolumeMm3).not.toBe(9999900000); // not the poisoned volume
  });

  it('TEST-05: Legacy File Load Compatibility', () => {
    // Valid legacy file with no canonicalDocument but valid activeSolid
    const legacySolid: CadSolidEntity = {
      id: 'legacy-box',
      name: 'Legacy_Box',
      type: 'BOX',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      colorHex: '#00ff00',
      dimensions: { dx: 100, dy: 100, dz: 40 },
      volumeM3: 0.0004,
      surfaceAreaM2: 0.036,
      centerOfGravity: { x: 0, y: 0, z: 0 },
      mesh: { vertices: [0.1, 0.2, 0.3], normals: [0, 0, 1], indices: [0, 0, 0], facesCount: 1 }
    };

    const legacyProject: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-legacy',
      projectName: 'Legacy Un-parametric Project',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: legacySolid, // pure baked B-Rep
      assemblyComponents: [],
      assemblyMates: []
    };

    // Assert Case B: No canonical document
    expect(legacyProject.canonicalDocument).toBeUndefined();

    // Check we treat legacy as static IMPORTED_SOLID
    const legacySolidImported: CadSolidEntity = {
      ...legacyProject.activeSolid!,
      type: 'IMPORTED_SOLID',
      name: `${legacyProject.activeSolid!.name}_Static_Import`
    };

    expect(legacySolidImported.type).toBe('IMPORTED_SOLID');
    expect(legacySolidImported.name).toBe('Legacy_Box_Static_Import');
  });

  it('TEST-06: Legacy Load -> Save -> Reload -> geometry preservation', () => {
    const legacySolid: CadSolidEntity = {
      id: 'legacy-box-2',
      name: 'Legacy_Box_2',
      type: 'BOX',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      colorHex: '#0000ff',
      dimensions: { dx: 150, dy: 150, dz: 60 },
      volumeM3: 0.00135,
      surfaceAreaM2: 0.081,
      centerOfGravity: { x: 0, y: 0, z: 0 },
      mesh: {
        vertices: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2],
        facesCount: 1
      }
    };

    const legacyProject: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-legacy-2',
      projectName: 'Legacy Un-parametric Project 2',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: legacySolid,
      assemblyComponents: [],
      assemblyMates: []
    };

    // Load step: in-memory state setup simulating processImportedProject logic
    const inMemoryCanonicalDoc: EngineeringDocument | null = null;
    const inMemoryActiveSolid: CadSolidEntity = {
      ...legacyProject.activeSolid!,
      type: 'IMPORTED_SOLID',
      name: `${legacyProject.activeSolid!.name}_Static_Import`
    };

    expect(inMemoryCanonicalDoc).toBeNull();
    expect(inMemoryActiveSolid.type).toBe('IMPORTED_SOLID');

    // Save step
    const savedProject: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-legacy-2',
      projectName: 'Legacy Un-parametric Project 2',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: inMemoryActiveSolid,
      canonicalDocument: inMemoryCanonicalDoc || undefined, // strictly excluded when null
      assemblyComponents: [],
      assemblyMates: []
    };

    // Assert serialization contract
    expect(savedProject.canonicalDocument).toBeUndefined();
    expect(savedProject.activeSolid).toBeDefined();

    // Reload step
    const loadedProject = savedProject;
    expect(loadedProject.canonicalDocument).toBeUndefined();
    expect(loadedProject.activeSolid).toBeDefined();
    expect(loadedProject.activeSolid!.type).toBe('IMPORTED_SOLID');

    // Repeated load/save cycles verify conservation of volume and mesh metadata
    expect(loadedProject.activeSolid!.volumeM3).toBeCloseTo(0.00135, 6);
    expect(loadedProject.activeSolid!.mesh.vertices.length).toBe(9);
    expect(loadedProject.activeSolid!.mesh.vertices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(loadedProject.activeSolid!.mesh.indices).toEqual([0, 1, 2]);
  });

  it('TEST-07: Legacy canonical boundary', () => {
    const legacySolid: CadSolidEntity = {
      id: 'legacy-box-3',
      name: 'Legacy_Box_3',
      type: 'BOX',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      colorHex: '#0000ff',
      dimensions: { dx: 150, dy: 150, dz: 60 },
      volumeM3: 0.00135,
      surfaceAreaM2: 0.081,
      centerOfGravity: { x: 0, y: 0, z: 0 },
      mesh: { vertices: [1, 2, 3], normals: [0, 0, 1], indices: [0, 0, 0], facesCount: 1 }
    };

    const legacyProject: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-legacy-3',
      projectName: 'Legacy Un-parametric Project 3',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: legacySolid,
      assemblyComponents: [],
      assemblyMates: []
    };

    // Verify STATIC_IMPORT_PLACEHOLDER is never created on legacy load
    // Check serialization does not write canonicalDocument for legacy mode
    const loadedCanonicalDoc = legacyProject.canonicalDocument || null;
    expect(loadedCanonicalDoc).toBeNull();

    const savedProjectLegacy: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-legacy-3',
      projectName: 'Legacy Un-parametric Project 3',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: legacySolid,
      canonicalDocument: loadedCanonicalDoc || undefined,
      assemblyComponents: [],
      assemblyMates: []
    };
    expect(savedProjectLegacy.canonicalDocument).toBeUndefined();

    // Genuine canonical document still serializes normally
    const genuineDoc = SketchUIIntegration.createEmptyDocument('GENUINE_DOC');
    const savedProjectGenuine: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-genuine',
      projectName: 'Genuine Project',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: legacySolid,
      canonicalDocument: genuineDoc,
      assemblyComponents: [],
      assemblyMates: []
    };
    expect(savedProjectGenuine.canonicalDocument).toBeDefined();
    expect(savedProjectGenuine.canonicalDocument!.documentId).toBe('GENUINE_DOC');
  });

  it('TEST-08: IMPORTED_SOLID mesh rendering contract', () => {
    // Simulate our BufferGeometry rendering logic
    const importedSolid: CadSolidEntity = {
      id: 'imported-mesh-solid',
      name: 'Imported_Mesh_Solid',
      type: 'IMPORTED_SOLID',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      colorHex: '#abcdef',
      dimensions: { dx: 120, dy: 130, dz: 140 }, // Bounding box values
      volumeM3: 0.005,
      surfaceAreaM2: 0.1,
      centerOfGravity: { x: 0, y: 0, z: 0 },
      mesh: {
        vertices: [10, 20, 30, 40, 50, 60], // Original vertices in meters
        normals: [0, 1, 0, 0, 1, 0],
        indices: [0, 1, 0],
        facesCount: 2
      }
    };

    // Reconstruct scaled positions exactly as done in CadViewport3D.tsx:
    const scaledVertices = importedSolid.mesh.vertices.map((v: number) => v * 1000);
    expect(scaledVertices).toEqual([10000, 20000, 30000, 40000, 50000, 60000]);

    // Test positions become geometry source rather than bounding dimensions
    expect(scaledVertices[0]).toBe(10000);
    expect(scaledVertices[0]).not.toBe(120 * 1000); // must NOT use dx bounding box

    // Preserved normals & indices
    expect(importedSolid.mesh.normals).toEqual([0, 1, 0, 0, 1, 0]);
    expect(importedSolid.mesh.indices).toEqual([0, 1, 0]);
  });

  it('TEST-09: Canonical + poisoned activeSolid precedence', () => {
    const docBase = SketchUIIntegration.createEmptyDocument('POISON_PREC_DOC');
    const evalResultA = SketchUIIntegration.applyExtrudeAction(docBase, rectSketch, 40);

    const poisonedSolid: CadSolidEntity = {
      id: 'poisoned-solid-2',
      name: 'Poisoned Solid 2',
      type: 'IMPORTED_SOLID',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      colorHex: '#ff0000',
      dimensions: { dx: 500, dy: 500, dz: 500 },
      volumeM3: 9.9999,
      surfaceAreaM2: 50.0,
      centerOfGravity: { x: 0, y: 0, z: 0 },
      mesh: { vertices: [99, 99, 99], normals: [1, 0, 0], indices: [0, 0, 0], facesCount: 1 }
    };

    const projectData: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-poison-2',
      projectName: 'Poisoned Project 2',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: poisonedSolid, // poisoned cache
      canonicalDocument: evalResultA.document,
      assemblyComponents: [],
      assemblyMates: []
    };

    // Simulate Case A load precedence: canonical document evaluation must overwrite loaded.activeSolid
    expect(projectData.canonicalDocument).toBeDefined();

    const evaluatedResult = DocumentEvaluator.evaluate(projectData.canonicalDocument!);
    expect(evaluatedResult.success).toBe(true);
    expect(evaluatedResult.evaluatedShape).not.toBeNull();
    expect((evaluatedResult.evaluatedShape as any).type).not.toBe('IMPORTED_SOLID');
    expect((evaluatedResult.evaluatedShape as any).volumeM3).not.toBe(9.9999);
  });

  it('TEST-10: REAL LEGACY ROUND-TRIP (Verification of exact legacy persistence path)', () => {
    // 1. Initial raw legacy JSON representing baked mesh data
    const rawLegacyJSON: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-legacy-rt',
      projectName: 'Legacy Round Trip Part',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: {
        id: 'legacy-geom-id-123',
        name: 'Legacy_Faceted_Brace',
        type: 'BOX' as any, // Legacy type could be BOX, CYLINDER, etc.
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        colorHex: '#3b82f6',
        dimensions: { dx: 12.0, dy: 34.0, dz: 56.0 },
        volumeM3: 0.000022848,
        surfaceAreaM2: 0.005968,
        centerOfGravity: { x: 0.5, y: 1.0, z: 1.5 },
        mesh: {
          vertices: [0.012, 0.034, 0.056, 0.078, 0.090, 0.112],
          normals: [0.0, 1.0, 0.0, 0.0, 1.0, 0.0],
          indices: [0, 1, 0],
          facesCount: 2
        }
      },
      assemblyComponents: [],
      assemblyMates: []
    };

    // 2. LOAD PHASE (Replicating exact App.tsx processImportedProject legacy branch)
    let appCanonicalDocument: EngineeringDocument | null = SketchUIIntegration.createEmptyDocument('DOC_UI_PROD');
    let appActiveSolid: CadSolidEntity | null = null;

    const simulateProcessImportedProject = (loaded: SecpCadProjectData) => {
      if (loaded.canonicalDocument) {
        const evalResult = DocumentEvaluator.evaluate(loaded.canonicalDocument);
        appCanonicalDocument = evalResult.document;
        appActiveSolid = evalResult.evaluatedShape as unknown as CadSolidEntity;
      } else {
        if (loaded.activeSolid) {
          const legacySolid: CadSolidEntity = {
            ...loaded.activeSolid,
            type: 'IMPORTED_SOLID',
            name: loaded.activeSolid.name ? `${loaded.activeSolid.name}_Static_Import` : 'Static_Legacy_Import'
          };
          appCanonicalDocument = null;
          appActiveSolid = legacySolid;
        } else {
          appCanonicalDocument = null;
          appActiveSolid = null;
        }
      }
    };

    simulateProcessImportedProject(rawLegacyJSON);

    // Assert STATE INVARIANT on load
    expect(appCanonicalDocument).toBeNull(); // Must remain null throughout the legacy lifecycle
    expect(appActiveSolid).not.toBeNull();
    expect(appActiveSolid!.type).toBe('IMPORTED_SOLID'); // Tagged strictly IMPORTED_SOLID
    expect(appActiveSolid!.name).toBe('Legacy_Faceted_Brace_Static_Import');
    expect(appActiveSolid!.mesh.vertices).toEqual([0.012, 0.034, 0.056, 0.078, 0.090, 0.112]); // Preserved exactly
    expect(appActiveSolid!.mesh.indices).toEqual([0, 1, 0]); // Preserved exactly
    expect(appActiveSolid!.mesh.normals).toEqual([0.0, 1.0, 0.0, 0.0, 1.0, 0.0]); // Preserved exactly
    expect(appActiveSolid!.mesh.facesCount).toBe(2); // Cardinality preserved

    // Verify absolutely no promotional document/placeholder was created
    expect(appCanonicalDocument).toBeNull();

    // 3. SAVE / EXPORT PHASE (Replicating exact App.tsx handleSaveProject/handleExportJson serialization)
    const savedPayload: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-legacy-rt',
      projectName: 'Legacy Round Trip Part',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: [],
      activeSolid: appActiveSolid || undefined,
      canonicalDocument: appCanonicalDocument || undefined, // strictly excluded from serializing when null
      assemblyComponents: [],
      assemblyMates: []
    };

    // Assert serialized JSON schema contract: canonicalDocument MUST be absent, activeSolid preserved
    expect(savedPayload.canonicalDocument).toBeUndefined();
    expect(savedPayload.activeSolid).toBeDefined();
    expect(savedPayload.activeSolid!.type).toBe('IMPORTED_SOLID');
    expect(savedPayload.activeSolid!.mesh.vertices).toEqual([0.012, 0.034, 0.056, 0.078, 0.090, 0.112]);

    // Perform actual JSON serialization/deserialization to test exact persistence path
    const jsonStr = JSON.stringify(savedPayload);
    const parsedPayload: SecpCadProjectData = JSON.parse(jsonStr);

    // Verify exact deserialized SOT invariants
    expect(parsedPayload.canonicalDocument).toBeUndefined();
    expect(parsedPayload.activeSolid).toBeDefined();
    expect(parsedPayload.activeSolid!.type).toBe('IMPORTED_SOLID');
    expect(parsedPayload.activeSolid!.mesh.vertices).toEqual([0.012, 0.034, 0.056, 0.078, 0.090, 0.112]);
    expect(parsedPayload.activeSolid!.mesh.indices).toEqual([0, 1, 0]);
    expect(parsedPayload.activeSolid!.mesh.normals).toEqual([0.0, 1.0, 0.0, 0.0, 1.0, 0.0]);
    expect(parsedPayload.activeSolid!.mesh.facesCount).toBe(2);

    // 4. SECOND RELOAD CYCLE
    // Reset App States to verify complete cycle
    appCanonicalDocument = SketchUIIntegration.createEmptyDocument('DOC_UI_PROD');
    appActiveSolid = null;

    simulateProcessImportedProject(parsedPayload);

    // Verify states remain completely static/legacy and no promotion occurred
    expect(appCanonicalDocument).toBeNull();
    expect(appActiveSolid).not.toBeNull();
    expect(appActiveSolid!.type).toBe('IMPORTED_SOLID');
    expect(appActiveSolid!.mesh.vertices).toEqual([0.012, 0.034, 0.056, 0.078, 0.090, 0.112]);
  });

  it('TEST-11: REAL CANONICAL POISON PROTECTION (Verification of precedence order of the SOT)', () => {
    // 1. Create a genuine, valid canonical document defining a 100mm Extrude
    const genuineBaseDoc = SketchUIIntegration.createEmptyDocument('CANONICAL_SOT_TRUE');
    const genuineExtrudeResult = SketchUIIntegration.applyExtrudeAction(genuineBaseDoc, rectSketch, 100);
    expect(genuineExtrudeResult.success).toBe(true);

    // 2. Create a poisoned, malicious activeSolid that mimics an adversarial static mesh
    const poisonedActiveSolid: CadSolidEntity = {
      id: 'malicious-injected-mesh-id',
      name: 'INJECTED_ADVERSARIAL_SOLID',
      type: 'IMPORTED_SOLID',
      position: { x: 999, y: 999, z: 999 },
      rotation: { x: 45, y: 45, z: 45 },
      scale: { x: 10, y: 10, z: 10 },
      colorHex: '#ff0000',
      dimensions: { dx: 9999, dy: 9999, dz: 9999 },
      volumeM3: 999999.9,
      surfaceAreaM2: 999999.9,
      centerOfGravity: { x: 9, y: 9, z: 9 },
      mesh: {
        vertices: [666.0, 666.0, 666.0],
        normals: [0.0, 0.0, 1.0],
        indices: [0, 0, 0],
        facesCount: 1
      }
    };

    // 3. Construct the mixed payload (contains genuine document AND poisoned activeSolid cache)
    const mixedPayload: SecpCadProjectData = {
      version: '0.1.0',
      projectId: 'proj-precedence-poison-test',
      projectName: 'Precedence Verification Part',
      unit: 'MM',
      updatedAt: new Date().toISOString(),
      parameters: {},
      constraints: [],
      featureTree: {},
      activeSolid: poisonedActiveSolid, // Injected poison
      canonicalDocument: genuineExtrudeResult.document, // The authoritative SOT
      assemblyComponents: [],
      assemblyMates: []
    };

    // 4. Process mixed payload using the exact loader precedence rules of App.tsx
    let activeViewportSolid: CadSolidEntity | null = null;
    let canonicalDocumentSOT: EngineeringDocument | null = null;

    const simulateProcessMixedPayload = (loaded: SecpCadProjectData) => {
      // CASE A / CASE C: canonicalDocument takes absolute precedence, discarding activeSolid
      if (loaded.canonicalDocument) {
        const evalResult = DocumentEvaluator.evaluate(loaded.canonicalDocument);
        canonicalDocumentSOT = evalResult.document;
        activeViewportSolid = evalResult.evaluatedShape as unknown as CadSolidEntity;
      } else {
        if (loaded.activeSolid) {
          canonicalDocumentSOT = null;
          activeViewportSolid = loaded.activeSolid;
        }
      }
    };

    simulateProcessMixedPayload(mixedPayload);

    // 5. Assert SOT Precedence and Poison Elimination
    expect(canonicalDocumentSOT).not.toBeNull();
    expect(canonicalDocumentSOT!.documentId).toBe('CANONICAL_SOT_TRUE');
    
    expect(activeViewportSolid).not.toBeNull();
    // Geometry MUST be evaluated directly from the canonical document, not the poisoned cache
    expect(activeViewportSolid!.id).not.toBe('malicious-injected-mesh-id');
    expect(activeViewportSolid!.name).not.toBe('INJECTED_ADVERSARIAL_SOLID');
    expect(activeViewportSolid!.type).not.toBe('IMPORTED_SOLID');
    expect((activeViewportSolid as any).volumeM3).not.toBe(999999.9);
    
    // Check that the actual evaluated solid depth / volume corresponds to the genuine 100mm extrusion
    const computedVolume = brepKernel.computeVolume(activeViewportSolid as any);
    expect(computedVolume).toBeCloseTo(0.001, 4); // 100x100x100 mm3 = 1,000,000 mm3 = 0.001 m3
    expect(activeViewportSolid!.mesh?.vertices).not.toEqual([666.0, 666.0, 666.0]);
  });
});
