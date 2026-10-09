/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — G-Code Verification Evidence Generator
 * 
 * Generates tamper-evident cryptographic provenance certificates
 * for complete NC Verification runs with deterministic SHA-256 hashes.
 */

import { generateDeterministicHash } from '../../../lib/hash';
import {
  VerificationContract,
  VerificationStatus,
  VerificationIssue,
  MachineMotionSequence,
  ToolpathDeviationReport,
  KinematicDeviationReport,
  GCodeVerificationEvidence,
  VerificationTolerances
} from './GCodeVerificationTypes';

export class VerificationEvidenceGenerator {
  public static readonly ENGINE_VERSION = 'SECP-CAM-NC-VERIFY-v3.263.0';

  /**
   * Generate cryptographic verification evidence certificate
   */
  public static async generateEvidence(
    contract: VerificationContract,
    tolerances: VerificationTolerances,
    status: VerificationStatus,
    isPassing: boolean,
    motion: MachineMotionSequence,
    issues: VerificationIssue[],
    toolpathReport?: ToolpathDeviationReport,
    kinematicReport?: KinematicDeviationReport
  ): Promise<GCodeVerificationEvidence> {
    const timestamp = new Date().toISOString();

    // 1. Compute Hashes of Input Contracts
    const ncHash = await generateDeterministicHash(contract.ncProgramText);
    const machineHash = await generateDeterministicHash(JSON.stringify(contract.machine));
    const toolsHash = await generateDeterministicHash(JSON.stringify(contract.toolSnapshots));
    const tolHash = await generateDeterministicHash(JSON.stringify(tolerances));
    const toolpathHash = contract.referenceToolpaths 
      ? await generateDeterministicHash(JSON.stringify(contract.referenceToolpaths))
      : undefined;

    // 2. Aggregate Statistics
    const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
    const errorCount = issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = issues.filter(i => i.severity === 'WARNING').length;
    const infoCount = issues.filter(i => i.severity === 'INFO').length;

    // Issue code histogram
    const codeMap = new Map<string, { severity: any; count: number }>();
    for (const issue of issues) {
      const existing = codeMap.get(issue.code) || { severity: issue.severity, count: 0 };
      existing.count++;
      codeMap.set(issue.code, existing);
    }

    const issuesSummary = Array.from(codeMap.entries()).map(([code, data]) => ({
      code: code as any,
      severity: data.severity,
      count: data.count
    }));

    // Envelope utilization
    const envelopeUtilization: Record<string, number> = {};
    const axes = contract.machine.axes;
    if (axes) {
      if (axes.X) {
        const span = Math.abs(axes.X.maxLimit - axes.X.minLimit);
        envelopeUtilization['X'] = span > 0 ? ((motion.bounds.maxX - motion.bounds.minX) / span) * 100 : 0;
      }
      if (axes.Y) {
        const span = Math.abs(axes.Y.maxLimit - axes.Y.minLimit);
        envelopeUtilization['Y'] = span > 0 ? ((motion.bounds.maxY - motion.bounds.minY) / span) * 100 : 0;
      }
      if (axes.Z) {
        const span = Math.abs(axes.Z.maxLimit - axes.Z.minLimit);
        envelopeUtilization['Z'] = span > 0 ? ((motion.bounds.maxZ - motion.bounds.minZ) / span) * 100 : 0;
      }
    }

    const evidenceCore = {
      engineVersion: this.ENGINE_VERSION,
      ncProgramHash: ncHash,
      machineDefinitionHash: machineHash,
      controllerDialect: contract.controllerDialect,
      toolSnapshotsHash: toolsHash,
      tolerancesHash: tolHash,
      overallStatus: status,
      isPassing,
      totalBlocks: motion.steps.length,
      totalDistanceMm: motion.totalDistanceMm,
      criticalCount,
      errorCount,
      warningCount,
      maxToolpathDeviation: toolpathReport?.maxDeviationMm || 0,
      maxKinematicAngularError: kinematicReport?.maxAngularErrorDeg || 0
    };

    const digest = await generateDeterministicHash(JSON.stringify(evidenceCore));
    const evidenceId = `SECP-VERIFY-${digest.substring(0, 12).toUpperCase()}`;
    const provenanceSignature = `SECP-SIG-${await generateDeterministicHash(`${evidenceId}:${timestamp}:${digest}`)}`;

    return {
      evidenceId,
      timestamp,
      engineVersion: this.ENGINE_VERSION,
      ncProgramHash: ncHash,
      machineDefinitionHash: machineHash,
      controllerDialect: contract.controllerDialect,
      toolSnapshotsHash: toolsHash,
      referenceToolpathHash: toolpathHash,
      tolerancesHash: tolHash,
      overallStatus: status,
      isPassing,
      statistics: {
        totalBlocks: motion.steps.length,
        reconstructedMotionSteps: motion.steps.length,
        cuttingDistanceMm: motion.totalCuttingDistanceMm,
        rapidDistanceMm: motion.totalRapidDistanceMm,
        estimatedMachiningTimeSec: motion.totalEstimatedTimeSec,
        criticalIssuesCount: criticalCount,
        errorsCount: errorCount,
        warningsCount: warningCount,
        infoCount: infoCount
      },
      metrics: {
        maxToolpathDeviationMm: toolpathReport?.maxDeviationMm || 0,
        rmsToolpathDeviationMm: toolpathReport?.rmsDeviationMm || 0,
        maxKinematicAngularErrorDeg: kinematicReport?.maxAngularErrorDeg || 0,
        machineEnvelopeUtilizationPct: envelopeUtilization
      },
      issuesSummary,
      verificationDigestSha256: digest,
      provenanceSignature
    };
  }
}
