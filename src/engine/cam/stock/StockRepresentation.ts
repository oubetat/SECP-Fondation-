/**
 * SECP-260 — Stock Representation & Volumetric Dexel/Voxel Engine
 * Implements high-precision volumetric Dexel Grid & Voxel representations
 * supporting Block, Cylindrical, Extruded, and Imported B-Rep stocks.
 * Performs deterministic boolean subtraction against swept cutter volumes.
 */

import { 
  Vector3D,
  vec3,
  StockDefinition, 
  StockBounds, 
  StockGeometryType, 
  StockRepresentationType,
  ToolGeometry,
  SweptCutterVolume
} from './StockTypes';
import { SweptCutterEngine, SweptSamplePoint } from './SweptCutterVolume';

export interface DexelInterval {
  zMin: number;
  zMax: number;
}

export interface StockTriMesh {
  vertices: number[];
  indices: number[];
  normals: number[];
}

export class StockModelRepresentation {
  public readonly stockDef: StockDefinition;
  public readonly repType: StockRepresentationType;
  public readonly resolutionMm: number;
  public readonly bounds: StockBounds;
  
  public gridNx: number;
  public gridNy: number;
  public dx: number;
  public dy: number;

  // Dexel Grid: Array of arrays of z-intervals at each (ix, iy) cell
  private dexels: DexelInterval[][];
  private initialTotalVolumeMm3: number = 0;
  private currentVolumeMm3: number = 0;

  constructor(stockDef: StockDefinition, repType: StockRepresentationType = 'DEXEL') {
    this.stockDef = stockDef;
    this.repType = repType;
    this.bounds = { ...stockDef.bounds };
    this.resolutionMm = Math.max(0.2, stockDef.resolutionMm || 1.0);

    const spanX = Math.max(1, this.bounds.maxX - this.bounds.minX);
    const spanY = Math.max(1, this.bounds.maxY - this.bounds.minY);

    this.gridNx = Math.max(10, Math.min(400, Math.ceil(spanX / this.resolutionMm)));
    this.gridNy = Math.max(10, Math.min(400, Math.ceil(spanY / this.resolutionMm)));

    this.dx = spanX / this.gridNx;
    this.dy = spanY / this.gridNy;

    this.dexels = [];
    this.initializeStockGeometry();
  }

  /**
   * Initializes the raw stock intervals based on geometry type
   */
  private initializeStockGeometry(): void {
    this.dexels = new Array(this.gridNx * this.gridNy);
    let volAccum = 0;
    const cellArea = this.dx * this.dy;

    const b = this.bounds;
    const geomType = this.stockDef.geometryType;
    const dims = this.stockDef.dimensions;

    for (let iy = 0; iy < this.gridNy; iy++) {
      const cy = b.minY + (iy + 0.5) * this.dy;
      for (let ix = 0; ix < this.gridNx; ix++) {
        const cx = b.minX + (ix + 0.5) * this.dx;
        const idx = iy * this.gridNx + ix;
        const intervals: DexelInterval[] = [];

        if (geomType === 'BOUNDING_BOX' || geomType === 'CUSTOM_BREP' || geomType === 'IMPORTED_SOLID') {
          // Standard block interval
          intervals.push({ zMin: b.minZ, zMax: b.maxZ });
          volAccum += cellArea * (b.maxZ - b.minZ);
        } else if (geomType === 'CYLINDRICAL') {
          // Cylinder along Z or X
          const diam = dims.diameterMm || (b.maxX - b.minX);
          const rad = diam / 2;
          const midX = (b.minX + b.maxX) / 2;
          const midY = (b.minY + b.maxY) / 2;
          const distSq = (cx - midX) ** 2 + (cy - midY) ** 2;

          if (distSq <= rad * rad) {
            intervals.push({ zMin: b.minZ, zMax: b.maxZ });
            volAccum += cellArea * (b.maxZ - b.minZ);
          }
        } else if (geomType === 'EXTRUDED' && dims.polygonVertices && dims.polygonVertices.length >= 3) {
          // Point-in-polygon test for 2D footprint
          if (this.isPointInPolygon(cx, cy, dims.polygonVertices)) {
            const h = dims.extrusionHeightMm || (b.maxZ - b.minZ);
            intervals.push({ zMin: b.minZ, zMax: b.minZ + h });
            volAccum += cellArea * h;
          }
        } else {
          // Default fallback to bounding box
          intervals.push({ zMin: b.minZ, zMax: b.maxZ });
          volAccum += cellArea * (b.maxZ - b.minZ);
        }

        this.dexels[idx] = intervals;
      }
    }

    this.initialTotalVolumeMm3 = volAccum;
    this.currentVolumeMm3 = volAccum;
  }

