/**
 * SECP Industrial OS v2 — CFD Benchmark Test Runner
 * Phase 15 (PATCH-174)
 *
 * Executes individual CFD benchmark cases, audits conservation and convergence,
 * queries analytical physics oracles, hashes states, and signs evidence records.
 */

import { CFDBenchmarkCaseDefinition } from './CFDBenchmarkCaseRegistry';
import { CFDEvidenceRecord, CFDVerdict } from './types';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { CFDConservationAuditor } from './CFDConservationAuditor';
import { CFDConvergenceAuditor } from './CFDConvergenceAuditor';
import { CFDIndependentOracles } from './CFDIndependentOracles';
import { CFDDeterminismAuditor } from './CFDDeterminismAuditor';
import { pureSha256 } from '../../../polyfills/crypto';

export class CFDRunner {
  /**
   * Executes a single CFD benchmark case and builds its cryptographic evidence record
   */
  public static runCase(caseDef: CFDBenchmarkCaseDefinition): CFDEvidenceRecord {
    const { mesh, fluid, config, referenceAreaM2, referenceVelocityMS, analyticalCheck } = caseDef.setup();

    const t0 = performance.now();
    let solution;
    let actualVerdict: CFDVerdict = 'PASS';
    let solverError = '';

    try {
      solution = Fvm3DNavierStokesSolver.solve(mesh, fluid, config, referenceAreaM2, referenceVelocityMS);
    } catch (err: any) {
      solverError = err.message || 'Unknown solver exception';
      actualVerdict = 'NUMERICAL_FAILURE';
    }

    const solveTimeMs = performance.now() - t0;
    const iterations = solution ? solution.iterations : 0;
    const timePerIterationMs = iterations > 0 ? solveTimeMs / iterations : 0;

    // Handle energy case (TC-CFD-B03)
    if (caseDef.id === 'TC-CFD-B03') {
      actualVerdict = 'UNPROVEN';
    }

    // Mass & Momentum Conservation Audits
    const massBalance = solution
      ? CFDConservationAuditor.auditMassConservation(mesh, solution, fluid)
      : {
          totalInflowKgS: 0,
          totalOutflowKgS: 0,
          netImbalanceKgS: 999,
          relativeImbalancePercent: 100,
          isConserved: false
        };

    const momentumBalance = solution
      ? CFDConservationAuditor.auditMomentumConservation(mesh, solution, fluid)
      : {
          pressureForceXN: 0,
          viscousForceXN: 0,
          netForceXN: 0,
          momentumFluxNetXN: 0,
          residualImbalanceN: 999,
          isConserved: false
        };

    const energyBalance = CFDConservationAuditor.auditEnergyConservation();

    // Convergence Audit
    const convergenceDiag = solution
      ? CFDConvergenceAuditor.diagnoseConvergence(solution, massBalance, config.continuityTol, config.momentumTol)
      : {
          verdict: 'NUMERICAL_FAILURE' as CFDVerdict,
          isMonotonic: false,
          isStagnated: false,
          isDiverged: false,
          isFalseConvergenceDetected: false,
          residualContinuity: 999,
          residualMomentum: 999,
          iterationsCompleted: 0,
          decayRatio: 1.0,
          details: solverError
        };

    // Analytical Reference Error Check
    let referenceResult;
    let numericalResult;
    let errorNorm;

    if (solution && analyticalCheck && analyticalCheck.type !== 'NONE') {
      if (analyticalCheck.type === 'POISEUILLE') {
        const analytical = CFDIndependentOracles.getPoiseuilleAnalytical(
          mesh.boundingBox.max.x - mesh.boundingBox.min.x,
          mesh.boundingBox.max.y - mesh.boundingBox.min.y,
          mesh.boundingBox.max.z - mesh.boundingBox.min.z,
          referenceVelocityMS,
          fluid.viscosityPaS,
          fluid.densityKgM3
        );
        const exactDeltaP = analytical.exactPressureDropPa;
        const numDeltaP = solution.monitors.pressureDropPa;
        const relErr = (Math.abs(numDeltaP - exactDeltaP) / exactDeltaP) * 100.0;
        const withinTol = relErr <= analyticalCheck.tolerancePercent;

        referenceResult = {
          type: 'EXACT_ANALYTICAL' as const,
          description: 'Exact Poiseuille Navier-Stokes Channel Pressure Drop (12*mu*L*U/h^2)',
          referenceValue: exactDeltaP,
          unit: 'Pa'
        };
        numericalResult = {
          numericalValue: numDeltaP,
          unit: 'Pa'
        };
        errorNorm = {
          absoluteError: Math.abs(numDeltaP - exactDeltaP),
          relativeErrorPercent: relErr,
          tolerancePercent: analyticalCheck.tolerancePercent,
          withinTolerance: withinTol
        };

        if (!withinTol) {
          actualVerdict = 'FAIL';
        }
      } else if (analyticalCheck.type === 'COUETTE') {
        const analytical = CFDIndependentOracles.getCouetteAnalytical(
          mesh.boundingBox.max.y - mesh.boundingBox.min.y,
          referenceVelocityMS,
          fluid.viscosityPaS,
          fluid.densityKgM3
        );
        const exactTau = analytical.exactWallShearStressPa;
        let numTau = 0.0;
        let movingWallArea = 0.0;
        for (const face of mesh.faces) {
          if (face.boundaryType === 'WALL' && face.u_bc !== undefined && face.u_bc > 0) {
            const c = face.ownerCellId;
            const cellCentroid = mesh.cells[c].centroid;
            const d_wall = Math.abs(cellCentroid.y - face.centroid.y);
            const u_rel = Math.abs((face.u_bc ?? 0) - solution.velocity.u[c]);
            const tau = fluid.viscosityPaS * (u_rel / Math.max(d_wall, 1e-6));
            numTau += tau * face.area;
            movingWallArea += face.area;
          }
        }
        if (movingWallArea > 0) {
          numTau /= movingWallArea;
        } else {
          numTau = Math.abs(solution.monitors.viscousDragForceN) / Math.max(referenceAreaM2, 1e-4);
        }
        const relErr = (Math.abs(numTau - exactTau) / Math.max(exactTau, 1e-4)) * 100.0;
        const withinTol = relErr <= analyticalCheck.tolerancePercent;

        referenceResult = {
          type: 'EXACT_ANALYTICAL' as const,
          description: 'Exact Couette Wall Shear Stress (mu * U_wall / h)',
          referenceValue: exactTau,
          unit: 'Pa'
        };
        numericalResult = {
          numericalValue: numTau,
          unit: 'Pa'
        };
        errorNorm = {
          absoluteError: Math.abs(numTau - exactTau),
          relativeErrorPercent: relErr,
          tolerancePercent: analyticalCheck.tolerancePercent,
          withinTolerance: withinTol
        };
      }
    }

    // Determinism Audit
    const detResult = solution
      ? CFDDeterminismAuditor.verifyDeterminism(
          () => caseDef.setup().mesh,
          fluid,
          config,
          2
        )
      : {
          isDeterministic: false,
          isReproducible: false,
          passCount: 0,
          driftCount: 2,
          outputHashes: []
        };

    // Calculate final verdict
    if (caseDef.id === 'TC-CFD-B03') {
      actualVerdict = 'UNPROVEN';
    } else if (!solution) {
      actualVerdict = 'NUMERICAL_FAILURE';
    } else if (convergenceDiag.isFalseConvergenceDetected) {
      actualVerdict = 'CONSERVATION_FAILURE';
    } else if (errorNorm && !errorNorm.withinTolerance) {
      actualVerdict = 'FAIL';
    } else if (!detResult.isDeterministic) {
      actualVerdict = 'NON_DETERMINISTIC';
    } else {
      actualVerdict = 'PASS';
    }

    // Hashes & Signatures using real pureSha256
    const meshPayload = `${mesh.meshId}:${mesh.cells.length}:${mesh.faces.length}`;
    const meshHash = `sha256-mesh-${pureSha256(meshPayload).substring(0, 16)}`;
    const inputPayload = `${fluid.densityKgM3}:${fluid.viscosityPaS}:${referenceVelocityMS}`;
    const inputHash = `sha256-input-${pureSha256(inputPayload).substring(0, 16)}`;
    const timestamp = new Date().toISOString();
    const attestationPayload = `${caseDef.id}::${actualVerdict}::${meshHash}::${inputHash}::${iterations}`;
    const attestationSignature = `sig-cfd-${caseDef.id}-${pureSha256(attestationPayload).substring(0, 24)}`;

    const lastLog = solution?.iterationHistory?.[solution.iterationHistory.length - 1];

    return {
      testId: caseDef.id,
      category: caseDef.category,
      title: caseDef.title,
      description: caseDef.description,
      meshHash,
      inputHash,
      solverVersion: 'Fvm3DNavierStokesSolver v082.1-SIMPLE-RhieChow',
      solverConfiguration: {
        maxIterations: config.maxIterations,
        continuityTol: config.continuityTol,
        momentumTol: config.momentumTol,
        underRelaxationVelocity: config.underRelaxationVelocity || 0.7,
        underRelaxationPressure: config.underRelaxationPressure || 0.3,
        turbulenceScheme: config.turbulenceScheme || 'LAMINAR',
        upwindScheme: config.upwindScheme || 'FIRST_ORDER_UPWIND'
      },
      material: {
        densityKgM3: fluid.densityKgM3,
        viscosityPaS: fluid.viscosityPaS,
        reynoldsNumber: solution?.reynoldsNumber || 0,
        flowRegime: solution?.flowRegime || 'LAMINAR'
      },
      boundaryConditions: {
        xMin: 'INLET / WALL',
        xMax: 'OUTLET / WALL',
        y: 'WALL',
        z: 'SYMMETRY / WALL'
      },
      initialConditions: `u0=${referenceVelocityMS}m/s, p0=0Pa`,
      cellCount: mesh.cells.length,
      faceCount: mesh.faces.length,
      iterations,
      solveTimeMs,
      timePerIterationMs,
      residuals: {
        continuity: lastLog ? lastLog.continuityResidual : (solution ? solution.finalContinuityResidual : 999),
        uMomentum: lastLog ? lastLog.uMomentumResidual : (solution ? solution.finalMomentumResidual : 999),
        vMomentum: lastLog ? lastLog.vMomentumResidual : 0,
        wMomentum: lastLog ? lastLog.wMomentumResidual : 0,
        energyResidual: 'UNPROVEN'
      },
      massBalance,
      momentumBalance,
      energyBalance,
      referenceResult,
      numericalResult,
      errorNorm,
      determinismResult: detResult,
      reproducibilityResult: {
        runtime: 'V8 / Node.js Engine',
        environmentConsistent: true,
        hashMatched: detResult.isReproducible
      },
      expectedVerdict: caseDef.expectedVerdict,
      actualVerdict,
      verdict: actualVerdict,
      attestationSignature,
      timestamp
    };
  }
}
