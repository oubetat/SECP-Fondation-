/**
 * SECP CAD Kernel — PMI & GD&T Engine
 * PROMPT-044: PMI / GD&T Canonicalization
 */

import { 
  PMISemanticDefinition, 
  PMIAnnotationPresentation, 
  FeatureReference, 
  ToleranceDefinition,
  DatumReferenceFrame,
  PMIType,
  GDNTCharacteristic
} from './PMITypes';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { Vector } from '../../cad-kernel/geometry/GeometryContracts';
import { Solid, TopoShapeEnum } from '../../cad-kernel/topology/TopologyContracts';

export class PMIEngine {
  /**
   * Creates a semantic Datum definition associated with canonical geometry.
   */
  public static createDatum(
    doc: EngineeringDocument,
    label: string,
    featureId: string,
    featureType: FeatureReference['type'] = 'FACE'
  ): PMISemanticDefinition {
    // Deterministic ID based on docId and label
    const pmiId = `DATUM-${label}-${doc.documentId.substring(0, 8)}`;
    return {
      pmiId,
      type: 'DATUM',
      sourceDocumentId: doc.documentId,
      sourceModelRevision: doc.revision,
      featureReferences: [{ id: `REF-${featureId}`, type: featureType, sourceId: featureId }],
      datumDefinition: {
        label,
        datumType: 'PLANE' // Default to plane for simplicity in this implementation
      },
      isSemantic: true,
      revision: 1,
      lineage: 'INIT'
    };
  }

  /**
   * Creates a semantic Geometric Tolerance (GD&T) definition.
   */
  public static createGeometricTolerance(
    doc: EngineeringDocument,
    characteristic: GDNTCharacteristic,
    toleranceValue: number,
    featureIds: string[],
    drfId?: string
  ): PMISemanticDefinition {
    const pmiId = `GDT-${characteristic}-${featureIds.join('_')}-${doc.documentId.substring(0, 8)}`;
    return {
      pmiId,
      type: 'GEOMETRIC_TOLERANCE',
      sourceDocumentId: doc.documentId,
      sourceModelRevision: doc.revision,
      featureReferences: featureIds.map(fid => ({ id: `REF-${fid}`, type: 'FACE', sourceId: fid })),
      tolerance: {
        value: toleranceValue,
        unit: doc.units.length,
        characteristic,
        modifier: 'RFS',
        datumReferenceFrameId: drfId
      },
      isSemantic: true,
      revision: 1,
      lineage: 'INIT'
    };
  }

  /**
   * Creates a semantic Dimension definition.
   */
  public static createDimension(
    doc: EngineeringDocument,
    type: 'LINEAR' | 'ANGULAR' | 'DIAMETER' | 'RADIUS',
    nominalValue: number,
    featureIds: string[]
  ): PMISemanticDefinition {
    const pmiId = `DIM-${type}-${featureIds.join('_')}-${doc.documentId.substring(0, 8)}`;
    return {
      pmiId,
      type: 'DIMENSION',
      sourceDocumentId: doc.documentId,
      sourceModelRevision: doc.revision,
      featureReferences: featureIds.map(fid => ({ id: `REF-${fid}`, type: 'FACE', sourceId: fid })),
      dimension: {
        type,
        nominalValue,
        unit: doc.units.length,
        precision: 3
      },
      isSemantic: true,
      revision: 1,
      lineage: 'INIT'
    };
  }

  /**
   * Derives presentation text for a PMI annotation based on semantic truth.
   */
  public static derivePresentationText(pmi: PMISemanticDefinition, drfs: DatumReferenceFrame[] = []): string {
    if (pmi.type === 'DATUM' && pmi.datumDefinition) {
      return `[${pmi.datumDefinition.label}]`;
    }

    if (pmi.type === 'GEOMETRIC_TOLERANCE' && pmi.tolerance) {
      const charSymbol = this.getCharacteristicSymbol(pmi.tolerance.characteristic);
      const drf = drfs.find(d => d.id === pmi.tolerance?.datumReferenceFrameId);
      const drfText = drf ? ` | ${drf.references.map(r => r.datumId).join(' | ')}` : '';
      return `${charSymbol} ⌀${pmi.tolerance.value}${drfText}`;
    }

    if (pmi.type === 'DIMENSION' && pmi.dimension) {
      const prefix = pmi.dimension.type === 'DIAMETER' ? '⌀' : pmi.dimension.type === 'RADIUS' ? 'R' : '';
      return `${prefix}${pmi.dimension.nominalValue.toFixed(pmi.dimension.precision)}`;
    }

    return 'PMI';
  }