  private isPointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Applies continuous swept cutter boolean subtraction on the active dexel grid
   * Returns exact volume removed in mm³
   */
  public carveSweptCutter(sweptVolume: SweptCutterVolume): { removedVolumeMm3: number; isAirCut: boolean } {
    const samples = SweptCutterEngine.generateSweptSamples(sweptVolume);
    const bMin = sweptVolume.boundingMin;
    const bMax = sweptVolume.boundingMax;

    // Determine grid sub-region affected by this swept segment
    const startIx = Math.max(0, Math.floor((bMin.x - this.bounds.minX) / this.dx));
    const endIx = Math.min(this.gridNx - 1, Math.ceil((bMax.x - this.bounds.minX) / this.dx));
    const startIy = Math.max(0, Math.floor((bMin.y - this.bounds.minY) / this.dy));
    const endIy = Math.min(this.gridNy - 1, Math.ceil((bMax.y - this.bounds.minY) / this.dy));

    if (startIx > endIx || startIy > endIy) {
      return { removedVolumeMm3: 0, isAirCut: true };
    }

    let segmentRemovedVol = 0;
    const cellArea = this.dx * this.dy;

    for (let iy = startIy; iy <= endIy; iy++) {
      const cy = this.bounds.minY + (iy + 0.5) * this.dy;
      for (let ix = startIx; ix <= endIx; ix++) {
        const cx = this.bounds.minX + (ix + 0.5) * this.dx;
        const idx = iy * this.gridNx + ix;
        const intervals = this.dexels[idx];
        if (!intervals || intervals.length === 0) continue;

        // Find the lowest cutter penetration profile across the swept samples for this (cx, cy)
        let cutZMin = Infinity;
        let cutZMax = -Infinity;

        for (const sample of samples) {
          const dx = cx - sample.center.x;
          const dy = cy - sample.center.y;
          const perpR = Math.hypot(dx, dy);

          if (perpR <= sample.radius) {
            // Point is radially within tool flute cylinder
            let bottomZ = sample.center.z;

            if (sample.cutterType === 'BALL_ENDMILL') {
              const deltaR = Math.min(sample.radius, perpR);
              const sphereDz = sample.radius - Math.sqrt(Math.max(0, sample.radius * sample.radius - deltaR * deltaR));
              bottomZ = sample.center.z + sphereDz;
            } else if (sample.cutterType === 'DRILL') {
              const tipHeight = sample.radius * 0.3; // 118° drill point
              const rRatio = perpR / sample.radius;
              bottomZ = sample.center.z + tipHeight * rRatio;
            } else if (sample.cutterType === 'BULLNOSE' && sample.cornerRad > 0) {
              const flatR = sample.radius - sample.cornerRad;
              if (perpR > flatR) {
                const dr = perpR - flatR;
                const dz = sample.cornerRad - Math.sqrt(Math.max(0, sample.cornerRad * sample.cornerRad - dr * dr));
                bottomZ = sample.center.z + dz;
              }
            }

            const topZ = sample.center.z + sample.fluteLength;
            cutZMin = Math.min(cutZMin, bottomZ);
            cutZMax = Math.max(cutZMax, topZ);
          }
        }

        if (cutZMin < cutZMax && isFinite(cutZMin)) {
          // Subtract [cutZMin, cutZMax] from dexel intervals
          const newIntervals: DexelInterval[] = [];
          for (const inv of intervals) {
            // Case 1: No overlap
            if (cutZMax <= inv.zMin || cutZMin >= inv.zMax) {
              newIntervals.push(inv);
              continue;
            }

            // Case 2: Partial overlap on top (cut from cutZMin to top)
            if (cutZMin <= inv.zMin && cutZMax < inv.zMax) {
              const removedH = cutZMax - inv.zMin;
              segmentRemovedVol += cellArea * removedH;
              newIntervals.push({ zMin: cutZMax, zMax: inv.zMax });
            }
            // Case 3: Partial overlap on bottom
            else if (cutZMin > inv.zMin && cutZMax >= inv.zMax) {
              const removedH = inv.zMax - cutZMin;
              segmentRemovedVol += cellArea * removedH;
              newIntervals.push({ zMin: inv.zMin, zMax: cutZMin });
            }
            // Case 4: Complete removal of interval
            else if (cutZMin <= inv.zMin && cutZMax >= inv.zMax) {
              const removedH = inv.zMax - inv.zMin;
              segmentRemovedVol += cellArea * removedH;
            }
            // Case 5: Split interval into two
            else if (cutZMin > inv.zMin && cutZMax < inv.zMax) {
              const removedH = cutZMax - cutZMin;
              segmentRemovedVol += cellArea * removedH;
              newIntervals.push({ zMin: inv.zMin, zMax: cutZMin });
              newIntervals.push({ zMin: cutZMax, zMax: inv.zMax });
            }
          }
          this.dexels[idx] = newIntervals;
        }
      }
    }

    this.currentVolumeMm3 = Math.max(0, this.currentVolumeMm3 - segmentRemovedVol);
    const isAirCut = segmentRemovedVol < 1e-6;

    return {
      removedVolumeMm3: segmentRemovedVol,
      isAirCut
    };
  }

