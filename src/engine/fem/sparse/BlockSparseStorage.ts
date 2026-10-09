import { CSRStorage } from "./CSRStorage";

export interface BCSRData {
  rows: number;
  cols: number;
  blockRowSize: number;
  blockColSize: number;
  numBlockRows: number;
  numBlockCols: number;
  numNonzeroBlocks: number;
  blockValues: Float64Array; // size: numNonzeroBlocks * (blockRowSize * blockColSize)
  blockColIndices: Int32Array; // size: numNonzeroBlocks
  blockRowPointers: Int32Array; // size: numBlockRows + 1
}

export class BlockSparseStorage {
  readonly rows: number;
  readonly cols: number;
  readonly blockRowSize: number;
  readonly blockColSize: number;
  readonly numBlockRows: number;
  readonly numBlockCols: number;
  readonly numNonzeroBlocks: number;
  readonly blockValues: Float64Array;
  readonly blockColIndices: Int32Array;
  readonly blockRowPointers: Int32Array;
  readonly status: 'FOUNDATION' = 'FOUNDATION';

  constructor(data: BCSRData) {
    this.rows = data.rows;
    this.cols = data.cols;
    this.blockRowSize = data.blockRowSize;
    this.blockColSize = data.blockColSize;
    this.numBlockRows = data.numBlockRows;
    this.numBlockCols = data.numBlockCols;
    this.numNonzeroBlocks = data.numNonzeroBlocks;
    this.blockValues = data.blockValues;
    this.blockColIndices = data.blockColIndices;
    this.blockRowPointers = data.blockRowPointers;
  }

  /**
   * Constructs Block Sparse storage from standard CSR storage given block dimensions
   * (e.g. 3x3 for 3D structural elasticity DOFs)
   */
  static fromCSR(csr: CSRStorage, blockRowSize: number = 3, blockColSize: number = 3): BlockSparseStorage {
    const numBlockRows = Math.ceil(csr.rows / blockRowSize);
    const numBlockCols = Math.ceil(csr.cols / blockColSize);
    const blockSize = blockRowSize * blockColSize;

    // Track active blocks
    const blockMap = new Map<string, number[]>(); // key: `${br},${bc}` -> values array
    for (let r = 0; r < csr.rows; r++) {
      const br = Math.floor(r / blockRowSize);
      const localR = r % blockRowSize;
      const start = csr.rowPointers[r];
      const end = csr.rowPointers[r + 1];

      for (let idx = start; idx < end; idx++) {
        const c = csr.columnIndices[idx];
        const val = csr.values[idx];
        const bc = Math.floor(c / blockColSize);
        const localC = c % blockColSize;

        const key = `${br},${bc}`;
        if (!blockMap.has(key)) {
          blockMap.set(key, new Array(blockSize).fill(0));
        }
        const blk = blockMap.get(key)!;
        blk[localR * blockColSize + localC] += val;
      }
    }

    const numNonzeroBlocks = blockMap.size;
    const blockValues = new Float64Array(numNonzeroBlocks * blockSize);
    const blockColIndices = new Int32Array(numNonzeroBlocks);
    const blockRowPointers = new Int32Array(numBlockRows + 1);

    // Group blocks by blockRow
    const rowBlocks: { bc: number; data: number[] }[][] = Array.from({ length: numBlockRows }, () => []);
    for (const [key, data] of blockMap.entries()) {
      const [brStr, bcStr] = key.split(',');
      const br = parseInt(brStr, 10);
      const bc = parseInt(bcStr, 10);
      rowBlocks[br].push({ bc, data });
    }

    let blkIdx = 0;
    blockRowPointers[0] = 0;

    for (let br = 0; br < numBlockRows; br++) {
      const list = rowBlocks[br].sort((a, b) => a.bc - b.bc);
      for (const item of list) {
        blockColIndices[blkIdx] = item.bc;
        for (let k = 0; k < blockSize; k++) {
          blockValues[blkIdx * blockSize + k] = item.data[k];
        }
        blkIdx++;
      }
      blockRowPointers[br + 1] = blkIdx;
    }

    return new BlockSparseStorage({
      rows: csr.rows,
      cols: csr.cols,
      blockRowSize,
      blockColSize,
      numBlockRows,
      numBlockCols,
      numNonzeroBlocks,
      blockValues,
      blockColIndices,
      blockRowPointers
    });
  }
}
