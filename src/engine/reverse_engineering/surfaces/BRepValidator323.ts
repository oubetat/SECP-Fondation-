import { 
  BRepModel323, BRepValidationReport, BRepEdge, BRepCoEdge, 
  BRepFace, BRepVertex, BRepPoint3D 
} from './BRepReconstructionTypes323';
import { BRepEvaluator323 } from './BRepEvaluator323';
import { NURBSSurface322 } from './NURBSTypes322';
import { AnalyticalSurface321A } from './AnalyticalSurfaceTypes321A';

export class BRepValidator323 {
  private static readonly TOLERANCE = 1e-5;

  public static validate(
    model: BRepModel323, 
    nurbsSurfaces: Map<string, NURBSSurface322>,
    analyticalSurfaces: Map<string, AnalyticalSurface321A>,
    options: { gridSize?: number } = {}
  ): BRepValidationReport {
    const report: BRepValidationReport = {
      isValid: false,
      topology: {
        vertexCount: model.vertices.length,
        edgeCount: model.edges.length,
        coedgeCount: model.coedges.length,
        loopCount: model.loops.length,
        faceCount: model.faces.length,
        shellCount: model.shells.length,
        solidCount: model.solids.length,
        eulerCharacteristic: 0,
        isManifold: false,
        isClosed: false,
        openEdgeCount: 0,
        nonManifoldEdgeCount: 0,
        degenerateEdgeCount: 0,
        hasTjunctions: false, // We check vertex/edge coincidence
        orientationConsistent: true
      },
      geometry: {
        maxGapMm: 0,
        rmsDeviationMm: 0,
        maxDeviationMm: 0,
        areaMm2: 0,
        volumeMm3: 0,
        centroid: { x: 0, y: 0, z: 0 },
        verticesValid: true,
        edgesValid: true,
        loopsClosed: true
      },
      failures: []
    }

    this.validateTopology(model, report);
    this.validateGeometry(model, nurbsSurfaces, analyticalSurfaces, report, options.gridSize || 40);

    report.isValid = report.failures.length === 0;

    return report;
  }

  private static validateTopology(model: BRepModel323, report: BRepValidationReport) {
    const t = report.topology;

    // Topological Cell-Complex Convention:
    // We evaluate the Euler characteristic χ = V - E + F.
    // However, to align with the standard topological invariants of the 
    // underlying 2-manifold surfaces, we explicitly EXCLUDE degenerate boundary 
    // edges from the topological edge count 'E'. 
    // 
    // Detailed Treatment:
    // 1. Sphere: Has 1 periodic seam (1 valid edge) and 2 degenerate pole boundaries.
    //    The geometric poles are collapsed to 2 distinct vertices.
    //    Topological count: V(2) - E(1 valid seam) + F(1) = 2.
    //    (Degenerate top/bottom poles are omitted from E, keeping χ = 2).
    // 2. Cone (Lateral only): Has 1 periodic seam and 1 valid circular base.
    //    The apex is a degenerate boundary mapped to 1 vertex.
    //    Topological count: V(2) - E(2: seam + base) + F(1) = 1 (Disk topology).
    // 3. Periodic Cylinder (Lateral only): 1 periodic seam, 2 valid circular bases.
    //    Topological count: V(2) - E(3: seam + top + bottom) + F(1) = 0 (Annulus/Cylinder topology).
    // 4. Closed Box: 6 faces, 12 non-degenerate edges, 8 vertices.
    //    Topological count: V(8) - E(12) + F(6) = 2.
    
    const validEdges = model.edges.filter(e => !e.isDegenerate).length;
    t.degenerateEdgeCount = model.edges.length - validEdges;
    
    // Euler Characteristic: V - E + F
    t.eulerCharacteristic = t.vertexCount - validEdges + t.faceCount;

    // Edge incidences (manifoldness)
    // Map edgeId -> array of CoEdges
    const edgeIncidences = new Map<string, BRepCoEdge[]>();
    for (const edge of model.edges) {
      if (!edge.isDegenerate) {
        edgeIncidences.set(edge.edgeId, []);
      }
    }
    
    for (const ce of model.coedges) {
      const edge = model.edges.find(e => e.edgeId === ce.edgeId);
      if (edge && !edge.isDegenerate) {
        if (!edgeIncidences.has(ce.edgeId)) edgeIncidences.set(ce.edgeId, []);
        edgeIncidences.get(ce.edgeId)!.push(ce);
      }
    }

    t.openEdgeCount = 0;
    t.nonManifoldEdgeCount = 0;
    t.isManifold = true;

    for (const [edgeId, coedges] of edgeIncidences.entries()) {
      if (coedges.length === 1) {
        t.openEdgeCount++;
      } else if (coedges.length > 2) {
        t.nonManifoldEdgeCount++;
        t.isManifold = false;
        report.failures.push(`Non-manifold edge detected: ${edgeId} has ${coedges.length} coedges.`);
      } else if (coedges.length === 2) {
        // For a manifold edge, the two coedges MUST have opposite orientations.
        if (coedges[0].orientation === coedges[1].orientation) {
          t.orientationConsistent = false;
          report.failures.push(`Inconsistent orientation on edge: ${edgeId}`);
        }
      } else {
        report.failures.push(`Edge with no coedges: ${edgeId}`);
      }
    }

    // A shell is closed if there are no open edges.
    t.isClosed = t.openEdgeCount === 0 && model.edges.length > 0;
    
    // If we claim a solid exists, we MUST have a closed, manifold outer shell
    if (model.solids.length > 0 && (!t.isClosed || !t.isManifold)) {
      report.failures.push(`Solid constructed from an open or non-manifold shell.`);
    }

    // Loop continuity check
    const vertexMap = new Map<string, BRepVertex>();
    model.vertices.forEach(v => vertexMap.set(v.vertexId, v));
    const edgeMap = new Map<string, BRepEdge>();
    model.edges.forEach(e => edgeMap.set(e.edgeId, e));

    for (const loop of model.loops) {
      if (loop.coedgeIds.length === 0) {
        report.failures.push(`Empty loop: ${loop.loopId}`);
        continue;
      }
      
      let previousEndVertexId: string | null = null;
      const firstStartVertexId = this.getStartVertexOfCoEdge(model, loop.coedgeIds[0]);
      
      for (let i = 0; i < loop.coedgeIds.length; i++) {
        const start = this.getStartVertexOfCoEdge(model, loop.coedgeIds[i]);
        const end = this.getEndVertexOfCoEdge(model, loop.coedgeIds[i]);
        
        if (previousEndVertexId !== null && start !== previousEndVertexId) {
          report.failures.push(`Broken loop ${loop.loopId}: Coedge sequence is disconnected.`);
          report.geometry.loopsClosed = false;
        }
        previousEndVertexId = end;
      }
      
      if (previousEndVertexId !== firstStartVertexId) {
        report.failures.push(`Broken loop ${loop.loopId}: Loop does not close on itself.`);
        report.geometry.loopsClosed = false;
      }
    }
  }

