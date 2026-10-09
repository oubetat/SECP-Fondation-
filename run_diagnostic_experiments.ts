/**
 * NACA0012 SST — CONTROLLED DIAGNOSTIC BATTERY
 * CANONICAL RESULT CONTRACT + MOMENTUM-L∞ ROOT-CAUSE FORENSICS
 */

import { AirfoilMeshGenerator } from './src/engine/cfd3d/mesh/AirfoilMeshGenerator';
import { Fvm3DNavierStokesSolver } from './src/engine/cfd3d/Fvm3DNavierStokesSolver';
import { FvmMesh3D, CfdSolution3D, FvmCell3D } from './src/engine/cfd3d/Fvm3DTypes';
import * as fs from 'fs';
import * as crypto from 'crypto';

interface RegionStats {
  region: string;
  count: number;
  maxRu: number;
  maxRv: number;
  maxCombined: number;
  meanResidual: number;
  p95: number;
  p99: number;
}

function getRegion(cell: FvmCell3D, nx: number, ny: number): string {
  // O-Grid indexing: i circumferential, j radial
  const j = Math.floor(cell.cellId / nx) % ny;
  
  if (j === 0) return 'AIRFOIL_WALL';
  if (j === ny - 1) {
    // Check if it's inlet or outlet based on centroid (AoA 10 deg)
    const aoaRad = (10 * Math.PI) / 180;
    const cosA = Math.cos(aoaRad);
    const sinA = Math.sin(aoaRad);
    const dx = cell.centroid.x - 0.5;
    const dy = cell.centroid.y;
    const dot = dx * cosA + dy * sinA;
    return dot < 0 ? 'INLET_BOUNDARY' : 'OUTLET_BOUNDARY';
  }
  if (j >= ny * 0.8) return 'FAR_FIELD';
  return 'INTERIOR';
}

