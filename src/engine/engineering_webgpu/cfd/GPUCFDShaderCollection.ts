/**
 * GPUCFDShaderCollection.ts
 * High-performance WGSL Compute Shaders for WebGPU CFD Computational Kernels (PATCH-299)
 */

export class GPUCFDShaderCollection {
  /**
   * 1. Green-Gauss Gradient Kernel: Computes cell gradient ∇φ = (1/V_P) * sum_f (φ_f * S_f)
   */
  public static readonly GRADIENT_GAUSS_WGSL = /* wgsl */ `
    struct MeshParams {
      numCells: u32,
      numFaces: u32,
      dimension: u32,
      pad: u32,
    };

    @group(0) @binding(0) var<uniform> params: MeshParams;
    @group(0) @binding(1) var<storage, read> cellVolumes: array<f32>;
    @group(0) @binding(2) var<storage, read> cellFaceOffsets: array<u32>;
    @group(0) @binding(3) var<storage, read> cellFaceIndices: array<u32>;
    @group(0) @binding(4) var<storage, read> cellFaceSigns: array<i32>;
    @group(0) @binding(5) var<storage, read> faceAreaVectors: array<vec4<f32>>; // [Sx, Sy, Sz, pad]
    @group(0) @binding(6) var<storage, read> faceScalarValues: array<f32>;
    @group(0) @binding(7) var<storage, read_write> cellGradients: array<vec4<f32>>; // [dPhi/dx, dPhi/dy, dPhi/dz, mag]

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let cellIdx = global_id.x;
      if (cellIdx >= params.numCells) {
        return;
      }

      let V_P = cellVolumes[cellIdx];
      if (V_P <= 1e-12) {
        cellGradients[cellIdx] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
        return;
      }

      let startFace = cellFaceOffsets[cellIdx];
      let endFace = cellFaceOffsets[cellIdx + 1u];

      var gradSum = vec3<f32>(0.0, 0.0, 0.0);

      for (var i = startFace; i < endFace; i = i + 1u) {
        let faceIdx = cellFaceIndices[i];
        let signVal = f32(cellFaceSigns[i]);
        let S_f = faceAreaVectors[faceIdx].xyz * signVal;
        let phi_f = faceScalarValues[faceIdx];

        gradSum = gradSum + phi_f * S_f;
      }

      let grad = gradSum / V_P;
      let mag = length(grad);
      cellGradients[cellIdx] = vec4<f32>(grad.x, grad.y, grad.z, mag);
    }
  `;

  /**
   * 2. Green-Gauss Divergence Kernel: Computes velocity field divergence ∇·u = (1/V_P) * sum_f (u_f · S_f)
   */
  public static readonly DIVERGENCE_GAUSS_WGSL = /* wgsl */ `
    struct MeshParams {
      numCells: u32,
      numFaces: u32,
      dimension: u32,
      pad: u32,
    };

    @group(0) @binding(0) var<uniform> params: MeshParams;
    @group(0) @binding(1) var<storage, read> cellVolumes: array<f32>;
    @group(0) @binding(2) var<storage, read> cellFaceOffsets: array<u32>;
    @group(0) @binding(3) var<storage, read> cellFaceIndices: array<u32>;
    @group(0) @binding(4) var<storage, read> cellFaceSigns: array<i32>;
    @group(0) @binding(5) var<storage, read> faceAreaVectors: array<vec4<f32>>;
    @group(0) @binding(6) var<storage, read> faceVelocities: array<vec4<f32>>; // [u, v, w, pad]
    @group(0) @binding(7) var<storage, read_write> cellDivergence: array<f32>;

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let cellIdx = global_id.x;
      if (cellIdx >= params.numCells) {
        return;
      }

      let V_P = cellVolumes[cellIdx];
      if (V_P <= 1e-12) {
        cellDivergence[cellIdx] = 0.0;
        return;
      }

      let startFace = cellFaceOffsets[cellIdx];
      let endFace = cellFaceOffsets[cellIdx + 1u];

      var divSum: f32 = 0.0;

      for (var i = startFace; i < endFace; i = i + 1u) {
        let faceIdx = cellFaceIndices[i];
        let signVal = f32(cellFaceSigns[i]);
        let S_f = faceAreaVectors[faceIdx].xyz * signVal;
        let u_f = faceVelocities[faceIdx].xyz;

        divSum = divSum + dot(u_f, S_f);
      }

      cellDivergence[cellIdx] = divSum / V_P;
    }
  `;

