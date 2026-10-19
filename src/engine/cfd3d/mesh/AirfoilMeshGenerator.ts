/**
 * SECP Industrial OS v2 — CFD Mesh Generator
 * PATCH-071.2: Wall-orthogonal, boundary-conforming O-Grid airfoil mesh
 *
 * Index convention (right-handed, i x j = +z):
 *   i : circumferential, CLOCKWISE in the x-y plane, starts at the lower trailing edge
 *   j : radial, from wall (j = 0) to far field (j = numNormalLayers)
 *   k : spanwise
 *
 * Geometry
 *  - Radial lines leave the wall along the vertex normal (mean of the two adjacent edge normals)
 *    and blend into a far-field circle with beta = (j/nJ)^p.
 *  - Far-field points use a blend of surface arc length and uniform angle
 *    (farFieldUniformBlend, default 0.6). Pure arc length (0) leaves very thin, strongly curved
 *    wake cells (max non-orthogonality ~77-80 deg in tests); 0.6 gives < 70 deg.
 *  - firstCellHeight is the NOMINAL offset of the first node layer along the vertex normal.
 *    The ACTUAL distance from every first-cell centroid to the wall is measured and returned in
 *    report.wallDistance; judge y+ from that (and from the solved flow), not from the requested value.
 *  - The effective growth rate is solved (numerically stable for growth ~ 1) so the layers
 *    reach farFieldRadius with the requested first height, and is checked against a hard limit.
 *  - A finite trailing-edge base is always built (O-grid topology). A sharp edge
 *    (trailingEdgeGapFraction < 1e-5) is represented by a 1e-5*chord base and a warning.
 *
 * Verification built in (report.quality): signed volumes, per-cell closure, skewness,
 * non-orthogonality (definitions in OGRID_QUALITY_DEFINITIONS), histogram and worst cells.
 * Hard acceptance limits are literature defaults (OpenFOAM checkMesh style), NOT tuned to results.
 */

import type { FvmMesh3D, FvmCell3D, FvmFace3D, BoundaryType3D, Vector3D } from '../Fvm3DTypes';
import { AirfoilGeometryEngine } from '../geometry/AirfoilGeometryEngine';
import { Fvm3DMeshGenerator } from '../Fvm3DMeshGenerator';

export interface OGridQualityLimits {
  /** Hard limit on max non-orthogonality [deg]. Default 70 (checkMesh "severely non-orthogonal"). */
  maxNonOrthogonalityDeg?: number;
  /** Hard limit on max face skewness. Default 4 (checkMesh error level). */
  maxSkewness?: number;
  /** Hard limit on the effective radial growth rate. Default 1.3. */
  maxEffectiveGrowthRate?: number;
  /** Hard limit on relative cell closure error. Default 1e-9. */
  maxCellClosureError?: number;
}

export const OGRID_DEFAULT_LIMITS: Required<OGridQualityLimits> = {
  maxNonOrthogonalityDeg: 70,
  maxSkewness: 4,
  maxEffectiveGrowthRate: 1.3,
  maxCellClosureError: 1e-9
};

export const OGRID_QUALITY_DEFINITIONS = {
  nonOrthogonalityInternal: 'angle between the face normal and the owner->neighbour centroid vector [deg]',
  nonOrthogonalityBoundary: 'angle between the face normal and the owner-centroid->face-centroid vector [deg]',
  skewnessInternal: '|face centroid - intersection of the centroid line with the face plane| / |owner->neighbour|',
  skewnessBoundary: '|face centroid - its projection from the owner centroid| / |owner-centroid->face-centroid|',
  wallDistance: 'min distance from the first-cell centroid to the wall segment of its own and the two adjacent surface edges (xy plane)',
  closure: '|sum of outward area vectors| / sum of face areas, per cell',
  cellMetric: 'cell value = max over its faces'
} as const;

export interface OGridConfig {
  airfoilDesignation: string;
  chord: number;
  span: number;
  farFieldRadius: number;
  numSurfacePoints: number;   // target circumferential resolution (i), integer
  numNormalLayers: number;    // radial (j), integer
  numSpanwiseLayers: number;  // spanwise (k), integer
  /** Nominal full thickness of the first layer (first-cell centroid at ~ h/2). */
  firstCellHeight: number;
  /** Requested growth rate (>= 1). Only used for the consistency warning; see report.growthRateEffective. */
  growthRate: number;

  /** Freestream speed [m/s] used for far-field INLET values. Default 10. */
  freestreamSpeedMS?: number;
  /** Angle of attack [deg] used to split INLET/OUTLET and set inlet velocity. Default 0. */
  angleOfAttackDeg?: number;

  // Backward compatibility aliases
  aoaDeg?: number;
  uFreestream?: number;

  /** Trailing-edge base height as a fraction of chord. Default 0.0025. Values < 1e-5 are raised to 1e-5. */
  trailingEdgeGapFraction?: number;
  /** Exponent of the wall-normal -> far-field blending, beta = (j/nJ)^p. Default 3. */
  orthogonalBlendExponent?: number;
  /** 0 = far-field points by surface arc length, 1 = uniform in angle. Default 0.6. */
  farFieldUniformBlend?: number;
  /** Throw when the mesh violates a hard limit. Default false for legacy resilience, true if strict specified. */
  strict?: boolean;
  limits?: OGridQualityLimits;
}

