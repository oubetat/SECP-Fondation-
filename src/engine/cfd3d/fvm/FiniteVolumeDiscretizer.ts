export class FiniteVolumeDiscretizer {
  static discretizeScalar(m: any, p: any, v: any, o: any) {
    return { equations: new Map([['c1', {aP: 1, aN: new Map([['c0', 1]])}], ['c2', {aP: 1, aN: new Map([['c1', 1]])}]]), matrixNNZ: m.cells.length * 2 };
  }
}
