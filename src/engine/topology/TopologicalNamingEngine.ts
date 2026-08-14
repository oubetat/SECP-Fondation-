import {
  PersistentTopologyIdentity,
  TopologicalEntityType,
  GeometricSignature,
  TopologyFingerprint
} from './PersistentTopologyTypes';
import { ShapeHandle } from '../geometry/ShapeHandle';

export class TopologicalNamingEngine {
  private persistentMap: Map<string, PersistentTopologyIdentity> = new Map();
  private revision: number = 1;

  /**
   * Generate persistent identities for a feature's resulting shape.
   */
  public extractAndRegisterTopology(
    featureId: string,
    featureType: string,
    shape: ShapeHandle,
    parameters: Record<string, any> = {}
  ): PersistentTopologyIdentity[] {
    const identities: PersistentTopologyIdentity[] = [];
    const w = parameters.width || 50;
    const h = parameters.height || 50;
    const d = parameters.depth || 10;
    const isPocket = parameters.isPocket || featureType === 'POCKET';
    const isCylinder = featureType === 'CYLINDER' || parameters.isCylinder;

    // 1. Extract Faces
    if (isCylinder) {
      // Cylinder faces
      const cylWallSig: GeometricSignature = {
        centroid: { x: 0, y: 0, z: d / 2 },
        normalOrDirection: { x: 1, y: 0, z: 0 },
        measure: Math.PI * (parameters.radius || 10) * 2 * d,
        shapeHash: `cyl-wall-${featureId}`
      };
      identities.push(this.createIdentity(featureId, 'FACE', 0, 'CylindricalWall', cylWallSig));

      const topCapSig: GeometricSignature = {
        centroid: { x: 0, y: 0, z: d },
        normalOrDirection: { x: 0, y: 0, z: 1 },
        measure: Math.PI * Math.pow(parameters.radius || 10, 2),
        shapeHash: `cyl-top-${featureId}`
      };
      identities.push(this.createIdentity(featureId, 'FACE', 1, 'TopCap', topCapSig));

      const botCapSig: GeometricSignature = {
        centroid: { x: 0, y: 0, z: 0 },
        normalOrDirection: { x: 0, y: 0, z: -1 },
        measure: Math.PI * Math.pow(parameters.radius || 10, 2),
        shapeHash: `cyl-bot-${featureId}`
      };
      identities.push(this.createIdentity(featureId, 'FACE', 2, 'BottomCap', botCapSig));
    } else {
      // Box / Extrusion faces
      const faceDefs = [
        { name: 'TopFace', normal: { x: 0, y: 0, z: 1 }, centroid: { x: w / 2, y: h / 2, z: d }, measure: w * h },
        { name: 'BottomFace', normal: { x: 0, y: 0, z: -1 }, centroid: { x: w / 2, y: h / 2, z: 0 }, measure: w * h },
        { name: 'LeftFace', normal: { x: -1, y: 0, z: 0 }, centroid: { x: 0, y: h / 2, z: d / 2 }, measure: h * d },
        { name: 'RightFace', normal: { x: 1, y: 0, z: 0 }, centroid: { x: w, y: h / 2, z: d / 2 }, measure: h * d },
        { name: 'FrontFace', normal: { x: 0, y: -1, z: 0 }, centroid: { x: w / 2, y: 0, z: d / 2 }, measure: w * d },
        { name: 'BackFace', normal: { x: 0, y: 1, z: 0 }, centroid: { x: w / 2, y: h, z: d / 2 }, measure: w * d }
      ];

      faceDefs.forEach((fd, idx) => {
        const sig: GeometricSignature = {
          centroid: fd.centroid,
          normalOrDirection: fd.normal,
          measure: fd.measure,
          shapeHash: `${fd.name.toLowerCase()}-${featureId}`
        };
        identities.push(this.createIdentity(featureId, 'FACE', idx, fd.name, sig));
      });
    }

    // 2. Extract Edges (Top / Bottom / Vertical edges)
    const edgeCount = isCylinder ? 2 : 12;
    for (let e = 0; e < edgeCount; e++) {
      const eName = isCylinder ? `CircEdge[${e}]` : `BoxEdge[${e}]`;
      const sig: GeometricSignature = {
        centroid: { x: w / 2, y: h / 2, z: (e % 2) * d },
        measure: isCylinder ? 2 * Math.PI * (parameters.radius || 10) : (e < 4 ? w : e < 8 ? h : d),
        shapeHash: `edge-${e}-${featureId}`
      };
      identities.push(this.createIdentity(featureId, 'EDGE', e, eName, sig));
    }

    // 3. Extract Vertices
    const vertexCount = isCylinder ? 0 : 8;
    for (let v = 0; v < vertexCount; v++) {
      const vSig: GeometricSignature = {
        centroid: {
          x: (v & 1) ? w : 0,
          y: (v & 2) ? h : 0,
          z: (v & 4) ? d : 0
        },
        measure: 0,
        shapeHash: `vert-${v}-${featureId}`
      };
      identities.push(this.createIdentity(featureId, 'VERTEX', v, `Vertex[${v}]`, vSig));
    }

    // Register into persistent map
    identities.forEach(id => this.persistentMap.set(id.persistentId, id));
    this.revision++;

    return identities;
  }

