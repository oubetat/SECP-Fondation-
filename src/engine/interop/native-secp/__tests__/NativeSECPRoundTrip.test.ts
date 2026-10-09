import { describe, it, expect } from 'vitest';
import { NativeSECPFixtures } from '../__fixtures__/NativeSECPFixtures';
import { NativeSECPWriter } from '../NativeSECPWriter';
import { NativeSECPReader } from '../NativeSECPReader';
import { NativeSECPRevisionEngine } from '../NativeSECPRevisionEngine';

describe('PATCH-039: Native SECP Round-Trip Engineering Preservation', () => {

  it('performs lossless Native SECP serialization and reload round-trip', () => {
    const originalDoc = NativeSECPFixtures.createValidCubeDocument();

    // 1. Write Native SECP document
    const writeResult = NativeSECPWriter.write(originalDoc);
    expect(writeResult.success).toBe(true);

    // 2. Read back from JSON string container
    const readResult = NativeSECPReader.read(writeResult.jsonString);
    expect(readResult.success).toBe(true);
    expect(readResult.document).not.toBeNull();

    const loadedDoc = readResult.document!;

    // 3. Verify exact entity equivalence
    expect(loadedDoc.identity.engineeringObjectId).toBe(originalDoc.identity.engineeringObjectId);
    expect(loadedDoc.identity.revisionId).toBe(originalDoc.identity.revisionId);
    expect(loadedDoc.integrity.canonicalHash).toBe(originalDoc.integrity.canonicalHash);

    // Geometry equivalence
    expect(loadedDoc.model.geometry.points.length).toBe(originalDoc.model.geometry.points.length);
    expect(loadedDoc.model.geometry.nurbsCurves.length).toBe(originalDoc.model.geometry.nurbsCurves.length);

    // Topology equivalence
    expect(loadedDoc.model.topology.vertices.length).toBe(originalDoc.model.topology.vertices.length);
    expect(loadedDoc.model.topology.edges.length).toBe(originalDoc.model.topology.edges.length);
    expect(loadedDoc.model.topology.faces.length).toBe(originalDoc.model.topology.faces.length);
    expect(loadedDoc.model.topology.solids.length).toBe(originalDoc.model.topology.solids.length);

    // Feature history equivalence
    expect(loadedDoc.model.features.features.length).toBe(originalDoc.model.features.features.length);
    expect(loadedDoc.model.features.executionOrder).toEqual(originalDoc.model.features.executionOrder);

    // Assembly hierarchy equivalence
    expect(loadedDoc.model.assemblies.instances.length).toBe(originalDoc.model.assemblies.instances.length);

    // Re-serialize loaded document and check identical hash
    const reWriteResult = NativeSECPWriter.write(loadedDoc);
    expect(reWriteResult.canonicalHash).toBe(originalDoc.integrity.canonicalHash);
  });

  it('creates revision with lineage tracking and parent hash preservation', () => {
    const parentDoc = NativeSECPFixtures.createValidCubeDocument();

    const revDoc = NativeSECPRevisionEngine.createRevision({
      parentDocument: parentDoc,
      newRevisionId: 'REV-B',
      author: 'Senior CAD Architect',
      changeSummary: 'Modified tolerance and manufacturing specs',
      manufacturingChanges: {
        features: parentDoc.manufacturing.features,
        toolpaths: parentDoc.manufacturing.toolpaths,
        metadata: {
          machiningAllowanceMm: 0.25,
          surfaceFinishRa: 0.8
        }
      }
    });

    expect(revDoc.identity.revisionId).toBe('REV-B');
    expect(revDoc.identity.parentRevisionId).toBe('REV-A');
    expect(revDoc.integrity.parentHash).toBe(parentDoc.integrity.canonicalHash);
    expect(revDoc.provenance.revisions.length).toBe(2);
    expect(revDoc.provenance.operations.some(op => op.operationType === 'CREATE_REVISION')).toBe(true);

    const readResult = NativeSECPReader.read(revDoc);
    expect(readResult.success).toBe(true);
    expect(readResult.integrityValid).toBe(true);
  });
});
