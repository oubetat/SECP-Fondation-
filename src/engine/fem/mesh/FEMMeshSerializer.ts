import { FEMMesh } from './FEMMesh';

export class FEMMeshSerializer {
  /**
   * Serialize a FEMMesh object into a stable, human-readable JSON string.
   */
  public static exportToJSON(mesh: FEMMesh): string {
    return JSON.stringify(
      {
        id: mesh.id,
        nodes: mesh.nodes,
        elements: mesh.elements,
        boundaries: mesh.boundaries,
        regions: mesh.regions,
        meshHash: mesh.meshHash,
        topologyHash: mesh.topologyHash,
        geometryHash: mesh.geometryHash,
        qualityHash: mesh.qualityHash,
        diagnostics: mesh.diagnostics,
        timestamp: mesh.timestamp,
      },
      null,
      2
    );
  }

  /**
   * Deserialize a JSON string back into a FEMMesh object.
   */
  public static importFromJSON(jsonStr: string): FEMMesh {
    const data = JSON.parse(jsonStr);

    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw new Error('SERIALIZATION_ERROR_MISSING_NODES');
    }
    if (!data.elements || !Array.isArray(data.elements)) {
      throw new Error('SERIALIZATION_ERROR_MISSING_ELEMENTS');
    }

    return {
      id: data.id || `mesh_${Math.random().toString(36).substring(2, 9)}`,
      nodes: data.nodes,
      elements: data.elements,
      boundaries: data.boundaries || [],
      regions: data.regions || [],
      meshHash: data.meshHash,
      topologyHash: data.topologyHash,
      geometryHash: data.geometryHash,
      qualityHash: data.qualityHash,
      diagnostics: data.diagnostics,
      timestamp: data.timestamp || Date.now(),
    };
  }
}