  /**
   * 3. Vorticity / Curl Kernel: Computes ω = ∇ × u = (dw/dy - dv/dz, du/dz - dw/dx, dv/dx - du/dy)
   */
  public static readonly VORTICITY_CURL_WGSL = /* wgsl */ `
    struct Params {
      numCells: u32,
      pad0: u32,
      pad1: u32,
      pad2: u32,
    };

    @group(0) @binding(0) var<uniform> params: Params;
    @group(0) @binding(1) var<storage, read> gradU: array<vec4<f32>>; // [du/dx, du/dy, du/dz, 0]
    @group(0) @binding(2) var<storage, read> gradV: array<vec4<f32>>; // [dv/dx, dv/dy, dv/dz, 0]
    @group(0) @binding(3) var<storage, read> gradW: array<vec4<f32>>; // [dw/dx, dw/dy, dw/dz, 0]
    @group(0) @binding(4) var<storage, read_write> vorticity: array<vec4<f32>>; // [wx, wy, wz, mag]

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let idx = global_id.x;
      if (idx >= params.numCells) {
        return;
      }

      let gu = gradU[idx].xyz;
      let gv = gradV[idx].xyz;
      let gw = gradW[idx].xyz;

      let wx = gw.y - gv.z;
      let wy = gu.z - gw.x;
      let wz = gv.x - gu.y;
      let mag = sqrt(wx * wx + wy * wy + wz * wz);

      vorticity[idx] = vec4<f32>(wx, wy, wz, mag);
    }
  `;

  /**
   * 4. Discretized FVM Laplacian Kernel: ∇·(Γ ∇φ) = (1/V_P) * sum_f Γ_f * ((φ_N - φ_P) / |d_PN|) * |S_f|
   */
  public static readonly LAPLACIAN_WGSL = /* wgsl */ `
    struct LaplaceParams {
      numCells: u32,
      numFaces: u32,
      gamma: f32,
      pad: u32,
    };

    @group(0) @binding(0) var<uniform> params: LaplaceParams;
    @group(0) @binding(1) var<storage, read> cellVolumes: array<f32>;
    @group(0) @binding(2) var<storage, read> cellCenters: array<vec4<f32>>;
    @group(0) @binding(3) var<storage, read> faceOwner: array<i32>;
    @group(0) @binding(4) var<storage, read> faceNeighbor: array<i32>;
    @group(0) @binding(5) var<storage, read> faceAreas: array<f32>;
    @group(0) @binding(6) var<storage, read> cellPhi: array<f32>;
    @group(0) @binding(7) var<storage, read> boundaryFacePhi: array<f32>; // Pre-evaluated boundary values
    @group(0) @binding(8) var<storage, read> cellFaceOffsets: array<u32>;
    @group(0) @binding(9) var<storage, read> cellFaceIndices: array<u32>;
    @group(0) @binding(10) var<storage, read_write> cellLaplacian: array<f32>;

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let cellIdx = global_id.x;
      if (cellIdx >= params.numCells) {
        return;
      }

      let V_P = cellVolumes[cellIdx];
      if (V_P <= 1e-12) {
        cellLaplacian[cellIdx] = 0.0;
        return;
      }

      let xP = cellCenters[cellIdx].xyz;
      let phiP = cellPhi[cellIdx];

      let startFace = cellFaceOffsets[cellIdx];
      let endFace = cellFaceOffsets[cellIdx + 1u];

      var lapSum: f32 = 0.0;

      for (var i = startFace; i < endFace; i = i + 1u) {
        let faceIdx = cellFaceIndices[i];
        let owner = faceOwner[faceIdx];
        let neigh = faceNeighbor[faceIdx];
        let A_f = faceAreas[faceIdx];

        var phiN: f32 = 0.0;
        var dist: f32 = 1e-6;

        if (neigh >= 0) {
          let otherIdx = select(owner, neigh, owner == i32(cellIdx));
          let xN = cellCenters[otherIdx].xyz;
          dist = max(1e-6, distance(xP, xN));
          phiN = cellPhi[otherIdx];
        } else {
          // Boundary face
          phiN = boundaryFacePhi[faceIdx];
          dist = max(1e-6, distance(xP, cellCenters[cellIdx].xyz + vec3<f32>(0.001))); // approximate boundary distance
        }

        let fluxDiff = params.gamma * (phiN - phiP) / dist * A_f;
        lapSum = lapSum + fluxDiff;
      }

      cellLaplacian[cellIdx] = lapSum / V_P;
    }
  `;

