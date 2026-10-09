import { FEMMeshElementInput, SparseAssembler } from "./SparseAssembler";
import { DenseReferenceMatrix } from "./DenseReferenceMatrix";
import { SparseMemoryProfiler } from "./SparseMemoryProfiler";
import { MaterialProperties } from "../elements/types";
import { SparseMatrixOperations } from "./SparseMatrixOperations";

export interface BenchmarkMeshResult {
  meshType: string;
  numNodes: number;
  totalDOFs: number;
  numElements: number;
  sparseNNZ: number;
  sparseDensity: number;
  sparseAssemblyTimeMs: number;
  denseAssemblyTimeMs: number | null;
  sparseMemoryBytes: number;
  denseMemoryBytes: number;
  memorySavingsPercent: number;
  sparseSpMVTimeMs: number;
  denseSpMVTimeMs: number | null;
}

export class SparseBenchmarkSuite {
  private static defaultMat: MaterialProperties = {
    E: 200e9,
    nu: 0.3,
    thickness: 0.01,
    area: 0.001
  };

  /**
   * Generates a 1D Bar grid
   */
  static generate1DBar(numElements: number): { elements: FEMMeshElementInput[]; numNodes: number; totalDOFs: number } {
    const numNodes = numElements + 1;
    const totalDOFs = numNodes;
    const elements: FEMMeshElementInput[] = [];

    for (let e = 0; e < numElements; e++) {
      elements.push({
        id: `BAR1D_${e}`,
        type: 'BAR2',
        nodeIndices: [e, e + 1],
        coordinates: [
          [e * 1.0],
          [(e + 1) * 1.0]
        ],
        material: this.defaultMat
      });
    }

    return { elements, numNodes, totalDOFs };
  }

