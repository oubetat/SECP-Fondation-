import { FEMMesh } from './FEMMesh';
import { FEMNode } from './FEMNode';
import { FEMElement, FEMElementType } from './FEMElement';
import { FEMBoundary } from './FEMBoundary';
import { FEMRegion } from './FEMRegion';
import { FEMConnectivityBuilder } from './FEMConnectivity';

export interface MeshGenerationParams {
  geometryType: 'RECTANGLE' | 'PLATE_WITH_HOLE' | 'BOX' | 'CYLINDER' | string;
  elementType?: 'BAR' | 'TRI' | 'QUAD' | 'TET' | 'HEX' | string;
  elementSize: number;
  dimensions: Record<string, number>;
}

export class FEMMeshGenerator {
  /**
   * Deterministic 8-character hex hash from an arbitrary string.
   */
  private static hash8(str: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
  }

  /**
   * Primary mesh generation dispatch based on geometry type and element type.
   */
  public static generate(params: MeshGenerationParams): FEMMesh {
    const geom = (params.geometryType || 'BOX').toUpperCase();
    const elemType = (params.elementType || (geom === 'BOX' || geom === 'CYLINDER' ? 'TET' : 'TRI')).toUpperCase() as FEMElementType;
    const elemSize = Math.max(0.02, params.elementSize || 0.2);
    const dims = params.dimensions || {};

    let mesh: FEMMesh;

    if (geom === 'RECTANGLE') {
      mesh = this.generateRectangle(dims.width || 1.0, dims.height || 1.0, elemSize, elemType);
    } else if (geom === 'PLATE_WITH_HOLE') {
      mesh = this.generatePlateWithHole(dims.width || 2.0, dims.height || 1.0, dims.holeRadius || 0.25, elemSize, elemType);
    } else if (geom === 'CYLINDER') {
      mesh = this.generateCylinder(dims.radius || 0.5, dims.height || 1.0, elemSize);
    } else {
      // Default to 3D BOX
      mesh = this.generateBox(dims.dx || 1.0, dims.dy || 1.0, dims.dz || 1.0, elemSize, elemType);
    }

    // Assign deterministic hashes
    const geomStr = `${geom}_${JSON.stringify(dims)}_${elemSize}`;
    const topoStr = mesh.elements.map(e => `${e.type}:${e.nodeIds.join(',')}`).join('|');
    const nodeStr = mesh.nodes.map(n => `${n.id}:${n.x.toFixed(4)},${n.y.toFixed(4)},${n.z.toFixed(4)}`).join(';');

    mesh.geometryHash = this.hash8(geomStr);
    mesh.topologyHash = this.hash8(topoStr);
    mesh.qualityHash = this.hash8(`${mesh.nodes.length}_${mesh.elements.length}`);
    mesh.meshHash = this.hash8(`${mesh.geometryHash}_${mesh.topologyHash}`);

    // Build connectivity
    mesh.connectivity = FEMConnectivityBuilder.build(mesh.nodes, mesh.elements);

    return mesh;
  }