  /**
   * 5. Face Interpolation Kernel: Central Differencing & Upwind
   */
  public static readonly FACE_INTERPOLATION_WGSL = /* wgsl */ `
    struct InterpParams {
      numFaces: u32,
      scheme: u32, // 0 = Central Differencing, 1 = Upwind (UDS)
      pad0: u32,
      pad1: u32,
    };

    @group(0) @binding(0) var<uniform> params: InterpParams;
    @group(0) @binding(1) var<storage, read> faceOwner: array<i32>;
    @group(0) @binding(2) var<storage, read> faceNeighbor: array<i32>;
    @group(0) @binding(3) var<storage, read> cellScalar: array<f32>;
    @group(0) @binding(4) var<storage, read> faceMassFlux: array<f32>; // F_f
    @group(0) @binding(5) var<storage, read> boundaryValues: array<f32>;
    @group(0) @binding(6) var<storage, read_write> faceScalarOut: array<f32>;

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let faceIdx = global_id.x;
      if (faceIdx >= params.numFaces) {
        return;
      }

      let owner = faceOwner[faceIdx];
      let neigh = faceNeighbor[faceIdx];

      if (neigh < 0) {
        // Boundary face: take prescribed boundary value
        faceScalarOut[faceIdx] = boundaryValues[faceIdx];
        return;
      }

      let phiP = cellScalar[owner];
      let phiN = cellScalar[neigh];
      let F_f = faceMassFlux[faceIdx];

      if (params.scheme == 1u) {
        // Upwind Differencing Scheme (UDS) based on mass flux sign
        if (F_f >= 0.0) {
          faceScalarOut[faceIdx] = phiP;
        } else {
          faceScalarOut[faceIdx] = phiN;
        }
      } else {
        // Central Differencing Scheme (CDS: 50/50 linear average)
        faceScalarOut[faceIdx] = 0.5 * (phiP + phiN);
      }
    }
  `;

