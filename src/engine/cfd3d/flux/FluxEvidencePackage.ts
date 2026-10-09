/**
 * SECP Industrial OS v2 — Flux Evidence Package Generator
 * PATCH-053: Flux Framework
 */

import * as fs from 'fs';
import * as path from 'path';
import { HardAcceptanceGate053 } from './HardAcceptanceGate053';
import { DeterministicClock } from '../../core/clock';
import { PhysicsModel, ConservativeState, Vector3 } from './FluxTypes';
import { FluxStateEngine } from './FluxState';
import { PhysicalFluxEngine } from './PhysicalFlux';
import { CentralFluxScheme } from './CentralFlux';
import { UpwindFluxScheme } from './UpwindFlux';
import { FluxBoundaryHandler } from './FluxBoundaryHandler';
import { FluxRegistry } from './FluxRegistry';
import { BoundaryType } from '../mesh/CFDMeshTypes';

export class FluxEvidencePackageGenerator {

  public static generateEvidencePackage(outputDir?: string): { success: boolean; files: string[] } {
    const targetDir = outputDir ?? path.join(process.cwd(), 'reports', 'cfd', 'patch-053');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const clock = new DeterministicClock('2026-08-19T00:00:00.000Z');
    const gateResult = HardAcceptanceGate053.evaluateGate(clock);

    // 1. flux-capability-report.json
    const capabilityReport = {
      patchId: 'PATCH-053',
      timestamp: gateResult.timestamp,
      capabilities: {
        physicalFluxEuler3D: gateResult.capabilities.physicalFlux,
        centralFluxScheme: gateResult.capabilities.centralFlux,
        upwindFluxSchemeRusanov: gateResult.capabilities.upwindFlux,
        boundaryFluxHandler: gateResult.capabilities.boundaryHandler,
        invalidStateRejection: gateResult.capabilities.invalidStateRejection,
        faceConservation: gateResult.capabilities.conservation,
        fluxSymmetry: gateResult.capabilities.symmetry,
        determinism: gateResult.capabilities.determinism
      },
      verdict: gateResult.verdict
    };
    const capabilityPath = path.join(targetDir, 'flux-capability-report.json');
    fs.writeFileSync(capabilityPath, JSON.stringify(capabilityReport, null, 2));

    // 2. flux-verification-report.json
    const verificationReport = {
      patchId: 'PATCH-053',
      timestamp: gateResult.timestamp,
      verificationReports: gateResult.verificationReports,
      overallVerdict: gateResult.verdict
    };
    const verificationPath = path.join(targetDir, 'flux-verification-report.json');
    fs.writeFileSync(verificationPath, JSON.stringify(verificationReport, null, 2));

    // 3. flux-adversarial-report.json
    const physicsModel: PhysicsModel = { modelType: 'EULER_3D', gamma: 1.4, gasConstant: 287.05 };
    const adversarialResults = [
      { test: 'density <= 0', rejected: !FluxStateEngine.validatePrimitiveState({ rho: 0, u: 0, v: 0, w: 0, p: 100000, T: 300 }, physicsModel).valid },
      { test: 'pressure <= 0', rejected: !FluxStateEngine.validatePrimitiveState({ rho: 1.2, u: 0, v: 0, w: 0, p: -100, T: 300 }, physicsModel).valid },
      { test: 'NaN input', rejected: !FluxStateEngine.validatePrimitiveState({ rho: NaN, u: 0, v: 0, w: 0, p: 100000, T: 300 }, physicsModel).valid },
      { test: 'zero normal vector', rejected: !PhysicalFluxEngine.computePhysicalFlux({ rho: 1, rhoU: 0, rhoV: 0, rhoW: 0, rhoE: 250000 }, [0, 0, 0], physicsModel).validity },
      { test: 'unsupported boundary', rejected: FluxBoundaryHandler.getBoundaryCapability('UNKNOWN' as any) === 'UNSUPPORTED' },
      { test: 'duplicate scheme ID', rejected: !FluxRegistry.getInstance().registerScheme(new CentralFluxScheme()).success }
    ];

    const adversarialReport = {
      patchId: 'PATCH-053',
      timestamp: gateResult.timestamp,
      adversarialCasesCount: adversarialResults.length,
      allAdversarialCasesPassed: adversarialResults.every(r => r.rejected),
      cases: adversarialResults
    };
    const adversarialPath = path.join(targetDir, 'flux-adversarial-report.json');
    fs.writeFileSync(adversarialPath, JSON.stringify(adversarialReport, null, 2));

    // 4. flux-evidence.json
    const evidenceReport = {
      patchId: 'PATCH-053',
      timestamp: gateResult.timestamp,
      evidenceRecord: gateResult.evidenceRecord
    };
    const evidencePath = path.join(targetDir, 'flux-evidence.json');
    fs.writeFileSync(evidencePath, JSON.stringify(evidenceReport, null, 2));

    return {
      success: true,
      files: [capabilityPath, verificationPath, adversarialPath, evidencePath]
    };
  }
}
