import { FEMNode } from './FEMNode';
import { FEMElement } from './FEMElement';

export type FEMElementQualityClass = 'VALID' | 'WARNING' | 'POOR' | 'INVALID';

export interface FEMElementQuality {
  elementId: string;
  type: string;
  classification: FEMElementQualityClass;
  metrics: Record<string, number>;
}

export interface FEMMeshQualitySummary {
  overallClassification: FEMElementQualityClass;
  averageAspectRatio: number;
  maxAspectRatio: number;
  minAreaVolume: number;
  warningCount: number;
  poorCount: number;
  invalidCount: number;
  elementQualities: Map<string, FEMElementQuality>;
}

export class FEMMeshQualityCalculator {
  /**
   * Calculate distance between two 3D points.
   */
  public static dist(n1: { x: number; y: number; z: number }, n2: { x: number; y: number; z: number }): number {
    return Math.hypot(n1.x - n2.x, n1.y - n2.y, n1.z - n2.z);
  }

  /**
   * Angle between three 3D points in degrees (angle at p1).
   */
  public static angle(p1: FEMNode, p0: FEMNode, p2: FEMNode): number {
    const v1 = { x: p0.x - p1.x, y: p0.y - p1.y, z: p0.z - p1.z };
    const v2 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const len1 = Math.hypot(v1.x, v1.y, v1.z);
    const len2 = Math.hypot(v2.x, v2.y, v2.z);
    if (len1 < 1e-12 || len2 < 1e-12) return 0;
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const cosTheta = Math.max(-1.0, Math.min(1.0, dot / (len1 * len2)));
    return (Math.acos(cosTheta) * 180) / Math.PI;
  }

  /**
   * Calculate 3D Cross Product of vectors AB and AC.
   */
  public static crossProduct(A: FEMNode, B: FEMNode, C: FEMNode): { x: number; y: number; z: number } {
    const AB = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
    const AC = { x: C.x - A.x, y: C.y - A.y, z: C.z - A.z };
    return {
      x: AB.y * AC.z - AB.z * AC.y,
      y: AB.z * AC.x - AB.x * AC.z,
      z: AB.x * AC.y - AB.y * AC.x,
    };
  }

  /**
   * Calculate dihedral angle in degrees between two triangular faces sharing an edge.
   */
  public static dihedralAngle(
    shared1: FEMNode,
    shared2: FEMNode,
    tip1: FEMNode,
    tip2: FEMNode
  ): number {
    // Normal 1
    const n1 = this.crossProduct(shared1, shared2, tip1);
    // Normal 2
    const n2 = this.crossProduct(shared2, shared1, tip2);

    const len1 = Math.hypot(n1.x, n1.y, n1.z);
    const len2 = Math.hypot(n2.x, n2.y, n2.z);
    if (len1 < 1e-12 || len2 < 1e-12) return 0;

    const dot = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
    const cosTheta = Math.max(-1.0, Math.min(1.0, dot / (len1 * len2)));
    // Dihedral angle
    return 180 - (Math.acos(cosTheta) * 180) / Math.PI;
  }

  /**
   * Calculate quality of a Triangle.
   */
  public static evaluateTriangle(n0: FEMNode, n1: FEMNode, n2: FEMNode): FEMElementQuality {
    const a = this.dist(n0, n1);
    const b = this.dist(n1, n2);
    const c = this.dist(n2, n0);
    const perimeter = a + b + c;

    // Area via cross product (to support 3D orientation)
    const cp = this.crossProduct(n0, n1, n2);
    const area = 0.5 * Math.hypot(cp.x, cp.y, cp.z);

    if (area <= 1e-14 || isNaN(area) || !isFinite(area)) {
      return {
        elementId: '',
        type: 'TRI',
        classification: 'INVALID',
        metrics: { area: 0, aspectRatio: Infinity, minAngle: 0, maxAngle: 180 },
      };
    }

    const lMax = Math.max(a, b, c);
    const lMin = Math.min(a, b, c);

    // Aspect Ratio: l_max * perimeter / (4 * sqrt(3) * Area)
    const ar = (lMax * perimeter) / (4 * Math.sqrt(3) * area);

    const ang0 = this.angle(n0, n1, n2);
    const ang1 = this.angle(n1, n2, n0);
    const ang2 = this.angle(n2, n0, n1);

    const minAngle = Math.min(ang0, ang1, ang2);
    const maxAngle = Math.max(ang0, ang1, ang2);

    let classification: FEMElementQualityClass = 'VALID';
    if (ar > 5.0 || minAngle < 15.0 || maxAngle > 150.0) {
      classification = 'POOR';
    } else if (ar > 2.5 || minAngle < 30.0 || maxAngle > 120.0) {
      classification = 'WARNING';
    }

    return {
      elementId: '',
      type: 'TRI',
      classification,
      metrics: {
        area,
        aspectRatio: ar,
        minAngle,
        maxAngle,
      },
    };
  }