  /**
   * 6. Convective & Diffusive Face Fluxes:
   * Computes F_conv = F_f * phi_f, F_diff = Gamma * (phi_N - phi_P) / |d_PN| * A_f
   */
  public static readonly CONVECTIVE_DIFFUSIVE_FLUX_WGSL = /* wgsl */ `
    struct FluxParams {
      numFaces: u32,
      gamma: f32,
      pad0: u32,
      pad1: u32,
    };

    @group(0) @binding(0) var<uniform> params: FluxParams;
    @group(0) @binding(1) var<storage, read> faceOwner: array<i32>;
    @group(0) @binding(2) var<storage, read> faceNeighbor: array<i32>;
    @group(0) @binding(3) var<storage, read> faceAreas: array<f32>;
    @group(0) @binding(4) var<storage, read> cellCenters: array<vec4<f32>>;
    @group(0) @binding(5) var<storage, read> cellPhi: array<f32>;
    @group(0) @binding(6) var<storage, read> faceMassFlux: array<f32>; // F_f
    @group(0) @binding(7) var<storage, read> facePhi: array<f32>;
    @group(0) @binding(8) var<storage, read_write> convectiveFlux: array<f32>;
    @group(0) @binding(9) var<storage, read_write> diffusiveFlux: array<f32>;
    @group(0) @binding(10) var<storage, read_write> totalFlux: array<f32>;

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let faceIdx = global_id.x;
      if (faceIdx >= params.numFaces) {
        return;
      }

      let F_f = faceMassFlux[faceIdx];
      let phi_f = facePhi[faceIdx];
      let f_conv = F_f * phi_f;
      convectiveFlux[faceIdx] = f_conv;

      let owner = faceOwner[faceIdx];
      let neigh = faceNeighbor[faceIdx];
      let A_f = faceAreas[faceIdx];

      var f_diff: f32 = 0.0;
      if (neigh >= 0) {
        let xP = cellCenters[owner].xyz;
        let xN = cellCenters[neigh].xyz;
        let dist = max(1e-6, distance(xP, xN));
        let phiP = cellPhi[owner];
        let phiN = cellPhi[neigh];

        f_diff = params.gamma * (phiN - phiP) / dist * A_f;
      } else {
        f_diff = 0.0;
      }

      diffusiveFlux[faceIdx] = f_diff;
      totalFlux[faceIdx] = f_conv - f_diff;
    }
  `;

  /**
   * 7. Momentum Equation Assembly & Diagonal Coefficients
   * Computes diagonal a_P, source term -V_P * grad(p), and momentum residuals
   */
  public static readonly MOMENTUM_ASSEMBLY_WGSL = /* wgsl */ `
    struct MomParams {
      numCells: u32,
      density: f32,
      viscosity: f32,
      relaxFactor: f32,
    };

    @group(0) @binding(0) var<uniform> params: MomParams;
    @group(0) @binding(1) var<storage, read> cellVolumes: array<f32>;
    @group(0) @binding(2) var<storage, read> cellFaceOffsets: array<u32>;
    @group(0) @binding(3) var<storage, read> cellFaceIndices: array<u32>;
    @group(0) @binding(4) var<storage, read> cellFaceSigns: array<i32>;
    @group(0) @binding(5) var<storage, read> faceMassFlux: array<f32>;
    @group(0) @binding(6) var<storage, read> faceAreas: array<f32>;
    @group(0) @binding(7) var<storage, read> cellVelocities: array<vec4<f32>>; // [u, v, w, 0]
    @group(0) @binding(8) var<storage, read> cellPressureGradients: array<vec4<f32>>; // [dp/dx, dp/dy, dp/dz, 0]
    @group(0) @binding(9) var<storage, read_write> diagonalCoeffs: array<f32>; // a_P
    @group(0) @binding(10) var<storage, read_write> momentumResiduals: array<vec4<f32>>; // [Rx, Ry, Rz, |R|]

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let cellIdx = global_id.x;
      if (cellIdx >= params.numCells) {
        return;
      }

      let V_P = cellVolumes[cellIdx];
      let u_P = cellVelocities[cellIdx].xyz;
      let gradP = cellPressureGradients[cellIdx].xyz;

      let startFace = cellFaceOffsets[cellIdx];
      let endFace = cellFaceOffsets[cellIdx + 1u];

      var sum_a_nb: f32 = 0.0;
      var convSum = vec3<f32>(0.0, 0.0, 0.0);

      for (var i = startFace; i < endFace; i = i + 1u) {
        let faceIdx = cellFaceIndices[i];
        let signVal = f32(cellFaceSigns[i]);
        let F_f = faceMassFlux[faceIdx] * signVal;
        let A_f = faceAreas[faceIdx];

        // Central / Hybrid coefficient
        let a_nb = max(0.0, -F_f) + params.viscosity * A_f / max(1e-5, pow(V_P, 0.3333));
        sum_a_nb = sum_a_nb + a_nb;

        convSum = convSum + F_f * u_P;
      }

      let a_P = sum_a_nb / params.relaxFactor;
      diagonalCoeffs[cellIdx] = max(1e-6, a_P);

      // Pressure gradient source term
      let sourceP = -V_P * gradP;

      // Residual R = b - A*u
      let Res = sourceP - convSum;
      let magR = length(Res);

      momentumResiduals[cellIdx] = vec4<f32>(Res.x, Res.y, Res.z, magR);
    }
  `;

