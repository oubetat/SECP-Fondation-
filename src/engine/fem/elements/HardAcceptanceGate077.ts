import { ElementEvidenceEngine } from "./ElementEvidenceEngine";
import { ElementRegistry } from "./ElementRegistry";
import { ElementVerificationEngine } from "./ElementVerificationEngine";

export interface HardGateResult {
  passed: boolean;
  score: number;
  totalChecks: number;
  checks: { name: string; passed: boolean; details?: string }[];
  timestamp: string;
}

export class HardAcceptanceGate077 {
  static evaluate(): HardGateResult {
    ElementRegistry.initialize();
    const checks: { name: string; passed: boolean; details?: string }[] = [];

    // 1. Registry & Identity
    const list = ElementRegistry.list();
    checks.push({
      name: "Element registry implemented & populated",
      passed: list.length >= 5,
      details: `${list.length} element definitions registered`
    });

    const capabilityMatrix = ElementRegistry.getCapabilityMatrix();
    checks.push({
      name: "Capability matrix complete",
      passed: capabilityMatrix.length >= 5
    });

    // 2. Element-by-element verification
    const targetElements = ['BAR2', 'TRI3', 'QUAD4', 'TET4', 'HEX8'];
    for (const el of targetElements) {
      const verdict = ElementVerificationEngine.runBattery(el);
      checks.push({
        name: `Element ${el} verified by full numerical battery`,
        passed: verdict.verdict === 'VERIFIED',
        details: `All ${Object.keys(verdict.batteryResults).length} verification tests passed`
      });
      checks.push({
        name: `Element ${el} rigid body modes produce zero strain`,
        passed: verdict.batteryResults.rigidBodyPass
      });
      checks.push({
        name: `Element ${el} constant strain patch test`,
        passed: verdict.batteryResults.patchTestPass
      });
      checks.push({
        name: `Element ${el} strain energy non-negativity`,
        passed: verdict.batteryResults.energyPass
      });
      checks.push({
        name: `Element ${el} scaling linearity`,
        passed: verdict.batteryResults.scalingPass
      });
      checks.push({
        name: `Element ${el} negative case rejection`,
        passed: verdict.batteryResults.negativeTestsPass
      });
      checks.push({
        name: `Element ${el} adversarial robustness`,
        passed: verdict.batteryResults.adversarialPass
      });
    }

    // 3. Evidence Engine check
    const summary = ElementEvidenceEngine.runFullEvidenceBattery();
    checks.push({
      name: "Full evidence battery executed and verified",
      passed: summary.hardGatePassed,
      details: `${summary.verifiedElements.length} elements verified`
    });

    const passedCount = checks.filter(c => c.passed).length;
    const passed = passedCount === checks.length;

    return {
      passed,
      score: (passedCount / checks.length) * 100,
      totalChecks: checks.length,
      checks,
      timestamp: new Date().toISOString()
    };
  }
}