  /**
   * Calculate quality of a Quadrilateral.
   */
  public static evaluateQuadrilateral(n0: FEMNode, n1: FEMNode, n2: FEMNode, n3: FEMNode): FEMElementQuality {
    // Split into triangles (0,1,2) and (0,2,3) to estimate properties
    const q1 = this.evaluateTriangle(n0, n1, n2);
    const q2 = this.evaluateTriangle(n0, n2, n3);
    const area = q1.metrics.area + q2.metrics.area;

    if (area <= 1e-14 || q1.classification === 'INVALID' || q2.classification === 'INVALID') {
      return {
        elementId: '',
        type: 'QUAD',
        classification: 'INVALID',
        metrics: { area: 0, aspectRatio: Infinity, skewness: 1, jacobianDet: 0 },
      };
    }

    const sides = [
      this.dist(n0, n1),
      this.dist(n1, n2),
      this.dist(n2, n3),
      this.dist(n3, n0),
    ];
    const lMax = Math.max(...sides);
    const lMin = Math.min(...sides);
    const ar = lMin > 1e-12 ? lMax / lMin : Infinity;

    // Skewness from angles deviation from 90 deg
    const angs = [
      this.angle(n0, n1, n3),
      this.angle(n1, n2, n0),
      this.angle(n2, n3, n1),
      this.angle(n3, n0, n2),
    ];
    const dev = angs.map(a => Math.abs(a - 90));
    const skewness = Math.max(...dev) / 90;

    // Jacobian determinant evaluation at corners
    // J = [dx/dxi dy/dxi; dx/deta dy/deta]
    // A simplified Jacobian quality index based on quadrilateral convexity:
    const d1 = { x: n2.x - n0.x, y: n2.y - n0.y, z: n2.z - n0.z };
    const d2 = { x: n3.x - n1.x, y: n3.y - n1.y, z: n3.z - n1.z };
    const cp = {
      x: d1.y * d2.z - d1.z * d2.y,
      y: d1.z * d2.x - d1.x * d2.z,
      z: d1.x * d2.y - d1.y * d2.x,
    };
    const jacobianDet = Math.hypot(cp.x, cp.y, cp.z);

    let classification: FEMElementQualityClass = 'VALID';
    if (ar > 5.0 || skewness > 0.6 || jacobianDet <= 1e-12) {
      classification = 'POOR';
    } else if (ar > 2.5 || skewness > 0.3) {
      classification = 'WARNING';
    }

    return {
      elementId: '',
      type: 'QUAD',
      classification,
      metrics: {
        area,
        aspectRatio: ar,
        skewness,
        jacobianDet,
      },
    };
  }