  /**
   * 8. Continuity Mass Imbalance Residual Kernel: R_cont = sum_f F_f
   */
  public static readonly CONTINUITY_RESIDUAL_WGSL = /* wgsl */ `
    struct Params {
      numCells: u32,
      pad0: u32,
      pad1: u32,
      pad2: u32,
    };

    @group(0) @binding(0) var<uniform> params: Params;
    @group(0) @binding(1) var<storage, read> cellFaceOffsets: array<u32>;
    @group(0) @binding(2) var<storage, read> cellFaceIndices: array<u32>;
    @group(0) @binding(3) var<storage, read> cellFaceSigns: array<i32>;
    @group(0) @binding(4) var<storage, read> faceMassFlux: array<f32>;
    @group(0) @binding(5) var<storage, read_write> continuityResiduals: array<f32>;

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let cellIdx = global_id.x;
      if (cellIdx >= params.numCells) {
        return;
      }

      let startFace = cellFaceOffsets[cellIdx];
      let endFace = cellFaceOffsets[cellIdx + 1u];

      var massImbalance: f32 = 0.0;

      for (var i = startFace; i < endFace; i = i + 1u) {
        let faceIdx = cellFaceIndices[i];
        let signVal = f32(cellFaceSigns[i]);
        let F_f = faceMassFlux[faceIdx] * signVal;
        massImbalance = massImbalance + F_f;
      }

      continuityResiduals[cellIdx] = massImbalance;
    }
  `;

  /**
   * 9. Pressure-Velocity Correction & Rhie-Chow Interpolation (SIMPLE Kernel)
   * Assembles Poisson source terms b_P = - sum_f F_f* and computes velocity correction u_P = u_P* - (V_P / a_P) * grad(p')
   */
  public static readonly PRESSURE_VELOCITY_CORRECTION_WGSL = /* wgsl */ `
    struct SimpleParams {
      numCells: u32,
      numFaces: u32,
      alphaP: f32,
      alphaU: f32,
    };

    @group(0) @binding(0) var<uniform> params: SimpleParams;
    @group(0) @binding(1) var<storage, read> cellVolumes: array<f32>;
    @group(0) @binding(2) var<storage, read> diagonalCoeffs: array<f32>; // a_P^u
    @group(0) @binding(3) var<storage, read> cellPressureCorrections: array<f32>; // p'
    @group(0) @binding(4) var<storage, read> cellPressureGradPrime: array<vec4<f32>>; // grad(p')
    @group(0) @binding(5) var<storage, read_write> cellPressures: array<f32>; // p = p* + alphaP * p'
    @group(0) @binding(6) var<storage, read_write> cellVelocities: array<vec4<f32>>; // u = u* - (V_P / a_P) * grad(p')

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let cellIdx = global_id.x;
      if (cellIdx >= params.numCells) {
        return;
      }

      let V_P = cellVolumes[cellIdx];
      let a_P = max(1e-6, diagonalCoeffs[cellIdx]);
      let p_prime = cellPressureCorrections[cellIdx];
      let gradP_prime = cellPressureGradPrime[cellIdx].xyz;

      // 1. Update Pressure
      let p_old = cellPressures[cellIdx];
      cellPressures[cellIdx] = p_old + params.alphaP * p_prime;

      // 2. Correct Velocity: u = u* - (V_P / a_P) * grad(p')
      let u_star = cellVelocities[cellIdx].xyz;
      let u_corr = u_star - (V_P / a_P) * gradP_prime;

      cellVelocities[cellIdx] = vec4<f32>(u_corr.x, u_corr.y, u_corr.z, length(u_corr));
    }
  `;