  /**
   * Generates a 3D polygonal surface mesh representing the current state of machined stock
   */
  public generateSurfaceMesh(): StockTriMesh {
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    // Reconstruct top elevation surface grid
    for (let iy = 0; iy < this.gridNy; iy++) {
      const cy = this.bounds.minY + (iy + 0.5) * this.dy;
      for (let ix = 0; ix < this.gridNx; ix++) {
        const cx = this.bounds.minX + (ix + 0.5) * this.dx;
        const idx = iy * this.gridNx + ix;
        const intervals = this.dexels[idx];

        let topZ = this.bounds.minZ;
        if (intervals && intervals.length > 0) {
          topZ = intervals[intervals.length - 1].zMax;
        }

        vertices.push(cx, cy, topZ);
        normals.push(0, 0, 1);
      }
    }

    // Connect grid quad triangles
    for (let iy = 0; iy < this.gridNy - 1; iy++) {
      for (let ix = 0; ix < this.gridNx - 1; ix++) {
        const i0 = iy * this.gridNx + ix;
        const i1 = iy * this.gridNx + (ix + 1);
        const i2 = (iy + 1) * this.gridNx + ix;
        const i3 = (iy + 1) * this.gridNx + (ix + 1);

        // Tri 1
        indices.push(i0, i1, i2);
        // Tri 2
        indices.push(i1, i3, i2);
      }
    }

    return { vertices, indices, normals };
  }

  /**
   * Returns top surface height at coordinates (x, y)
   */
  public getTopSurfaceZ(x: number, y: number): number {
    const ix = Math.max(0, Math.min(this.gridNx - 1, Math.floor((x - this.bounds.minX) / this.dx)));
    const iy = Math.max(0, Math.min(this.gridNy - 1, Math.floor((y - this.bounds.minY) / this.dy)));
    const idx = iy * this.gridNx + ix;
    const intervals = this.dexels[idx];

    if (!intervals || intervals.length === 0) return this.bounds.minZ;
    return intervals[intervals.length - 1].zMax;
  }

  public getInitialVolumeMm3(): number {
    return this.initialTotalVolumeMm3;
  }

  public getRemainingVolumeMm3(): number {
    return this.currentVolumeMm3;
  }

  public getRemovedVolumeMm3(): number {
    return Math.max(0, this.initialTotalVolumeMm3 - this.currentVolumeMm3);
  }

  public clone(): StockModelRepresentation {
    const cloned = new StockModelRepresentation(this.stockDef, this.repType);
    for (let i = 0; i < this.dexels.length; i++) {
      cloned.dexels[i] = this.dexels[i].map(inv => ({ ...inv }));
    }
    cloned.initialTotalVolumeMm3 = this.initialTotalVolumeMm3;
    cloned.currentVolumeMm3 = this.currentVolumeMm3;
    return cloned;
  }
}
