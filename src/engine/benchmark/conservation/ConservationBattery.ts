/**
 * SECP Industrial OS v2 — Conservation Battery Orchestrator
 * Phase 15 (PATCH-175)
 *
 * Runs the comprehensive physical conservation test suite across Mass, Momentum,
 * and Energy balance laws, adversarial injections, grid sensitivity studies,
 * and cryptographic provenance attestation.
 */

import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { ConservationCaseRegistry } from './ConservationCaseRegistry';
import { ConservationVerifier } from './ConservationVerifier';
import { ConservationAdversarialSuite } from './ConservationAdversarialSuite';
import { ConservationMeshSensitivity } from './ConservationMeshSensitivity';
import { ConservationAntiFabrication } from './ConservationAntiFabrication';
import {
  ConservationBatteryReport,
  ConservationEvidencePacket,
  ConservationVerdict
} from './types';

export class ConservationBattery {
  public static readonly VERSION = '1.0.0-SECP-PATCH175';

  /**
   * Executes the full Conservation Battery suite.
   */
  public static runBattery(): ConservationBatteryReport {
    const batteryId = `BATTERY-CONSERV-175-${Date.now()}`;
    const tStartTotal = performance.now();
    const cases = ConservationCaseRegistry.getCases();
    const evidenceLedger: ConservationEvidencePacket[] = [];

    let passedCount = 0;
    let failedCount = 0;
    let unprovenCount = 0;
    let notConvergedCount = 0;
    let invalidCount = 0;
    let conservationFailureCount = 0;

    let worstMassError = 0.0;
    let worstMomentumError = 0.0;

    for (const caseDef of cases) {
      const tStart = performance.now();
      const mesh = caseDef.meshGenerator();
      const meshHash = ConservationAntiFabrication.hashData({
        cellCount: mesh.cells.length,
        faceCount: mesh.faces.length,
        boundingBox: mesh.boundingBox
      });
      const geometryHash = ConservationAntiFabrication.hashData(mesh.cells.map(c => c.centroid));
      const inputHash = ConservationAntiFabrication.hashData({
        fluid: caseDef.fluid,
        config: caseDef.config,
        thresholds: caseDef.thresholds
      });
      const boundaryConditionHash = ConservationAntiFabrication.hashData(
        mesh.faces.filter(f => f.neighborCellId === -1).map(f => ({
          type: f.boundaryType,
          u: f.u_bc,
          v: f.v_bc,
          w: f.w_bc,
          p: f.p_bc
        }))
      );

      let solution;
      let solveTimeMs = 0;
      let runError: any = null;

      try {
        const tSolveStart = performance.now();
        solution = Fvm3DNavierStokesSolver.solve(mesh, caseDef.fluid, caseDef.config);
        solveTimeMs = performance.now() - tSolveStart;
      } catch (err: any) {
        runError = err;
      }

      if (runError || !solution) {
        invalidCount++;
        const unsignedPacket: Omit<ConservationEvidencePacket, 'attestationSignature'> = {
          caseId: caseDef.caseId,
          title: caseDef.title,
          solverVersion: 'Fvm3DNavierStokesSolver-v2.1',
          meshHash,
          geometryHash,
          inputHash,
          boundaryConditionHash,
          resultHash: '0x0000000000000000',
          cellCount: mesh.cells.length,
          faceCount: mesh.faces.length,
          iterations: 0,
          solverConverged: false,
          solverContinuityResidual: NaN,
          solverMomentumResidual: NaN,
          solveTimeMs: performance.now() - tStart,
          conservationMetrics: {
            mass: {
              inflowKgS: 0,
              outflowKgS: 0,
              accumulationKgS: 0,
              imbalanceKgS: NaN,
              relativeErrorPercent: NaN,
              isConserved: false,
              thresholdPercent: caseDef.thresholds.maxMassRelativeErrorPercent,
              status: 'FAILED',
              details: `Solver error: ${runError?.message || 'Unknown'}`
            },
            energy: {
              convectiveInflowW: 0,
              convectiveOutflowW: 0,
              conductiveFluxW: 0,
              pressureWorkW: 0,
              sourceTermsW: 0,
              accumulationW: 0,
              imbalanceW: NaN,
              relativeErrorPercent: NaN,
              isConserved: false,
              thresholdPercent: caseDef.thresholds.maxEnergyRelativeErrorPercent,
              status: 'UNPROVEN',
              notes: 'Execution failed.'
            }
          },
          thresholds: caseDef.thresholds,
          verdict: 'INVALID',
          failureReasons: [`Solver exception: ${runError?.message || 'Unknown'}`],
          timestamp: new Date().toISOString(),
          executionEnvironment: {
            runtime: 'SECP-Industrial-OS-V2',
            platform: 'Node/WebAssembly/TypeScript',
            deterministicSeed: 'SECP-SEED-CONSERV-175'
          }
        };
        const sig = ConservationAntiFabrication.signEvidence(unsignedPacket);
        evidenceLedger.push({ ...unsignedPacket, attestationSignature: sig });
        continue;
      }

      const resultHash = ConservationAntiFabrication.hashData({
        velocityU: solution.velocity.u.slice(0, 10),
        pressure: solution.pressure.slice(0, 10),
        residuals: solution.finalContinuityResidual
      });

      const verification = ConservationVerifier.verifyConservation(
        mesh,
        solution,
        caseDef.fluid,
        caseDef.config,
        caseDef.thresholds,
        caseDef.bodyForce
      );

      const verdict = verification.verdict;
      if (verdict === 'PASS') passedCount++;
      else if (verdict === 'CONSERVATION_FAILURE') conservationFailureCount++;
      else if (verdict === 'NOT_CONVERGED') notConvergedCount++;
      else if (verdict === 'UNPROVEN') unprovenCount++;
      else if (verdict === 'INVALID') invalidCount++;
      else failedCount++;

      if (!isNaN(verification.metrics.mass.relativeErrorPercent)) {
        if (verification.metrics.mass.relativeErrorPercent > worstMassError) {
          worstMassError = verification.metrics.mass.relativeErrorPercent;
        }
      }

      if (verification.metrics.momentum && !isNaN(verification.metrics.momentum.relativeErrorPercent)) {
        if (verification.metrics.momentum.relativeErrorPercent > worstMomentumError) {
          worstMomentumError = verification.metrics.momentum.relativeErrorPercent;
        }
      }

      const unsignedPacket: Omit<ConservationEvidencePacket, 'attestationSignature'> = {
        caseId: caseDef.caseId,
        title: caseDef.title,
        solverVersion: 'Fvm3DNavierStokesSolver-v2.1',
        meshHash,
        geometryHash,
        inputHash,
        boundaryConditionHash,
        resultHash,
        cellCount: mesh.cells.length,
        faceCount: mesh.faces.length,
        iterations: solution.totalIterations,
        solverConverged: solution.converged,
        solverContinuityResidual: solution.finalContinuityResidual,
        solverMomentumResidual: solution.finalMomentumResidual,
        solveTimeMs,
        conservationMetrics: verification.metrics,
        thresholds: caseDef.thresholds,
        verdict,
        failureReasons: verification.failureReasons,
        timestamp: new Date().toISOString(),
        executionEnvironment: {
          runtime: 'SECP-Industrial-OS-V2',
          platform: 'Node/WebAssembly/TypeScript',
          deterministicSeed: 'SECP-SEED-CONSERV-175'
        }
      };

      const sig = ConservationAntiFabrication.signEvidence(unsignedPacket);
      evidenceLedger.push({ ...unsignedPacket, attestationSignature: sig });
    }

    // Run Adversarial Suite
    const adversarialReport = ConservationAdversarialSuite.runAdversarialBattery();

    // Run Mesh Sensitivity Study
    const meshSensitivity = ConservationMeshSensitivity.runSensitivityStudy();

    const totalDurationMs = performance.now() - tStartTotal;
    const totalCases = cases.length;
    const passRatePercent = (passedCount / totalCases) * 100.0;

    let overallVerdict: ConservationVerdict = 'PASS';
    if (conservationFailureCount > 0) overallVerdict = 'CONSERVATION_FAILURE';
    else if (failedCount > 0) overallVerdict = 'FAIL';
    else if (notConvergedCount > 0) overallVerdict = 'NOT_CONVERGED';
    else if (invalidCount > 0) overallVerdict = 'INVALID';
    else if (adversarialReport.falseAcceptanceCount > 0) overallVerdict = 'FAIL';

    // Build text report
    const formattedReportText = this.buildReportText({
      batteryId,
      title: 'SECP Industrial OS v2 — Physical Conservation Benchmark Battery',
      solverVersion: 'Fvm3DNavierStokesSolver-v2.1',
      timestamp: new Date().toISOString(),
      overallVerdict,
      totalCases,
      passedCount,
      failedCount,
      unprovenCount,
      notConvergedCount,
      invalidCount,
      conservationFailureCount,
      passRatePercent,
      totalDurationMs,
      massTestsSummary: {
        total: totalCases,
        passed: passedCount,
        failed: conservationFailureCount,
        unproven: unprovenCount,
        worstErrorPercent: worstMassError
      },
      momentumTestsSummary: {
        total: totalCases,
        passed: passedCount,
        failed: conservationFailureCount,
        unproven: unprovenCount,
        worstErrorPercent: worstMomentumError
      },
      energyTestsSummary: {
        total: totalCases,
        passed: 0,
        failed: 0,
        unproven: totalCases,
        worstErrorPercent: 0.0
      },
      meshSensitivity,
      adversarialReport,
      evidenceLedger,
      formattedReportText: ''
    });

    return {
      batteryId,
      title: 'SECP Industrial OS v2 — Physical Conservation Benchmark Battery',
      solverVersion: 'Fvm3DNavierStokesSolver-v2.1',
      timestamp: new Date().toISOString(),
      overallVerdict,
      totalCases,
      passedCount,
      failedCount,
      unprovenCount,
      notConvergedCount,
      invalidCount,
      conservationFailureCount,
      passRatePercent,
      totalDurationMs,
      massTestsSummary: {
        total: totalCases,
        passed: passedCount,
        failed: conservationFailureCount,
        unproven: unprovenCount,
        worstErrorPercent: worstMassError
      },
      momentumTestsSummary: {
        total: totalCases,
        passed: passedCount,
        failed: conservationFailureCount,
        unproven: unprovenCount,
        worstErrorPercent: worstMomentumError
      },
      energyTestsSummary: {
        total: totalCases,
        passed: 0,
        failed: 0,
        unproven: totalCases,
        worstErrorPercent: 0.0
      },
      meshSensitivity,
      adversarialReport,
      evidenceLedger,
      formattedReportText
    };
  }