  /**
   * 10. Face Mass Flux Correction: F_f = F_f* + d_f * (p'_P - p'_N)
   */
  public static readonly FLUX_CORRECTION_WGSL = /* wgsl */ `
    struct FluxCorrParams {
      numFaces: u32,
      density: f32,
      pad0: u32,
      pad1: u32,
    };

    @group(0) @binding(0) var<uniform> params: FluxCorrParams;
    @group(0) @binding(1) var<storage, read> faceOwner: array<i32>;
    @group(0) @binding(2) var<storage, read> faceNeighbor: array<i32>;
    @group(0) @binding(3) var<storage, read> faceAreas: array<f32>;
    @group(0) @binding(4) var<storage, read> cellCenters: array<vec4<f32>>;
    @group(0) @binding(5) var<storage, read> diagonalCoeffs: array<f32>; // a_P
    @group(0) @binding(6) var<storage, read> cellPressureCorrections: array<f32>; // p'
    @group(0) @binding(7) var<storage, read_write> faceMassFlux: array<f32>; // F_f

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let faceIdx = global_id.x;
      if (faceIdx >= params.numFaces) {
        return;
      }

      let owner = faceOwner[faceIdx];
      let neigh = faceNeighbor[faceIdx];

      if (neigh < 0) {
        // Boundary face mass flux remains unchanged or prescribed
        return;
      }

      let pPrimeP = cellPressureCorrections[owner];
      let pPrimeN = cellPressureCorrections[neigh];

      let aP = max(1e-6, diagonalCoeffs[owner]);
      let aN = max(1e-6, diagonalCoeffs[neigh]);
      let a_f = 0.5 * (aP + aN);

      let xP = cellCenters[owner].xyz;
      let xN = cellCenters[neigh].xyz;
      let dist = max(1e-6, distance(xP, xN));
      let A_f = faceAreas[faceIdx];

      // Rhie-Chow d_f coefficient: d_f = rho * A_f^2 / a_f
      let d_f = params.density * A_f / (a_f * dist);

      let F_star = faceMassFlux[faceIdx];
      let F_corr = F_star + d_f * (pPrimeP - pPrimeN);

      faceMassFlux[faceIdx] = F_corr;
    }
  `;