  /**
   * Calculate quality of a Tetrahedron.
   */
  public static evaluateTetrahedron(n0: FEMNode, n1: FEMNode, n2: FEMNode, n3: FEMNode): FEMElementQuality {
    // Volume via scalar triple product: (AB . (AC x AD)) / 6
    const AB = { x: n1.x - n0.x, y: n1.y - n0.y, z: n1.z - n0.z };
    const AC = { x: n2.x - n0.x, y: n2.y - n0.y, z: n2.z - n0.z };
    const AD = { x: n3.x - n0.x, y: n3.y - n0.y, z: n3.z - n0.z };

    const cross = {
      x: AC.y * AD.z - AC.z * AD.y,
      y: AC.z * AD.x - AC.x * AD.z,
      z: AB.x * AC.y - AB.y * AC.x, // wait, AC x AD cross product:
    };
    const crossCAD = {
      x: AC.y * AD.z - AC.z * AD.y,
      y: AC.z * AD.x - AC.x * AD.z,
      z: AC.x * AD.y - AC.y * AD.x,
    };

    const tripleProduct = AB.x * crossCAD.x + AB.y * crossCAD.y + AB.z * crossCAD.z;
    const volume = tripleProduct / 6.0;

    if (Math.abs(volume) <= 1e-15 || isNaN(volume) || !isFinite(volume)) {
      return {
        elementId: '',
        type: 'TET',
        classification: 'INVALID',
        metrics: { volume: 0, aspectRatio: Infinity, skewness: 1, minDihedralAngle: 0, jacobianQuality: 0 },
      };
    }

    const edges = [
      this.dist(n0, n1), this.dist(n0, n2), this.dist(n0, n3),
      this.dist(n1, n2), this.dist(n1, n3),
      this.dist(n2, n3),
    ];
    const lMax = Math.max(...edges);
    const lMin = Math.min(...edges);

    // Face areas
    const cp012 = this.crossProduct(n0, n1, n2);
    const a012 = 0.5 * Math.hypot(cp012.x, cp012.y, cp012.z);

    const cp013 = this.crossProduct(n0, n1, n3);
    const a013 = 0.5 * Math.hypot(cp013.x, cp013.y, cp013.z);

    const cp023 = this.crossProduct(n0, n2, n3);
    const a023 = 0.5 * Math.hypot(cp023.x, cp023.y, cp023.z);

    const cp123 = this.crossProduct(n1, n2, n3);
    const a123 = 0.5 * Math.hypot(cp123.x, cp123.y, cp123.z);

    const faceAreaSum = a012 + a013 + a023 + a123;

    // Aspect Ratio formula: l_max * sum_of_face_areas / (36 * Volume)
    // Normalized by factor for equilateral tet so it is 1.0
    const arRaw = (lMax * faceAreaSum) / (36 * Math.abs(volume));
    const ar = arRaw / (Math.sqrt(2) / 3); // Normalization factor

    // Dihedral angles
    const dihedral01 = this.dihedralAngle(n0, n1, n2, n3);
    const dihedral02 = this.dihedralAngle(n0, n2, n1, n3);
    const dihedral03 = this.dihedralAngle(n0, n3, n1, n2);
    const dihedral12 = this.dihedralAngle(n1, n2, n0, n3);
    const dihedral13 = this.dihedralAngle(n1, n3, n0, n2);
    const dihedral23 = this.dihedralAngle(n2, n3, n0, n1);

    const dihedrals = [dihedral01, dihedral02, dihedral03, dihedral12, dihedral13, dihedral23];
    const minDihedralAngle = Math.min(...dihedrals);
    const maxDihedralAngle = Math.max(...dihedrals);

    // Ideal dihedral angle of tet is ~70.53
    const idealDihedral = 70.528;
    const skewness = Math.max(
      (maxDihedralAngle - idealDihedral) / (180 - idealDihedral),
      (idealDihedral - minDihedralAngle) / idealDihedral
    );

    // Jacobian Quality is positive if volume is positive
    const jacobianQuality = volume > 0 ? 1.0 : -1.0;

    let classification: FEMElementQualityClass = 'VALID';
    if (volume < 0) {
      classification = 'INVALID';
    } else if (ar > 6.0 || minDihedralAngle < 10.0 || skewness > 0.8) {
      classification = 'POOR';
    } else if (ar > 3.0 || minDihedralAngle < 20.0 || skewness > 0.5) {
      classification = 'WARNING';
    }

    return {
      elementId: '',
      type: 'TET',
      classification,
      metrics: {
        volume,
        aspectRatio: ar,
        skewness,
        minDihedralAngle,
        jacobianQuality,
      },
    };
  }

  /**
   * Calculate quality of a Hexahedron.
   */
  public static evaluateHexahedron(
    n0: FEMNode, n1: FEMNode, n2: FEMNode, n3: FEMNode,
    n4: FEMNode, n5: FEMNode, n6: FEMNode, n7: FEMNode
  ): FEMElementQuality {
    // Split hex into 6 tetrahedrons:
    // T1: 0,1,2,5
    // T2: 0,2,3,7
    // T3: 0,5,7,4
    // T4: 2,5,6,7
    // T5: 0,2,5,7
    // (An alternative decomposition of a cube)
    const t1 = this.evaluateTetrahedron(n0, n1, n2, n5);
    const t2 = this.evaluateTetrahedron(n0, n2, n3, n7);
    const t3 = this.evaluateTetrahedron(n0, n5, n7, n4);
    const t4 = this.evaluateTetrahedron(n2, n5, n6, n7);
    const t5 = this.evaluateTetrahedron(n0, n2, n5, n7);

    const volume =
      t1.metrics.volume +
      t2.metrics.volume +
      t3.metrics.volume +
      t4.metrics.volume +
      t5.metrics.volume;

    const anyInvalid = [t1, t2, t3, t4, t5].some(t => t.classification === 'INVALID' || t.metrics.volume <= 0);

    if (anyInvalid || volume <= 1e-15 || isNaN(volume)) {
      return {
        elementId: '',
        type: 'HEX',
        classification: 'INVALID',
        metrics: { volume: 0, aspectRatio: Infinity, skewness: 1, jacobianDeterminant: 0 },
      };
    }

    const edgeLengths = [
      this.dist(n0, n1), this.dist(n1, n2), this.dist(n2, n3), this.dist(n3, n0),
      this.dist(n4, n5), this.dist(n5, n6), this.dist(n6, n7), this.dist(n7, n4),
      this.dist(n0, n4), this.dist(n1, n5), this.dist(n2, n6), this.dist(n3, n7),
    ];
    const lMax = Math.max(...edgeLengths);
    const lMin = Math.min(...edgeLengths);
    const ar = lMin > 1e-12 ? lMax / lMin : Infinity;

    // Skewness based on orthogonality of faces
    // For a hex, compute angles of the 6 quad faces and take max deviation
    const q0 = this.evaluateQuadrilateral(n0, n1, n2, n3);
    const q1 = this.evaluateQuadrilateral(n4, n5, n6, n7);
    const q2 = this.evaluateQuadrilateral(n0, n1, n5, n4);
    const q3 = this.evaluateQuadrilateral(n1, n2, n6, n5);
    const q4 = this.evaluateQuadrilateral(n2, n3, n6, n7);
    const q5 = this.evaluateQuadrilateral(n3, n0, n4, n7);

    const skewnesses = [
      q0.metrics.skewness,
      q1.metrics.skewness,
      q2.metrics.skewness,
      q3.metrics.skewness,
      q4.metrics.skewness,
      q5.metrics.skewness,
    ].filter(s => !isNaN(s));

    const skewness = Math.max(...skewnesses);

    // Simplified Jacobian determinant as the ratio of minimum to maximum volume of the 5 constituent tets
    const volumes = [
      t1.metrics.volume,
      t2.metrics.volume,
      t3.metrics.volume,
      t4.metrics.volume,
      t5.metrics.volume,
    ];
    const jacobianDeterminant = Math.min(...volumes) / Math.max(...volumes);

    let classification: FEMElementQualityClass = 'VALID';
    if (ar > 5.0 || skewness > 0.6 || jacobianDeterminant < 0.05) {
      classification = 'POOR';
    } else if (ar > 2.5 || skewness > 0.3 || jacobianDeterminant < 0.15) {
      classification = 'WARNING';
    }

    return {
      elementId: '',
      type: 'HEX',
      classification,
      metrics: {
        volume,
        aspectRatio: ar,
        skewness,
        jacobianDeterminant,
      },
    };
  }