  /**
   * Generates a 2D planar rectangle mesh (TRI or QUAD).
   */
  private static generateRectangle(width: number, height: number, size: number, elemType: FEMElementType): FEMMesh {
    const nx = Math.max(2, Math.round(width / size));
    const ny = Math.max(2, Math.round(height / size));
    const dx = width / nx;
    const dy = height / ny;

    const nodes: FEMNode[] = [];
    const elements: FEMElement[] = [];
    const nodeGrid: string[][] = [];

    let nodeCount = 0;
    for (let j = 0; j <= ny; j++) {
      const row: string[] = [];
      const y = j * dy;
      for (let i = 0; i <= nx; i++) {
        const x = i * dx;
        const id = `n_${++nodeCount}`;
        nodes.push(new FEMNode(id, x, y, 0));
        row.push(id);
      }
      nodeGrid.push(row);
    }

    let elemCount = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const n00 = nodeGrid[j][i];
        const n10 = nodeGrid[j][i + 1];
        const n11 = nodeGrid[j + 1][i + 1];
        const n01 = nodeGrid[j + 1][i];

        if (elemType === 'QUAD') {
          elements.push({
            id: `e_${++elemCount}`,
            type: 'QUAD',
            nodeIds: [n00, n10, n11, n01],
            regionId: 'REG_CORE',
            materialId: 'MAT_STEEL',
          });
        } else {
          // TRI elements with counter-clockwise winding
          elements.push({
            id: `e_${++elemCount}`,
            type: 'TRI',
            nodeIds: [n00, n10, n11],
            regionId: 'REG_CORE',
            materialId: 'MAT_STEEL',
          });
          elements.push({
            id: `e_${++elemCount}`,
            type: 'TRI',
            nodeIds: [n00, n11, n01],
            regionId: 'REG_CORE',
            materialId: 'MAT_STEEL',
          });
        }
      }
    }

    const boundaries: FEMBoundary[] = [
      {
        id: 'BND_BOTTOM',
        name: 'Fixed Base',
        tag: 'FIXED_SUPPORT',
        nodeIds: nodeGrid[0],
        elementIds: elements.slice(0, nx).map(e => e.id),
      },
      {
        id: 'BND_TOP',
        name: 'Loaded Edge',
        tag: 'LOAD_FACE',
        nodeIds: nodeGrid[ny],
        elementIds: elements.slice(-nx).map(e => e.id),
      },
    ];

    return new FEMMesh({
      id: `RECT_${width}x${height}`,
      nodes,
      elements,
      boundaries,
      regions: [{ id: 'REG_CORE', name: 'Planar Domain', materialId: 'MAT_STEEL', properties: { thickness: 0.01 } }],
      timestamp: Date.now(),
    });
  }

  /**
   * Generates a plate with a circular hole, strictly keeping nodes outside the hole radius.
   */
  private static generatePlateWithHole(width: number, height: number, holeRadius: number, size: number, elemType: FEMElementType): FEMMesh {
    const cx = width / 2;
    const cy = height / 2;
    const nx = Math.max(4, Math.round(width / size));
    const ny = Math.max(4, Math.round(height / size));
    const dx = width / nx;
    const dy = height / ny;

    // Track which grid vertices are outside the hole
    const nodes: FEMNode[] = [];
    const nodeMap = new Map<string, string>(); // "i_j" -> nodeId
    let nodeCount = 0;

    for (let j = 0; j <= ny; j++) {
      const y = j * dy;
      for (let i = 0; i <= nx; i++) {
        const x = i * dx;
        const dist = Math.hypot(x - cx, y - cy);
        // Exclude vertices inside the hole (with 1e-3 buffer)
        if (dist >= holeRadius - 1e-3) {
          const id = `n_${++nodeCount}`;
          nodes.push(new FEMNode(id, x, y, 0));
          nodeMap.set(`${i}_${j}`, id);
        }
      }
    }

    // Assemble elements whose 4 (or 3) vertices all exist and are outside the hole
    const elements: FEMElement[] = [];
    let elemCount = 0;

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const n00 = nodeMap.get(`${i}_${j}`);
        const n10 = nodeMap.get(`${i + 1}_${j}`);
        const n11 = nodeMap.get(`${i + 1}_${j + 1}`);
        const n01 = nodeMap.get(`${i}_${j + 1}`);

        // Cell is fully valid if all 4 corners exist
        if (n00 && n10 && n11 && n01) {
          // Check center of cell is also outside
          const cellCenterX = (i + 0.5) * dx;
          const cellCenterY = (j + 0.5) * dy;
          if (Math.hypot(cellCenterX - cx, cellCenterY - cy) >= holeRadius * 0.8) {
            if (elemType === 'QUAD') {
              elements.push({
                id: `e_${++elemCount}`,
                type: 'QUAD',
                nodeIds: [n00, n10, n11, n01],
                regionId: 'REG_CORE',
                materialId: 'MAT_STEEL',
              });
            } else {
              elements.push({
                id: `e_${++elemCount}`,
                type: 'TRI',
                nodeIds: [n00, n10, n11],
                regionId: 'REG_CORE',
                materialId: 'MAT_STEEL',
              });
              elements.push({
                id: `e_${++elemCount}`,
                type: 'TRI',
                nodeIds: [n00, n11, n01],
                regionId: 'REG_CORE',
                materialId: 'MAT_STEEL',
              });
            }
          }
        } else if (elemType !== 'QUAD') {
          // If only 3 corners exist, generate a transition triangle if outside hole
          if (n00 && n10 && n11) {
            elements.push({
              id: `e_${++elemCount}`,
              type: 'TRI',
              nodeIds: [n00, n10, n11],
              regionId: 'REG_CORE',
              materialId: 'MAT_STEEL',
            });
          } else if (n00 && n11 && n01) {
            elements.push({
              id: `e_${++elemCount}`,
              type: 'TRI',
              nodeIds: [n00, n11, n01],
              regionId: 'REG_CORE',
              materialId: 'MAT_STEEL',
            });
          }
        }
      }
    }

    // Eliminate any orphan nodes that aren't in any element
    const usedNodeIds = new Set<string>();
    elements.forEach(e => e.nodeIds.forEach(id => usedNodeIds.add(id)));
    const cleanNodes = nodes.filter(n => usedNodeIds.has(n.id));

    // Left and Right boundaries
    const leftNodes = cleanNodes.filter(n => Math.abs(n.x) < 1e-4).map(n => n.id);
    const rightNodes = cleanNodes.filter(n => Math.abs(n.x - width) < 1e-4).map(n => n.id);

    const boundaries: FEMBoundary[] = [
      { id: 'BND_LEFT', name: 'Fixed Left Edge', tag: 'FIXED_SUPPORT', nodeIds: leftNodes, elementIds: [] },
      { id: 'BND_RIGHT', name: 'Tension Load Edge', tag: 'LOAD_FACE', nodeIds: rightNodes, elementIds: [] },
    ];

    return new FEMMesh({
      id: `PLATE_HOLE_${width}x${height}_R${holeRadius}`,
      nodes: cleanNodes,
      elements,
      boundaries,
      regions: [{ id: 'REG_CORE', name: 'Perforated Plate', materialId: 'MAT_STEEL', properties: { thickness: 0.01 } }],
      timestamp: Date.now(),
    });
  }

  /**
   * Generates a 3D box solid volume mesh (TET or HEX).
   */
  private static generateBox(dx: number, dy: number, dz: number, size: number, elemType: FEMElementType): FEMMesh {
    const nx = Math.max(1, Math.round(dx / size));
    const ny = Math.max(1, Math.round(dy / size));
    const nz = Math.max(1, Math.round(dz / size));
    const stepX = dx / nx;
    const stepY = dy / ny;
    const stepZ = dz / nz;

    const nodes: FEMNode[] = [];
    const grid: string[][][] = [];
    let nodeCount = 0;

    for (let k = 0; k <= nz; k++) {
      const plane: string[][] = [];
      const z = k * stepZ;
      for (let j = 0; j <= ny; j++) {
        const row: string[] = [];
        const y = j * stepY;
        for (let i = 0; i <= nx; i++) {
          const x = i * stepX;
          const id = `n_${++nodeCount}`;
          nodes.push(new FEMNode(id, x, y, z));
          row.push(id);
        }
        plane.push(row);
      }
      grid.push(plane);
    }

    const elements: FEMElement[] = [];
    let elemCount = 0;

    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const v0 = grid[k][j][i];
          const v1 = grid[k][j][i + 1];
          const v2 = grid[k][j + 1][i + 1];
          const v3 = grid[k][j + 1][i];
          const v4 = grid[k + 1][j][i];
          const v5 = grid[k + 1][j][i + 1];
          const v6 = grid[k + 1][j + 1][i + 1];
          const v7 = grid[k + 1][j + 1][i];

          if (elemType === 'HEX') {
            elements.push({
              id: `e_${++elemCount}`,
              type: 'HEX',
              nodeIds: [v0, v1, v2, v3, v4, v5, v6, v7],
              regionId: 'REG_CORE',
              materialId: 'MAT_STEEL',
            });
          } else {
            // Standard 5-Tetrahedron volume decomposition (strictly non-inverted)
            // Tet 1: (v0, v1, v3, v4)
            elements.push({ id: `e_${++elemCount}`, type: 'TET', nodeIds: [v0, v1, v3, v4], regionId: 'REG_CORE', materialId: 'MAT_STEEL' });
            // Tet 2: (v1, v2, v3, v6)
            elements.push({ id: `e_${++elemCount}`, type: 'TET', nodeIds: [v1, v2, v3, v6], regionId: 'REG_CORE', materialId: 'MAT_STEEL' });
            // Tet 3: (v1, v4, v5, v6)
            elements.push({ id: `e_${++elemCount}`, type: 'TET', nodeIds: [v1, v4, v5, v6], regionId: 'REG_CORE', materialId: 'MAT_STEEL' });
            // Tet 4: (v3, v4, v6, v7)
            elements.push({ id: `e_${++elemCount}`, type: 'TET', nodeIds: [v3, v4, v6, v7], regionId: 'REG_CORE', materialId: 'MAT_STEEL' });
            // Tet 5: (v1, v3, v4, v6)
            elements.push({ id: `e_${++elemCount}`, type: 'TET', nodeIds: [v1, v3, v4, v6], regionId: 'REG_CORE', materialId: 'MAT_STEEL' });
          }
        }
      }
    }

    const baseNodes = grid[0].flatMap(r => r);
    const topNodes = grid[nz].flatMap(r => r);
    const frontNodes = grid.flatMap(plane => plane[0]);
    const backNodes = grid.flatMap(plane => plane[ny]);
    const leftNodes = grid.flatMap(plane => plane.map(row => row[0]));
    const rightNodes = grid.flatMap(plane => plane.map(row => row[nx]));

    const boundaries: FEMBoundary[] = [
      { 
        id: 'BND_BASE', 
        name: 'Fixed Floor (-Z / Bottom Face)', 
        tag: 'FIXED_SUPPORT', 
        nodeIds: baseNodes, 
        elementIds: [],
        normal: { x: 0, y: 0, z: -1 },
        centroid: { x: dx / 2, y: dy / 2, z: 0 },
        area: dx * dy
      },
      { 
        id: 'BND_TOP', 
        name: 'Upper Face Load (+Z / Top Face)', 
        tag: 'LOAD_FACE', 
        nodeIds: topNodes, 
        elementIds: [],
        normal: { x: 0, y: 0, z: 1 },
        centroid: { x: dx / 2, y: dy / 2, z: dz },
        area: dx * dy
      },
      { 
        id: 'BND_FRONT', 
        name: 'Front Face (-Y)', 
        tag: 'PRESSURE_FACE', 
        nodeIds: frontNodes, 
        elementIds: [],
        normal: { x: 0, y: -1, z: 0 },
        centroid: { x: dx / 2, y: 0, z: dz / 2 },
        area: dx * dz
      },
      { 
        id: 'BND_BACK', 
        name: 'Back Face (+Y)', 
        tag: 'PRESSURE_FACE', 
        nodeIds: backNodes, 
        elementIds: [],
        normal: { x: 0, y: 1, z: 0 },
        centroid: { x: dx / 2, y: dy, z: dz / 2 },
        area: dx * dz
      },
      { 
        id: 'BND_LEFT', 
        name: 'Left Face (-X)', 
        tag: 'FIXED_SUPPORT', 
        nodeIds: leftNodes, 
        elementIds: [],
        normal: { x: -1, y: 0, z: 0 },
        centroid: { x: 0, y: dy / 2, z: dz / 2 },
        area: dy * dz
      },
      { 
        id: 'BND_RIGHT', 
        name: 'Right Face (+X)', 
        tag: 'LOAD_FACE', 
        nodeIds: rightNodes, 
        elementIds: [],
        normal: { x: 1, y: 0, z: 0 },
        centroid: { x: dx, y: dy / 2, z: dz / 2 },
        area: dy * dz
      },
    ];

    return new FEMMesh({
      id: `BOX_${dx}x${dy}x${dz}`,
      nodes,
      elements,
      boundaries,
      regions: [{ id: 'REG_CORE', name: 'Solid Volume', materialId: 'MAT_STEEL', properties: {} }],
      timestamp: Date.now(),
    });
  }

  /**
   * Generates a 3D cylinder solid mesh.
   */
  private static generateCylinder(radius: number, height: number, size: number): FEMMesh {
    const numSlices = Math.max(6, Math.round((2 * Math.PI * radius) / size));
    const numLayers = Math.max(2, Math.round(height / size));
    const stepZ = height / numLayers;

    const nodes: FEMNode[] = [];
    const layerCenters: string[] = [];
    const ringNodes: string[][] = [];
    let nodeCount = 0;

    for (let k = 0; k <= numLayers; k++) {
      const z = k * stepZ;
      const cId = `n_c_${k}`;
      nodes.push(new FEMNode(cId, 0, 0, z));
      layerCenters.push(cId);

      const ring: string[] = [];
      for (let s = 0; s < numSlices; s++) {
        const theta = (s * 2 * Math.PI) / numSlices;
        const x = radius * Math.cos(theta);
        const y = radius * Math.sin(theta);
        const rId = `n_${++nodeCount}`;
        nodes.push(new FEMNode(rId, x, y, z));
        ring.push(rId);
      }
      ringNodes.push(ring);
    }

    const elements: FEMElement[] = [];
    let elemCount = 0;

    for (let k = 0; k < numLayers; k++) {
      const c0 = layerCenters[k];
      const c1 = layerCenters[k + 1];
      const r0 = ringNodes[k];
      const r1 = ringNodes[k + 1];

      for (let s = 0; s < numSlices; s++) {
        const sNext = (s + 1) % numSlices;
        const p0 = r0[s];
        const p1 = r0[sNext];
        const q0 = r1[s];
        const q1 = r1[sNext];

        // Tetrahedral decomposition of the wedge sector
        elements.push({ id: `e_${++elemCount}`, type: 'TET', nodeIds: [c0, p0, p1, c1], regionId: 'REG_CORE', materialId: 'MAT_STEEL' });
        elements.push({ id: `e_${++elemCount}`, type: 'TET', nodeIds: [p0, p1, q0, c1], regionId: 'REG_CORE', materialId: 'MAT_STEEL' });
        elements.push({ id: `e_${++elemCount}`, type: 'TET', nodeIds: [p1, q0, q1, c1], regionId: 'REG_CORE', materialId: 'MAT_STEEL' });
      }
    }

    const baseNodes = [layerCenters[0], ...ringNodes[0]];
    const topNodes = [layerCenters[numLayers], ...ringNodes[numLayers]];

    const boundaries: FEMBoundary[] = [
      { id: 'BND_CYL_BASE', name: 'Cylinder Base', tag: 'FIXED_SUPPORT', nodeIds: baseNodes, elementIds: [] },
      { id: 'BND_CYL_TOP', name: 'Cylinder Top', tag: 'LOAD_FACE', nodeIds: topNodes, elementIds: [] },
    ];

    return new FEMMesh({
      id: `CYL_R${radius}_H${height}`,
      nodes,
      elements,
      boundaries,
      regions: [{ id: 'REG_CORE', name: 'Cylindrical Core', materialId: 'MAT_STEEL', properties: {} }],
      timestamp: Date.now(),
    });
  }

  /**
   * Generates a structured Hexahedral (HEX8) solid volume mesh.
   * Required for SparseMatrixBenchmarks and HardAcceptanceGate235.
   */
  public static generateHexMesh(params: { length: number; width: number; height: number; nx: number; ny: number; nz: number }): FEMMesh {
    const { length, width, height, nx, ny, nz } = params;
    const dx = length / nx;
    const dy = width / ny;
    const dz = height / nz;

    const nodes: FEMNode[] = [];
    const grid: string[][][] = [];
    let nodeCount = 0;

    for (let k = 0; k <= nz; k++) {
      const plane: string[][] = [];
      const z = k * dz;
      for (let j = 0; j <= ny; j++) {
        const row: string[] = [];
        const y = j * dy;
        for (let i = 0; i <= nx; i++) {
          const x = i * dx;
          const id = `n_${++nodeCount}`;
          nodes.push(new FEMNode(id, x, y, z));
          row.push(id);
        }
        plane.push(row);
      }
      grid.push(plane);
    }

    const elements: FEMElement[] = [];
    let elemCount = 0;

    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const v0 = grid[k][j][i];
          const v1 = grid[k][j][i + 1];
          const v2 = grid[k][j + 1][i + 1];
          const v3 = grid[k][j + 1][i];
          const v4 = grid[k + 1][j][i];
          const v5 = grid[k + 1][j][i + 1];
          const v6 = grid[k + 1][j + 1][i + 1];
          const v7 = grid[k + 1][j + 1][i];

          elements.push({
            id: `e_${++elemCount}`,
            type: 'HEX',
            nodeIds: [v0, v1, v2, v3, v4, v5, v6, v7],
            regionId: 'REG_CORE',
            materialId: 'MAT_STEEL',
          });
        }
      }
    }

    const baseNodes = grid[0].flatMap(r => r);
    const topNodes = grid[nz].flatMap(r => r);
    const frontNodes = grid.flatMap(plane => plane[0]);
    const backNodes = grid.flatMap(plane => plane[ny]);
    const leftNodes = grid.flatMap(plane => plane.map(row => row[0]));
    const rightNodes = grid.flatMap(plane => plane.map(row => row[nx]));

    const boundaries: FEMBoundary[] = [
      { 
        id: 'BND_BASE', 
        name: 'Base Fixed Support (-Z)', 
        tag: 'FIXED_SUPPORT', 
        nodeIds: baseNodes, 
        elementIds: [],
        normal: { x: 0, y: 0, z: -1 },
        centroid: { x: length / 2, y: width / 2, z: 0 },
        area: length * width
      },
      { 
        id: 'BND_TOP', 
        name: 'Top Face Force (+Z)', 
        tag: 'LOAD_FACE', 
        nodeIds: topNodes, 
        elementIds: [],
        normal: { x: 0, y: 0, z: 1 },
        centroid: { x: length / 2, y: width / 2, z: height },
        area: length * width
      },
      { 
        id: 'BND_FRONT', 
        name: 'Front Face (-Y)', 
        tag: 'PRESSURE_FACE', 
        nodeIds: frontNodes, 
        elementIds: [],
        normal: { x: 0, y: -1, z: 0 },
        centroid: { x: length / 2, y: 0, z: height / 2 },
        area: length * height
      },
      { 
        id: 'BND_BACK', 
        name: 'Back Face (+Y)', 
        tag: 'PRESSURE_FACE', 
        nodeIds: backNodes, 
        elementIds: [],
        normal: { x: 0, y: 1, z: 0 },
        centroid: { x: length / 2, y: width, z: height / 2 },
        area: length * height
      },
      { 
        id: 'BND_LEFT', 
        name: 'Left Face (-X)', 
        tag: 'FIXED_SUPPORT', 
        nodeIds: leftNodes, 
        elementIds: [],
        normal: { x: -1, y: 0, z: 0 },
        centroid: { x: 0, y: width / 2, z: height / 2 },
        area: width * height
      },
      { 
        id: 'BND_RIGHT', 
        name: 'Right Face (+X)', 
        tag: 'LOAD_FACE', 
        nodeIds: rightNodes, 
        elementIds: [],
        normal: { x: 1, y: 0, z: 0 },
        centroid: { x: length, y: width / 2, z: height / 2 },
        area: width * height
      },
    ];

    const mesh = new FEMMesh({
      id: `HEX_${nx}x${ny}x${nz}`,
      nodes,
      elements,
      boundaries,
      regions: [{ id: 'REG_CORE', name: 'Hex Volume', materialId: 'MAT_STEEL', properties: {} }],
      timestamp: Date.now(),
    });

    const geomStr = `HEX_${length}_${width}_${height}_${nx}_${ny}_${nz}`;
    const topoStr = elements.map(e => e.nodeIds.join(',')).join('|');
    mesh.geometryHash = this.hash8(geomStr);
    mesh.topologyHash = this.hash8(topoStr);
    mesh.qualityHash = this.hash8(`${nodes.length}_${elements.length}`);
    mesh.meshHash = this.hash8(`${mesh.geometryHash}_${mesh.topologyHash}`);
    mesh.connectivity = FEMConnectivityBuilder.build(mesh.nodes, mesh.elements);

    return mesh;
  }
}