  /**
   * 11. RANS Turbulence Model Kernel (k-epsilon / k-omega production, dissipation & eddy viscosity)
   * S_ij = 0.5 * (du_i/dx_j + du_j/dx_i), P_k = 2 * mu_t * S_ij S_ij, mu_t = rho * C_mu * k^2 / eps
   */
  public static readonly RANS_TURBULENCE_WGSL = /* wgsl */ `
    struct RANSParams {
      numCells: u32,
      modelType: u32, // 0 = k-epsilon, 1 = k-omega
      density: f32,
      C_mu: f32,
    };

    @group(0) @binding(0) var<uniform> params: RANSParams;
    @group(0) @binding(1) var<storage, read> gradU: array<vec4<f32>>; // [du/dx, du/dy, du/dz, 0]
    @group(0) @binding(2) var<storage, read> gradV: array<vec4<f32>>; // [dv/dx, dv/dy, dv/dz, 0]
    @group(0) @binding(3) var<storage, read> gradW: array<vec4<f32>>; // [dw/dx, dw/dy, dw/dz, 0]
    @group(0) @binding(4) var<storage, read> turbulentKE: array<f32>; // k
    @group(0) @binding(5) var<storage, read> turbulentDissipation: array<f32>; // eps or omega
    @group(0) @binding(6) var<storage, read_write> turbulentViscosity: array<f32>; // mu_t
    @group(0) @binding(7) var<storage, read_write> turbulenceProduction: array<f32>; // P_k

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let cellIdx = global_id.x;
      if (cellIdx >= params.numCells) {
        return;
      }

      let gu = gradU[cellIdx].xyz;
      let gv = gradV[cellIdx].xyz;
      let gw = gradW[cellIdx].xyz;

      // Rate of strain tensor S_ij
      let Sxx = gu.x;
      let Syy = gv.y;
      let Szz = gw.z;
      let Sxy = 0.5 * (gu.y + gv.x);
      let Sxz = 0.5 * (gu.z + gw.x);
      let Syz = 0.5 * (gv.z + gw.y);

      let S2 = 2.0 * (Sxx * Sxx + Syy * Syy + Szz * Szz + 2.0 * (Sxy * Sxy + Sxz * Sxz + Syz * Syz));

      let k = max(1e-10, turbulentKE[cellIdx]);
      let diss = max(1e-10, turbulentDissipation[cellIdx]);

      var mu_t: f32 = 0.0;
      if (params.modelType == 0u) {
        // Standard k-epsilon: mu_t = rho * C_mu * k^2 / eps
        mu_t = params.density * params.C_mu * (k * k) / diss;
      } else {
        // Standard k-omega: mu_t = rho * k / omega
        mu_t = params.density * k / diss;
      }

      turbulentViscosity[cellIdx] = mu_t;
      turbulentProduction[cellIdx] = mu_t * S2;
    }
  `;

  /**
   * 12. Heat Transfer & Energy Convection-Diffusion Kernel
   * Computes Fourier heat flux vector q = -k_th * grad(T) and energy equation residual
   */
  public static readonly HEAT_TRANSFER_WGSL = /* wgsl */ `
    struct HeatParams {
      numCells: u32,
      thermalConductivity: f32, // k_th in W/(m*K)
      specificHeatCp: f32,      // Cp in J/(kg*K)
      pad: u32,
    };

    @group(0) @binding(0) var<uniform> params: HeatParams;
    @group(0) @binding(1) var<storage, read> cellGradT: array<vec4<f32>>; // [dT/dx, dT/dy, dT/dz, |gradT|]
    @group(0) @binding(2) var<storage, read> cellVolumes: array<f32>;
    @group(0) @binding(3) var<storage, read> cellFaceOffsets: array<u32>;
    @group(0) @binding(4) var<storage, read> cellFaceIndices: array<u32>;
    @group(0) @binding(5) var<storage, read> cellFaceSigns: array<i32>;
    @group(0) @binding(6) var<storage, read> faceMassFlux: array<f32>;
    @group(0) @binding(7) var<storage, read> faceTemperature: array<f32>;
    @group(0) @binding(8) var<storage, read_write> cellHeatFluxVectors: array<vec4<f32>>; // q = -k * gradT
    @group(0) @binding(9) var<storage, read_write> energyResiduals: array<f32>;

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let cellIdx = global_id.x;
      if (cellIdx >= params.numCells) {
        return;
      }

      let gradT = cellGradT[cellIdx].xyz;
      let q = -params.thermalConductivity * gradT;
      let q_mag = length(q);
      cellHeatFluxVectors[cellIdx] = vec4<f32>(q.x, q.y, q.z, q_mag);

      let V_P = cellVolumes[cellIdx];
      let startFace = cellFaceOffsets[cellIdx];
      let endFace = cellFaceOffsets[cellIdx + 1u];

      var netEnergyFlux: f32 = 0.0;
      for (var i = startFace; i < endFace; i = i + 1u) {
        let faceIdx = cellFaceIndices[i];
        let signVal = f32(cellFaceSigns[i]);
        let F_f = faceMassFlux[faceIdx] * signVal;
        let T_f = faceTemperature[faceIdx];

        netEnergyFlux = netEnergyFlux + F_f * params.specificHeatCp * T_f;
      }

      energyResiduals[cellIdx] = netEnergyFlux / max(1e-12, V_P);
    }
  `;

