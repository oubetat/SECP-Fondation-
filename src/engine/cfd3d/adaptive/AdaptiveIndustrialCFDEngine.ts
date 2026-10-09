/**
 * SECP Industrial OS v2 — Adaptive Industrial CFD Engine
 * Phase 15 (PATCH-174)
 *
 * The primary entry point orchestrating the entire industrial CFD workflow:
 * Case Definition → Pre-Flight Validation → Mesh Diagnostics → BC Validation →
 * Solver Configuration → Adaptive Time Integration → Nonlinear/Linear Solve →
 * Residual Monitoring → Physical Monitoring → Adaptive Control → Validation → CFD Evidence
 */

import { FvmMesh3D } from '../Fvm3DTypes';
import {
  CaseDefinition3D,
  AdaptiveCFDSolution,
  ResidualSnapshot,
  PhysicalMonitorsSnapshot
} from './AdaptiveCFDTypes';
import { PreFlightValidator } from './PreFlightValidator';
import { MeshDiagnosticsEngine } from './MeshDiagnosticsEngine';
import { BoundaryConditionValidator } from './BoundaryConditionValidator';
import { AdaptiveCFLTimeController } from './AdaptiveCFLTimeController';
import { DynamicRelaxationController } from './DynamicRelaxationController';
import { PhysicalResidualMonitor } from './PhysicalResidualMonitor';
import { DivergenceRecoveryEngine } from './DivergenceRecoveryEngine';
import { CompressibleShockSensor } from './CompressibleShockSensor';
import { CFDEvidenceGenerator } from './CFDEvidenceGenerator';
import { ConservationEnforcementEngine } from '../conservation/enforcement/ConservationEnforcementEngine';
import { TurbulenceModelRegistry } from '../turbulence/registry/TurbulenceModelRegistry';
import { TurbulenceModelIdentity } from '../turbulence/types/TurbulenceTypes';
import { VortexDiagnostics } from '../turbulence/diagnostics/VortexDiagnostics';

