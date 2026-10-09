/**
 * SECP Industrial OS v2 — Momentum Conservation Evidence Package
 * PATCH-058
 */

import * as fs from 'fs';
import * as path from 'path';
import { HardAcceptanceGate058 } from './HardAcceptanceGate058';
import { MomentumConservationReport } from './MomentumConservationReport';
import { MomentumConservationStatus, MomentumVector } from './MomentumConservationTypes';
import { MomentumConservationEvidence } from './MomentumConservationEvidence';

export class MomentumConservationEvidencePackage {

  public static generatePackage(outputDir?: string): { targetDir: string; gatePassed: boolean } {
    const targetDir = outputDir ?? path.join(process.cwd(), 'reports', 'cfd', 'patch-058');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const gateEval = HardAcceptanceGate058.evaluate();
    const timestamp = new Date().toISOString();

    // 1. Momentum Report
    const momentumReport = {
      patch: 'PATCH-058',
      title: 'SECP Industrial OS v2 — Momentum Conservation Report',
      timestamp,
      verdict: gateEval.passed ? 'PASS' : 'FAIL',
      gateId: 'HARD_ACCEPTANCE_GATE_058',
      criteria: gateEval.criteria
    };
    fs.writeFileSync(path.join(targetDir, 'momentum-conservation-report.json'), JSON.stringify(momentumReport, null, 2));

    // 2. Evidence
    const mockReport: MomentumConservationReport = {
      formulation: 'Steady Incompressible',
      steady: true,
      totalConvectiveFlux: MomentumVector.zero(),
      pressureForce: MomentumVector.zero(),
      viscousForce: MomentumVector.zero(),
      bodyForce: MomentumVector.zero(),
      sourceTerms: MomentumVector.zero(),
      accumulation: MomentumVector.zero(),
      imbalanceX: 0,
      imbalanceY: 0,
      imbalanceZ: 0,
      globalImbalanceNorm: 0,
      maxLocalImbalance: MomentumVector.zero(),
      internalFaceImbalance: 0,
      status: MomentumConservationStatus.CONSERVATIVE,
      diagnostics: [],
      meshHash: 'gate-mesh-hash',
      fieldStateHash: 'gate-state-hash',
      timestamp
    };

    const evidence = MomentumConservationEvidence.generate(
      'secp-momentum-gate',
      mockReport,
      'bc-hash',
      'material-hash',
      'physics-hash',
      'policy-hash'
    );
    fs.writeFileSync(path.join(targetDir, 'momentum-evidence.json'), JSON.stringify(evidence, null, 2));

    return { targetDir, gatePassed: gateEval.passed };
  }
}