  /**
   * 13. Transient Time Integration & Local CFL Calculation
   * Computes CFL = |u| * dt / dx and updates phi^{n+1} = phi^n + (dt / (rho * V_P)) * Res
   */
  public static readonly TRANSIENT_UPDATE_WGSL = /* wgsl */ `
    struct TransientParams {
      numCells: u32,
      dt: f32,
      density: f32,
      pad: u32,
    };

    @group(0) @binding(0) var<uniform> params: TransientParams;
    @group(0) @binding(1) var<storage, read> cellVolumes: array<f32>;
    @group(0) @binding(2) var<storage, read> cellVelocities: array<vec4<f32>>;
    @group(0) @binding(3) var<storage, read> residuals: array<f32>;
    @group(0) @binding(4) var<storage, read_write> cellScalar: array<f32>;
    @group(0) @binding(5) var<storage, read_write> cellCFL: array<f32>;

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let cellIdx = global_id.x;
      if (cellIdx >= params.numCells) {
        return;
      }

      let V_P = cellVolumes[cellIdx];
      let dx = pow(max(1e-12, V_P), 0.33333);
      let u_mag = cellVelocities[cellIdx].w;

      let cfl = (u_mag * params.dt) / max(1e-6, dx);
      cellCFL[cellIdx] = cfl;

      let oldPhi = cellScalar[cellIdx];
      let res = residuals[cellIdx];

      // Explicit Forward Euler update
      let newPhi = oldPhi + (params.dt / (params.density * V_P)) * res;
      cellScalar[cellIdx] = newPhi;
    }
  `;

  /**
   * 14. Safety & NaN / Infinity / Physical Bounds Detection
   * Atomic reduction detecting NaN, Inf, negative density, negative temperature, negative pressure
   */
  public static readonly SAFETY_NAN_DETECTION_WGSL = /* wgsl */ `
    struct SafetyParams {
      numCells: u32,
      pad0: u32,
      pad1: u32,
      pad2: u32,
    };

    @group(0) @binding(0) var<uniform> params: SafetyParams;
    @group(0) @binding(1) var<storage, read> cellPressure: array<f32>;
    @group(0) @binding(2) var<storage, read> cellVelocities: array<vec4<f32>>;
    @group(0) @binding(3) var<storage, read> cellTemperature: array<f32>;
    @group(0) @binding(4) var<storage, read> cellDensity: array<f32>;
    @group(0) @binding(5) var<storage, read_write> errorFlags: array<atomic<u32>>; // [nanCount, infCount, negDensityCount, negTempCount]

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let cellIdx = global_id.x;
      if (cellIdx >= params.numCells) {
        return;
      }

      let p = cellPressure[cellIdx];
      let u = cellVelocities[cellIdx];
      let T = cellTemperature[cellIdx];
      let rho = cellDensity[cellIdx];

      // NaN check (IEEE-754: x != x)
      let isNanP = (p != p);
      let isNanU = (u.x != u.x) || (u.y != u.y) || (u.z != u.z);
      let isNanT = (T != T);
      let isNanRho = (rho != rho);

      if (isNanP || isNanU || isNanT || isNanRho) {
        atomicAdd(&errorFlags[0], 1u);
      }

      // Inf check
      let isInfP = abs(p) > 1e20;
      let isInfU = abs(u.x) > 1e20 || abs(u.y) > 1e20 || abs(u.z) > 1e20;
      if (isInfP || isInfU) {
        atomicAdd(&errorFlags[1], 1u);
      }

      // Physical state checks
      if (rho <= 0.0) {
        atomicAdd(&errorFlags[2], 1u);
      }

      if (T <= 0.0) {
        atomicAdd(&errorFlags[3], 1u);
      }
    }
  `;
}