export class AdaptiveIndustrialCFDEngine {
  /**
   * Executes the full industrial CFD pipeline adaptively with Real-Time Conservation Enforcement
   */
  public static runSimulation(
    caseDef: CaseDefinition3D,
    mesh: FvmMesh3D
  ): AdaptiveCFDSolution {
    const startTime = performance.now();

    // 1. Pre-Flight Validation
    const preFlight = PreFlightValidator.validateCase(caseDef, mesh);
    if (!preFlight.isReadyForSolve) {
      throw new Error(`CFD_PREFLIGHT_FAILURE: Pre-flight checks failed. ${preFlight.identifiedRisks.join(' | ')}`);
    }

    // 2. Mesh Diagnostics
    const meshQuality = MeshDiagnosticsEngine.evaluateMeshQuality(mesh);
    if (!meshQuality.isValid) {
      throw new Error(`CFD_MESH_FAILURE: Mesh failed validation. ${meshQuality.criticalErrors.join(' | ')}`);
    }

    // 3. Boundary Condition Validation
    const bcReport = BoundaryConditionValidator.validate(mesh, caseDef);
    if (!bcReport.isValid) {
      throw new Error(`CFD_BC_FAILURE: Boundary condition validation failed. ${bcReport.issues.join(' | ')}`);
    }

    // 4. Initialize Controllers, Monitors & Conservation Enforcement Engine
    const numCells = mesh.cells.length;
    const cflController = new AdaptiveCFLTimeController(5.0, 1e-3, 1e-7, 0.1);
    const relaxationController = new DynamicRelaxationController(0.3, 0.7);
    const monitor = new PhysicalResidualMonitor();
    const recoveryEngine = new DivergenceRecoveryEngine();
    const conservationEngine = new ConservationEnforcementEngine();

    // Initialize Turbulence Model via Registry (Zero Hardcoded Branching)
    TurbulenceModelRegistry.initialize();
    const turbIdentity = (caseDef.turbulenceModelIdentity as TurbulenceModelIdentity) || 'KOMEGA_SST';
    const turbulenceModel = TurbulenceModelRegistry.create(turbIdentity, 'VALIDATED');
    let turbulenceStates = turbulenceModel.initialize(
      mesh as any,
      {
        density: caseDef.fluid.densityKgM3,
        viscosity: caseDef.fluid.viscosityPaS,
        specificHeat: 1005,
        thermalConductivity: caseDef.fluid.thermalConductivityWMK
      },
      caseDef.referenceVelocityMS,
      caseDef.referenceLengthM
    );

    // 5. Initialize Field Arrays
    const u = new Array<number>(numCells).fill(caseDef.initialConditions.velocity.x || caseDef.referenceVelocityMS);
    const v = new Array<number>(numCells).fill(caseDef.initialConditions.velocity.y || 0.0);
    const w = new Array<number>(numCells).fill(caseDef.initialConditions.velocity.z || 0.0);
    const p = new Array<number>(numCells).fill(caseDef.initialConditions.pressurePa || 0.0);
    const massResiduals = new Array<number>(numCells).fill(0.0);

    const u_prev = new Array<number>(numCells).fill(0.0);
    const v_prev = new Array<number>(numCells).fill(0.0);
    const w_prev = new Array<number>(numCells).fill(0.0);
    const p_prev = new Array<number>(numCells).fill(0.0);
    const u_prev2 = new Array<number>(numCells).fill(0.0);

    // Synchronize inlet boundary face velocities to initial field
    for (const face of mesh.faces) {
      if (face.boundaryType === 'INLET' && face.u_bc !== undefined) {
        const ownerId = face.ownerCellId;
        if (ownerId >= 0 && ownerId < numCells) {
          u[ownerId] = face.u_bc;
        }
      }
    }

    const maxIterations = caseDef.targetConvergence.maxIterations || 150;
    const convergenceHistory: AdaptiveCFDSolution['convergenceHistory'] = [];

    let totalSimulatedTimeS = 0.0;
    let converged = false;
    let finalResiduals!: ResidualSnapshot;
    let finalMonitors!: PhysicalMonitorsSnapshot;

    const rho = caseDef.fluid.densityKgM3;
    const mu = caseDef.fluid.viscosityPaS;

    // 6. Iterative Adaptive Simulation Loop with Real-Time Conservation Enforcement
    for (let iter = 1; iter <= maxIterations; iter++) {
      // Copy previous step fields
      for (let i = 0; i < numCells; i++) {
        u_prev2[i] = u_prev[i];
        u_prev[i] = u[i];
        v_prev[i] = v[i];
        w_prev[i] = w[i];
        p_prev[i] = p[i];
      }

      // Compute max CFL
      const { maxCFL } = cflController.computeMaxCFL(mesh, u, v, w, caseDef.fluid);

      // Nonlinear Navier-Stokes simple step execution with dynamic relaxation
      const relaxState = relaxationController.getState();
      let alphaU = relaxState.alphaMomentum;
      let alphaP = relaxState.alphaPressure;
      let currentDt = cflController.getState().currentTimestepS;

      // Face fluxes & Momentum solve with Turbulent Effective Viscosity (mu_eff = mu + rho * nut)
      const currentVelocity = u.map((val, idx) => ({ x: val, y: v[idx], z: w[idx] }));
      const velGradients = VortexDiagnostics.computeVelocityGradients(mesh as any, currentVelocity);
      turbulenceStates = turbulenceModel.updateTurbulenceState(
        turbulenceStates,
        currentVelocity,
        velGradients,
        p,
        rho,
        mu,
        mesh as any,
        currentDt
      );

      for (let cId = 0; cId < numCells; cId++) {
        const cell = mesh.cells[cId];
        let dU_conv = 0;
        let dU_diff = 0;
        let massImbalanceCell = 0;
        const cellNut = turbulenceStates[cId]?.nut || 0.0;
        const muEff = mu + (rho * cellNut);

        for (const fId of cell.faceIds) {
          const face = mesh.faces[fId];
          const isOwner = face.ownerCellId === cId;
          const neighId = face.neighborCellId;
          const sign = isOwner ? 1.0 : -1.0;

          let faceU = u[cId];
          let faceP = p[cId];

          if (neighId !== -1) {
            const otherId = isOwner ? neighId : face.ownerCellId;
            faceU = 0.5 * (u[cId] + u[otherId]);
            faceP = 0.5 * (p[cId] + p[otherId]);
            const dPN = Math.max(1e-6, Math.abs(mesh.cells[otherId].centroid.x - cell.centroid.x));
            const neighNut = turbulenceStates[otherId]?.nut || 0.0;
            const faceMuEff = 0.5 * (muEff + mu + (rho * neighNut));
            dU_diff += (faceMuEff * face.area * (u[otherId] - u[cId])) / dPN;
          } else {
            if (face.boundaryType === 'INLET' && face.u_bc !== undefined) {
              faceU = face.u_bc;
            } else if (face.boundaryType && face.boundaryType.startsWith('WALL')) {
              faceU = 0.0;
              const dy = Math.max(1e-6, Math.abs(face.centroid.y - cell.centroid.y));
              dU_diff -= (muEff * face.area * u[cId]) / dy;
            }
          }

          const massFlux = rho * face.area * (face.normal.x * faceU);
          massImbalanceCell += sign * massFlux;
          dU_conv -= sign * massFlux * faceU;
        }

        massResiduals[cId] = massImbalanceCell;

        // Momentum relaxation update
        const vol = Math.max(1e-12, cell.volume);
        const targetU = u[cId] + (currentDt / (rho * vol)) * (dU_conv + dU_diff);

        // Under-relaxed step
        u[cId] = u[cId] + alphaU * (targetU - u[cId]);

        // Continuity pressure correction
        const pCorrection = - (massImbalanceCell / (rho * vol + 1e-12)) * (currentDt * 50.0);
        p[cId] = p[cId] + alphaP * pCorrection;
      }

      // Real-Time Conservation Enforcement & Physical Bounds Evaluation
      const enforcement = conservationEngine.evaluateIteration(
        iter,
        mesh,
        u,
        v,
        w,
        p,
        massResiduals,
        rho,
        mu,
        currentDt,
        maxCFL,
        alphaU,
        alphaP
      );

      // Decision Handling: REJECT / RECOVER / ABORT / ACCEPT
      if (enforcement.decision === 'REJECT' || enforcement.decision === 'RECOVER') {
        if (enforcement.restoredCheckpoint) {
          const chk = enforcement.restoredCheckpoint;
          for (let i = 0; i < numCells; i++) {
            u[i] = chk.u[i];
            v[i] = chk.v[i];
            w[i] = chk.w[i];
            p[i] = chk.p[i];
          }
        }
        alphaU = enforcement.adjustedAlphaU;
        alphaP = enforcement.adjustedAlphaP;
        currentDt = enforcement.adjustedDt;
        cflController.adaptTimestep(maxCFL, 1.0, true);
        continue;
      } else if (enforcement.decision === 'ABORT') {
        break;
      }

      // Check for Numerical Divergence
      const maxResEstimate = Math.max(...massResiduals.map(Math.abs));
      const prevMaxRes = iter > 1 ? monitor.getHistories().residuals[monitor.getHistories().residuals.length - 1]?.maxResidual || 1.0 : 1.0;
      const divergenceCheck = recoveryEngine.checkDivergence(iter, u, v, w, p, caseDef.referenceVelocityMS, maxResEstimate, prevMaxRes);

      if (divergenceCheck.isDiverging) {
        const recoveryResult = recoveryEngine.recover(iter, divergenceCheck.reason);
        if (recoveryResult.success && recoveryResult.restoredState) {
          const restored = recoveryResult.restoredState;
          for (let i = 0; i < numCells; i++) {
            u[i] = restored.u[i];
            v[i] = restored.v[i];
            w[i] = restored.w[i];
            p[i] = restored.p[i];
          }
          cflController.adaptTimestep(maxCFL, 1.0, true);
        }
      } else {
        if (iter % 5 === 0) {
          recoveryEngine.saveCheckpoint(iter, u, v, w, p, maxResEstimate);
        }
      }

      // Monitor Residuals & Physical Quantities
      finalResiduals = monitor.computeResiduals(iter, u, u_prev, v, v_prev, w, w_prev, p, p_prev, massResiduals);
      finalMonitors = monitor.computePhysicalMonitors(iter, mesh, caseDef, p, u, v, w);

      // Adaptive Control Updates
      relaxationController.updateRelaxation(iter, finalResiduals.maxResidual);
      const dt = cflController.adaptTimestep(maxCFL, finalResiduals.maxResidual / (prevMaxRes || 1.0));
      totalSimulatedTimeS += dt;

      // Log convergence point
      convergenceHistory.push({
        iteration: iter,
        residuals: finalResiduals,
        monitors: finalMonitors,
        cfl: maxCFL,
        dt
      });

      // Dual Convergence Evaluation (Residuals + Physical Forces + Conservation Laws)
      const convEval = monitor.evaluateConvergence(finalResiduals, finalMonitors, caseDef);
      const conservationPassed = enforcement.telemetry.mass.passed && enforcement.telemetry.continuity.passed;
      if (convEval.isConverged && conservationPassed && iter >= (caseDef.targetConvergence.minConsecutiveConvergedIters || 5)) {
        converged = true;
        break;
      }
    }

    // 7. Compressible Shock Diagnostics
    const shockReport = CompressibleShockSensor.detectShocks(mesh, u, v, w, p, caseDef.fluid);

    // 8. Generate Verifiable Evidence Artifact
    const evidenceArtifact = CFDEvidenceGenerator.generateArtifact(
      caseDef,
      meshQuality,
      preFlight,
      finalResiduals,
      finalMonitors,
      convergenceHistory.length,
      converged
    );

    const executionTimeMs = performance.now() - startTime;
    const telemetrySummary = conservationEngine.getTelemetry().getSummary();
    const lastTelemetry = conservationEngine.getTelemetry().getHistory().slice(-1)[0];
    const finalTurbulenceDiagnostics = turbulenceModel.getDiagnostics(
      turbulenceStates,
      u.map((val, idx) => ({ x: val, y: v[idx], z: w[idx] })),
      mesh as any
    );

    return {
      caseId: caseDef.caseId,
      converged,
      totalIterations: telemetrySummary.totalIterations,
      acceptedIterations: telemetrySummary.acceptedIterations,
      rejectedIterations: telemetrySummary.rejectedIterations,
      totalSimulatedTimeS,
      executionTimeMs,
      finalResiduals,
      finalMonitors,
      finalMassConservation: lastTelemetry?.mass,
      finalMomentumConservation: lastTelemetry?.momentum,
      finalEnergyConservation: lastTelemetry?.energy,
      finalContinuity: lastTelemetry?.continuity,
      finalPhysicalBounds: lastTelemetry?.physicalBounds,
      finalFluxBalance: lastTelemetry?.fluxBalance,
      finalTurbulenceDiagnostics,
      conservationTelemetry: conservationEngine.getTelemetry().getHistory(),
      meshQuality,
      preFlight,
      cflState: cflController.getState(),
      relaxationState: relaxationController.getState(),
      shockReport,
      recoveryHistory: recoveryEngine.getRecoveryLog(),
      convergenceHistory,
      evidenceArtifact
    };
  }
}