  /**
   * Preserve identities across a Boolean operation (Cut, Fuse, Common).
   */
  public applyBooleanOperationTopology(
    targetFeatureId: string,
    toolFeatureId: string,
    operation: 'CUT' | 'FUSE' | 'COMMON',
    targetIdentities: PersistentTopologyIdentity[],
    toolIdentities: PersistentTopologyIdentity[]
  ): PersistentTopologyIdentity[] {
    const resultingIdentities: PersistentTopologyIdentity[] = [];

    if (operation === 'CUT') {
      // Retain target identities (modified/split), add internal cut faces from tool
      targetIdentities.forEach(id => {
        resultingIdentities.push({
          ...id,
          revision: id.revision + 1
        });
      });

      // Add tool cut wall faces with parent linkage
      toolIdentities.filter(i => i.semanticTag.includes('Wall') || i.semanticTag.includes('Cylindrical')).forEach(toolId => {
        const cutIdentity = this.createIdentity(
          targetFeatureId,
          toolId.entityType,
          toolId.localIndex,
          `BooleanCutWall_${toolId.semanticTag}`,
          toolId.geometricSignature,
          [toolId.persistentId]
        );
        resultingIdentities.push(cutIdentity);
      });
    } else if (operation === 'FUSE') {
      // Combine identities
      targetIdentities.forEach(id => resultingIdentities.push({ ...id, revision: id.revision + 1 }));
      toolIdentities.forEach(id => {
        const fusedId = this.createIdentity(
          targetFeatureId,
          id.entityType,
          id.localIndex,
          `Fused_${id.semanticTag}`,
          id.geometricSignature,
          [id.persistentId]
        );
        resultingIdentities.push(fusedId);
      });
    } else { // COMMON
      targetIdentities.forEach(id => {
        resultingIdentities.push({ ...id, semanticTag: `Common_${id.semanticTag}`, revision: id.revision + 1 });
      });
    }

    resultingIdentities.forEach(id => this.persistentMap.set(id.persistentId, id));
    this.revision++;
    return resultingIdentities;
  }

  /**
   * Preserve topology across Fillet or Chamfer operation.
   */
  public applyFilletOrChamferTopology(
    featureId: string,
    opType: 'FILLET' | 'CHAMFER',
    targetEdgeIds: string[],
    existingIdentities: PersistentTopologyIdentity[]
  ): PersistentTopologyIdentity[] {
    const resultingIdentities: PersistentTopologyIdentity[] = [...existingIdentities];

    targetEdgeIds.forEach((edgePersistentId, idx) => {
      const parentEdge = this.persistentMap.get(edgePersistentId);
      const parentIds = parentEdge ? [parentEdge.persistentId] : [];

      const sig: GeometricSignature = parentEdge ? parentEdge.geometricSignature : {
        centroid: { x: 0, y: 0, z: 0 },
        measure: 5.0,
        shapeHash: `${opType.toLowerCase()}-face-${idx}`
      };

      const opFace = this.createIdentity(
        featureId,
        'FACE',
        idx,
        `${opType === 'FILLET' ? 'FilletFace' : 'ChamferFace'}[${idx}]`,
        sig,
        parentIds
      );
      resultingIdentities.push(opFace);
      this.persistentMap.set(opFace.persistentId, opFace);
    });

    this.revision++;
    return resultingIdentities;
  }

  /**
   * Compute fingerprint hash of the entire topological structure.
   */
  public computeFingerprint(identities: PersistentTopologyIdentity[]): TopologyFingerprint {
    const faces = identities.filter(i => i.entityType === 'FACE').length;
    const edges = identities.filter(i => i.entityType === 'EDGE').length;
    const vertices = identities.filter(i => i.entityType === 'VERTEX').length;

    const rawPayload = JSON.stringify({
      faces,
      edges,
      vertices,
      pIds: identities.map(i => i.persistentId).sort()
    });

    const fingerprintHash = `sha256-topo-${this.hashString(rawPayload)}`;

    return {
      shapeHash: fingerprintHash,
      faceCount: faces,
      edgeCount: edges,
      vertexCount: vertices,
      persistentIdentities: identities,
      fingerprintHash
    };
  }

  public getIdentity(persistentId: string): PersistentTopologyIdentity | undefined {
    return this.persistentMap.get(persistentId);
  }

  public getAllIdentities(): PersistentTopologyIdentity[] {
    return Array.from(this.persistentMap.values());
  }

  public getRevision(): number {
    return this.revision;
  }

  private createIdentity(
    featureId: string,
    entityType: TopologicalEntityType,
    localIndex: number,
    semanticTag: string,
    geometricSignature: GeometricSignature,
    parentPersistentIds: string[] = []
  ): PersistentTopologyIdentity {
    const persistentId = `Part/${featureId}/${semanticTag}`;
    return {
      persistentId,
      featureId,
      entityType,
      localIndex,
      semanticTag,
      geometricSignature,
      parentPersistentIds,
      revision: 1
    };
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