export interface OGridWorstCell {
  cellId: number; i: number; j: number; k: number;
  x: number; y: number;
  nonOrthogonalityDeg: number; skewness: number;
}

export interface OGridReport {
  accepted: boolean;
  rejectionReasons: string[];
  warnings: string[];

  numCells: number;
  numFaces: number;
  nCircumferential: number;
  nRadial: number;
  nSpanwise: number;

  chordActual: number;
  center: { x: number; y: number };
  farFieldRadius: number;
  farFieldExtent: number;

  firstCellHeightRequested: number;
  /** Measured distance from first-cell centroids to the wall vs the nominal target h/2. */
  wallDistance: {
    target: number; min: number; mean: number; max: number;
    minRelDev: number; maxRelDev: number; fractionWithin10pct: number;
    worst: { i: number; x: number; y: number; distance: number };
  };
  growthRateRequested: number;
  growthRateEffective: number;
  minNormalLayersForRequestedGrowth: number;

  trailingEdge: { requestedGap: number; existingGap: number; appliedExtraGap: number; finalGap: number };
  freestream: { speedMS: number; angleOfAttackDeg: number };
  farFieldUniformBlend: number;
  boundaryFaceCounts: Record<string, number>;
  wallAreaM2: number;
  /** chord * span: the correct reference area for Cl/Cd/Cm of this 2-D-extruded foil. */
  planformAreaM2: number;

  limits: Required<OGridQualityLimits>;
  quality: {
    minVolume: number;
    invertedCells: number;
    nonFiniteMetrics: number;
    maxSkewness: number;
    maxNonOrthogonalityDeg: number;
    meanNonOrthogonalityDeg: number;
    maxWallNonOrthogonalityDeg: number;
    wallNonOrthogonalityWorst: { x: number; y: number; deg: number };
    negativeOrthogonalityFaces: number;
    maxAspectRatio: number;
    maxCellClosureError: number;
    /** Cells per max-face non-orthogonality bin (upper edge in deg). */
    nonOrthogonalityHistogram: { upToDeg: number; cells: number }[];
    worst: { byNonOrthogonality: OGridWorstCell[]; bySkewness: OGridWorstCell[] };
  };
  definitions: typeof OGRID_QUALITY_DEFINITIONS;
  /** Output of Fvm3DMeshGenerator.auditMeshQuality, kept so both reports can be compared. */
  legacyAudit: unknown;
}

interface QuadGeom {
  area: number;
  sx: number; sy: number; sz: number;   // vector area
  cx: number; cy: number; cz: number;   // area-weighted centroid
}

const MIN_TE_GAP_FRACTION = 1e-5;

export class AirfoilMeshGenerator {
  /** Mesh only (warnings are printed). Use generateOGridWithReport for the full audit. */
  public static generateOGrid(config: OGridConfig): FvmMesh3D {
    const { mesh, report } = this.generateOGridWithReport(config);
    for (const w of report.warnings) console.warn(`[SECP-MESH] ${w}`);
    return mesh;
  }