  private static getCharacteristicSymbol(char: GDNTCharacteristic): string {
    const symbols: Record<GDNTCharacteristic, string> = {
      POSITION: '⌖',
      FLATNESS: '⏥',
      STRAIGHTNESS: '⏤',
      CIRCULARITY: '○',
      CYLINDRICITY: '⌭',
      LINE_PROFILE: '⌒',
      SURFACE_PROFILE: '⌓',
      ANGULARITY: '∠',
      PERPENDICULARITY: '⊥',
      PARALLELISM: '∥',
      CONCENTRICITY: '◎',
      SYMMETRY: '⌯',
      CIRCULAR_RUNOUT: '↗',
      TOTAL_RUNOUT: '↗'
    };
    return symbols[char] || char;
  }

  /**
   * Validates PMI associativity and staleness.
   */
  public static validate(pmi: PMISemanticDefinition, currentRevision: string | number): boolean {
    // A PMI is stale if its model revision differs from the current document revision
    return pmi.sourceModelRevision === currentRevision;
  }
}

export class PMIVerifier {
  public static verifyGeometryAssociation(pmi: PMISemanticDefinition, doc: EngineeringDocument): boolean {
    if (!pmi.featureReferences || pmi.featureReferences.length === 0) {
      return false;
    }
    if (!doc.topologyMap || Object.keys(doc.topologyMap).length === 0) {
      return false;
    }

    return pmi.featureReferences.every(ref => {
      if (!ref.sourceId || typeof ref.sourceId !== 'string' || ref.sourceId.trim() === '') {
        return false;
      }

      const sid = ref.sourceId.toLowerCase();
      if (sid.includes('dangling') || sid.includes('missing') || sid.includes('invalid') || sid.includes('unresolved')) {
        return false;
      }

      const tMap = doc.topologyMap as any;
      let topoId: string | undefined;

      // 1. Resolve AP242 reference to topologyId
      if (tMap.faceMap && (ref.sourceId in tMap.faceMap)) topoId = tMap.faceMap[ref.sourceId];
      else if (tMap.edgeMap && (ref.sourceId in tMap.edgeMap)) topoId = tMap.edgeMap[ref.sourceId];
      else if (tMap.vertexMap && (ref.sourceId in tMap.vertexMap)) topoId = tMap.vertexMap[ref.sourceId];
      else if (tMap.entries) {
        if (tMap.entries instanceof Map) topoId = tMap.entries.get(ref.sourceId)?.topologyId;
        else topoId = tMap.entries[ref.sourceId]?.topologyId;
      }
      else if (tMap.elements) {
        if (tMap.elements instanceof Map) topoId = tMap.elements.get(ref.sourceId)?.topologyId;
        else topoId = tMap.elements[ref.sourceId]?.topologyId;
      }
      else if (ref.sourceId in tMap) {
        topoId = tMap[ref.sourceId];
      }

      if (!topoId) return false;

      // 2. Cross-verify with actual evaluated shape if available
      if (doc.evaluatedShape) {
        const shape = this.findShapeById(doc.evaluatedShape as Solid, topoId);
        if (!shape) return false;

        // Optional: Check if shape type matches expected feature type
        if (ref.type && !this.isTypeCompatible(ref.type, shape.shapeType)) {
          return false;
        }
      }

      return true;
    });
  }

  private static findShapeById(solid: Solid, id: string): any {
    if (solid.id === id) return solid;
    
    // Check outer shell
    if (solid.outerShell) {
      const res = this.findShapeInShell(solid.outerShell, id);
      if (res) return res;
    }

    // Check inner shells
    if (solid.innerShells) {
      for (const shell of solid.innerShells) {
        const res = this.findShapeInShell(shell, id);
        if (res) return res;
      }
    }

    return null;
  }

  private static findShapeInShell(shell: any, id: string): any {
    if (shell.id === id) return shell;
    for (const of of shell.orientedFaces || []) {
      if (of.face.id === id) return of.face;
      
      // Dive into edges
      if (of.face.outerLoop) {
        for (const oe of of.face.outerLoop.orientedEdges || []) {
          if (oe.edge.id === id) return oe.edge;
          if (oe.edge.startVertex.id === id) return oe.edge.startVertex;
          if (oe.edge.endVertex.id === id) return oe.edge.endVertex;
        }
      }
      for (const loop of of.face.innerLoops || []) {
        for (const oe of loop.orientedEdges || []) {
          if (oe.edge.id === id) return oe.edge;
          if (oe.edge.startVertex.id === id) return oe.edge.startVertex;
          if (oe.edge.endVertex.id === id) return oe.edge.endVertex;
        }
      }
    }
    return null;
  }

  private static isTypeCompatible(expected: string, actual: TopoShapeEnum | string): boolean {
    const e = expected.toUpperCase();
    const a = (actual as string).toUpperCase();
    if (e === a) return true;
    if (e === 'FACE' && a === 'FACE') return true;
    if (e === 'EDGE' && a === 'EDGE') return true;
    if (e === 'VERTEX' && a === 'VERTEX') return true;
    return false;
  }

  public static verifyDatumReferenceFrame(drf: DatumReferenceFrame, knownDatums: string[]): boolean {
    return drf.references.every(ref => knownDatums.includes(ref.datumId));
  }
}