  private static buildReportText(report: ConservationBatteryReport): string {
    const lines: string[] = [];
    lines.push('============================================================');
    lines.push('PATCH-175 — CONSERVATION BATTERY AUDIT REPORT');
    lines.push('============================================================');
    lines.push(`Battery ID      : ${report.batteryId}`);
    lines.push(`Solver Engine   : ${report.solverVersion}`);
    lines.push(`Execution Time  : ${report.totalDurationMs.toFixed(2)} ms`);
    lines.push(`Overall Verdict : [ ${report.overallVerdict} ]`);
    lines.push(`Cases Evaluated : ${report.totalCases} (Pass: ${report.passedCount}, Fail: ${report.failedCount}, Non-Conv: ${report.notConvergedCount}, Cons-Fail: ${report.conservationFailureCount})`);
    lines.push(`Pass Rate       : ${report.passRatePercent.toFixed(1)}%`);
    lines.push('------------------------------------------------------------');
    lines.push('PHYSICAL CONSERVATION DOMAIN BREAKDOWN:');
    lines.push(`1. MASS CONSERVATION     : ${report.massTestsSummary.passed}/${report.massTestsSummary.total} PASSED (Worst Error: ${report.massTestsSummary.worstErrorPercent.toFixed(4)}%, Threshold <= 0.5%)`);
    lines.push(`2. MOMENTUM CONSERVATION : ${report.momentumTestsSummary.passed}/${report.momentumTestsSummary.total} PASSED (Worst Error: ${report.momentumTestsSummary.worstErrorPercent.toFixed(4)}%, Threshold <= 5.0%)`);
    lines.push(`3. ENERGY CONSERVATION   : ${report.energyTestsSummary.unproven}/${report.energyTestsSummary.total} UNPROVEN (Isothermal Navier-Stokes - Energy Uncoupled)`);
    lines.push('------------------------------------------------------------');
    lines.push('ADVERSARIAL ATTACK RESISTANCE:');
    lines.push(`Injected Pathologies : ${report.adversarialReport.testsInjected}`);
    lines.push(`Successfully Caught  : ${report.adversarialReport.testsDetected}`);
    lines.push(`False Passes         : ${report.adversarialReport.falseAcceptanceCount} (Detection Rate: ${report.adversarialReport.detectionRatePercent.toFixed(1)}%)`);
    lines.push('------------------------------------------------------------');
    lines.push('GRID SENSITIVITY (COARSE -> MEDIUM -> FINE):');
    for (const pt of report.meshSensitivity.points) {
      lines.push(`- [${pt.meshLevel.padEnd(7)}] Cells: ${pt.cellCount.toString().padEnd(4)} | Time: ${pt.solveTimeMs.toFixed(1).padStart(5)} ms | Mass Err: ${pt.massErrorPercent.toFixed(4)}% | Mom Err: ${pt.momentumErrorPercent.toFixed(4)}%`);
    }
    lines.push(`Convergence Trend : Mass: ${report.meshSensitivity.massConvergenceTrend}, Momentum: ${report.meshSensitivity.momentumConvergenceTrend}`);
    lines.push('============================================================');
    return lines.join('\n');
  }
}