  public static generateOGridWithReport(config: OGridConfig): { mesh: FvmMesh3D; report: OGridReport } {
    const {
      airfoilDesignation, chord, span, farFieldRadius,
      numSurfacePoints, numNormalLayers, numSpanwiseLayers, firstCellHeight, growthRate
    } = config;

    const speed = config.freestreamSpeedMS ?? config.uFreestream ?? 10.0;
    const aoaDeg = config.angleOfAttackDeg ?? config.aoaDeg ?? 0.0;
    const teGapFracRequested = config.trailingEdgeGapFraction ?? 0.0025;
    const blendExp = config.orthogonalBlendExponent ?? 3.0;
    const lam = config.farFieldUniformBlend ?? 0.6;
    const strict = config.strict ?? false;
    const limits: Required<OGridQualityLimits> = { ...OGRID_DEFAULT_LIMITS, ...(config.limits ?? {}) };
    const warnings: string[] = [];

    // ---------------------------------------------------------------- validation
    const posFinite = (v: unknown): boolean => typeof v === 'number' && isFinite(v) && v > 0;
    const fail = (m: string): never => { throw new Error(`MESH_CONFIG_INVALID: ${m}`); };
    if (typeof airfoilDesignation !== 'string' || !/^\d{4}$/.test(airfoilDesignation)) fail('airfoilDesignation must be a 4-digit NACA string.');
    if (![chord, span, farFieldRadius, firstCellHeight, speed].every(posFinite)) fail('chord, span, farFieldRadius, firstCellHeight and freestream speed must be positive and finite.');
    if (typeof growthRate !== 'number' || !isFinite(growthRate) || growthRate < 1.0) fail('growthRate must be a finite number >= 1.');
    if (typeof aoaDeg !== 'number' || !isFinite(aoaDeg)) fail('angleOfAttackDeg must be finite.');
    if (![numSurfacePoints, numNormalLayers, numSpanwiseLayers].every(v => Number.isInteger(v))) fail('numSurfacePoints, numNormalLayers and numSpanwiseLayers must be integers.');
    if (numSurfacePoints < 10 || numNormalLayers < 2 || numSpanwiseLayers < 1) fail('need numSurfacePoints >= 10, numNormalLayers >= 2, numSpanwiseLayers >= 1.');
    if (!posFinite(blendExp)) fail('orthogonalBlendExponent must be > 0.');
    if (typeof teGapFracRequested !== 'number' || !isFinite(teGapFracRequested) || teGapFracRequested < 0 || teGapFracRequested > 0.05) fail('trailingEdgeGapFraction must be in [0, 0.05].');
    if (typeof lam !== 'number' || !isFinite(lam) || lam < 0 || lam > 1) fail('farFieldUniformBlend must be in [0, 1].');
    if (!Object.values(limits).every(posFinite)) fail('all quality limits must be positive and finite.');
    if (farFieldRadius <= chord) fail('farFieldRadius must exceed the chord (use >= 10 chords for external aerodynamics).');

    // ---------------------------------------------------------------- airfoil loop
    const numPointsHalf = Math.max(8, Math.round(numSurfacePoints / 2));
    const geo = AirfoilGeometryEngine.generateNaca4(airfoilDesignation, chord, numPointsHalf);
    if (!geo || !geo.points || geo.points.length < 5) {
      throw new Error(`MESH_GEOMETRY_INVALID: geometry engine returned no usable points for ${airfoilDesignation}.`);
    }
    for (const p of geo.points) {
      if (![p.x, p.yUpper, p.yLower].every(v => typeof v === 'number' && isFinite(v))) {
        throw new Error('MESH_GEOMETRY_INVALID: non-finite airfoil coordinate from geometry engine.');
      }
    }
    // Normalise ordering: index 0 = leading edge, last = trailing edge
    const pts = geo.points[0].x <= geo.points[geo.points.length - 1].x ? geo.points : [...geo.points].reverse();
    const len = pts.length;
    const leX = pts[0].x;
    const teX = pts[len - 1].x;
    const chordActual = teX - leX;
    if (!(chordActual > 0)) throw new Error('MESH_GEOMETRY_INVALID: non-positive chord from geometry engine.');
    if (Math.abs(chordActual - chord) / chord > 1e-3) {
      warnings.push(`Geometry chord ${chordActual} differs from configured chord ${chord}.`);
    }

    // Trailing-edge base: open by a smooth wedge, never shrink an existing gap
    if (teGapFracRequested < MIN_TE_GAP_FRACTION) {
      warnings.push(`Sharp trailing edge requested; represented with a ${MIN_TE_GAP_FRACTION}*chord base (O-grid needs a finite base).`);
    }
    const existingGap = pts[len - 1].yUpper - pts[len - 1].yLower;
    const requestedGap = Math.max(teGapFracRequested, MIN_TE_GAP_FRACTION) * chordActual;
    const extraGap = Math.max(0.0, requestedGap - Math.max(existingGap, 0.0));
    const yU = (p: { x: number; yUpper: number }) => p.yUpper + 0.5 * extraGap * ((p.x - leX) / chordActual);
    const yL = (p: { x: number; yLower: number }) => p.yLower - 0.5 * extraGap * ((p.x - leX) / chordActual);

    // Loop: lower TE -> LE (len points), then upper LE+1 -> TE (len-1 points). Clockwise.
    let lx: number[] = [];
    let ly: number[] = [];
    for (let i = len - 1; i >= 0; i--) { lx.push(pts[i].x); ly.push(yL(pts[i])); }
    for (let i = 1; i < len; i++)       { lx.push(pts[i].x); ly.push(yU(pts[i])); }
    const nI = lx.length;

    // Enforce clockwise orientation (signed shoelace area < 0)
    let shoe = 0;
    for (let i = 0; i < nI; i++) {
      const i1 = (i + 1) % nI;
      shoe += lx[i] * ly[i1] - lx[i1] * ly[i];
    }
    if (shoe > 0) { lx = lx.reverse(); ly = ly.reverse(); }

    const nJ = numNormalLayers;
    const nK = numSpanwiseLayers;

    // ---------------------------------------------------------------- wall normals + arc length
    const enx = new Float64Array(nI); // outward unit normal of edge i -> i+1
    const eny = new Float64Array(nI);
    const elen = new Float64Array(nI);
    let loopLength = 0.0;
    for (let i = 0; i < nI; i++) {
      const i1 = (i + 1) % nI;
      const ex = lx[i1] - lx[i];
      const ey = ly[i1] - ly[i];
      const l = Math.hypot(ex, ey);
      if (!(l > 1e-14)) throw new Error(`MESH_GEOMETRY_INVALID: zero-length surface edge at i=${i}.`);
      elen[i] = l;
      enx[i] = -ey / l;   // clockwise loop: outward = (-ey, ex)
      eny[i] = ex / l;
      loopLength += l;
    }
    const vnx = new Float64Array(nI);
    const vny = new Float64Array(nI);
    for (let i = 0; i < nI; i++) {
      const im = (i - 1 + nI) % nI;
      let nx = enx[im] + enx[i];
      let ny = eny[im] + eny[i];
      const l = Math.hypot(nx, ny);
      if (l < 0.1) {
        // Fallback for near-cusp
        nx = enx[i];
        ny = eny[i];
      } else {
        nx /= l; ny /= l;
      }
      vnx[i] = nx; vny[i] = ny;
    }

    // Far-field angle: blend of normalised arc length and uniform index, symmetric about the wake axis
    const sBase = elen[nI - 1] / loopLength;
    const cx0 = leX + 0.5 * chordActual;
    const cy0 = 0.0;
    const fx = new Float64Array(nI);
    const fy = new Float64Array(nI);
    {
      const uBase = (1.0 - lam) * sBase + lam / nI;
      let s = 0.0;
      for (let i = 0; i < nI; i++) {
        const u = (1.0 - lam) * s + lam * (i / nI);
        const theta = -2.0 * Math.PI * (u + 0.5 * uBase);
        fx[i] = cx0 + farFieldRadius * Math.cos(theta);
        fy[i] = cy0 + farFieldRadius * Math.sin(theta);
        s += elen[i] / loopLength;
      }
    }

    // ---------------------------------------------------------------- radial distribution
    // d_j = h * S(eps, j), S = sum_{m<j} (1+eps)^m = expm1(j*log1p(eps))/eps  (stable as eps -> 0)
    const H = farFieldRadius - 0.5 * chordActual;
    const geomSum = (eps: number, n: number) => (eps < 1e-12 ? n : Math.expm1(n * Math.log1p(eps)) / eps);
    let eLo = 0.0;
    let eHi = 4.0;
    
    if (firstCellHeight * nJ >= H) {
      warnings.push(`firstCellHeight*numNormalLayers (${firstCellHeight * nJ}) >= far-field extent (${H}); using uniform radial spacing.`);
      eLo = 0.0;
      eHi = 0.0;
    } else {
      if (firstCellHeight * geomSum(eHi, nJ) < H) {
        warnings.push('Growth rate exceeds 5 to reach far field with current layer count; clamping.');
      }
      for (let it = 0; it < 200; it++) {
        const em = 0.5 * (eLo + eHi);
        if (firstCellHeight * geomSum(em, nJ) < H) eLo = em; else eHi = em;
      }
    }
    const epsEff = 0.5 * (eLo + eHi);
    const gEff = 1.0 + epsEff;
    const layerDist = new Float64Array(nJ + 1);
    for (let j = 1; j <= nJ; j++) layerDist[j] = firstCellHeight * geomSum(epsEff, j);
    layerDist[nJ] = H;

    const minLayersForRequested = growthRate - 1.0 > 1e-9
      ? Math.ceil(Math.log1p((H * (growthRate - 1.0)) / firstCellHeight) / Math.log1p(growthRate - 1.0))
      : Math.ceil(H / firstCellHeight);
    if (Math.abs(gEff - growthRate) / growthRate > 0.1) {
      warnings.push(
        `Effective growth rate ${gEff.toFixed(3)} (requested ${growthRate}). ` +
        `numNormalLayers >= ${minLayersForRequested} gives ~${growthRate} with firstCellHeight=${firstCellHeight}, farFieldRadius=${farFieldRadius}.`
      );
    }

    // ---------------------------------------------------------------- nodes (2-D, extruded in z)
    const nodeX = new Float64Array(nI * (nJ + 1));
    const nodeY = new Float64Array(nI * (nJ + 1));
    for (let j = 0; j <= nJ; j++) {
      const dj = layerDist[j];
      const sj = dj / H;
      const beta = Math.pow(j / nJ, blendExp);
      for (let i = 0; i < nI; i++) {
        const ox = lx[i] + dj * vnx[i];
        const oy = ly[i] + dj * vny[i];
        const rx = lx[i] + sj * (fx[i] - lx[i]);
        const ry = ly[i] + sj * (fy[i] - ly[i]);
        const x = (1.0 - beta) * ox + beta * rx;
        const y = (1.0 - beta) * oy + beta * ry;
        if (!isFinite(x) || !isFinite(y)) throw new Error(`MESH_NONFINITE_NODE: node (i=${i}, j=${j}) is not finite.`);
        nodeX[j * nI + i] = x;
        nodeY[j * nI + i] = y;
      }
    }
    const NX = (i: number, j: number) => nodeX[j * nI + (i % nI)];
    const NY = (i: number, j: number) => nodeY[j * nI + (i % nI)];
    const dz = span / nK;
    const Z = (k: number) => k * dz;

    // ---------------------------------------------------------------- cells
    const cells: FvmCell3D[] = [];
    const getCellId = (i: number, j: number, k: number) => i + j * nI + k * nI * nJ;
    let invertedCells = 0;
    let minVolume = Infinity;
    let maxAspect = 0.0;

    for (let k = 0; k < nK; k++) {
      for (let j = 0; j < nJ; j++) {
        for (let i = 0; i < nI; i++) {
          const x0 = NX(i, j),     y0 = NY(i, j);
          const x1 = NX(i + 1, j), y1 = NY(i + 1, j);
          const x2 = NX(i + 1, j + 1), y2 = NY(i + 1, j + 1);
          const x3 = NX(i, j + 1), y3 = NY(i, j + 1);

          const a1 = 0.5 * ((x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0));
          const a2 = 0.5 * ((x2 - x0) * (y3 - y0) - (y2 - y0) * (x3 - x0));
          const area2D = a1 + a2; // signed
          if (!(area2D > 0.0)) invertedCells++;
          const vol = area2D * dz;
          if (vol < minVolume) minVolume = vol;

          const wsum = Math.abs(area2D) > 1e-300 ? area2D : 1e-300;
          const ccx = (a1 * (x0 + x1 + x2) / 3.0 + a2 * (x0 + x2 + x3) / 3.0) / wsum;
          const ccy = (a1 * (y0 + y1 + y2) / 3.0 + a2 * (y0 + y2 + y3) / 3.0) / wsum;

          const ds = 0.5 * (Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x3, y2 - y3));
          const dr = 0.5 * (Math.hypot(x3 - x0, y3 - y0) + Math.hypot(x2 - x1, y2 - y1));
          const aspect = Math.max(ds, dr, dz) / Math.max(Math.min(ds, dr, dz), 1e-12);
          if (aspect > maxAspect) maxAspect = aspect;

          cells.push({
            cellId: getCellId(i, j, k),
            volume: vol,
            centroid: { x: ccx, y: ccy, z: Z(k) + 0.5 * dz },
            faceIds: [],
            neighborCellIds: [],
            boundaryFaceIds: [],
            skewness: 0,
            aspectRatio: aspect,
            nonOrthogonalityDeg: 0
          });
        }
      }
    }

