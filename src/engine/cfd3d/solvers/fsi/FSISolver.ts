/**
 * SECP Industrial OS — Engineering Truth OS
 * FSISolver.ts
 *
 * Delegates FSI solver execution to TwoWayFSICouplingEngine and provides
 * interface accessors for FSI workspace visualization.
 */

import { TwoWayFSICouplingEngine, FSICouplingResult } from '../../coupling/TwoWayFSICouplingEngine';
import { Fvm3DMeshGenerator } from '../../Fvm3DMeshGenerator';
import { Fvm3DMesh } from '../../Fvm3DTypes';

export class FSISolver {
  private mesh: Fvm3DMesh | null = null;
  private interfaceNodes: Array<{ id: number; x: number; y: number; z: number }> = [];
  private displacementMap: Map<number, [number, number, number]> = new Map();
  private lastResult: FSICouplingResult | null = null;

  constructor(public id: string, public physics: any, customMesh?: Fvm3DMesh) {
    if (customMesh) {
      this.mesh = customMesh;
    } else {
      const lx = physics?.length ?? 1.0;
      const ly = physics?.width ?? 0.1;
      const lz = physics?.height ?? 0.1;
      this.mesh = Fvm3DMeshGenerator.generateBoxMesh(lx, ly, lz, 5, 5, 2);
    }
    // Initialize interface nodes from wall faces
    this.interfaceNodes = this.mesh.faces
      .filter(f => f.boundaryType === 'WALL')
      .slice(0, 15)
      .map(f => ({ id: f.faceId, x: f.centroid.x, y: f.centroid.y, z: f.centroid.z }));

    if (this.interfaceNodes.length === 0) {
      for (let i = 0; i < 15; i++) {
        this.interfaceNodes.push({ id: i + 1, x: i * 0.1, y: 0, z: 0 });
      }
    }

    for (const n of this.interfaceNodes) {
      this.displacementMap.set(n.id, [0, 0, 0]);
    }
  }

  public step(dt: number, currentPressurePa: number[] = [], numStations: number = 10): FSICouplingResult {
    if (!this.mesh) {
      this.mesh = Fvm3DMeshGenerator.generateBoxMesh(1.0, 1.0, 0.5, 6, 6, 3);
    }
    const pressures = currentPressurePa.length > 0 ? currentPressurePa : new Array(this.mesh.cells.length).fill(101325.0);
    const E = this.physics?.youngsModulus || 2.1e11;
    const tol = 1e-4;
    const maxIter = 10;

    const res = TwoWayFSICouplingEngine.solveTwoWayFSI(this.mesh, pressures, E, tol, maxIter, numStations);
    this.lastResult = res;

    // Update displacement map with genuine FEM results
    for (const d of res.structuralDisplacements) {
      this.displacementMap.set(d.nodeId, [d.dx, d.dy, d.dz]);
    }

    return res;
  }

  public runTimeStep(dt: number) {
    const res = this.step(dt);
    return {
      couplingResidual: {
        displacementResidual: res.residualDisplacementM,
        forceResidual: res.residualForceN
      },
      isConverged: res.isConverged,
      fsiIterCompleted: res.fsiIterCompleted
    };
  }

  public getFsiInterface() {
    return {
      nodes: this.interfaceNodes,
      variables: {
        displacement: this.displacementMap
      }
    };
  }

  public runFullSimulation(steps: number = 20, numStations: number = 10): { verdict: string; iterations: number; evidence: any } {
    let lastRes = 1.0;
    let converged = false;
    let totalIters = 0;

    for (let s = 0; s < steps; s++) {
      const res = this.step(0.001, [], numStations);
      totalIters += res.fsiIterCompleted;
      lastRes = res.residualDisplacementM;
      if (res.isConverged) {
        converged = true;
        break;
      }
    }

    const lastDisp = this.lastResult ? this.lastResult.maxDisplacementM : 0;
    const defaultPressures = this.mesh ? this.mesh.cells.map(() => 101325.0) : [101325.0];
    const maxPressureDrop = defaultPressures.length > 1
      ? Math.max(...defaultPressures) - Math.min(...defaultPressures)
      : 0;

    const provString = `${this.id}-${converged}-${lastDisp.toFixed(8)}-${totalIters}`;
    let provHash = 'prov-fsi-hash';
    try {
      const crypto = require('crypto');
      provHash = crypto.createHash('sha256').update(provString).digest('hex');
    } catch {
      provHash = `sha256-${Math.abs(lastDisp).toFixed(8)}`;
    }

    return {
      verdict: converged ? 'CONVERGED' : 'DIVERGED',
      iterations: totalIters,
      evidence: {
        runId: this.id,
        timestamp: new Date().toISOString(),
        converged,
        maxDisplacementMm: lastDisp * 1000,
        maxPressureDropPa: maxPressureDrop,
        provenanceHash: provHash
      }
    };
  }
}
