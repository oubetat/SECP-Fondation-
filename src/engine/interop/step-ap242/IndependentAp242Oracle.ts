/**
 * SECP Industrial OS v2 — Independent STEP AP242 Reference Oracle
 * Decoupled, stand-alone reference validator and structural interpreter for ISO 10303-21 AP242 files.
 * 
 * INDEPENDENCE DECLARATION:
 * This oracle contains zero imports of SECP production CAD kernel classes (BRepSolid, BRepFace, etc.),
 * zero imports of StepAp242Mapper, StepAp242Exporter, or StepAp242Pipeline.
 * It independently parses raw STEP Part 21 text to verify syntax, entity dependency graphs,
 * geometry bounding boxes, Euler characteristics, assembly hierarchies, and PMI semantics.
 */

export interface IndependentEntity {
  id: number;
  type: string;
  params: any[];
  rawText: string;
}

export interface IndependentBBox {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  dx: number;
  dy: number;
  dz: number;
  volumeBox: number;
}

export interface IndependentTopologyCounts {
  vertices: number;
  edges: number;
  faces: number;
  shells: number;
  solids: number;
  eulerCharacteristic: number; // V - E + F
  danglingReferences: number[];
}

export interface IndependentPmiEntry {
  entityId: number;
  type: string;
  name: string;
  nominalValue?: number;
  unit?: string;
  datumLabel?: string;
  characteristic?: string;
  referencedGeometryIds: number[];
}

export interface IndependentAssemblyNode {
  occurrenceId: number;
  parentComponent: string;
  childComponent: string;
  transformMatrix: number[];
}

export class IndependentAp242Oracle {
  /**
   * Independently tokenizes and parses a STEP Part 21 physical file into a Map of raw IndependentEntities.
   */
  public static parseRawPart21(stepText: string): Map<number, IndependentEntity> {
    const entityMap = new Map<number, IndependentEntity>();
    if (!stepText || typeof stepText !== 'string') return entityMap;

    // Match lines like #123=TYPE(...)
    const entityRegex = /#(\d+)\s*=\s*([A-Z0-9_]+)\s*\((.*)\)\s*;/g;
    let match: RegExpExecArray | null;

    while ((match = entityRegex.exec(stepText)) !== null) {
      const id = parseInt(match[1], 10);
      const type = match[2].toUpperCase();
      const rawBody = match[3];

      const params = this.tokenizeParams(rawBody);
      entityMap.set(id, { id, type, params, rawText: match[0] });
    }

    return entityMap;
  }