    // ---------------------------------------------------------------- first-cell wall distance (measured)
    const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
      const abx = bx - ax, aby = by - ay;
      const l2 = abx * abx + aby * aby;
      let t = l2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
    };
    const targetDist = 0.5 * firstCellHeight;
    let wdMin = Infinity, wdMax = 0, wdSum = 0, wdWithin = 0;
    let wdWorst = { i: 0, x: 0, y: 0, distance: targetDist };
    for (let i = 0; i < nI; i++) {
      const c = cells[getCellId(i, 0, 0)];
      let d = Infinity;
      for (const sIdx of [(i - 1 + nI) % nI, i, (i + 1) % nI]) {
        d = Math.min(d, segDist(c.centroid.x, c.centroid.y, NX(sIdx, 0), NY(sIdx, 0), NX(sIdx + 1, 0), NY(sIdx + 1, 0)));
      }
      wdMin = Math.min(wdMin, d); wdMax = Math.max(wdMax, d); wdSum += d;
      if (Math.abs(d - targetDist) <= 0.1 * targetDist) wdWithin++;
      if (Math.abs(d - targetDist) > Math.abs(wdWorst.distance - targetDist)) wdWorst = { i, x: c.centroid.x, y: c.centroid.y, distance: d };
    }
    const wallDistance = {
      target: targetDist, min: wdMin, mean: wdSum / nI, max: wdMax,
      minRelDev: (wdMin - targetDist) / targetDist, maxRelDev: (wdMax - targetDist) / targetDist,
      fractionWithin10pct: wdWithin / nI, worst: wdWorst
    };

    // ---------------------------------------------------------------- faces
    const faces: FvmFace3D[] = [];
    const aoaRad = (aoaDeg * Math.PI) / 180.0;
    const flowX = Math.cos(aoaRad);
    const flowY = Math.sin(aoaRad);

    const quad = (
      ax: number, ay: number, az: number, bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number, dx: number, dy: number, dz_: number
    ): QuadGeom => {
      const ux = cx - ax, uy = cy - ay, uz = cz - az;
      const wx = dx - bx, wy = dy - by, wz = dz_ - bz;
      const sx = 0.5 * (uy * wz - uz * wy);
      const sy = 0.5 * (uz * wx - ux * wz);
      const sz = 0.5 * (ux * wy - uy * wx);
      const area = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (!(area > 1e-18)) throw new Error('MESH_DEGENERATE_FACE: zero-area face generated.');
      
      const t1x = 0.5 * ((by - ay) * (cz - az) - (bz - az) * (cy - ay));
      const t1y = 0.5 * ((bz - az) * (cx - ax) - (bx - ax) * (cz - az));
      const t1z = 0.5 * ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
      const t2x = 0.5 * ((cy - ay) * (dz_ - az) - (cz - az) * (dy - ay));
      const t2y = 0.5 * ((cz - az) * (dx - ax) - (cx - ax) * (dz_ - az));
      const t2z = 0.5 * ((cx - ax) * (dy - ay) - (cy - ay) * (dx - ax));
      const w1 = (t1x * sx + t1y * sy + t1z * sz) / area;
      const w2 = (t2x * sx + t2y * sy + t2z * sz) / area;
      const ws = w1 + w2;
      let gx: number, gy: number, gz: number;
      if (ws > 1e-300) {
        gx = (w1 * (ax + bx + cx) + w2 * (ax + cx + dx)) / (3.0 * ws);
        gy = (w1 * (ay + by + cy) + w2 * (ay + cy + dy)) / (3.0 * ws);
        gz = (w1 * (az + bz + cz) + w2 * (az + cz + dz_)) / (3.0 * ws);
      } else {
        gx = 0.25 * (ax + bx + cx + dx); gy = 0.25 * (ay + by + cy + dy); gz = 0.25 * (az + bz + cz + dz_);
      }
      return { area, sx, sy, sz, cx: gx, cy: gy, cz: gz };
    };

    const pushFace = (q: QuadGeom, ownerId: number, neighborId: number, flip: boolean, type: BoundaryType3D, farField = false): void => {
      const sgn = flip ? -1.0 : 1.0;
      const nx = (sgn * q.sx) / q.area;
      const ny = (sgn * q.sy) / q.area;
      const nz = (sgn * q.sz) / q.area;
      let bType = type;
      let u_bc: number | undefined, v_bc: number | undefined, w_bc: number | undefined, p_bc: number | undefined;
      if (farField) {
        if (nx * flowX + ny * flowY > 0.0) {
          bType = 'OUTLET';
          p_bc = 0.0;
        } else {
          bType = 'INLET';
          u_bc = speed * flowX;
          v_bc = speed * flowY;
          w_bc = 0.0;
        }
      }
      const face: FvmFace3D = {
        faceId: faces.length,
        area: q.area,
        normal: { x: nx, y: ny, z: nz },
        centroid: { x: q.cx, y: q.cy, z: q.cz },
        ownerCellId: ownerId,
        neighborCellId: neighborId,
        boundaryType: bType
      };
      if (u_bc !== undefined) face.u_bc = u_bc;
      if (v_bc !== undefined) face.v_bc = v_bc;
      if (w_bc !== undefined) face.w_bc = w_bc;
      if (p_bc !== undefined) face.p_bc = p_bc;
      faces.push(face);
      this.wire(face, cells);
    };

    // J-faces (normal +j): wall at j=0, far field at j=nJ, otherwise internal
    for (let k = 0; k < nK; k++) {
      for (let j = 0; j <= nJ; j++) {
        for (let i = 0; i < nI; i++) {
          const q = quad(
            NX(i, j), NY(i, j), Z(k),
            NX(i, j), NY(i, j), Z(k + 1),
            NX(i + 1, j), NY(i + 1, j), Z(k + 1),
            NX(i + 1, j), NY(i + 1, j), Z(k)
          );
          if (j === 0) {
            pushFace(q, getCellId(i, 0, k), -1, true, 'WALL');
          } else if (j === nJ) {
            pushFace(q, getCellId(i, nJ - 1, k), -1, false, 'INTERNAL', true);
          } else {
            pushFace(q, getCellId(i, j - 1, k), getCellId(i, j, k), false, 'INTERNAL');
          }
        }
      }
    }

    // I-faces (normal +i): between cell i and cell (i+1) mod nI, always internal (periodic loop)
    for (let k = 0; k < nK; k++) {
      for (let j = 0; j < nJ; j++) {
        for (let i = 0; i < nI; i++) {
          const ip = (i + 1) % nI;
          const q = quad(
            NX(ip, j), NY(ip, j), Z(k),
            NX(ip, j + 1), NY(ip, j + 1), Z(k),
            NX(ip, j + 1), NY(ip, j + 1), Z(k + 1),
            NX(ip, j), NY(ip, j), Z(k + 1)
          );
          pushFace(q, getCellId(i, j, k), getCellId(ip, j, k), false, 'INTERNAL');
        }
      }
    }

    // K-faces (normal +k): spanwise symmetry planes at k=0 and k=nK
    for (let k = 0; k <= nK; k++) {
      for (let j = 0; j < nJ; j++) {
        for (let i = 0; i < nI; i++) {
          const q = quad(
            NX(i, j), NY(i, j), Z(k),
            NX(i + 1, j), NY(i + 1, j), Z(k),
            NX(i + 1, j + 1), NY(i + 1, j + 1), Z(k),
            NX(i, j + 1), NY(i, j + 1), Z(k)
          );
          if (k === 0) {
            pushFace(q, getCellId(i, j, 0), -1, true, 'SYMMETRY');
          } else if (k === nK) {
            pushFace(q, getCellId(i, j, nK - 1), -1, false, 'SYMMETRY');
          } else {
            pushFace(q, getCellId(i, j, k - 1), getCellId(i, j, k), false, 'INTERNAL');
          }
        }
      }
    }

    // ---------------------------------------------------------------- quality metrics (see OGRID_QUALITY_DEFINITIONS)
    let negOrthFaces = 0;
    let nonFinite = 0;
    let maxSkew = 0.0;
    let maxNonOrth = 0.0;
    let maxWallNonOrth = 0.0;
    let wallWorst = { x: 0, y: 0, deg: 0 };
    let sumNonOrth = 0.0;
    let countNonOrth = 0;
    let wallArea = 0.0;
    const bcCounts: Record<string, number> = { WALL: 0, INLET: 0, OUTLET: 0, SYMMETRY: 0, INTERNAL: 0 };
    const closure = new Float64Array(cells.length * 3);
    const cellSurface = new Float64Array(cells.length);
    const RAD2DEG = 180.0 / Math.PI;

    for (const f of faces) {
      bcCounts[f.boundaryType] = (bcCounts[f.boundaryType] ?? 0) + 1;
      const o = cells[f.ownerCellId];
      const n = f.normal;
      let skew: number;
      let dn: number;
      let dl: number;

      if (f.neighborCellId !== -1) {
        const nb = cells[f.neighborCellId];
        const dx = nb.centroid.x - o.centroid.x, dy = nb.centroid.y - o.centroid.y, dzv = nb.centroid.z - o.centroid.z;
        dl = Math.sqrt(dx * dx + dy * dy + dzv * dzv);
        if (!(dl > 1e-300)) throw new Error(`MESH_DEGENERATE: coincident centroids across face ${f.faceId}.`);
        dn = dx * n.x + dy * n.y + dzv * n.z;
        const t = dn !== 0.0 ? ((f.centroid.x - o.centroid.x) * n.x + (f.centroid.y - o.centroid.y) * n.y + (f.centroid.z - o.centroid.z) * n.z) / dn : 0.0;
        const px = o.centroid.x + t * dx, py = o.centroid.y + t * dy, pz = o.centroid.z + t * dzv;
        skew = Math.sqrt((f.centroid.x - px) ** 2 + (f.centroid.y - py) ** 2 + (f.centroid.z - pz) ** 2) / dl;
      } else {
        const dx = f.centroid.x - o.centroid.x, dy = f.centroid.y - o.centroid.y, dzv = f.centroid.z - o.centroid.z;
        dl = Math.sqrt(dx * dx + dy * dy + dzv * dzv);
        if (!(dl > 1e-300)) throw new Error(`MESH_DEGENERATE: boundary face ${f.faceId} centroid coincides with its cell centroid.`);
        dn = dx * n.x + dy * n.y + dzv * n.z;
        const px = o.centroid.x + n.x * dn, py = o.centroid.y + n.y * dn, pz = o.centroid.z + n.z * dn;
        skew = Math.sqrt((f.centroid.x - px) ** 2 + (f.centroid.y - py) ** 2 + (f.centroid.z - pz) ** 2) / dl;
        if (f.boundaryType === 'WALL') wallArea += f.area;
      }
      if (dn <= 0.0) negOrthFaces++;
      const nonOrth = Math.acos(Math.max(-1, Math.min(1, dn / dl))) * RAD2DEG;
      if (!isFinite(skew) || !isFinite(nonOrth)) { nonFinite++; continue; }

      if (f.neighborCellId !== -1) { sumNonOrth += nonOrth; countNonOrth++; }
      if (nonOrth > maxNonOrth) maxNonOrth = nonOrth;
      if (f.boundaryType === 'WALL' && nonOrth > maxWallNonOrth) {
        maxWallNonOrth = nonOrth;
        wallWorst = { x: f.centroid.x, y: f.centroid.y, deg: nonOrth };
      }
      if (skew > maxSkew) maxSkew = skew;

      if (skew > o.skewness) o.skewness = skew;
      if (nonOrth > o.nonOrthogonalityDeg) o.nonOrthogonalityDeg = nonOrth;
      closure[3 * f.ownerCellId] += f.area * n.x;
      closure[3 * f.ownerCellId + 1] += f.area * n.y;
      closure[3 * f.ownerCellId + 2] += f.area * n.z;
      cellSurface[f.ownerCellId] += f.area;
      if (f.neighborCellId !== -1) {
        const nbc = cells[f.neighborCellId];
        if (skew > nbc.skewness) nbc.skewness = skew;
        if (nonOrth > nbc.nonOrthogonalityDeg) nbc.nonOrthogonalityDeg = nonOrth;
        closure[3 * f.neighborCellId] -= f.area * n.x;
        closure[3 * f.neighborCellId + 1] -= f.area * n.y;
        closure[3 * f.neighborCellId + 2] -= f.area * n.z;
        cellSurface[f.neighborCellId] += f.area;
      }
    }

    let maxClosure = 0.0;
    for (let c = 0; c < cells.length; c++) {
      const e = Math.hypot(closure[3 * c], closure[3 * c + 1], closure[3 * c + 2]) / Math.max(cellSurface[c], 1e-300);
      if (!(e <= maxClosure)) maxClosure = e;
    }

    // histogram + worst cells
    const edges = [10, 20, 30, 45, 60, 70, 85, 180];
    const histogram = edges.map(e => ({ upToDeg: e, cells: 0 }));
    for (const c of cells) {
      for (const h of histogram) { if (c.nonOrthogonalityDeg <= h.upToDeg) { h.cells++; break; } }
    }
    const toWorst = (c: FvmCell3D): OGridWorstCell => ({
      cellId: c.cellId, i: c.cellId % nI, j: Math.floor(c.cellId / nI) % nJ, k: Math.floor(c.cellId / (nI * nJ)),
      x: c.centroid.x, y: c.centroid.y, nonOrthogonalityDeg: c.nonOrthogonalityDeg, skewness: c.skewness
    });
    const topK = (key: (c: FvmCell3D) => number, kk = 5): OGridWorstCell[] => {
      const best: FvmCell3D[] = [];
      for (const c of cells) {
        const v = key(c);
        if (best.length < kk || v > key(best[best.length - 1])) {
          best.push(c);
          best.sort((a, b) => key(b) - key(a));
          if (best.length > kk) best.pop();
        }
      }
      return best.map(toWorst);
    };

    // ---------------------------------------------------------------- acceptance (hard limits)
    const reasons: string[] = [];
    if (invertedCells > 0) reasons.push(`${invertedCells} inverted/zero-volume cells`);
    if (negOrthFaces > 0) reasons.push(`${negOrthFaces} negative-orthogonality faces`);
    if (nonFinite > 0) reasons.push(`${nonFinite} faces with non-finite quality metrics`);
    if (!(maxClosure <= limits.maxCellClosureError)) reasons.push(`cell closure error ${maxClosure.toExponential(2)} > ${limits.maxCellClosureError}`);
    if (maxNonOrth > limits.maxNonOrthogonalityDeg) reasons.push(`max non-orthogonality ${maxNonOrth.toFixed(1)} deg > ${limits.maxNonOrthogonalityDeg}`);
    if (maxSkew > limits.maxSkewness) reasons.push(`max skewness ${maxSkew.toFixed(2)} > ${limits.maxSkewness}`);
    if (gEff > limits.maxEffectiveGrowthRate) {
      reasons.push(`effective growth rate ${gEff.toFixed(3)} > ${limits.maxEffectiveGrowthRate} (numNormalLayers >= ${minLayersForRequested} gives ~${growthRate})`);
    }
    if (reasons.length > 0 && strict) throw new Error(`MESH_REJECTED: ${reasons.join('; ')}`);
    for (const r of reasons) warnings.push(`QUALITY NOTICE (strict=${strict}): ${r}`);

    const legacyAudit = Fvm3DMeshGenerator.auditMeshQuality(cells, faces);

    const report: OGridReport = {
      accepted: reasons.length === 0,
      rejectionReasons: reasons,
      warnings,
      numCells: cells.length,
      numFaces: faces.length,
      nCircumferential: nI,
      nRadial: nJ,
      nSpanwise: nK,
      chordActual,
      center: { x: cx0, y: cy0 },
      farFieldRadius,
      farFieldExtent: H,
      firstCellHeightRequested: firstCellHeight,
      wallDistance,
      growthRateRequested: growthRate,
      growthRateEffective: gEff,
      minNormalLayersForRequestedGrowth: minLayersForRequested,
      trailingEdge: {
        requestedGap,
        existingGap: Math.max(existingGap, 0.0),
        appliedExtraGap: extraGap,
        finalGap: Math.max(existingGap, 0.0) + extraGap
      },
      freestream: { speedMS: speed, angleOfAttackDeg: aoaDeg },
      farFieldUniformBlend: lam,
      boundaryFaceCounts: bcCounts,
      wallAreaM2: wallArea,
      planformAreaM2: chordActual * span,
      limits,
      quality: {
        minVolume,
        invertedCells,
        nonFiniteMetrics: nonFinite,
        maxSkewness: maxSkew,
        maxNonOrthogonalityDeg: maxNonOrth,
        meanNonOrthogonalityDeg: countNonOrth > 0 ? sumNonOrth / countNonOrth : 0,
        maxWallNonOrthogonalityDeg: maxWallNonOrth,
        wallNonOrthogonalityWorst: wallWorst,
        negativeOrthogonalityFaces: negOrthFaces,
        maxAspectRatio: maxAspect,
        maxCellClosureError: maxClosure,
        nonOrthogonalityHistogram: histogram,
        worst: { byNonOrthogonality: topK(c => c.nonOrthogonalityDeg), bySkewness: topK(c => c.skewness) }
      },
      definitions: OGRID_QUALITY_DEFINITIONS,
      legacyAudit
    };

    const mesh: FvmMesh3D = {
      meshId: `o-grid-${airfoilDesignation}-${nI}x${nJ}x${nK}`,
      cells,
      faces,
      quality: legacyAudit,
      boundingBox: {
        min: { x: cx0 - farFieldRadius, y: cy0 - farFieldRadius, z: 0 },
        max: { x: cx0 + farFieldRadius, y: cy0 + farFieldRadius, z: span }
      }
    };

    (mesh as any).ogridReport = report;

    return { mesh, report };
  }

  private static wire(face: FvmFace3D, cells: FvmCell3D[]): void {
    const owner = cells[face.ownerCellId];
    owner.faceIds.push(face.faceId);
    if (face.neighborCellId !== -1) {
      owner.neighborCellIds.push(face.neighborCellId);
      const neighbor = cells[face.neighborCellId];
      neighbor.faceIds.push(face.faceId);
      neighbor.neighborCellIds.push(face.ownerCellId);
    } else {
      owner.boundaryFaceIds.push(face.faceId);
    }
  }
}
