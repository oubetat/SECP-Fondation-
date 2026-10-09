/**
 * GPUFEMShaderCollection.ts
 * Real WGSL Compute Shaders for FEM Element Geometry, Jacobian, B-Matrix,
 * Element Stiffness Ke, Mass Matrix Me, Load Vectors, Strain, Stress & Von Mises
 */

import { ComputeShaderManager } from '../ComputeShaderManager';

export class GPUFEMShaderCollection {
  private static registered = false;

  public static registerAllFEMShaders(): void {
    if (this.registered) return;

    // 1. QUAD4 Element Stiffness Kernel (8x8 matrix, 4 Gauss points, 2D Plane Stress/Strain)
    const quad4StiffnessSource = `
struct ElementMaterial {
  E: f32,
  nu: f32,
  rho: f32,
  thickness: f32,
  yieldStrength: f32,
  thermalAlpha: f32,
  deltaT: f32,
  planeState: f32, // 0.0 = Plane Stress, 1.0 = Plane Strain
};

struct Uniforms {
  numElements: u32,
  dim: u32,
  nodesPerElement: u32,
  dofsPerElement: u32,
};

@group(0) @binding(0) var<storage, read> nodeCoords: array<f32>;      // [x0, y0, (z0), x1, y1, (z1)...]
@group(0) @binding(1) var<storage, read> connectivity: array<u32>;    // [e0_n0, e0_n1, e0_n2, e0_n3, ...]
@group(0) @binding(2) var<storage, read> materials: array<ElementMaterial>;
@group(0) @binding(3) var<storage, read_write> stiffnessOut: array<f32>; // [elem0_ke(64), elem1_ke(64), ...]
@group(0) @binding(4) var<storage, read_write> diagnostics: array<f32>;  // [minDetJ, maxDetJ, area, status] per elem
@group(0) @binding(5) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let elemIdx = global_id.x;
  if (elemIdx >= uniforms.numElements) {
    return;
  }

  let mat = materials[elemIdx];
  let E = mat.E;
  let nu = mat.nu;
  let t = select(mat.thickness, 1.0, mat.thickness <= 0.0);
  let isPlaneStrain = mat.planeState > 0.5;

  // Retrieve 4 node coordinates for this element
  var x: array<f32, 4>;
  var y: array<f32, 4>;

  let connOffset = elemIdx * 4u;
  for (var i = 0u; i < 4u; i = i + 1u) {
    let nodeIdx = connectivity[connOffset + i];
    let coordOffset = nodeIdx * uniforms.dim;
    x[i] = nodeCoords[coordOffset];
    y[i] = nodeCoords[coordOffset + 1u];
  }

  // 2D Constitutive matrix D (3x3)
  var D00: f32; var D01: f32; var D22: f32;
  if (isPlaneStrain) {
    let factor = E / ((1.0 + nu) * (1.0 - 2.0 * nu));
    D00 = factor * (1.0 - nu);
    D01 = factor * nu;
    D22 = factor * (0.5 - nu);
  } else {
    // Plane Stress
    let factor = E / (1.0 - nu * nu);
    D00 = factor;
    D01 = factor * nu;
    D22 = factor * (1.0 - nu) * 0.5;
  }

  // Gauss Quadrature Points (2x2 = 4 points)
  let gp = 0.5773502691896257; // 1 / sqrt(3)
  var xiPoints = array<f32, 4>(-gp, gp, gp, -gp);
  var etaPoints = array<f32, 4>(-gp, -gp, gp, gp);
  let weight = 1.0; // Gauss weight for 2x2 rule

  // Initialize 8x8 local element stiffness to 0.0
  var Ke: array<f32, 64>;
  for (var k = 0u; k < 64u; k = k + 1u) {
    Ke[k] = 0.0;
  }

  var minDetJ: f32 = 1.0e30;
  var maxDetJ: f32 = -1.0e30;
  var totalArea: f32 = 0.0;
  var isValid: bool = true;

  // Numerical Integration loop over 4 Gauss Points
  for (var gpIdx = 0u; gpIdx < 4u; gpIdx = gpIdx + 1u) {
    let xi = xiPoints[gpIdx];
    let eta = etaPoints[gpIdx];

    // Natural derivatives dN/dxi, dN/deta
    let dN_dxi = array<f32, 4>(
      -0.25 * (1.0 - eta),
       0.25 * (1.0 - eta),
       0.25 * (1.0 + eta),
      -0.25 * (1.0 + eta)
    );

    let dN_deta = array<f32, 4>(
      -0.25 * (1.0 - xi),
      -0.25 * (1.0 + xi),
       0.25 * (1.0 + xi),
       0.25 * (1.0 - xi)
    );

    // Compute 2x2 Jacobian matrix J = [J11 J12; J21 J22]
    var J11: f32 = 0.0; var J12: f32 = 0.0;
    var J21: f32 = 0.0; var J22: f32 = 0.0;

    for (var n = 0u; n < 4u; n = n + 1u) {
      J11 = J11 + dN_dxi[n] * x[n];
      J12 = J12 + dN_dxi[n] * y[n];
      J21 = J21 + dN_deta[n] * x[n];
      J22 = J22 + dN_deta[n] * y[n];
    }

    let detJ = J11 * J22 - J12 * J21;
    minDetJ = min(minDetJ, detJ);
    maxDetJ = max(maxDetJ, detJ);

    if (detJ <= 1.0e-12) {
      isValid = false;
    }

    let invDet = 1.0 / max(detJ, 1.0e-12);
    let invJ11 = J22 * invDet;
    let invJ12 = -J12 * invDet;
    let invJ21 = -J21 * invDet;
    let invJ22 = J11 * invDet;

    // Spatial derivatives dN/dx, dN/dy
    var dN_dx: array<f32, 4>;
    var dN_dy: array<f32, 4>;
    for (var n = 0u; n < 4u; n = n + 1u) {
      dN_dx[n] = invJ11 * dN_dxi[n] + invJ12 * dN_deta[n];
      dN_dy[n] = invJ21 * dN_dxi[n] + invJ22 * dN_deta[n];
    }

    // Build B matrix columns (3 components x 8 DOFs)
    // Row 0: eps_xx = [dN0/dx, 0, dN1/dx, 0, dN2/dx, 0, dN3/dx, 0]
    // Row 1: eps_yy = [0, dN0/dy, 0, dN1/dy, 0, dN2/dy, 0, dN3/dy]
    // Row 2: gamma_xy = [dN0/dy, dN0/dx, dN1/dy, dN1/dx, dN2/dy, dN2/dx, dN3/dy, dN3/dx]
    var B: array<f32, 24>; // 3 rows x 8 cols
    for (var n = 0u; n < 4u; n = n + 1u) {
      let col = n * 2u;
      // Row 0
      B[0u * 8u + col] = dN_dx[n];
      B[0u * 8u + col + 1u] = 0.0;
      // Row 1
      B[1u * 8u + col] = 0.0;
      B[1u * 8u + col + 1u] = dN_dy[n];
      // Row 2
      B[2u * 8u + col] = dN_dy[n];
      B[2u * 8u + col + 1u] = dN_dx[n];
    }

    let dV = detJ * t * weight;
    totalArea = totalArea + detJ * weight;

    // Accumulate Ke = B^T * D * B * dV
    // DB = D * B (3x8)
    var DB: array<f32, 24>;
    for (var c = 0u; c < 8u; c = c + 1u) {
      let b0 = B[0u * 8u + c];
      let b1 = B[1u * 8u + c];
      let b2 = B[2u * 8u + c];
      DB[0u * 8u + c] = D00 * b0 + D01 * b1;
      DB[1u * 8u + c] = D01 * b0 + D00 * b1;
      DB[2u * 8u + c] = D22 * b2;
    }

    // Ke += B^T * DB * dV
    for (var r = 0u; r < 8u; r = r + 1u) {
      let bt0 = B[0u * 8u + r];
      let bt1 = B[1u * 8u + r];
      let bt2 = B[2u * 8u + r];

      for (var c = 0u; c < 8u; c = c + 1u) {
        let db0 = DB[0u * 8u + c];
        let db1 = DB[1u * 8u + c];
        let db2 = DB[2u * 8u + c];
        let val = (bt0 * db0 + bt1 * db1 + bt2 * db2) * dV;
        Ke[r * 8u + c] = Ke[r * 8u + c] + val;
      }
    }
  }

  // Write out 8x8 matrix
  let outOffset = elemIdx * 64u;
  for (var k = 0u; k < 64u; k = k + 1u) {
    stiffnessOut[outOffset + k] = Ke[k];
  }

  // Diagnostics: [minDetJ, maxDetJ, totalArea, status]
  let diagOffset = elemIdx * 4u;
  diagnostics[diagOffset] = minDetJ;
  diagnostics[diagOffset + 1u] = maxDetJ;
  diagnostics[diagOffset + 2u] = totalArea;
  diagnostics[diagOffset + 3u] = select(select(0.0, 2.0, minDetJ < 0.0), 3.0, minDetJ <= 1.0e-12 && minDetJ >= 0.0);
}
    `.trim();

    ComputeShaderManager.registerShader({
      shaderId: 'FEM_STIFFNESS_QUAD4',
      name: 'QUAD4 2D Isoparametric Element Stiffness Kernel',
      version: '1.0.0',
      category: 'FEM_STIFFNESS',
      source: quad4StiffnessSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 2. TET4 3D Tetrahedral Element Stiffness Kernel (12x12 matrix, 1-point exact integration)
    const tet4StiffnessSource = `
struct ElementMaterial {
  E: f32,
  nu: f32,
  rho: f32,
  thickness: f32,
  yieldStrength: f32,
  thermalAlpha: f32,
  deltaT: f32,
  planeState: f32,
};

struct Uniforms {
  numElements: u32,
  dim: u32,
  nodesPerElement: u32,
  dofsPerElement: u32,
};

@group(0) @binding(0) var<storage, read> nodeCoords: array<f32>;      // [x, y, z...]
@group(0) @binding(1) var<storage, read> connectivity: array<u32>;    // [e0_n0, e0_n1, e0_n2, e0_n3...]
@group(0) @binding(2) var<storage, read> materials: array<ElementMaterial>;
@group(0) @binding(3) var<storage, read_write> stiffnessOut: array<f32>; // [elem0_ke(144), elem1_ke(144)...]
@group(0) @binding(4) var<storage, read_write> diagnostics: array<f32>;  // [minDetJ, volume, 0, status]
@group(0) @binding(5) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let elemIdx = global_id.x;
  if (elemIdx >= uniforms.numElements) {
    return;
  }

  let mat = materials[elemIdx];
  let E = mat.E;
  let nu = mat.nu;

  // Retrieve 4 node coordinates (x, y, z)
  var x: array<f32, 4>;
  var y: array<f32, 4>;
  var z: array<f32, 4>;

  let connOffset = elemIdx * 4u;
  for (var i = 0u; i < 4u; i = i + 1u) {
    let nodeIdx = connectivity[connOffset + i];
    let coordOffset = nodeIdx * uniforms.dim;
    x[i] = nodeCoords[coordOffset];
    y[i] = nodeCoords[coordOffset + 1u];
    z[i] = nodeCoords[coordOffset + 2u];
  }

  // 3D Jacobian J for TET4 (constant):
  // J11 = x1 - x0, J12 = y1 - y0, J13 = z1 - z0
  // J21 = x2 - x0, J22 = y2 - y0, J23 = z2 - z0
  // J31 = x3 - x0, J32 = y3 - y0, J33 = z3 - z0
  let J11 = x[1] - x[0]; let J12 = y[1] - y[0]; let J13 = z[1] - z[0];
  let J21 = x[2] - x[0]; let J22 = y[2] - y[0]; let J23 = z[2] - z[0];
  let J31 = x[3] - x[0]; let J32 = y[3] - y[0]; let J33 = z[3] - z[0];

  let detJ = J11 * (J22 * J33 - J23 * J32) - J12 * (J21 * J33 - J23 * J31) + J13 * (J21 * J32 - J22 * J31);
  let volume = detJ / 6.0;

  // 3x3 Inverse of Jacobian
  let invDet = 1.0 / max(detJ, 1.0e-14);
  let invJ11 = (J22 * J33 - J23 * J32) * invDet;
  let invJ12 = (J13 * J32 - J12 * J33) * invDet;
  let invJ13 = (J12 * J23 - J13 * J22) * invDet;

  let invJ21 = (J23 * J31 - J21 * J33) * invDet;
  let invJ22 = (J11 * J33 - J13 * J31) * invDet;
  let invJ23 = (J13 * J21 - J11 * J23) * invDet;

  let invJ31 = (J21 * J32 - J22 * J31) * invDet;
  let invJ32 = (J12 * J31 - J11 * J32) * invDet;
  let invJ33 = (J11 * J22 - J12 * J21) * invDet;

  // Spatial derivatives dN/dx, dN/dy, dN/dz for the 4 nodes
  // Natural derivatives: N0: [-1,-1,-1], N1: [1,0,0], N2: [0,1,0], N3: [0,0,1]
  var dN_dx: array<f32, 4>;
  var dN_dy: array<f32, 4>;
  var dN_dz: array<f32, 4>;

  // Node 1 (xi=1)
  dN_dx[1] = invJ11; dN_dy[1] = invJ12; dN_dz[1] = invJ13;
  // Node 2 (eta=1)
  dN_dx[2] = invJ21; dN_dy[2] = invJ22; dN_dz[2] = invJ23;
  // Node 3 (zeta=1)
  dN_dx[3] = invJ31; dN_dy[3] = invJ32; dN_dz[3] = invJ33;
  // Node 0 (1 - xi - eta - zeta)
  dN_dx[0] = -(dN_dx[1] + dN_dx[2] + dN_dx[3]);
  dN_dy[0] = -(dN_dy[1] + dN_dy[2] + dN_dy[3]);
  dN_dz[0] = -(dN_dz[1] + dN_dz[2] + dN_dz[3]);

  // 6x6 3D Isotropic Elasticity Matrix D
  let factor = E / ((1.0 + nu) * (1.0 - 2.0 * nu));
  let c11 = factor * (1.0 - nu);
  let c12 = factor * nu;
  let c44 = factor * (0.5 - nu);

  // Construct 6x12 B matrix
  var B: array<f32, 72>; // 6 rows x 12 cols
  for (var n = 0u; n < 4u; n = n + 1u) {
    let col = n * 3u;
    let gx = dN_dx[n]; let gy = dN_dy[n]; let gz = dN_dz[n];
    // Row 0: eps_xx = du/dx
    B[0u * 12u + col] = gx;
    // Row 1: eps_yy = dv/dy
    B[1u * 12u + col + 1u] = gy;
    // Row 2: eps_zz = dw/dz
    B[2u * 12u + col + 2u] = gz;
    // Row 3: gamma_yz = dv/dz + dw/dy
    B[3u * 12u + col + 1u] = gz;
    B[3u * 12u + col + 2u] = gy;
    // Row 4: gamma_xz = du/dz + dw/dx
    B[4u * 12u + col] = gz;
    B[4u * 12u + col + 2u] = gx;
    // Row 5: gamma_xy = du/dy + dv/dx
    B[5u * 12u + col] = gy;
    B[5u * 12u + col + 1u] = gx;
  }

  // DB = D * B (6x12)
  var DB: array<f32, 72>;
  for (var c = 0u; c < 12u; c = c + 1u) {
    let b0 = B[0u * 12u + c];
    let b1 = B[1u * 12u + c];
    let b2 = B[2u * 12u + c];
    let b3 = B[3u * 12u + c];
    let b4 = B[4u * 12u + c];
    let b5 = B[5u * 12u + c];

    DB[0u * 12u + c] = c11 * b0 + c12 * b1 + c12 * b2;
    DB[1u * 12u + c] = c12 * b0 + c11 * b1 + c12 * b2;
    DB[2u * 12u + c] = c12 * b0 + c12 * b1 + c11 * b2;
    DB[3u * 12u + c] = c44 * b3;
    DB[4u * 12u + c] = c44 * b4;
    DB[5u * 12u + c] = c44 * b5;
  }

  // Ke = B^T * DB * volume (12x12 = 144 entries)
  let outOffset = elemIdx * 144u;
  for (var r = 0u; r < 12u; r = r + 1u) {
    let bt0 = B[0u * 12u + r];
    let bt1 = B[1u * 12u + r];
    let bt2 = B[2u * 12u + r];
    let bt3 = B[3u * 12u + r];
    let bt4 = B[4u * 12u + r];
    let bt5 = B[5u * 12u + r];

    for (var c = 0u; c < 12u; c = c + 1u) {
      let db0 = DB[0u * 12u + c];
      let db1 = DB[1u * 12u + c];
      let db2 = DB[2u * 12u + c];
      let db3 = DB[3u * 12u + c];
      let db4 = DB[4u * 12u + c];
      let db5 = DB[5u * 12u + c];

      let keVal = (bt0 * db0 + bt1 * db1 + bt2 * db2 + bt3 * db3 + bt4 * db4 + bt5 * db5) * volume;
      stiffnessOut[outOffset + r * 12u + c] = keVal;
    }
  }

  // Diagnostics: [minDetJ, volume, 0, status]
  let diagOffset = elemIdx * 4u;
  diagnostics[diagOffset] = detJ;
  diagnostics[diagOffset + 1u] = volume;
  diagnostics[diagOffset + 2u] = 0.0;
  diagnostics[diagOffset + 3u] = select(select(0.0, 2.0, detJ < 0.0), 3.0, detJ <= 1.0e-14 && detJ >= 0.0);
}
    `.trim();

    ComputeShaderManager.registerShader({
      shaderId: 'FEM_STIFFNESS_TET4',
      name: 'TET4 3D Linear Tetrahedral Stiffness Kernel',
      version: '1.0.0',
      category: 'FEM_STIFFNESS',
      source: tet4StiffnessSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 3. HEX8 3D Hexahedral Element Stiffness Kernel (24x24 matrix, 8 Gauss points)
    const hex8StiffnessSource = `
struct ElementMaterial {
  E: f32,
  nu: f32,
  rho: f32,
  thickness: f32,
  yieldStrength: f32,
  thermalAlpha: f32,
  deltaT: f32,
  planeState: f32,
};

struct Uniforms {
  numElements: u32,
  dim: u32,
  nodesPerElement: u32,
  dofsPerElement: u32,
};

@group(0) @binding(0) var<storage, read> nodeCoords: array<f32>;      // [x, y, z...]
@group(0) @binding(1) var<storage, read> connectivity: array<u32>;    // [e0_n0..n7...]
@group(0) @binding(2) var<storage, read> materials: array<ElementMaterial>;
@group(0) @binding(3) var<storage, read_write> stiffnessOut: array<f32>; // [elem0_ke(576)...]
@group(0) @binding(4) var<storage, read_write> diagnostics: array<f32>;  // [minDetJ, maxDetJ, volume, status]
@group(0) @binding(5) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let elemIdx = global_id.x;
  if (elemIdx >= uniforms.numElements) {
    return;
  }

  let mat = materials[elemIdx];
  let E = mat.E;
  let nu = mat.nu;

  var x: array<f32, 8>;
  var y: array<f32, 8>;
  var z: array<f32, 8>;

  let connOffset = elemIdx * 8u;
  for (var i = 0u; i < 8u; i = i + 1u) {
    let nodeIdx = connectivity[connOffset + i];
    let coordOffset = nodeIdx * uniforms.dim;
    x[i] = nodeCoords[coordOffset];
    y[i] = nodeCoords[coordOffset + 1u];
    z[i] = nodeCoords[coordOffset + 2u];
  }

  // 3D Elasticity D-matrix factors
  let factor = E / ((1.0 + nu) * (1.0 - 2.0 * nu));
  let c11 = factor * (1.0 - nu);
  let c12 = factor * nu;
  let c44 = factor * (0.5 - nu);

  // Initialize 24x24 local stiffness to 0.0
  var Ke: array<f32, 576>;
  for (var k = 0u; k < 576u; k = k + 1u) {
    Ke[k] = 0.0;
  }

  let gp = 0.5773502691896257;
  var xiPts = array<f32, 8>(-gp, gp, gp, -gp, -gp, gp, gp, -gp);
  var etaPts = array<f32, 8>(-gp, -gp, gp, gp, -gp, -gp, gp, gp);
  var zetaPts = array<f32, 8>(-gp, -gp, -gp, -gp, gp, gp, gp, gp);

  // Hex8 corner reference signs for [-1,1]^3
  let xiC = array<f32, 8>(-1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0);
  let etaC = array<f32, 8>(-1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0);
  let zetaC = array<f32, 8>(-1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0);

  var minDetJ: f32 = 1.0e30;
  var maxDetJ: f32 = -1.0e30;
  var totalVolume: f32 = 0.0;

  for (var p = 0u; p < 8u; p = p + 1u) {
    let xi = xiPts[p];
    let eta = etaPts[p];
    let zeta = zetaPts[p];

    var dN_dxi: array<f32, 8>;
    var dN_deta: array<f32, 8>;
    var dN_dzeta: array<f32, 8>;

    for (var n = 0u; n < 8u; n = n + 1u) {
      let xc = xiC[n]; let yc = etaC[n]; let zc = zetaC[n];
      dN_dxi[n]   = 0.125 * xc * (1.0 + yc * eta) * (1.0 + zc * zeta);
      dN_deta[n]  = 0.125 * (1.0 + xc * xi) * yc * (1.0 + zc * zeta);
      dN_dzeta[n] = 0.125 * (1.0 + xc * xi) * (1.0 + yc * eta) * zc;
    }

    var J11: f32 = 0.0; var J12: f32 = 0.0; var J13: f32 = 0.0;
    var J21: f32 = 0.0; var J22: f32 = 0.0; var J23: f32 = 0.0;
    var J31: f32 = 0.0; var J32: f32 = 0.0; var J33: f32 = 0.0;

    for (var n = 0u; n < 8u; n = n + 1u) {
      let gx = dN_dxi[n]; let gy = dN_deta[n]; let gz = dN_dzeta[n];
      let xn = x[n]; let yn = y[n]; let zn = z[n];

      J11 = J11 + gx * xn; J12 = J12 + gx * yn; J13 = J13 + gx * zn;
      J21 = J21 + gy * xn; J22 = J22 + gy * yn; J23 = J23 + gy * zn;
      J31 = J31 + gz * xn; J32 = J32 + gz * yn; J33 = J33 + gz * zn;
    }

    let detJ = J11 * (J22 * J33 - J23 * J32) - J12 * (J21 * J33 - J23 * J31) + J13 * (J21 * J32 - J22 * J31);
    minDetJ = min(minDetJ, detJ);
    maxDetJ = max(maxDetJ, detJ);
    totalVolume = totalVolume + detJ;

    let invDet = 1.0 / max(detJ, 1.0e-14);
    let invJ11 = (J22 * J33 - J23 * J32) * invDet;
    let invJ12 = (J13 * J32 - J12 * J33) * invDet;
    let invJ13 = (J12 * J23 - J13 * J22) * invDet;

    let invJ21 = (J23 * J31 - J21 * J33) * invDet;
    let invJ22 = (J11 * J33 - J13 * J31) * invDet;
    let invJ23 = (J13 * J21 - J11 * J23) * invDet;

    let invJ31 = (J21 * J32 - J22 * J31) * invDet;
    let invJ32 = (J12 * J31 - J11 * J32) * invDet;
    let invJ33 = (J11 * J22 - J12 * J21) * invDet;

    var dN_dx: array<f32, 8>;
    var dN_dy: array<f32, 8>;
    var dN_dz: array<f32, 8>;

    for (var n = 0u; n < 8u; n = n + 1u) {
      let gxi = dN_dxi[n]; let geta = dN_deta[n]; let gzeta = dN_dzeta[n];
      dN_dx[n] = invJ11 * gxi + invJ12 * geta + invJ13 * gzeta;
      dN_dy[n] = invJ21 * gxi + invJ22 * geta + invJ23 * gzeta;
      dN_dz[n] = invJ31 * gxi + invJ32 * geta + invJ33 * gzeta;
    }

    var B: array<f32, 144>; // 6 rows x 24 cols
    for (var n = 0u; n < 8u; n = n + 1u) {
      let col = n * 3u;
      let gx = dN_dx[n]; let gy = dN_dy[n]; let gz = dN_dz[n];
      B[0u * 24u + col] = gx;
      B[1u * 24u + col + 1u] = gy;
      B[2u * 24u + col + 2u] = gz;
      B[3u * 24u + col + 1u] = gz;
      B[3u * 24u + col + 2u] = gy;
      B[4u * 24u + col] = gz;
      B[4u * 24u + col + 2u] = gx;
      B[5u * 24u + col] = gy;
      B[5u * 24u + col + 1u] = gx;
    }

    var DB: array<f32, 144>;
    for (var c = 0u; c < 24u; c = c + 1u) {
      let b0 = B[0u * 24u + c];
      let b1 = B[1u * 24u + c];
      let b2 = B[2u * 24u + c];
      let b3 = B[3u * 24u + c];
      let b4 = B[4u * 24u + c];
      let b5 = B[5u * 24u + c];

      DB[0u * 24u + c] = c11 * b0 + c12 * b1 + c12 * b2;
      DB[1u * 24u + c] = c12 * b0 + c11 * b1 + c12 * b2;
      DB[2u * 24u + c] = c12 * b0 + c12 * b1 + c11 * b2;
      DB[3u * 24u + c] = c44 * b3;
      DB[4u * 24u + c] = c44 * b4;
      DB[5u * 24u + c] = c44 * b5;
    }

    let dV = detJ; // weight = 1.0
    for (var r = 0u; r < 24u; r = r + 1u) {
      let bt0 = B[0u * 24u + r];
      let bt1 = B[1u * 24u + r];
      let bt2 = B[2u * 24u + r];
      let bt3 = B[3u * 24u + r];
      let bt4 = B[4u * 24u + r];
      let bt5 = B[5u * 24u + r];

      for (var c = 0u; c < 24u; c = c + 1u) {
        let db0 = DB[0u * 24u + c];
        let db1 = DB[1u * 24u + c];
        let db2 = DB[2u * 24u + c];
        let db3 = DB[3u * 24u + c];
        let db4 = DB[4u * 24u + c];
        let db5 = DB[5u * 24u + c];

        let val = (bt0 * db0 + bt1 * db1 + bt2 * db2 + bt3 * db3 + bt4 * db4 + bt5 * db5) * dV;
        Ke[r * 24u + c] = Ke[r * 24u + c] + val;
      }
    }
  }

  let outOffset = elemIdx * 576u;
  for (var k = 0u; k < 576u; k = k + 1u) {
    stiffnessOut[outOffset + k] = Ke[k];
  }

  let diagOffset = elemIdx * 4u;
  diagnostics[diagOffset] = minDetJ;
  diagnostics[diagOffset + 1u] = maxDetJ;
  diagnostics[diagOffset + 2u] = totalVolume;
  diagnostics[diagOffset + 3u] = select(select(0.0, 2.0, minDetJ < 0.0), 3.0, minDetJ <= 1.0e-14 && minDetJ >= 0.0);
}
    `.trim();

    ComputeShaderManager.registerShader({
      shaderId: 'FEM_STIFFNESS_HEX8',
      name: 'HEX8 3D Trilinear Hexahedral Stiffness Kernel',
      version: '1.0.0',
      category: 'FEM_STIFFNESS',
      source: hex8StiffnessSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 4. Strain & Stress Recovery Kernel (QUAD4 / TET4 / HEX8)
    const strainStressQuad4Source = `
struct ElementMaterial {
  E: f32,
  nu: f32,
  rho: f32,
  thickness: f32,
  yieldStrength: f32,
  thermalAlpha: f32,
  deltaT: f32,
  planeState: f32,
};

struct Uniforms {
  numElements: u32,
  dim: u32,
  nodesPerElement: u32,
  dofsPerElement: u32,
};

@group(0) @binding(0) var<storage, read> nodeCoords: array<f32>;
@group(0) @binding(1) var<storage, read> connectivity: array<u32>;
@group(0) @binding(2) var<storage, read> materials: array<ElementMaterial>;
@group(0) @binding(3) var<storage, read> displacements: array<f32>;       // [u0_x, u0_y, u1_x, u1_y...]
@group(0) @binding(4) var<storage, read_write> strainOut: array<f32>;     // [elem0_eps(3), elem1_eps(3)...]
@group(0) @binding(5) var<storage, read_write> stressOut: array<f32>;     // [elem0_sig(3), elem1_sig(3)...]
@group(0) @binding(6) var<storage, read_write> vonMisesOut: array<f32>;   // [elem0_vm, elem0_fos, ...]
@group(0) @binding(7) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let elemIdx = global_id.x;
  if (elemIdx >= uniforms.numElements) {
    return;
  }

  let mat = materials[elemIdx];
  let E = mat.E;
  let nu = mat.nu;
  let isPlaneStrain = mat.planeState > 0.5;

  var x: array<f32, 4>;
  var y: array<f32, 4>;
  var u: array<f32, 8>;

  let connOffset = elemIdx * 4u;
  for (var i = 0u; i < 4u; i = i + 1u) {
    let nodeIdx = connectivity[connOffset + i];
    let coordOffset = nodeIdx * uniforms.dim;
    x[i] = nodeCoords[coordOffset];
    y[i] = nodeCoords[coordOffset + 1u];

    let dofOffset = nodeIdx * 2u;
    u[i * 2u] = displacements[dofOffset];
    u[i * 2u + 1u] = displacements[dofOffset + 1u];
  }

  // Evaluate at element centroid (xi = 0.0, eta = 0.0)
  let dN_dxi = array<f32, 4>(-0.25, 0.25, 0.25, -0.25);
  let dN_deta = array<f32, 4>(-0.25, -0.25, 0.25, 0.25);

  var J11: f32 = 0.0; var J12: f32 = 0.0;
  var J21: f32 = 0.0; var J22: f32 = 0.0;

  for (var n = 0u; n < 4u; n = n + 1u) {
    J11 = J11 + dN_dxi[n] * x[n];
    J12 = J12 + dN_dxi[n] * y[n];
    J21 = J21 + dN_deta[n] * x[n];
    J22 = J22 + dN_deta[n] * y[n];
  }

  let detJ = J11 * J22 - J12 * J21;
  let invDet = 1.0 / max(detJ, 1.0e-12);
  let invJ11 = J22 * invDet;
  let invJ12 = -J12 * invDet;
  let invJ21 = -J21 * invDet;
  let invJ22 = J11 * invDet;

  var dN_dx: array<f32, 4>;
  var dN_dy: array<f32, 4>;
  for (var n = 0u; n < 4u; n = n + 1u) {
    dN_dx[n] = invJ11 * dN_dxi[n] + invJ12 * dN_deta[n];
    dN_dy[n] = invJ21 * dN_dxi[n] + invJ22 * dN_deta[n];
  }

  // Strain eps = B * u
  var eps_xx: f32 = 0.0;
  var eps_yy: f32 = 0.0;
  var gamma_xy: f32 = 0.0;

  for (var n = 0u; n < 4u; n = n + 1u) {
    let un_x = u[n * 2u];
    let un_y = u[n * 2u + 1u];
    eps_xx = eps_xx + dN_dx[n] * un_x;
    eps_yy = eps_yy + dN_dy[n] * un_y;
    gamma_xy = gamma_xy + dN_dy[n] * un_x + dN_dx[n] * un_y;
  }

  // Constitutive D matrix
  var D00: f32; var D01: f32; var D22: f32;
  if (isPlaneStrain) {
    let factor = E / ((1.0 + nu) * (1.0 - 2.0 * nu));
    D00 = factor * (1.0 - nu);
    D01 = factor * nu;
    D22 = factor * (0.5 - nu);
  } else {
    let factor = E / (1.0 - nu * nu);
    D00 = factor;
    D01 = factor * nu;
    D22 = factor * (1.0 - nu) * 0.5;
  }

  let sig_xx = D00 * eps_xx + D01 * eps_yy;
  let sig_yy = D01 * eps_xx + D00 * eps_yy;
  let tau_xy = D22 * gamma_xy;

  // Von Mises Stress = sqrt(sig_xx^2 - sig_xx*sig_yy + sig_yy^2 + 3*tau_xy^2)
  let vm = sqrt(max(0.0, sig_xx * sig_xx - sig_xx * sig_yy + sig_yy * sig_yy + 3.0 * tau_xy * tau_xy));
  let fos = select(mat.yieldStrength / max(vm, 1.0), 999.0, vm < 1.0e-3);

  // Write outputs
  let strainOffset = elemIdx * 3u;
  strainOut[strainOffset] = eps_xx;
  strainOut[strainOffset + 1u] = eps_yy;
  strainOut[strainOffset + 2u] = gamma_xy;

  let stressOffset = elemIdx * 3u;
  stressOut[stressOffset] = sig_xx;
  stressOut[stressOffset + 1u] = sig_yy;
  stressOut[stressOffset + 2u] = tau_xy;

  let vmOffset = elemIdx * 2u;
  vonMisesOut[vmOffset] = vm;
  vonMisesOut[vmOffset + 1u] = fos;
}
    `.trim();

    ComputeShaderManager.registerShader({
      shaderId: 'FEM_STRAIN_STRESS_QUAD4',
      name: 'QUAD4 Strain & Stress Recovery Kernel',
      version: '1.0.0',
      category: 'FEM_RECOVERY',
      source: strainStressQuad4Source,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 5. Element Mass Matrix Kernel (QUAD4 / TET4 / HEX8)
    const massQuad4Source = `
struct ElementMaterial {
  E: f32,
  nu: f32,
  rho: f32,
  thickness: f32,
  yieldStrength: f32,
  thermalAlpha: f32,
  deltaT: f32,
  planeState: f32,
};

struct Uniforms {
  numElements: u32,
  dim: u32,
  nodesPerElement: u32,
  dofsPerElement: u32,
};

@group(0) @binding(0) var<storage, read> nodeCoords: array<f32>;
@group(0) @binding(1) var<storage, read> connectivity: array<u32>;
@group(0) @binding(2) var<storage, read> materials: array<ElementMaterial>;
@group(0) @binding(3) var<storage, read_write> massOut: array<f32>;       // [elem0_me(64)...]
@group(0) @binding(4) var<storage, read_write> lumpedMassOut: array<f32>; // [elem0_lumped(8)...]
@group(0) @binding(5) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let elemIdx = global_id.x;
  if (elemIdx >= uniforms.numElements) {
    return;
  }

  let mat = materials[elemIdx];
  let rho = mat.rho;
  let t = select(mat.thickness, 1.0, mat.thickness <= 0.0);

  var x: array<f32, 4>;
  var y: array<f32, 4>;

  let connOffset = elemIdx * 4u;
  for (var i = 0u; i < 4u; i = i + 1u) {
    let nodeIdx = connectivity[connOffset + i];
    let coordOffset = nodeIdx * uniforms.dim;
    x[i] = nodeCoords[coordOffset];
    y[i] = nodeCoords[coordOffset + 1u];
  }

  var Me: array<f32, 64>;
  for (var k = 0u; k < 64u; k = k + 1u) {
    Me[k] = 0.0;
  }

  let gp = 0.5773502691896257;
  var xiPts = array<f32, 4>(-gp, gp, gp, -gp);
  var etaPts = array<f32, 4>(-gp, -gp, gp, gp);

  for (var p = 0u; p < 4u; p = p + 1u) {
    let xi = xiPts[p];
    let eta = etaPts[p];

    let N = array<f32, 4>(
      0.25 * (1.0 - xi) * (1.0 - eta),
      0.25 * (1.0 + xi) * (1.0 - eta),
      0.25 * (1.0 + xi) * (1.0 + eta),
      0.25 * (1.0 - xi) * (1.0 + eta)
    );

    let dN_dxi = array<f32, 4>(
      -0.25 * (1.0 - eta),
       0.25 * (1.0 - eta),
       0.25 * (1.0 + eta),
      -0.25 * (1.0 + eta)
    );

    let dN_deta = array<f32, 4>(
      -0.25 * (1.0 - xi),
      -0.25 * (1.0 + xi),
       0.25 * (1.0 + xi),
       0.25 * (1.0 - xi)
    );

    var J11: f32 = 0.0; var J12: f32 = 0.0;
    var J21: f32 = 0.0; var J22: f32 = 0.0;
    for (var n = 0u; n < 4u; n = n + 1u) {
      J11 = J11 + dN_dxi[n] * x[n];
      J12 = J12 + dN_dxi[n] * y[n];
      J21 = J21 + dN_deta[n] * x[n];
      J22 = J22 + dN_deta[n] * y[n];
    }

    let detJ = J11 * J22 - J12 * J21;
    let dV = detJ * t * rho; // weight = 1.0

    // Consistent Mass: Me_ij = int rho * N_i * N_j * dV (2 DOFs per node)
    for (var i = 0u; i < 4u; i = i + 1u) {
      for (var j = 0u; j < 4u; j = j + 1u) {
        let val = N[i] * N[j] * dV;
        Me[(i * 2u) * 8u + (j * 2u)] += val;
        Me[(i * 2u + 1u) * 8u + (j * 2u + 1u)] += val;
      }
    }
  }

  // Row-sum lumped mass vector
  var lumped: array<f32, 8>;
  for (var r = 0u; r < 8u; r = r + 1u) {
    var sum: f32 = 0.0;
    for (var c = 0u; c < 8u; c = c + 1u) {
      sum += Me[r * 8u + c];
    }
    lumped[r] = sum;
  }

  let outOffset = elemIdx * 64u;
  for (var k = 0u; k < 64u; k = k + 1u) {
    massOut[outOffset + k] = Me[k];
  }

  let lumpOffset = elemIdx * 8u;
  for (var k = 0u; k < 8u; k = k + 1u) {
    lumpedMassOut[lumpOffset + k] = lumped[k];
  }
}
    `.trim();

    ComputeShaderManager.registerShader({
      shaderId: 'FEM_MASS_QUAD4',
      name: 'QUAD4 Consistent & Lumped Mass Kernel',
      version: '1.0.0',
      category: 'FEM_STIFFNESS',
      source: massQuad4Source,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 6. Element Load Vector (Body Force & Gravity)
    const loadVectorSource = `
struct ElementMaterial {
  E: f32,
  nu: f32,
  rho: f32,
  thickness: f32,
  yieldStrength: f32,
  thermalAlpha: f32,
  deltaT: f32,
  planeState: f32,
};

struct Uniforms {
  numElements: u32,
  dim: u32,
  nodesPerElement: u32,
  dofsPerElement: u32,
};

@group(0) @binding(0) var<storage, read> nodeCoords: array<f32>;
@group(0) @binding(1) var<storage, read> connectivity: array<u32>;
@group(0) @binding(2) var<storage, read> materials: array<ElementMaterial>;
@group(0) @binding(3) var<storage, read> bodyForces: array<f32>;        // [bx, by, (bz)]
@group(0) @binding(4) var<storage, read_write> loadOut: array<f32>;     // [f0_x, f0_y, f1_x, f1_y...]
@group(0) @binding(5) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let elemIdx = global_id.x;
  if (elemIdx >= uniforms.numElements) {
    return;
  }

  let mat = materials[elemIdx];
  let rho = mat.rho;
  let t = select(mat.thickness, 1.0, mat.thickness <= 0.0);

  let bx = bodyForces[0] * rho;
  let by = bodyForces[1] * rho;

  var x: array<f32, 4>;
  var y: array<f32, 4>;

  let connOffset = elemIdx * 4u;
  for (var i = 0u; i < 4u; i = i + 1u) {
    let nodeIdx = connectivity[connOffset + i];
    let coordOffset = nodeIdx * uniforms.dim;
    x[i] = nodeCoords[coordOffset];
    y[i] = nodeCoords[coordOffset + 1u];
  }

  var Fe: array<f32, 8>;
  for (var k = 0u; k < 8u; k = k + 1u) {
    Fe[k] = 0.0;
  }

  let gp = 0.5773502691896257;
  var xiPts = array<f32, 4>(-gp, gp, gp, -gp);
  var etaPts = array<f32, 4>(-gp, -gp, gp, gp);

  for (var p = 0u; p < 4u; p = p + 1u) {
    let xi = xiPts[p];
    let eta = etaPts[p];

    let N = array<f32, 4>(
      0.25 * (1.0 - xi) * (1.0 - eta),
      0.25 * (1.0 + xi) * (1.0 - eta),
      0.25 * (1.0 + xi) * (1.0 + eta),
      0.25 * (1.0 - xi) * (1.0 + eta)
    );

    let dN_dxi = array<f32, 4>(
      -0.25 * (1.0 - eta),
       0.25 * (1.0 - eta),
       0.25 * (1.0 + eta),
      -0.25 * (1.0 + eta)
    );

    let dN_deta = array<f32, 4>(
      -0.25 * (1.0 - xi),
      -0.25 * (1.0 + xi),
       0.25 * (1.0 + xi),
       0.25 * (1.0 - xi)
    );

    var J11: f32 = 0.0; var J12: f32 = 0.0;
    var J21: f32 = 0.0; var J22: f32 = 0.0;
    for (var n = 0u; n < 4u; n = n + 1u) {
      J11 = J11 + dN_dxi[n] * x[n];
      J12 = J12 + dN_dxi[n] * y[n];
      J21 = J21 + dN_deta[n] * x[n];
      J22 = J22 + dN_deta[n] * y[n];
    }

    let detJ = J11 * J22 - J12 * J21;
    let dV = detJ * t;

    for (var i = 0u; i < 4u; i = i + 1u) {
      Fe[i * 2u] += N[i] * bx * dV;
      Fe[i * 2u + 1u] += N[i] * by * dV;
    }
  }

  let outOffset = elemIdx * 8u;
  for (var k = 0u; k < 8u; k = k + 1u) {
    loadOut[outOffset + k] = Fe[k];
  }
}
    `.trim();

    ComputeShaderManager.registerShader({
      shaderId: 'FEM_LOAD_VECTOR',
      name: 'Element Body Force & Gravity Load Kernel',
      version: '1.0.0',
      category: 'FEM_STIFFNESS',
      source: loadVectorSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    this.registered = true;
  }
}
