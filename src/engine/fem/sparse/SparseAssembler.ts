import { BAR2Element } from "../elements/BAR2Element";
import { HEX8Element } from "../elements/HEX8Element";
import { QUAD4Element } from "../elements/QUAD4Element";
import { TET4Element } from "../elements/TET4Element";
import { TRI3Element } from "../elements/TRI3Element";
import { MaterialProperties } from "../elements/types";
import { COOBuilder } from "./COOBuilder";
import { SparseMatrix } from "./SparseMatrix";
import { ElementContributionTrace, ZeroPolicy } from "./types";

export interface FEMMeshElementInput {
  id: string;
  type: 'BAR2' | 'TRI3' | 'QUAD4' | 'TET4' | 'HEX8';
  nodeIndices: number[];
  coordinates: number[][];
  material: MaterialProperties;
}

export interface SparseAssemblyResult {
  sparseMatrix: SparseMatrix;
  totalDOFs: number;
  nnz: number;
  assemblyTimeMs: number;
  duplicateAccumulationCount: number;
  contributionTraces: Map<string, ElementContributionTrace>;
  usedDenseFallback: false;
}

export class SparseAssembler {
  /**
   * Directly assembles Global Stiffness Matrix into SparseMatrix from elements
   * Production path: Element -> Local Ke -> Global DOF Map -> COO -> Canonical CSR
   * Strict Rule: ZERO dense intermediate matrix.
   */
  static assembleGlobalStiffness(
    totalDOFs: number,
    dofsPerNode: number,
    elements: FEMMeshElementInput[],
    zeroPolicy: ZeroPolicy = 'RETAIN',
    pruningTolerance: number = 0.0
  ): SparseAssemblyResult {
    const startTime = performance.now();
    const coo = new COOBuilder(totalDOFs, totalDOFs);
    const contributionTraces = new Map<string, ElementContributionTrace>();

    let duplicateAccumulations = 0;
    const coordinateVisitCount = new Map<string, number>();

    for (const elem of elements) {
      // 1. Compute Local Stiffness Ke
      let KeMatrix: number[][];
      let res: any;
      switch (elem.type) {
        case 'BAR2':
          res = BAR2Element.computeStiffness(elem.id, elem.coordinates, elem.material);
          break;
        case 'TRI3':
          res = TRI3Element.computeStiffness(elem.id, elem.coordinates, elem.material);
          break;
        case 'QUAD4':
          res = QUAD4Element.computeStiffness(elem.id, elem.coordinates, elem.material);
          break;
        case 'TET4':
          res = TET4Element.computeStiffness(elem.id, elem.coordinates, elem.material);
          break;
        case 'HEX8':
          res = HEX8Element.computeStiffness(elem.id, elem.coordinates, elem.material);
          break;
        default:
          throw new Error(`Unsupported element type for sparse assembly: ${elem.type}`);
      }
      KeMatrix = res.stiffnessMatrix?.data || res.Ke || res.data || res;

      // 2. Compute Global DOFs for this element
      const elemGlobalDOFs: number[] = [];
      for (const nodeIdx of elem.nodeIndices) {
        for (let d = 0; d < dofsPerNode; d++) {
          elemGlobalDOFs.push(nodeIdx * dofsPerNode + d);
        }
      }

      // 3. Direct insertion into sparse COO accumulator
      const numElemDOFs = elemGlobalDOFs.length;
      for (let i = 0; i < numElemDOFs; i++) {
        const gRow = elemGlobalDOFs[i];
        if (gRow >= totalDOFs) continue;

        for (let j = 0; j < numElemDOFs; j++) {
          const gCol = elemGlobalDOFs[j];
          if (gCol >= totalDOFs) continue;

          const val = KeMatrix[i]?.[j] ?? 0;
          coo.add(gRow, gCol, val);

          // Track duplicate accumulations
          const coordKey = `${gRow},${gCol}`;
          const currentVisits = coordinateVisitCount.get(coordKey) ?? 0;
          if (currentVisits > 0) duplicateAccumulations++;
          coordinateVisitCount.set(coordKey, currentVisits + 1);

          // Track element contribution
          if (!contributionTraces.has(coordKey)) {
            contributionTraces.set(coordKey, {
              globalRow: gRow,
              globalCol: gCol,
              totalValue: 0,
              contributions: []
            });
          }
          const trace = contributionTraces.get(coordKey)!;
          trace.totalValue += val;
          trace.contributions.push({
            elementId: elem.id,
            localRow: i,
            localCol: j,
            value: val
          });
        }
      }
    }

    // 4. Deterministic conversion to Canonical CSR
    const csr = coo.toCSR(zeroPolicy, pruningTolerance);
    const sparseMatrix = new SparseMatrix(csr, 'FINALIZED');
    sparseMatrix.validate();

    const endTime = performance.now();

    return {
      sparseMatrix,
      totalDOFs,
      nnz: sparseMatrix.nnz,
      assemblyTimeMs: Math.max(0.001, endTime - startTime),
      duplicateAccumulationCount: duplicateAccumulations,
      contributionTraces,
      usedDenseFallback: false
    };
  }
}
