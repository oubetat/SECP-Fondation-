import { Vector3DImmutable, Triangle3DExact } from '../types';
export type { Triangle3DExact };

export class ExactNarrowPhaseMath {
  public static normalize(v: Vector3DImmutable): Vector3DImmutable {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len < 1e-12) return { x: 0, y: 0, z: 1 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  public static add(a: Vector3DImmutable, b: Vector3DImmutable): Vector3DImmutable {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  public static sub(a: Vector3DImmutable, b: Vector3DImmutable): Vector3DImmutable {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  public static scale(v: Vector3DImmutable, s: number): Vector3DImmutable {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  }

  public static dot(a: Vector3DImmutable, b: Vector3DImmutable): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  public static cross(a: Vector3DImmutable, b: Vector3DImmutable): Vector3DImmutable {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  public static distance(a: Vector3DImmutable, b: Vector3DImmutable): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  public static dist(a: Vector3DImmutable, b: Vector3DImmutable): number {
    return this.distance(a, b);
  }

  public static closestPointPointToTriangle(p: Vector3DImmutable, tri: Triangle3DExact): { distance: number, closestPoint: Vector3DImmutable } {
    const v0 = (tri as any).v0 || (tri as any).a || (Array.isArray(tri) ? tri[0] : undefined);
    const v1 = (tri as any).v1 || (tri as any).b || (Array.isArray(tri) ? tri[1] : undefined);
    const v2 = (tri as any).v2 || (tri as any).c || (Array.isArray(tri) ? tri[2] : undefined);
    
    const cp = this.closestPointOnTriangle(p, v0, v1, v2);
    return {
      distance: this.distance(p, cp),
      closestPoint: cp
    };
  }

  public static closestPointSegmentToTriangle(
    p0: Vector3DImmutable,
    p1: Vector3DImmutable,
    tri: Triangle3DExact
  ): {
    distance: number;
    isInterpenetrating: boolean;
    contactFeature: string;
    closestPointTriangle: Vector3DImmutable;
    closestPointSegment: Vector3DImmutable;
    isDegenerate?: boolean;
  } {
    const v0 = (tri as any).v0 || (tri as any).a || (Array.isArray(tri) ? tri[0] : undefined);
    const v1 = (tri as any).v1 || (tri as any).b || (Array.isArray(tri) ? tri[1] : undefined);
    const v2 = (tri as any).v2 || (tri as any).c || (Array.isArray(tri) ? tri[2] : undefined);

    const ab = this.sub(v1, v0);
    const ac = this.sub(v2, v0);
    const rawNormal = this.cross(ab, ac);
    const normalLen = Math.sqrt(this.dot(rawNormal, rawNormal));

    if (normalLen < 1e-12) {
      const cpSeg = this.closestPointOnSegment(v0, p0, p1);
      const d = this.distance(v0, cpSeg);
      return {
        distance: d,
        isInterpenetrating: false,
        isDegenerate: true,
        contactFeature: 'VERTEX_0',
        closestPointTriangle: v0,
        closestPointSegment: cpSeg
      };
    }

    const normal = this.scale(rawNormal, 1.0 / normalLen);
    const u = this.sub(p1, p0);
    const denom = this.dot(u, normal);

    if (Math.abs(denom) > 1e-12) {
      const t = this.dot(this.sub(v0, p0), normal) / denom;
      if (t >= -1e-9 && t <= 1 + 1e-9) {
        const tClamped = Math.max(0, Math.min(1, t));
        const pInt = this.add(p0, this.scale(u, tClamped));
        if (this.isPointInTriangle(pInt, v0, v1, v2)) {
          let feature = 'FACE_INTERIOR';
          const dV0 = this.distance(pInt, v0);
          const dV1 = this.distance(pInt, v1);
          const dV2 = this.distance(pInt, v2);

          const cpE01 = this.closestPointOnSegment(pInt, v0, v1);
          const cpE12 = this.closestPointOnSegment(pInt, v1, v2);
          const cpE20 = this.closestPointOnSegment(pInt, v2, v0);
          const dE01 = this.distance(pInt, cpE01);
          const dE12 = this.distance(pInt, cpE12);
          const dE20 = this.distance(pInt, cpE20);

          if (dV0 < 1e-4) {
            feature = 'VERTEX_0';
          } else if (dV1 < 1e-4) {
            feature = 'VERTEX_1';
          } else if (dV2 < 1e-4) {
            feature = 'VERTEX_2';
          } else if (dE01 < 1e-4) {
            feature = 'EDGE_01';
          } else if (dE12 < 1e-4) {
            feature = 'EDGE_12';
          } else if (dE20 < 1e-4) {
            feature = 'EDGE_20';
          }

          return {
            distance: 0,
            isInterpenetrating: true,
            contactFeature: feature,
            closestPointTriangle: pInt,
            closestPointSegment: pInt
          };
        }
      }
    }

    let minDistance = Infinity;
    let bestSeg = p0;
    let bestTri = v0;
    let bestFeature = 'FACE_INTERIOR';

    const p0Proj = this.sub(p0, this.scale(normal, this.dot(this.sub(p0, v0), normal)));
    if (this.isPointInTriangle(p0Proj, v0, v1, v2)) {
      const d = this.distance(p0, p0Proj);
      if (d < minDistance) {
        minDistance = d;
        bestSeg = p0;
        bestTri = p0Proj;
        bestFeature = 'FACE_INTERIOR';
      }
    }

    const p1Proj = this.sub(p1, this.scale(normal, this.dot(this.sub(p1, v0), normal)));
    if (this.isPointInTriangle(p1Proj, v0, v1, v2)) {
      const d = this.distance(p1, p1Proj);
      if (d < minDistance) {
        minDistance = d;
        bestSeg = p1;
        bestTri = p1Proj;
        bestFeature = 'FACE_INTERIOR';
      }
    }

    const resAB = this.closestPointsBetweenSegments(p0, p1, v0, v1);
    if (resAB.distance < minDistance) {
      minDistance = resAB.distance;
      bestSeg = resAB.cpP;
      bestTri = resAB.cpQ;
      bestFeature = 'EDGE_01';
    }

    const resBC = this.closestPointsBetweenSegments(p0, p1, v1, v2);
    if (resBC.distance < minDistance) {
      minDistance = resBC.distance;
      bestSeg = resBC.cpP;
      bestTri = resBC.cpQ;
      bestFeature = 'EDGE_12';
    }

    const resCA = this.closestPointsBetweenSegments(p0, p1, v2, v0);
    if (resCA.distance < minDistance) {
      minDistance = resCA.distance;
      bestSeg = resCA.cpP;
      bestTri = resCA.cpQ;
      bestFeature = 'EDGE_20';
    }

    return {
      distance: minDistance,
      isInterpenetrating: false,
      contactFeature: bestFeature,
      closestPointTriangle: bestTri,
      closestPointSegment: bestSeg
    };
  }

  public static intersectTriangleTriangle(
    triA: Triangle3DExact,
    triB: Triangle3DExact
  ): {
    intersects: boolean;
    isCoplanar: boolean;
    contactType: string;
  } {
    const a0 = (triA as any).v0 || (triA as any).a || (Array.isArray(triA) ? triA[0] : undefined);
    const a1 = (triA as any).v1 || (triA as any).b || (Array.isArray(triA) ? triA[1] : undefined);
    const a2 = (triA as any).v2 || (triA as any).c || (Array.isArray(triA) ? triA[2] : undefined);

    const b0 = (triB as any).v0 || (triB as any).a || (Array.isArray(triB) ? triB[0] : undefined);
    const b1 = (triB as any).v1 || (triB as any).b || (Array.isArray(triB) ? triB[1] : undefined);
    const b2 = (triB as any).v2 || (triB as any).c || (Array.isArray(triB) ? triB[2] : undefined);

    const edgesB = [[b0, b1], [b1, b2], [b2, b0]];
    for (const [p0, p1] of edgesB) {
      const res = this.closestPointSegmentToTriangle(p0, p1, triA);
      if (res.isInterpenetrating) {
        return { intersects: true, isCoplanar: false, contactType: 'EDGE_FACE' };
      }
    }

    const edgesA = [[a0, a1], [a1, a2], [a2, a0]];
    for (const [p0, p1] of edgesA) {
      const res = this.closestPointSegmentToTriangle(p0, p1, triB);
      if (res.isInterpenetrating) {
        return { intersects: true, isCoplanar: false, contactType: 'EDGE_FACE' };
      }
    }

    return {
      intersects: false,
      isCoplanar: false,
      contactType: 'NONE'
    };
  }

  public static vectorToOrientationQuaternion(v: Vector3DImmutable) {
    const normalized = this.normalize(v);
    return { x: normalized.x, y: normalized.y, z: normalized.z, w: 1.0 };
  }

  public static continuousSweptToolSegmentToTriangle(
    p0: Vector3DImmutable,
    q0: any,
    p1: Vector3DImmutable,
    q1: any,
    length: number,
    radius: number,
    tri: Triangle3DExact
  ): { isColliding: boolean; penetrationDepthMm: number; clearanceMm: number; toi: number | null; contactPoint: Vector3DImmutable } {
    const v0 = (tri as any).v0 || (tri as any).a || (Array.isArray(tri) ? tri[0] : undefined);
    const v1 = (tri as any).v1 || (tri as any).b || (Array.isArray(tri) ? tri[1] : undefined);
    const v2 = (tri as any).v2 || (tri as any).c || (Array.isArray(tri) ? tri[2] : undefined);
    
    const steps = 11;
    let minClearance = Infinity;
    let maxPenetration = 0;
    let isColliding = false;
    let bestToi: number | null = null;
    let contactPoint = v0;

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const pt = {
        x: p0.x + t * (p1.x - p0.x),
        y: p0.y + t * (p1.y - p0.y),
        z: p0.z + t * (p1.z - p0.z)
      };
      const qt = {
        x: q0.x + t * (q1.x - q0.x),
        y: q0.y + t * (q1.y - q0.y),
        z: q0.z + t * (q1.z - q0.z)
      };
      const axis = this.normalize(qt);
      const capEnd = this.add(pt, this.scale(axis, length));

      const res = this.capsuleToTriangleDistance(pt, capEnd, radius, tri);
      if (res.isColliding) {
        isColliding = true;
        if (res.penetrationDepthMm > maxPenetration) {
          maxPenetration = res.penetrationDepthMm;
        }
        if (bestToi === null) {
          bestToi = t;
          contactPoint = res.closestPointTriangle;
        }
      } else {
        if (res.clearanceMm < minClearance) {
          minClearance = res.clearanceMm;
        }
      }
    }

    return {
      isColliding,
      penetrationDepthMm: maxPenetration,
      clearanceMm: isColliding ? 0 : minClearance,
      toi: bestToi,
      contactPoint
    };
  }

  public static closestPointOnTriangle(
    p: Vector3DImmutable,
    v0: Vector3DImmutable,
    v1: Vector3DImmutable,
    v2: Vector3DImmutable
  ): Vector3DImmutable {
    const ab = this.sub(v1, v0);
    const ac = this.sub(v2, v0);
    const ap = this.sub(p, v0);

    const d1 = this.dot(ab, ap);
    const d2 = this.dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return v0;

    const bp = this.sub(p, v1);
    const d3 = this.dot(ab, bp);
    const d4 = this.dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) return v1;

    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      return this.add(v0, this.scale(ab, v));
    }

    const cp = this.sub(p, v2);
    const d5 = this.dot(ab, cp);
    const d6 = this.dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) return v2;

    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6);
      return this.add(v0, this.scale(ac, w));
    }

    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
      const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
      return this.add(v1, this.scale(this.sub(v2, v1), w));
    }

    const denom = 1.0 / (va + vb + vc);
    const v = vb * denom;
    const w = vc * denom;
    return this.add(v0, this.add(this.scale(ab, v), this.scale(ac, w)));
  }

  public static closestPointOnSegment(p: Vector3DImmutable, a: Vector3DImmutable, b: Vector3DImmutable): Vector3DImmutable {
    const ab = this.sub(b, a);
    const abLenSq = this.dot(ab, ab);
    if (abLenSq < 1e-18) {
      return a;
    }
    const t = Math.max(0, Math.min(1, this.dot(this.sub(p, a), ab) / abLenSq));
    return this.add(a, this.scale(ab, t));
  }

  public static closestPointsBetweenSegments(
    p0: Vector3DImmutable, p1: Vector3DImmutable,
    q0: Vector3DImmutable, q1: Vector3DImmutable
  ): { cpP: Vector3DImmutable, cpQ: Vector3DImmutable, distance: number } {
    const u = this.sub(p1, p0);
    const v = this.sub(q1, q0);
    const r = this.sub(p0, q0);

    const a = this.dot(u, u);
    const b = this.dot(u, v);
    const c = this.dot(v, v);
    const d = this.dot(u, r);
    const e = this.dot(v, r);

    let s = 0;
    let t = 0;

    if (a < 1e-18 && c < 1e-18) {
      s = 0;
      t = 0;
    } else if (a < 1e-18) {
      s = 0;
      t = Math.max(0, Math.min(1, e / c));
    } else if (c < 1e-18) {
      t = 0;
      s = Math.max(0, Math.min(1, -d / a));
    } else {
      const denom = a * c - b * b;
      if (Math.abs(denom) > 1e-15) {
        s = Math.max(0, Math.min(1, (b * e - c * d) / denom));
      } else {
        s = 0;
      }
      t = (b * s + e) / c;
      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -d / a));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (b - d) / a));
      }
    }

    const cpP = this.add(p0, this.scale(u, s));
    const cpQ = this.add(q0, this.scale(v, t));
    return { cpP, cpQ, distance: this.distance(cpP, cpQ) };
  }

  public static isPointInTriangle(p: Vector3DImmutable, a: Vector3DImmutable, b: Vector3DImmutable, c: Vector3DImmutable): boolean {
    const u = this.sub(b, a);
    const v = this.sub(c, a);
    const w = this.sub(p, a);

    const d00 = this.dot(u, u);
    const d01 = this.dot(u, v);
    const d11 = this.dot(v, v);
    const d20 = this.dot(w, u);
    const d21 = this.dot(w, v);

    const denom = d00 * d11 - d01 * d01;
    if (Math.abs(denom) < 1e-15) {
      const distA = this.distance(p, a);
      const distB = this.distance(p, b);
      const distC = this.distance(p, c);
      const abDistance = this.distance(a, b);
      const bcDistance = this.distance(b, c);
      const caDistance = this.distance(c, a);
      const maxEdge = Math.max(abDistance, bcDistance, caDistance);
      if (maxEdge < 1e-12) return distA < 1e-9;
      if (abDistance >= bcDistance && abDistance >= caDistance) {
        const pOnAb = this.closestPointOnSegment(p, a, b);
        return this.distance(p, pOnAb) < 1e-9;
      } else if (bcDistance >= abDistance && bcDistance >= caDistance) {
        const pOnBc = this.closestPointOnSegment(p, b, c);
        return this.distance(p, pOnBc) < 1e-9;
      } else {
        const pOnCa = this.closestPointOnSegment(p, c, a);
        return this.distance(p, pOnCa) < 1e-9;
      }
    }

    const vBary = (d11 * d20 - d01 * d21) / denom;
    const wBary = (d00 * d21 - d01 * d20) / denom;
    const uBary = 1.0 - vBary - wBary;

    const tol = -1e-9;
    return vBary >= tol && wBary >= tol && uBary >= tol;
  }

  public static capsuleToTriangleDistance(
    capsuleStart: Vector3DImmutable,
    capsuleEnd: Vector3DImmutable,
    radius: number,
    triangle: Triangle3DExact
  ): {
    clearanceMm: number;
    isColliding: boolean;
    isTouching?: boolean;
    penetrationDepthMm: number;
    closestPointTriangle: Vector3DImmutable;
    closestPointCapsuleCore: Vector3DImmutable;
    contactNormal: Vector3DImmutable;
    contactFeature: string;
  } {
    const v0 = (triangle as any).v0 || (triangle as any).a || (Array.isArray(triangle) ? triangle[0] : undefined);
    const v1 = (triangle as any).v1 || (triangle as any).b || (Array.isArray(triangle) ? triangle[1] : undefined);
    const v2 = (triangle as any).v2 || (triangle as any).c || (Array.isArray(triangle) ? triangle[2] : undefined);

    const isZeroLengthCutter = this.distance(capsuleStart, capsuleEnd) < 1e-12;

    const ab = this.sub(v1, v0);
    const ac = this.sub(v2, v0);
    const rawNormal = this.cross(ab, ac);
    const normalLen = Math.sqrt(this.dot(rawNormal, rawNormal));

    let normal: Vector3DImmutable;
    let isDegenerateTriangle = normalLen < 1e-12;

    if (isDegenerateTriangle) {
      normal = { x: 0, y: 0, z: 1 };
    } else {
      normal = this.scale(rawNormal, 1.0 / normalLen);
    }

    let minDistance = Infinity;
    let cpSeg = capsuleStart;
    let cpTri = v0;
    let contactFeature = 'EDGE';

    if (!isDegenerateTriangle && !isZeroLengthCutter) {
      const u = this.sub(capsuleEnd, capsuleStart);
      const denom = this.dot(u, normal);
      if (Math.abs(denom) > 1e-12) {
        const t = this.dot(this.sub(v0, capsuleStart), normal) / denom;
        if (t >= 0 && t <= 1) {
          const pInt = this.add(capsuleStart, this.scale(u, t));
          if (this.isPointInTriangle(pInt, v0, v1, v2)) {
            minDistance = 0;
            cpSeg = pInt;
            cpTri = pInt;
            contactFeature = 'FACE';
          }
        }
      }
    }

    if (minDistance > 0) {
      const p0Proj = this.sub(capsuleStart, this.scale(normal, this.dot(this.sub(capsuleStart, v0), normal)));
      if (!isDegenerateTriangle && this.isPointInTriangle(p0Proj, v0, v1, v2)) {
        const d = this.distance(capsuleStart, p0Proj);
        if (d < minDistance) {
          minDistance = d;
          cpSeg = capsuleStart;
          cpTri = p0Proj;
          contactFeature = 'FACE';
        }
      }

      if (!isZeroLengthCutter) {
        const p1Proj = this.sub(capsuleEnd, this.scale(normal, this.dot(this.sub(capsuleEnd, v0), normal)));
        if (!isDegenerateTriangle && this.isPointInTriangle(p1Proj, v0, v1, v2)) {
          const d = this.distance(capsuleEnd, p1Proj);
          if (d < minDistance) {
            minDistance = d;
            cpSeg = capsuleEnd;
            cpTri = p1Proj;
            contactFeature = 'FACE';
          }
        }
      }

      const resAB = this.closestPointsBetweenSegments(capsuleStart, capsuleEnd, v0, v1);
      if (resAB.distance < minDistance) {
        minDistance = resAB.distance;
        cpSeg = resAB.cpP;
        cpTri = resAB.cpQ;
        contactFeature = 'EDGE';
      }

      const resBC = this.closestPointsBetweenSegments(capsuleStart, capsuleEnd, v1, v2);
      if (resBC.distance < minDistance) {
        minDistance = resBC.distance;
        cpSeg = resBC.cpP;
        cpTri = resBC.cpQ;
        contactFeature = 'EDGE';
      }

      const resCA = this.closestPointsBetweenSegments(capsuleStart, capsuleEnd, v2, v0);
      if (resCA.distance < minDistance) {
        minDistance = resCA.distance;
        cpSeg = resCA.cpP;
        cpTri = resCA.cpQ;
        contactFeature = 'EDGE';
      }
    }

    const isColliding = minDistance < radius;
    const penetrationDepthMm = isColliding ? radius - minDistance : 0;
    const clearanceMm = isColliding ? -penetrationDepthMm : minDistance - radius;
    const isTouching = Math.abs(minDistance - radius) < 1e-6 || Math.abs(clearanceMm) < 1e-6;

    let contactNormal = normal;
    if (minDistance > 1e-9) {
      contactNormal = this.normalize(this.sub(cpSeg, cpTri));
    }

    return {
      clearanceMm,
      isColliding,
      isTouching,
      penetrationDepthMm,
      closestPointTriangle: cpTri,
      closestPointCapsuleCore: cpSeg,
      contactNormal,
      contactFeature
    };
  }

  public static sweptSphereToTriangle(
    start: Vector3DImmutable,
    end: Vector3DImmutable,
    radius: number,
    tri: Triangle3DExact
  ): {
    isColliding: boolean;
    toi: number | null;
    penetrationDepthMm: number;
    clearanceMm: number;
    closestPointTriangle: Vector3DImmutable;
    closestPointCapsuleCore: Vector3DImmutable;
  } {
    // Check overall capsule to triangle first
    const capRes = this.capsuleToTriangleDistance(start, end, radius, tri);
    if (!capRes.isColliding) {
      return {
        isColliding: false,
        toi: null,
        penetrationDepthMm: 0,
        clearanceMm: capRes.clearanceMm,
        closestPointTriangle: capRes.closestPointTriangle,
        closestPointCapsuleCore: capRes.closestPointCapsuleCore
      };
    }

    // Discretize to find the first time of impact (TOI)
    let firstToi: number | null = null;
    const steps = 101;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const pt = {
        x: start.x + t * (end.x - start.x),
        y: start.y + t * (end.y - start.y),
        z: start.z + t * (end.z - start.z)
      };
      // A stationary sphere is a capsule of zero length
      const sphereRes = this.capsuleToTriangleDistance(pt, pt, radius, tri);
      if (sphereRes.isColliding) {
        firstToi = t;
        break;
      }
    }

    if (firstToi === null) {
      firstToi = 0.5; // fallback
    }

    return {
      isColliding: true,
      toi: firstToi,
      penetrationDepthMm: capRes.penetrationDepthMm,
      clearanceMm: 0,
      closestPointTriangle: capRes.closestPointTriangle,
      closestPointCapsuleCore: capRes.closestPointCapsuleCore
    };
  }

  public static slerp(q0: any, q1: any, t: number): { x: number, y: number, z: number, w: number } {
    if (
      !Number.isFinite(t) ||
      !Number.isFinite(q0?.x) || !Number.isFinite(q0?.y) || !Number.isFinite(q0?.z) || !Number.isFinite(q0?.w) ||
      !Number.isFinite(q1?.x) || !Number.isFinite(q1?.y) || !Number.isFinite(q1?.z) || !Number.isFinite(q1?.w)
    ) {
      throw new Error('[ExactNarrowPhaseMath.slerp] Non-finite parameters provided.');
    }
    let cosHalfTheta = q0.w * q1.w + q0.x * q1.x + q0.y * q1.y + q0.z * q1.z;
    
    // If the dot product is negative, slerp won't take the shorter path.
    // We can invert one quaternion to fix this.
    let q1Inverted = { ...q1 };
    if (cosHalfTheta < 0) {
      q1Inverted.w = -q1.w;
      q1Inverted.x = -q1.x;
      q1Inverted.y = -q1.y;
      q1Inverted.z = -q1.z;
      cosHalfTheta = -cosHalfTheta;
    }

    if (Math.abs(cosHalfTheta) >= 1.0) {
      return { x: q0.x, y: q0.y, z: q0.z, w: q0.w };
    }

    const halfTheta = Math.acos(cosHalfTheta);
    const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

    if (Math.abs(sinHalfTheta) < 0.001) {
      return {
        x: q0.x + t * (q1Inverted.x - q0.x),
        y: q0.y + t * (q1Inverted.y - q0.y),
        z: q0.z + t * (q1Inverted.z - q0.z),
        w: q0.w + t * (q1Inverted.w - q0.w)
      };
    }

    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

    return {
      x: q0.x * ratioA + q1Inverted.x * ratioB,
      y: q0.y * ratioA + q1Inverted.y * ratioB,
      z: q0.z * ratioA + q1Inverted.z * ratioB,
      w: q0.w * ratioA + q1Inverted.w * ratioB
    };
  }
}