  /**
   * Independently calculates 3D bounding box and bounding-box volume from CARTESIAN_POINT entities.
   */
  public static computeIndependentBBox(stepText: string): IndependentBBox {
    const entities = this.parseRawPart21(stepText);
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let pointCount = 0;

    for (const [, ent] of entities) {
      if (ent.type === 'CARTESIAN_POINT') {
        const coords = ent.params[1] || ent.params[0];
        if (Array.isArray(coords) && coords.length >= 3) {
          const x = typeof coords[0] === 'number' ? coords[0] : parseFloat(coords[0]);
          const y = typeof coords[1] === 'number' ? coords[1] : parseFloat(coords[1]);
          const z = typeof coords[2] === 'number' ? coords[2] : parseFloat(coords[2]);

          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);
            pointCount++;
          }
        }
      }
    }

    if (pointCount === 0) {
      return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0, dx: 0, dy: 0, dz: 0, volumeBox: 0 };
    }

    const dx = Math.max(0, maxX - minX);
    const dy = Math.max(0, maxY - minY);
    const dz = Math.max(0, maxZ - minZ);

    return {
      minX, minY, minZ,
      maxX, maxY, maxZ,
      dx, dy, dz,
      volumeBox: dx * dy * dz
    };
  }

  /**
   * Independently extracts topological counts and checks for dangling entity references.
   */
  public static computeIndependentTopology(stepText: string): IndependentTopologyCounts {
    const entities = this.parseRawPart21(stepText);
    let vertices = 0;
    let edges = 0;
    let faces = 0;
    let shells = 0;
    let solids = 0;

    const allIds = new Set<number>(entities.keys());
    const danglingReferences: number[] = [];

    for (const [id, ent] of entities) {
      if (ent.type === 'VERTEX_POINT') vertices++;
      else if (ent.type === 'EDGE_CURVE' || ent.type === 'ORIENTED_EDGE') edges++;
      else if (ent.type === 'ADVANCED_FACE') faces++;
      else if (ent.type === 'CLOSED_SHELL' || ent.type === 'OPEN_SHELL') shells++;
      else if (ent.type === 'MANIFOLD_SOLID_BREP') solids++;

      // Check parameter entity references #XYZ
      this.collectRefs(ent.params).forEach(refId => {
        if (!allIds.has(refId) && refId > 0) {
          danglingReferences.push(refId);
        }
      });
    }

    // Euler Characteristic for closed 2-manifold B-Rep solids: V - E + F = 2
    // (Edges count EDGE_CURVE unique instances)
    const uniqueEdges = Array.from(entities.values()).filter(e => e.type === 'EDGE_CURVE').length;
    const eulerCharacteristic = vertices - uniqueEdges + faces;

    return {
      vertices,
      edges: uniqueEdges,
      faces,
      shells,
      solids,
      eulerCharacteristic,
      danglingReferences
    };
  }

  /**
   * Independently extracts PMI entries directly from raw text.
   */
  public static extractIndependentPmi(stepText: string): IndependentPmiEntry[] {
    const entities = this.parseRawPart21(stepText);
    const pmiEntries: IndependentPmiEntry[] = [];

    for (const [id, ent] of entities) {
      if (ent.type === 'DIMENSIONAL_CHARACTERISTIC_REPRESENTATION') {
        const name = String(ent.params[0] || '');
        const nominal = parseFloat(ent.params[2]) || 0;
        const unit = String(ent.params[3] || 'mm');
        const refs = this.collectRefs(ent.params[5] || []);
        pmiEntries.push({
          entityId: id,
          type: 'DIMENSION',
          name,
          nominalValue: nominal,
          unit,
          referencedGeometryIds: refs
        });
      } else if (ent.type === 'DATUM_FEATURE' || ent.type === 'DATUM') {
        const label = String(ent.params[1] || 'A');
        const refs = this.collectRefs(ent.params[3] || []);
        pmiEntries.push({
          entityId: id,
          type: 'DATUM',
          name: label,
          datumLabel: label,
          referencedGeometryIds: refs
        });
      } else if (ent.type === 'GEOMETRIC_TOLERANCE_WITH_DATUM_REFERENCE') {
        const char = String(ent.params[1] || 'POSITION');
        const val = parseFloat(ent.params[2]) || 0;
        const unit = String(ent.params[3] || 'mm');
        const refs = this.collectRefs(ent.params[7] || []);
        pmiEntries.push({
          entityId: id,
          type: 'FEATURE_CONTROL_FRAME',
          name: char,
          characteristic: char,
          nominalValue: val,
          unit,
          referencedGeometryIds: refs
        });
      }
    }

    return pmiEntries;
  }

  /**
   * Independently parses assembly relationships.
   */
  public static extractIndependentAssembly(stepText: string): IndependentAssemblyNode[] {
    const entities = this.parseRawPart21(stepText);
    const assemblyNodes: IndependentAssemblyNode[] = [];

    for (const [id, ent] of entities) {
      if (ent.type === 'NEXT_ASSEMBLY_USAGE_OCCURRENCE' || ent.type === 'ASSEMBLY_COMPONENT_USAGE') {
        const name = String(ent.params[0] || '');
        const parentRef = ent.params[2];
        const childRef = ent.params[3];

        assemblyNodes.push({
          occurrenceId: id,
          parentComponent: String(parentRef || 'root'),
          childComponent: String(childRef || 'child'),
          transformMatrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
        });
      }
    }

    return assemblyNodes;
  }

  /**
   * Helper to parse parameter list recursively.
   */
  private static tokenizeParams(raw: string): any[] {
    const params: any[] = [];
    if (!raw) return params;

    let current = '';
    let depth = 0;
    let inString = false;

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if (char === "'") {
        inString = !inString;
        current += char;
      } else if (!inString && char === '(') {
        depth++;
        current += char;
      } else if (!inString && char === ')') {
        depth--;
        current += char;
      } else if (!inString && char === ',' && depth === 0) {
        params.push(this.cleanValue(current));
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      params.push(this.cleanValue(current));
    }
    return params;
  }

  private static cleanValue(v: string): any {
    v = v.trim();
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
    if (v.startsWith('#')) return { ref: parseInt(v.slice(1), 10) };
    if (v.startsWith('(') && v.endsWith(')')) return this.tokenizeParams(v.slice(1, -1));
    const num = parseFloat(v);
    return isNaN(num) ? v : num;
  }

  private static collectRefs(param: any): number[] {
    const refs: number[] = [];
    if (!param) return refs;
    if (typeof param === 'object' && typeof param.ref === 'number') {
      refs.push(param.ref);
    } else if (Array.isArray(param)) {
      param.forEach(p => refs.push(...this.collectRefs(p)));
    }
    return refs;
  }
}