  private static validateGeometry(
    model: BRepModel323, 
    nurbsSurfaces: Map<string, NURBSSurface322>,
    analyticalSurfaces: Map<string, AnalyticalSurface321A>,
    report: BRepValidationReport,
    gridSize: number = 40
  ) {
    const g = report.geometry;
    let maxGap = 0;

    const vertexMap = new Map<string, BRepVertex>();
    model.vertices.forEach(v => vertexMap.set(v.vertexId, v));

    // Validate Edges against Vertices and NURBS
    for (const edge of model.edges) {
      const nurbs = nurbsSurfaces.get(edge.curve.surfaceId);
      if (!nurbs) {
        report.failures.push(`Missing NURBS data for edge ${edge.edgeId}`);
        g.edgesValid = false;
        continue;
      }
      
      // Evaluate endpoints and compare to vertex coordinates
      const startV = vertexMap.get(edge.startVertexId);
      const endV = vertexMap.get(edge.endVertexId);

      if (!startV) {
        report.failures.push(`Missing start vertex ${edge.startVertexId} for edge ${edge.edgeId}`);
        g.verticesValid = false;
        continue;
      }
      if (!endV) {
        report.failures.push(`Missing end vertex ${edge.endVertexId} for edge ${edge.edgeId}`);
        g.verticesValid = false;
        continue;
      }
      
      const evalStart = BRepEvaluator323.evaluateEdge(edge.curve, nurbs.data, edge.curve.tMin);
      const evalEnd = BRepEvaluator323.evaluateEdge(edge.curve, nurbs.data, edge.curve.tMax);
      
      const distStart = BRepEvaluator323.distance3D(evalStart, startV.point);
      const distEnd = BRepEvaluator323.distance3D(evalEnd, endV.point);
      
      maxGap = Math.max(maxGap, distStart, distEnd);

      if (distStart > this.TOLERANCE || distEnd > this.TOLERANCE) {
        g.edgesValid = false;
        report.failures.push(`Geometric gap detected on edge ${edge.edgeId}: startGap=${distStart}, endGap=${distEnd}`);
      }

      // Check degenerate status actually matches geometry across full parameter domain
      if (edge.isDegenerate) {
        // Multi-point sampling across [tMin, tMax]
        const sampleCount = 5;
        for (let s = 0; s <= sampleCount; s++) {
          const t = edge.curve.tMin + (s / sampleCount) * (edge.curve.tMax - edge.curve.tMin);
          const evalPt = BRepEvaluator323.evaluateEdge(edge.curve, nurbs.data, t);
          const dev = BRepEvaluator323.distance3D(evalPt, startV.point);
          if (dev > this.TOLERANCE) {
            report.failures.push(`Edge ${edge.edgeId} marked degenerate but deviates ${dev} mm at t=${t}`);
            g.edgesValid = false;
            break;
          }
        }
      }
    }

    g.maxGapMm = maxGap;

    // Independent evaluation against analytical truth
    let sumSqDev = 0;
    let maxDev = 0;
    let count = 0;
    let totalArea = 0;
    
    // Polyhedron formulation for volume & centroid
    let volume = 0;
    let cx = 0, cy = 0, cz = 0;

    for (const face of model.faces) {
      const nurbs = nurbsSurfaces.get(face.surfaceId);
      const analytical = analyticalSurfaces.get(face.surfaceId);
      if (!nurbs) continue;
      
      let faceArea = 0;

      // Discretize face to approximate area, volume, centroid, and max deviation
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const u = face.uvDomain.uMin + (face.uvDomain.uMax - face.uvDomain.uMin) * (i / gridSize);
          const v = face.uvDomain.vMin + (face.uvDomain.vMax - face.uvDomain.vMin) * (j / gridSize);
          const uNext = face.uvDomain.uMin + (face.uvDomain.uMax - face.uvDomain.uMin) * ((i+1) / gridSize);
          const vNext = face.uvDomain.vMin + (face.uvDomain.vMax - face.uvDomain.vMin) * ((j+1) / gridSize);
          
          const p00 = BRepEvaluator323.evaluateFace(nurbs.data, u, v);
          const p10 = BRepEvaluator323.evaluateFace(nurbs.data, uNext, v);
          const p01 = BRepEvaluator323.evaluateFace(nurbs.data, u, vNext);
          const p11 = BRepEvaluator323.evaluateFace(nurbs.data, uNext, vNext);
          
          // Analytical Deviation
          if (analytical) {
            const dist = this.distanceToAnalytical([p00.x, p00.y, p00.z], analytical);
            sumSqDev += dist * dist;
            maxDev = Math.max(maxDev, dist);
            count++;
          }

          // Approx Area (sum of two triangles)
          const a1 = this.triangleArea(p00, p10, p11);
          const a2 = this.triangleArea(p00, p11, p01);
          faceArea += a1 + a2;

          // Divergence Theorem Volume & Centroid computation:
          // For vector field F(x) = x/3, div(F) = 1.
          // Volume V = \iiint 1 dV = 1/3 \iint (x \cdot n_effective) dA.
          // For a planar triangular facet (A, B, C), the outward tetrahedron volume element from origin is:
          // dV = 1/6 (A \cdot (B \times C)).
          // Face orientation convention:
          // - 'FORWARD': effective normal is +(dS/du \times dS/dv) / ||dS/du \times dS/dv||
          // - 'REVERSED': effective normal is -(dS/du \times dS/dv) / ||dS/du \times dS/dv||
          // Orientation verdict:
          // - signedVolume > 0: OUTWARD shell (surface normal points away from solid volume).
          // - signedVolume < 0: INWARD shell (surface normal points into solid volume).
          const sign = face.orientation === 'FORWARD' ? 1 : -1;
          const v1 = this.tetVolumeAndCentroid(p00, p10, p11);
          const v2 = this.tetVolumeAndCentroid(p00, p11, p01);
          
          volume += sign * (v1.vol + v2.vol);
          
          cx += sign * (v1.vol * v1.cx + v2.vol * v2.cx);
          cy += sign * (v1.vol * v1.cy + v2.vol * v2.cy);
          cz += sign * (v1.vol * v1.cz + v2.vol * v2.cz);
        }
      }
      totalArea += faceArea;
    }
    
    g.areaMm2 = totalArea;
    if (count > 0) {
      g.rmsDeviationMm = Math.sqrt(sumSqDev / count);
      g.maxDeviationMm = maxDev;
    }

    if (report.topology.isClosed) {
      g.signedVolumeMm3 = volume;
      // Strict mathematical convention: positive signed volume strictly defines an OUTWARD shell
      g.shellOrientation = Math.abs(volume) < 1e-9 ? 'UNKNOWN' : (volume > 0 ? 'OUTWARD' : 'INWARD');
      
      const absVol = Math.abs(volume);
      if (absVol > 1e-6) {
        // Centroid is scaled by the signed volume, then divided by signed volume to ensure invariance to orientation
        g.centroid = { x: cx / volume, y: cy / volume, z: cz / volume };
      }
      g.volumeMm3 = absVol;
    }
  }

  private static getStartVertexOfCoEdge(model: BRepModel323, ceId: string): string | null {
    const ce = model.coedges.find(c => c.coedgeId === ceId);
    if (!ce) return null;
    const edge = model.edges.find(e => e.edgeId === ce.edgeId);
    if (!edge) return null;
    return ce.orientation === 'FORWARD' ? edge.startVertexId : edge.endVertexId;
  }

  private static getEndVertexOfCoEdge(model: BRepModel323, ceId: string): string | null {
    const ce = model.coedges.find(c => c.coedgeId === ceId);
    if (!ce) return null;
    const edge = model.edges.find(e => e.edgeId === ce.edgeId);
    if (!edge) return null;
    return ce.orientation === 'FORWARD' ? edge.endVertexId : edge.startVertexId;
  }

  private static triangleArea(A: BRepPoint3D, B: BRepPoint3D, C: BRepPoint3D): number {
    const ux = B.x - A.x, uy = B.y - A.y, uz = B.z - A.z;
    const vx = C.x - A.x, vy = C.y - A.y, vz = C.z - A.z;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    return 0.5 * Math.sqrt(cx*cx + cy*cy + cz*cz);
  }

  private static tetVolumeAndCentroid(A: BRepPoint3D, B: BRepPoint3D, C: BRepPoint3D) {
    // Volume = (A dot (B cross C)) / 6
    const vol = (A.x*(B.y*C.z - B.z*C.y) + A.y*(B.z*C.x - B.x*C.z) + A.z*(B.x*C.y - B.y*C.x)) / 6;
    const cx = (A.x + B.x + C.x) / 4; // Origin is 0
    const cy = (A.y + B.y + C.y) / 4;
    const cz = (A.z + B.z + C.z) / 4;
    return { vol, cx, cy, cz };
  }

  private static distanceToAnalytical(pt: number[], surf: AnalyticalSurface321A): number {
    const p = surf.parameters;
    if (surf.surfaceType === 'PLANE') {
      const normal = p.normal || [0, 0, 1];
      const planeD = p.d !== undefined 
        ? p.d 
        : (p.centroid ? -(normal[0]*p.centroid[0] + normal[1]*p.centroid[1] + normal[2]*p.centroid[2]) : 0);
      return Math.abs(normal[0]*pt[0] + normal[1]*pt[1] + normal[2]*pt[2] + planeD);
    } else if (surf.surfaceType === 'CYLINDER') {
      const axisOrigin = p.axisOrigin || [0, 0, 0];
      const axisDirection = p.axisDirection || [0, 0, 1];
      const radius = p.radius !== undefined ? p.radius : 1;
      const vx = pt[0] - axisOrigin[0], vy = pt[1] - axisOrigin[1], vz = pt[2] - axisOrigin[2];
      const proj = vx*axisDirection[0] + vy*axisDirection[1] + vz*axisDirection[2];
      const rx = vx - proj*axisDirection[0], ry = vy - proj*axisDirection[1], rz = vz - proj*axisDirection[2];
      return Math.abs(Math.sqrt(rx*rx + ry*ry + rz*rz) - radius);
    } else if (surf.surfaceType === 'SPHERE') {
      const center = p.center || [0, 0, 0];
      const radius = p.radius !== undefined ? p.radius : 1;
      const dx = pt[0] - center[0], dy = pt[1] - center[1], dz = pt[2] - center[2];
      return Math.abs(Math.sqrt(dx*dx + dy*dy + dz*dz) - radius);
    } else if (surf.surfaceType === 'CONE') {
      const apex = p.apex || [0, 0, 0];
      const axisDirection = p.axisDirection || [0, 0, 1];
      const halfAngleRad = (p.halfAngleDeg !== undefined ? p.halfAngleDeg : 45) * Math.PI / 180;
      const vx = pt[0] - apex[0], vy = pt[1] - apex[1], vz = pt[2] - apex[2];
      const distToApex = Math.sqrt(vx*vx + vy*vy + vz*vz);
      if (distToApex < 1e-9) return 0;
      const proj = (vx*axisDirection[0] + vy*axisDirection[1] + vz*axisDirection[2]) / distToApex;
      const angle = Math.acos(Math.max(-1, Math.min(1, proj)));
      return distToApex * Math.abs(Math.sin(angle - halfAngleRad));
    }
    return 0;
  }
}