async function runExperiment(id: string, name: string, nx: number, ny: number, alpha_u: number, alpha_p: number) {
  console.log(`[DIAGNOSTIC] Running ${id}: ${name} (${nx}x${ny}, alpha_u=${alpha_u}, alpha_p=${alpha_p})...`);

  const mesh = AirfoilMeshGenerator.generateOGrid({
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

  const meshPayload = JSON.stringify({ nx, ny, cells: mesh.cells.length });
  const meshHash = crypto.createHash('sha256').update(meshPayload).digest('hex').substring(0, 16);

  const aoaRad = (10 * Math.PI) / 180;
  const cosA = Math.cos(aoaRad);
  const sinA = Math.sin(aoaRad);

  for (const f of mesh.faces) {
    if (f.boundaryType === 'FARFIELD') {
      const dx = f.centroid.x - 0.5;
      const dy = f.centroid.y;
      const dot = dx * cosA + dy * sinA;
      if (dot < 0) {
        f.boundaryType = 'INLET';
        f.u_bc = cosA; f.v_bc = sinA; f.w_bc = 0;
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

  const config = {
    maxIterations: 500,
    continuityTol: 1e-4,
    momentumTol: 0.015,
    underRelaxationVelocity: alpha_u,
    underRelaxationPressure: alpha_p,
    useTurbulenceModel: true,
    turbulenceScheme: 'SST_K_OMEGA' as const,
    upwindScheme: 'FIRST_ORDER_UPWIND' as const
  };

  const solution = Fvm3DNavierStokesSolver.solve(mesh, fluid, config, 1.0, Uinf);
  const configHash = crypto.createHash('sha256').update(JSON.stringify(config) + meshHash).digest('hex').substring(0, 16);

  // Region Split
  const regionMap = new Map<string, number[]>();
  for (let c = 0; c < mesh.cells.length; c++) {
    const reg = getRegion(mesh.cells[c], nx, ny);
    if (!regionMap.has(reg)) regionMap.set(reg, []);
    regionMap.get(reg)!.push(c);
  }

  const budgets = mesh.cells.map((_, i) => Fvm3DNavierStokesSolver.getCellMomentumBudget(mesh, fluid, solution, i, Uinf, alpha_u));
  
  const regionStats: RegionStats[] = [];
  regionMap.forEach((cellIds, region) => {
    const resArr = cellIds.map(id => Math.max(budgets[id].norm_u, budgets[id].norm_v));
    resArr.sort((a, b) => a - b);
    const sum = resArr.reduce((a, b) => a + b, 0);
    regionStats.push({
      region,
      count: cellIds.length,
      maxRu: Math.max(...cellIds.map(id => budgets[id].norm_u)),
      maxRv: Math.max(...cellIds.map(id => budgets[id].norm_v)),
      maxCombined: resArr[resArr.length - 1],
      meanResidual: sum / cellIds.length,
      p95: resArr[Math.floor(resArr.length * 0.95)],
      p99: resArr[Math.floor(resArr.length * 0.99)]
    });
  });

  // Top 20 worst cells for Experiment A
  let worstCells: any[] = [];
  if (id === 'EXP-A') {
    const sorted = [...budgets].sort((a, b) => Math.max(b.norm_u, b.norm_v) - Math.max(a.norm_u, a.norm_v));
    worstCells = sorted.slice(0, 20).map(b => ({
      ...b,
      region: getRegion(mesh.cells[b.cellId], nx, ny)
    }));
  }

  return {
    id,
    name,
    meshHash,
    configHash,
    iterations: solution.convergenceAudit?.iteration || 0,
    cl: solution.monitors.liftCoefficientCl,
    cd: solution.monitors.dragCoefficientCd,
    cm: solution.monitors.pitchingMomentCm || 0,
    momentumResiduals: {
      linf: solution.convergenceAudit?.momentumResidualLinf || 0,
      l1: solution.convergenceAudit?.momentumResidualL1 || 0,
      l2: solution.convergenceAudit?.momentumResidualL2 || 0
    },
    continuityResiduals: {
      linf: solution.convergenceAudit?.continuity.linf || 0,
      l1: solution.convergenceAudit?.continuity.l1 || 0,
      l2: solution.convergenceAudit?.continuity.l2 || 0
    },
    corrections: {
      pressure: solution.convergenceAudit?.pressureCorrection || 0,
      velocity: solution.convergenceAudit?.velocityCorrection || 0
    },
    turbulence: {
      kResidual: solution.convergenceAudit?.turbulence.kResidual || 0,
      omegaResidual: solution.convergenceAudit?.turbulence.omegaResidual || 0
    },
    forceStability: solution.convergenceAudit?.forceStabilityPassed ? 'PASS' : 'FAIL',
    massImbalance: {
      raw: solution.continuityAudit?.rawMassImbalance || 0,
      scaled: solution.continuityAudit?.postScalingMassImbalance || 0,
      inlet: solution.continuityAudit?.globalBoundaryBalance.inletMassFlow || 0,
      outletRaw: solution.continuityAudit?.globalBoundaryBalance.outletMassFlowRaw || 0,
      outletScaled: solution.continuityAudit?.globalBoundaryBalance.outletMassFlowScaled || 0,
      scaleFactor: solution.continuityAudit?.outletScaling.scaleFactor || 1.0
    },
    regionStats,
    worstCells
  };
}

async function main() {
  const results: any[] = [];

  // Phase 1: EXP-A Baseline
  results.push(await runExperiment('EXP-A', 'Baseline Fine 120x60', 120, 60, 0.5, 0.2));

  // Phase 2: EXP-B Coarse
  results.push(await runExperiment('EXP-B', 'Coarse Grid 60x30', 60, 30, 0.5, 0.2));

  // Phase 3: EXP-C Medium
  results.push(await runExperiment('EXP-C', 'Medium Grid 90x45', 90, 45, 0.5, 0.2));

  // Phase 4: EXP-D Relaxation Sensitivity
  results.push(await runExperiment('EXP-D', 'Higher Relaxation 120x60', 120, 60, 0.7, 0.3));

  fs.writeFileSync('diagnostic_experiments.json', JSON.stringify(results, null, 2));
  console.log('[DIAGNOSTIC-COMPLETE] Results saved to diagnostic_experiments.json');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
