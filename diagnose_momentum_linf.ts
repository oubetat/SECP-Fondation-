/**
 * SECP CFD Forensic Diagnostic Script: Momentum L_inf Root Cause Analyzer
 * Audits the NACA0012 120x60 Fine Grid run at Iteration 500.
 */

import { AirfoilMeshGenerator } from './src/engine/cfd3d/mesh/AirfoilMeshGenerator';
import { Fvm3DNavierStokesSolver } from './src/engine/cfd3d/Fvm3DNavierStokesSolver';
import * as fs from 'fs';

async function runDiagnostic() {
  console.log('[FORENSIC-DIAGNOSTIC] Generating NACA 0012 Fine Mesh (120x60)...');
  const nx = 120, ny = 60;
  const fvmMesh = AirfoilMeshGenerator.generateOGrid({
    airfoilDesignation: '0012',
    chord: 1.0,
    span: 0.2,
    farFieldRadius: 10.0,
    numSurfacePoints: nx,
    numNormalLayers: ny,
    numSpanwiseLayers: 1,
    firstCellHeight: 1e-4,
    growthRate: 1.15
  });

  const aoaRad = (10.0 * Math.PI) / 180;
  const cosA = Math.cos(aoaRad);
  const sinA = Math.sin(aoaRad);

  for (const f of fvmMesh.faces) {
    if (f.boundaryType === 'FARFIELD') {
      const dx = f.centroid.x - 0.5;
      const dy = f.centroid.y;
      const dot = dx * cosA + dy * sinA;
      if (dot < 0) {
        f.boundaryType = 'INLET';
        f.u_bc = cosA;
        f.v_bc = sinA;
        f.w_bc = 0;
      } else {
        f.boundaryType = 'OUTLET';
        f.p_bc = 0;
      }
    }
  }

  const rho = 1.225;
  const Uinf = 1.0;
  const re = 6.0e6;
  const mu = (rho * Uinf * 1.0) / re;
  const fluid = { densityKgM3: rho, viscosityPaS: mu };

  console.log('[FORENSIC-DIAGNOSTIC] Solving Baseline (500 iters)...');
  const config = {
    maxIterations: 500,
    continuityTol: 1e-4,
    momentumTol: 1.5e-2,
    underRelaxationVelocity: 0.5,
    underRelaxationPressure: 0.2,
    useTurbulenceModel: true,
    turbulenceScheme: 'SST_K_OMEGA' as const,
    upwindScheme: 'FIRST_ORDER_UPWIND' as const
  };

  const solution = Fvm3DNavierStokesSolver.solve(fvmMesh, fluid, config, 1.0, Uinf);

  const numCells = fvmMesh.cells.length;
  const u = solution.velocity.u;
  const v = solution.velocity.v;
  const w = solution.velocity.w;
  const p = solution.pressure;
  const k = solution.turbulence?.k || new Array(numCells).fill(0);
  const omega = solution.turbulence?.omega || new Array(numCells).fill(0);
  const nut = solution.turbulence?.nut || new Array(numCells).fill(0);

  // Compute face dPN
  const face_dPN = new Array<number>(fvmMesh.faces.length).fill(1e-3);
  for (let f = 0; f < fvmMesh.faces.length; f++) {
    const face = fvmMesh.faces[f];
    const o = face.ownerCellId;
    const n = face.neighborCellId;
    if (n !== -1) {
      const co = fvmMesh.cells[o].centroid;
      const cn = fvmMesh.cells[n].centroid;
      face_dPN[f] = Math.max(Math.hypot(cn.x - co.x, cn.y - co.y, cn.z - co.z), 1e-6);
    } else {
      const co = fvmMesh.cells[o].centroid;
      face_dPN[f] = Math.max(Math.hypot(face.centroid.x - co.x, face.centroid.y - co.y, face.centroid.z - co.z), 1e-6);
    }
  }

  // Cell-by-cell forensic audit
  interface CellAudit {
    cellId: number;
    i: number;
    j: number;
    x: number;
    y: number;
    u: number;
    v: number;
    p: number;
    k: number;
    omega: number;
    nut: number;
    rawResidualU: number;
    rawResidualV: number;
    rawResidualMag: number;
    normResidualU: number;
    normResidualV: number;
    normResidualMag: number;
    aP: number;
    aP_unrelaxed: number;
    pressureGradX: number;
    pressureGradY: number;
    convectionTermX: number;
    convectionTermY: number;
    diffusionTermX: number;
    diffusionTermY: number;
    sourceTermX: number;
    sourceTermY: number;
    neighborFluxContribX: number;
    neighborFluxContribY: number;
    boundaryContribX: number;
    boundaryContribY: number;
    wallContribX: number;
    wallContribY: number;
    volume: number;
    aspectRatio: number;
    skewness: number;
    wallDistance: number;
    yPlus: number;
    spatialRegion: string;
  }

  const audits: CellAudit[] = [];

  for (let c = 0; c < numCells; c++) {
    const cell = fvmMesh.cells[c];
    // Map c to i, j
    const j = Math.floor(c / nx);
    const i = c % nx;

    let aP_unrel = 0.0;
    let convX = 0.0, convY = 0.0;
    let diffX = 0.0, diffY = 0.0;
    let pressGradX = 0.0, pressGradY = 0.0;
    let sum_nb_u = 0.0, sum_nb_v = 0.0;
    let boundX = 0.0, boundY = 0.0;
    let wallX = 0.0, wallY = 0.0;

    let maxFaceArea = 0, minFaceArea = Infinity;
    let isWallAdjacent = false;
    let isOutletAdjacent = false;
    let isInletAdjacent = false;

    for (const faceId of cell.faceIds) {
      const face = fvmMesh.faces[faceId];
      const isOwner = face.ownerCellId === c;
      const nb = isOwner ? face.neighborCellId : face.ownerCellId;
      const sign = isOwner ? 1.0 : -1.0;
      const Af = face.area;
      if (Af > maxFaceArea) maxFaceArea = Af;
      if (Af < minFaceArea) minFaceArea = Af;

      const effMu = mu + nut[c];
      const dPN = face_dPN[faceId];
      const D_f = effMu * Af / dPN;

      const u_f = (nb !== -1) ? 0.5 * (u[c] + u[nb]) : (face.u_bc ?? u[c]);
      const v_f = (nb !== -1) ? 0.5 * (v[c] + v[nb]) : (face.v_bc ?? v[c]);
      const w_f = (nb !== -1) ? 0.5 * (w[c] + w[nb]) : (face.w_bc ?? w[c]);
      const Vn = sign * (u_f * face.normal.x + v_f * face.normal.y + w_f * face.normal.z);
      const F_f = rho * Vn * Af;

      const aN = D_f + Math.max(-F_f, 0.0);
      aP_unrel += D_f + Math.max(F_f, 0.0);

      if (nb !== -1) {
        sum_nb_u += aN * u[nb];
        sum_nb_v += aN * v[nb];
        convX += F_f * (u_f);
        convY += F_f * (v_f);
        diffX += D_f * (u[nb] - u[c]);
        diffY += D_f * (v[nb] - v[c]);
      } else {
        if (face.boundaryType === 'WALL') {
          isWallAdjacent = true;
          const u_w = face.u_bc ?? 0;
          const v_w = face.v_bc ?? 0;
          wallX += (D_f + Math.max(-F_f, 0.0)) * u_w;
          wallY += (D_f + Math.max(-F_f, 0.0)) * v_w;
        } else if (face.boundaryType === 'OUTLET') {
          isOutletAdjacent = true;
          boundX += aN * u[c];
          boundY += aN * v[c];
        } else if (face.boundaryType === 'INLET') {
          isInletAdjacent = true;
          boundX += (D_f + Math.max(-F_f, 0.0)) * (face.u_bc ?? 0);
          boundY += (D_f + Math.max(-F_f, 0.0)) * (face.v_bc ?? 0);
        }
      }

      const p_nb = (nb !== -1) ? p[nb] : p[c];
      const p_f = (face.boundaryType === 'OUTLET' && face.p_bc !== undefined) ? face.p_bc : 0.5 * (p[c] + p_nb);
      pressGradX += sign * p_f * face.normal.x * Af;
      pressGradY += sign * p_f * face.normal.y * Af;
    }

    const alpha_u = 0.5;
    const aP_relaxed = aP_unrel / alpha_u;
    const sourceX = -pressGradX + wallX + boundX;
    const sourceY = -pressGradY + wallY + boundY;

    // Discretized algebraic equation: aP * u_c - sum(aN * u_nb) - source = R
    const rawResU = aP_unrel * u[c] - (sum_nb_u + sourceX);
    const rawResV = aP_unrel * v[c] - (sum_nb_v + sourceY);
    const rawResMag = Math.hypot(rawResU, rawResV);

    const normResU = Math.abs(rawResU) / Math.max(aP_relaxed * Uinf, 1e-6);
    const normResV = Math.abs(rawResV) / Math.max(aP_relaxed * Uinf, 1e-6);
    const normResMag = Math.max(normResU, normResV);

    // Wall distance & y+
    const x = cell.centroid.x;
    const y = cell.centroid.y;
    let minWDist = 1e9;
    for (const f of fvmMesh.faces) {
      if (f.boundaryType === 'WALL') {
        const d = Math.hypot(x - f.centroid.x, y - f.centroid.y);
        if (d < minWDist) minWDist = d;
      }
    }
    const u_speed = Math.hypot(u[c], v[c]);
    const nu = mu / rho;
    const u_tau_approx = Math.max(u_speed * 0.05, 1e-4);
    const yPlus = (u_tau_approx * minWDist) / nu;

    // Determine region
    let spatialRegion = 'FAR_FIELD';
    const rFromOrigin = Math.hypot(x - 0.5, y);
    if (isWallAdjacent) {
      if (x < 0.05) spatialRegion = 'WALL_LEADING_EDGE';
      else if (x > 0.95) spatialRegion = 'WALL_TRAILING_EDGE';
      else if (y > 0) spatialRegion = 'WALL_UPPER_SURFACE';
      else spatialRegion = 'WALL_LOWER_SURFACE';
    } else if (minWDist < 0.05) {
      if (x < 0.05) spatialRegion = 'BL_LEADING_EDGE';
      else if (x > 0.95) spatialRegion = 'BL_TRAILING_EDGE';
      else if (y > 0) spatialRegion = 'BL_UPPER_SURFACE';
      else spatialRegion = 'BL_LOWER_SURFACE';
    } else if (x >= 1.0 && Math.abs(y) < 0.2) {
      spatialRegion = 'NEAR_WAKE';
    } else if (isOutletAdjacent) {
      spatialRegion = 'OUTLET_BOUNDARY';
    } else if (isInletAdjacent) {
      spatialRegion = 'INLET_BOUNDARY';
    }

    const aspectRatio = maxFaceArea / Math.max(minFaceArea, 1e-12);

    audits.push({
      cellId: c,
      i, j,
      x, y,
      u: u[c],
      v: v[c],
      p: p[c],
      k: k[c],
      omega: omega[c],
      nut: nut[c],
      rawResidualU: rawResU,
      rawResidualV: rawResV,
      rawResidualMag: rawResMag,
      normResidualU: normResU,
      normResidualV: normResV,
      normResidualMag: normResMag,
      aP: aP_relaxed,
      aP_unrelaxed: aP_unrel,
      pressureGradX: pressGradX,
      pressureGradY: pressGradY,
      convectionTermX: convX,
      convectionTermY: convY,
      diffusionTermX: diffX,
      diffusionTermY: diffY,
      sourceTermX: sourceX,
      sourceTermY: sourceY,
      neighborFluxContribX: sum_nb_u,
      neighborFluxContribY: sum_nb_v,
      boundaryContribX: boundX,
      boundaryContribY: boundY,
      wallContribX: wallX,
      wallContribY: wallY,
      volume: cell.volume,
      aspectRatio,
      skewness: 0.0,
      wallDistance: minWDist,
      yPlus,
      spatialRegion
    });
  }

  // Sort by normalized residual descending
  audits.sort((a, b) => b.normResidualMag - a.normResidualMag);

  const top20 = audits.slice(0, 20);

  // Separate X and Y stats
  let maxAbsRu = 0, maxAbsRv = 0, maxAbsRmag = 0;
  let maxNormRu = 0, maxNormRv = 0;
  for (const a of audits) {
    if (Math.abs(a.rawResidualU) > maxAbsRu) maxAbsRu = Math.abs(a.rawResidualU);
    if (Math.abs(a.rawResidualV) > maxAbsRv) maxAbsRv = Math.abs(a.rawResidualV);
    if (a.rawResidualMag > maxAbsRmag) maxAbsRmag = a.rawResidualMag;
    if (a.normResidualU > maxNormRu) maxNormRu = a.normResidualU;
    if (a.normResidualV > maxNormRv) maxNormRv = a.normResidualV;
  }

  // Spatial concentration stats
  const regionCounts: Record<string, number> = {};
  for (const c of top20) {
    regionCounts[c.spatialRegion] = (regionCounts[c.spatialRegion] || 0) + 1;
  }

  console.log('=== MOMENTUM L_INF ROOT CAUSE DIAGNOSTIC RESULTS ===');
  console.log(`Max Normalized R_u: ${maxNormRu.toFixed(6)}`);
  console.log(`Max Normalized R_v: ${maxNormRv.toFixed(6)}`);
  console.log(`Max Raw |R_u|: ${maxAbsRu.toExponential(4)} N`);
  console.log(`Max Raw |R_v|: ${maxAbsRv.toExponential(4)} N`);
  console.log(`Top 20 Region Distribution:`, regionCounts);
  console.log('\nTop 5 Worst Cells:');
  for (let i = 0; i < 5; i++) {
    const c = top20[i];
    console.log(`[Rank ${i+1}] Cell ${c.cellId} (i=${c.i}, j=${c.j}) Region=${c.spatialRegion} x=${c.x.toFixed(4)}, y=${c.y.toFixed(4)}:`);
    console.log(`  u=${c.u.toFixed(4)}, v=${c.v.toFixed(4)}, p=${c.p.toFixed(4)} Pa, aP=${c.aP.toExponential(4)}`);
    console.log(`  NormResU=${c.normResidualU.toFixed(6)}, NormResV=${c.normResidualV.toFixed(6)} (NormResMag=${c.normResidualMag.toFixed(6)})`);
    console.log(`  RawResU=${c.rawResidualU.toExponential(4)}, RawResV=${c.rawResidualV.toExponential(4)}`);
    console.log(`  PressGradX=${c.pressureGradX.toExponential(4)}, PressGradY=${c.pressureGradY.toExponential(4)}`);
    console.log(`  d_wall=${c.wallDistance.toExponential(4)} m, y+=${c.yPlus.toFixed(2)}, AspectRatio=${c.aspectRatio.toFixed(2)}`);
  }

  fs.writeFileSync('top20_momentum_cells.json', JSON.stringify({
    summary: {
      maxNormRu,
      maxNormRv,
      maxAbsRu,
      maxAbsRv,
      regionCounts
    },
    top20
  }, null, 2));

  console.log('Top 20 worst cells written to top20_momentum_cells.json');
}

runDiagnostic();