  /**
   * Run full quality diagnostic on elements.
   */
  public static analyze(nodes: FEMNode[], elements: FEMElement[]): FEMMeshQualitySummary {
    const nodesMap = new Map<string, FEMNode>(nodes.map(n => [n.id, n]));
    const elementQualities = new Map<string, FEMElementQuality>();

    let totalAR = 0;
    let maxAR = 1.0;
    let minAreaVolume = Infinity;
    let warningCount = 0;
    let poorCount = 0;
    let invalidCount = 0;

    for (const elem of elements) {
      let q: FEMElementQuality;
      const nIds = elem.nodeIds;

      const elementNodes = nIds.map(id => nodesMap.get(id));
      const hasMissingNode = elementNodes.some(n => !n);

      if (hasMissingNode) {
        q = {
          elementId: elem.id,
          type: elem.type,
          classification: 'INVALID',
          metrics: { area: 0, volume: 0, aspectRatio: Infinity },
        };
      } else {
        const p = elementNodes as FEMNode[];
        switch (elem.type) {
          case 'TRI':
            q = this.evaluateTriangle(p[0], p[1], p[2]);
            break;
          case 'QUAD':
            q = this.evaluateQuadrilateral(p[0], p[1], p[2], p[3]);
            break;
          case 'TET':
            q = this.evaluateTetrahedron(p[0], p[1], p[2], p[3]);
            break;
          case 'HEX':
            q = this.evaluateHexahedron(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
            break;
          default:
            q = {
              elementId: elem.id,
              type: elem.type,
              classification: 'INVALID',
              metrics: {},
            };
        }
      }

      q.elementId = elem.id;
      elementQualities.set(elem.id, q);

      // Accumulate stats
      if (q.classification === 'INVALID') {
        invalidCount++;
        minAreaVolume = 0;
      } else {
        const ar = q.metrics.aspectRatio || 1.0;
        totalAR += ar;
        if (ar > maxAR) maxAR = ar;

        const size = q.metrics.area !== undefined ? q.metrics.area : q.metrics.volume || 0;
        if (size < minAreaVolume) minAreaVolume = size;

        if (q.classification === 'WARNING') warningCount++;
        if (q.classification === 'POOR') poorCount++;
      }
    }

    const count = elements.length - invalidCount;
    const averageAspectRatio = count > 0 ? totalAR / count : 1.0;

    let overallClassification: FEMElementQualityClass = 'VALID';
    if (invalidCount > 0) overallClassification = 'INVALID';
    else if (poorCount > 0) overallClassification = 'POOR';
    else if (warningCount > 0) overallClassification = 'WARNING';

    return {
      overallClassification,
      averageAspectRatio,
      maxAspectRatio: count > 0 ? maxAR : Infinity,
      minAreaVolume: minAreaVolume === Infinity ? 0 : minAreaVolume,
      warningCount,
      poorCount,
      invalidCount,
      elementQualities,
    };
  }
}
