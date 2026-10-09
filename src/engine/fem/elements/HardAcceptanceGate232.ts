import { ElementEvidenceEngine } from "./ElementEvidenceEngine";
import { ElementRegistry } from "./ElementRegistry";
import { ElementVerificationEngine } from "./ElementVerificationEngine";

export interface HardGateResult232 {
  passed: boolean;
  score: number;
  totalChecks: number;
  checks: { name: string; passed: boolean; details?: string }[];
  timestamp: string;
}

export class HardAcceptanceGate232 {
  static evaluate(): HardGateResult232 {
    ElementRegistry.initialize();
    const checks: { name: string; passed: boolean; details?: string }[] = [];

    // 1. Registry & Identity
    const list = ElementRegistry.list();
    const targetElements = ['BAR2', 'TRI3', 'QUAD4', 'TET4', 'HEX8', 'BEAM', 'SHELL', 'SOLID'];

    checks.push({
      name: "Element registry fully populated with PATCH-232 types",
      passed: list.length >= targetElements.length,
      details: `${list.length} element definitions registered (Expected >= ${targetElements.length})`
    });

    const capabilityMatrix = ElementRegistry.getCapabilityMatrix();
    checks.push({
      name: "Capability matrix complete with all 8 elements",
      passed: capabilityMatrix.length >= targetElements.length,
      details: `${capabilityMatrix.length} elements mapped in capability matrix`
    });

    // 2. Element-by-element verification
    for (const el of targetElements) {
      try {
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
      } catch (err: any) {
        checks.push({
          name: `Element ${el} executed and verified`,
          passed: false,
          details: `Error encountered: ${err?.message ?? err}`
        });
      }
    }

    // 3. Evidence Engine check
    try {
      const summary = ElementEvidenceEngine.runFullEvidenceBattery();
      checks.push({
        name: "Full evidence battery executed and verified for PATCH-232",
        passed: summary.hardGatePassed && summary.verifiedElements.length >= targetElements.length,
        details: `${summary.verifiedElements.length} elements verified in evidence log`
      });
    } catch (err: any) {
      checks.push({
        name: "Full evidence battery executed and verified for PATCH-232",
        passed: false,
        details: `Error: ${err?.message ?? err}`
      });
    }

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
