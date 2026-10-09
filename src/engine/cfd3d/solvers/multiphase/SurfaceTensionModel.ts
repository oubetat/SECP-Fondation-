/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-252 — Continuum Surface Force (CSF) & Contact Angle Model
 */

export class SurfaceTensionModel {
  /**
   * Calculates gradient of alpha_1 for all cells.
   * grad(alpha) = [d_alpha/dx, d_alpha/dy, d_alpha/dz]
   */
  public static computeAlphaGradients(
    alpha: number[],
    size: number,
    dx: number,
    nx: number,
    ny: number,
    nz: number,
    neighborsList: number[][]
  ): [number, number, number][] {
    const gradients: [number, number, number][] = Array.from({ length: size }, () => [0, 0, 0]);

    for (let i = 0; i < size; i++) {
      const z = Math.floor(i / (nx * ny));
      const y = Math.floor((i % (nx * ny)) / nx);
      const x = i % nx;

      let dadx = 0;
      let dady = 0;
      let dadz = 0;

      // X-direction central/forward/backward difference
      if (x > 0 && x < nx - 1) {
        dadx = (alpha[i + 1] - alpha[i - 1]) / (2 * dx);
      } else if (x > 0) {
        dadx = (alpha[i] - alpha[i - 1]) / dx;
      } else if (x < nx - 1 && i + 1 < size) {
        dadx = (alpha[i + 1] - alpha[i]) / dx;
      }

      // Y-direction difference
      if (y > 0 && y < ny - 1 && i + nx < size && i - nx >= 0) {
        dady = (alpha[i + nx] - alpha[i - nx]) / (2 * dx);
      } else if (y > 0 && i - nx >= 0) {
        dady = (alpha[i] - alpha[i - nx]) / dx;
      } else if (y < ny - 1 && i + nx < size) {
        dady = (alpha[i + nx] - alpha[i]) / dx;
      }

      // Z-direction difference
      const layerOffset = nx * ny;
      if (z > 0 && z < nz - 1 && i + layerOffset < size && i - layerOffset >= 0) {
        dadz = (alpha[i + layerOffset] - alpha[i - layerOffset]) / (2 * dx);
      } else if (z > 0 && i - layerOffset >= 0) {
        dadz = (alpha[i] - alpha[i - layerOffset]) / dx;
      } else if (z < nz - 1 && i + layerOffset < size) {
        dadz = (alpha[i + layerOffset] - alpha[i]) / dx;
      }

      gradients[i] = [dadx, dady, dadz];
    }

    return gradients;
  }

  /**
   * Computes interface normals and curvature: kappa = -div(n)
   * Where n = grad(alpha) / |grad(alpha)|
   */
  public static computeCurvatureAndForces(
    alpha: number[],
    sigma: number,
    staticContactAngle: number, // degrees
    dx: number,
    nx: number,
    ny: number,
    nz: number,
    neighborsList: number[][]
  ): {
    normals: [number, number, number][];
    curvature: number[];
    surfaceForces: [number, number, number][];
  } {
    const size = alpha.length;
    const gradients = this.computeAlphaGradients(alpha, size, dx, nx, ny, nz, neighborsList);
    const normals: [number, number, number][] = Array.from({ length: size }, () => [0, 0, 0]);
    const curvature = new Array(size).fill(0.0);
    const surfaceForces: [number, number, number][] = Array.from({ length: size }, () => [0, 0, 0]);

    // 1. Calculate and normalize interface normals, applying contact angle on boundaries
    const thetaRad = (staticContactAngle * Math.PI) / 180.0;
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);

    for (let i = 0; i < size; i++) {
      const grad = gradients[i];
      const mag = Math.sqrt(grad[0] * grad[0] + grad[1] * grad[1] + grad[2] * grad[2]);

      // Detect if touching a physical wall boundary to apply wall wetting / contact angle
      const z = Math.floor(i / (nx * ny));
      const y = Math.floor((i % (nx * ny)) / nx);
      const x = i % nx;
      const isBoundaryWall = (x === 0 || x === nx - 1 || y === 0 || y === ny - 1 || z === 0 || z === nz - 1);

      if (mag > 1e-5) {
        if (isBoundaryWall) {
          // Adjust interface normal based on wall normal n_wall and contact angle
          // Assume wall normal is pointing inwards or outwards
          const wallNormal: [number, number, number] = [0, 0, 0];
          if (x === 0) wallNormal[0] = 1;
          else if (x === nx - 1) wallNormal[0] = -1;
          else if (y === 0) wallNormal[1] = 1;
          else if (y === ny - 1) wallNormal[1] = -1;
          else if (z === 0) wallNormal[2] = 1;
          else if (z === nz - 1) wallNormal[2] = -1;

          // Wall-adherent modified normal: n = n_wall * cos(theta) + t_wall * sin(theta)
          const proj = grad[0]*wallNormal[0] + grad[1]*wallNormal[1] + grad[2]*wallNormal[2];
          const tangent: [number, number, number] = [
            grad[0] - proj * wallNormal[0],
            grad[1] - proj * wallNormal[1],
            grad[2] - proj * wallNormal[2]
          ];
          const tanMag = Math.sqrt(tangent[0]*tangent[0] + tangent[1]*tangent[1] + tangent[2]*tangent[2]) || 1;
          const tHat = tangent.map(v => v / tanMag);

          normals[i] = [
            wallNormal[0] * cosTheta + tHat[0] * sinTheta,
            wallNormal[1] * cosTheta + tHat[1] * sinTheta,
            wallNormal[2] * cosTheta + tHat[2] * sinTheta
          ];
        } else {
          normals[i] = [grad[0] / mag, grad[1] / mag, grad[2] / mag];
        }
      } else {
        normals[i] = [0, 0, 0];
      }
    }

    // 2. Compute curvature as kappa = -div(n)
    for (let i = 0; i < size; i++) {
      const z = Math.floor(i / (nx * ny));
      const y = Math.floor((i % (nx * ny)) / nx);
      const x = i % nx;

      let dndx = 0;
      let dndy = 0;
      let dndz = 0;

      // X-component divergence
      if (x > 0 && x < nx - 1) {
        dndx = (normals[i + 1][0] - normals[i - 1][0]) / (2 * dx);
      }
      // Y-component divergence
      if (y > 0 && y < ny - 1 && i + nx < size && i - nx >= 0) {
        dndy = (normals[i + nx][1] - normals[i - nx][1]) / (2 * dx);
      }
      // Z-component divergence
      const layerOffset = nx * ny;
      if (z > 0 && z < nz - 1 && i + layerOffset < size && i - layerOffset >= 0) {
        dndz = (normals[i + layerOffset][2] - normals[i - layerOffset][2]) / (2 * dx);
      }

      // kappa = -div(n)
      curvature[i] = -(dndx + dndy + dndz);

      // Curvature cap for numeric boundedness
      if (Math.abs(curvature[i]) > 2.0 / dx) {
        curvature[i] = Math.sign(curvature[i]) * (2.0 / dx);
      }
    }

    // 3. Compute Continuum Surface Force (CSF): F_sf = sigma * kappa * grad(alpha)
    for (let i = 0; i < size; i++) {
      const grad = gradients[i];
      const kappa = curvature[i];

      surfaceForces[i] = [
        sigma * kappa * grad[0],
        sigma * kappa * grad[1],
        sigma * kappa * grad[2]
      ];
    }

    return { normals, curvature, surfaceForces };
  }
}
