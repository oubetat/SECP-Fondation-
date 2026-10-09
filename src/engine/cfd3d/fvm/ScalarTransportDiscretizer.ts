/**
 * SECP Industrial OS v2 — CFD FVM Engine
 * Scalar Transport Discretizer
 * Assembles the linear system: A * phi = b
 * Equation: d(rho*u*phi)/dx = d(Gamma*d(phi)/dx)/dx + Source
 */

import { FvmMesh3D, Vector3D } from '../Fvm3DTypes';
import { LinearSystem } from '../linear-solvers/LinearSystem';
import { SparseMatrix } from '../linear-solvers/SparseMatrix';
import { SparseVector } from '../linear-solvers/SparseVector';

export interface ScalarTransportConfig {
  phiName: string;
  rho: number[];
  u: Vector3D[];
  gamma: number[]; // Diffusion coefficient (e.g. mu_t / sigma)
  source: number[];
  relaxation: number;
}

export class ScalarTransportDiscretizer {
  public static assemble(
    mesh: FvmMesh3D,
    config: ScalarTransportConfig,
    phi: number[]
  ): LinearSystem {
    const numCells = mesh.cells.length;
    const matrix = new SparseMatrix(numCells, numCells);
    const b = new Array(numCells).fill(0);

    for (const face of mesh.faces) {
      const owner = face.ownerCellId;
      const neighbor = face.neighborCellId;

      if (neighbor === -1) {
        // Boundary condition (Simplified Dirichlet)
        const d_bc = Math.sqrt(
          Math.pow(face.centroid.x - mesh.cells[owner].centroid.x, 2) +
          Math.pow(face.centroid.y - mesh.cells[owner].centroid.y, 2) +
          Math.pow(face.centroid.z - mesh.cells[owner].centroid.z, 2)
        );
        const gamma_f = config.gamma[owner];
        const diffFlux = (gamma_f * face.area) / Math.max(d_bc, 1e-6);

        // Fixed value boundary (Wall = 0 for k, specific for omega)
        matrix.add(owner, owner, diffFlux);
        // Source term b remains 0 for k wall, but could be adjusted for others
        continue;
      }

      // 1. Convection (Upwind)
      const rho_f = 0.5 * (config.rho[owner] + config.rho[neighbor]);
      const u_f = {
        x: 0.5 * (config.u[owner].x + config.u[neighbor].x),
        y: 0.5 * (config.u[owner].y + config.u[neighbor].y),
        z: 0.5 * (config.u[owner].z + config.u[neighbor].z)
      };
      const flux = rho_f * (u_f.x * face.normal.x + u_f.y * face.normal.y + u_f.z * face.normal.z) * face.area;

      const a_conv_owner = Math.max(flux, 0);
      const a_conv_neighbor = Math.max(-flux, 0);

      // 2. Diffusion
      const dOwner = Math.sqrt(
        Math.pow(face.centroid.x - mesh.cells[owner].centroid.x, 2) +
        Math.pow(face.centroid.y - mesh.cells[owner].centroid.y, 2) +
        Math.pow(face.centroid.z - mesh.cells[owner].centroid.z, 2)
      );
      const dNeighbor = Math.sqrt(
        Math.pow(face.centroid.x - mesh.cells[neighbor].centroid.x, 2) +
        Math.pow(face.centroid.y - mesh.cells[neighbor].centroid.y, 2) +
        Math.pow(face.centroid.z - mesh.cells[neighbor].centroid.z, 2)
      );
      const dTotal = dOwner + dNeighbor;
      
      const gamma_f = 0.5 * (config.gamma[owner] + config.gamma[neighbor]);
      const diffFlux = (gamma_f * face.area) / dTotal;

      // Matrix coefficients
      // a_P * phi_P + Sum(a_N * phi_N) = b
      matrix.add(owner, neighbor, -(a_conv_neighbor + diffFlux));
      matrix.add(neighbor, owner, -(a_conv_owner + diffFlux));

      matrix.add(owner, owner, (a_conv_owner + diffFlux));
      matrix.add(neighbor, neighbor, (a_conv_neighbor + diffFlux));
    }

    // 3. Source terms and Relaxation
    for (let i = 0; i < numCells; i++) {
      b[i] = config.source[i] * mesh.cells[i].volume;
      
      // Implicit source handling (linearization S = Sc + Sp * phi)
      // For now, source is treated as explicit Sc
      
      // Relaxation
      const ap = matrix.get(i, i);
      matrix.set(i, i, ap / config.relaxation);
      b[i] += (1.0 - config.relaxation) * (ap / config.relaxation) * phi[i];
    }

    return {
      matrix,
      rhs: new SparseVector(b),
      initialGuess: new SparseVector(phi)
    };
  }
}
