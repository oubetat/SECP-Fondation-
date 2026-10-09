import { describe, expect, it } from "vitest";
import { generateReports081 } from "../generateReports081";
import { HardAcceptanceGate081 } from "../HardAcceptanceGate081";

describe("HardAcceptanceGate081 Verification Suite", () => {
  it("evaluates all gate checks and dynamically achieves VERIFIED verdict", () => {
    const report = HardAcceptanceGate081.evaluateGate();

    console.log(`Gate 081 Total Checks: ${report.totalChecks}`);
    console.log(`Gate 081 Passed Checks: ${report.passedChecks}`);
    console.log(`Gate 081 Failed Checks: ${report.failedChecks}`);

    for (const check of report.checks) {
      if (!check.passed) {
        console.error(`FAILED CHECK: [${check.id}] ${check.description} - ${check.details}`);
      }
    }

    expect(report.failedChecks).toBe(0);
    expect(report.verdict).toBe("VERIFIED");
  });

  it("generates forensic evidence JSON reports in reports/fem/patch-081/", () => {
    expect(() => generateReports081()).not.toThrow();
  });
});