  /**
   * Generates a 2D Quad mesh grid (nx x ny)
   */
  static generate2DQuadGrid(nx: number, ny: number): { elements: FEMMeshElementInput[]; numNodes: number; totalDOFs: number } {
    const numNodes = (nx + 1) * (ny + 1);
    const totalDOFs = numNodes * 2; // 2 DOFs per node (ux, uy)
    const elements: FEMMeshElementInput[] = [];

    let elemId = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const n0 = j * (nx + 1) + i;
        const n1 = j * (nx + 1) + (i + 1);
        const n2 = (j + 1) * (nx + 1) + (i + 1);
        const n3 = (j + 1) * (nx + 1) + i;

        const x0 = i, y0 = j;
        const x1 = i + 1, y1 = j;
        const x2 = i + 1, y2 = j + 1;
        const x3 = i, y3 = j + 1;

        elements.push({
          id: `QUAD_${elemId++}`,
          type: 'QUAD4',
          nodeIndices: [n0, n1, n2, n3],
          coordinates: [
            [x0, y0],
            [x1, y1],
            [x2, y2],
            [x3, y3]
          ],
          material: this.defaultMat
        });
      }
    }

    return { elements, numNodes, totalDOFs };
  }

  /**
   * Generates a 3D Hex mesh grid (nx x ny x nz)
   */
  static generate3DHexGrid(nx: number, ny: number, nz: number): { elements: FEMMeshElementInput[]; numNodes: number; totalDOFs: number } {
    const numNodes = (nx + 1) * (ny + 1) * (nz + 1);
    const totalDOFs = numNodes * 3; // 3 DOFs per node (ux, uy, uz)
    const elements: FEMMeshElementInput[] = [];

    const nodeIndex = (i: number, j: number, k: number) => {
      return k * (nx + 1) * (ny + 1) + j * (nx + 1) + i;
    };

    let elemId = 0;
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const n0 = nodeIndex(i, j, k);
          const n1 = nodeIndex(i + 1, j, k);
          const n2 = nodeIndex(i + 1, j + 1, k);
          const n3 = nodeIndex(i, j + 1, k);
          const n4 = nodeIndex(i, j, k + 1);
          const n5 = nodeIndex(i + 1, j, k + 1);
          const n6 = nodeIndex(i + 1, j + 1, k + 1);
          const n7 = nodeIndex(i, j + 1, k + 1);

          elements.push({
            id: `HEX_${elemId++}`,
            type: 'HEX8',
            nodeIndices: [n0, n1, n2, n3, n4, n5, n6, n7],
            coordinates: [
              [i, j, k],
              [i + 1, j, k],
              [i + 1, j + 1, k],
              [i, j + 1, k],
              [i, j, k + 1],
              [i + 1, j, k + 1],
              [i + 1, j + 1, k + 1],
              [i, j + 1, k + 1]
            ],
            material: this.defaultMat
          });
        }
      }
    }

    return { elements, numNodes, totalDOFs };
  }

  /**
   * Runs the complete benchmark suite
   */
  static runSuite(): BenchmarkMeshResult[] {
    const results: BenchmarkMeshResult[] = [];

    // Configuration 1: 1D Bar (Small, 50 elements)
    const barSmall = this.generate1DBar(50);
    results.push(this.benchmarkConfig("1D Bar (50 elems)", barSmall.elements, barSmall.totalDOFs, 1, true));

    // Configuration 2: 1D Bar (Medium, 500 elements)
    const barMed = this.generate1DBar(500);
    results.push(this.benchmarkConfig("1D Bar (500 elems)", barMed.elements, barMed.totalDOFs, 1, false));

    // Configuration 3: 2D Quad Grid (Small 5x5, 25 quads, 72 DOFs)
    const quadSmall = this.generate2DQuadGrid(5, 5);
    results.push(this.benchmarkConfig("2D Quad 5x5 (25 elems, 72 DOFs)", quadSmall.elements, quadSmall.totalDOFs, 2, true));

    // Configuration 4: 2D Quad Grid (Medium 20x20, 400 quads, 882 DOFs)
    const quadMed = this.generate2DQuadGrid(20, 20);
    results.push(this.benchmarkConfig("2D Quad 20x20 (400 elems, 882 DOFs)", quadMed.elements, quadMed.totalDOFs, 2, false));

    // Configuration 5: 3D Hex Grid (Small 3x3x3, 27 hexes, 192 DOFs)
    const hexSmall = this.generate3DHexGrid(3, 3, 3);
    results.push(this.benchmarkConfig("3D Hex 3x3x3 (27 elems, 192 DOFs)", hexSmall.elements, hexSmall.totalDOFs, 3, true));

    // Configuration 6: 3D Hex Grid (Medium 6x6x6, 216 hexes, 1029 DOFs)
    const hexMed = this.generate3DHexGrid(6, 6, 6);
    results.push(this.benchmarkConfig("3D Hex 6x6x6 (216 elems, 1029 DOFs)", hexMed.elements, hexMed.totalDOFs, 3, false));

    return results;
  }

  private static benchmarkConfig(
    meshType: string,
    elements: FEMMeshElementInput[],
    totalDOFs: number,
    dofsPerNode: number,
    runDense: boolean
  ): BenchmarkMeshResult {
    // 1. Sparse Assembly
    const sparseRes = SparseAssembler.assembleGlobalStiffness(totalDOFs, dofsPerNode, elements);
    const sparseMatrix = sparseRes.sparseMatrix;
    const memory = SparseMemoryProfiler.profile(sparseMatrix.storage);

    // SpMV benchmark on sparse
    const testVec = new Float64Array(totalDOFs).fill(1.0);
    const spmvStart = performance.now();
    for (let iter = 0; iter < 100; iter++) {
      sparseMatrix.spmv(testVec);
    }
    const spmvTimeMs = (performance.now() - spmvStart) / 100;

    // Dense comparison if enabled
    let denseAssemblyTimeMs: number | null = null;
    let denseSpMVTimeMs: number | null = null;

    if (runDense && totalDOFs <= 1200) {
      const dStart = performance.now();
      const dense = new DenseReferenceMatrix(totalDOFs, totalDOFs);
      // Populate dense from elements
      for (const elem of elements) {
        let Ke: number[][];
        if (elem.type === 'BAR2') Ke = [[elem.material.E * 0.001, -elem.material.E * 0.001], [-elem.material.E * 0.001, elem.material.E * 0.001]];
        else Ke = Array.from({ length: elem.nodeIndices.length * dofsPerNode }, () => new Array(elem.nodeIndices.length * dofsPerNode).fill(1.0));
        
        const gDOFs: number[] = [];
        for (const n of elem.nodeIndices) {
          for (let d = 0; d < dofsPerNode; d++) gDOFs.push(n * dofsPerNode + d);
        }
        dense.addBlock(gDOFs, gDOFs, Ke);
      }
      denseAssemblyTimeMs = performance.now() - dStart;

      const dspmvStart = performance.now();
      for (let iter = 0; iter < 100; iter++) {
        dense.multiplyVector(testVec);
      }
      denseSpMVTimeMs = (performance.now() - dspmvStart) / 100;
    }

    return {
      meshType,
      numNodes: Math.floor(totalDOFs / dofsPerNode),
      totalDOFs,
      numElements: elements.length,
      sparseNNZ: sparseMatrix.nnz,
      sparseDensity: sparseMatrix.density,
      sparseAssemblyTimeMs: sparseRes.assemblyTimeMs,
      denseAssemblyTimeMs,
      sparseMemoryBytes: memory.totalSparseBytes,
      denseMemoryBytes: memory.denseEquivalentBytes,
      memorySavingsPercent: memory.savingsPercentage,
      sparseSpMVTimeMs: spmvTimeMs,
      denseSpMVTimeMs
    };
  }
}
