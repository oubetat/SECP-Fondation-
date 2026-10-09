import { describe, it, expect } from "vitest";
import { HardAcceptanceGate080 } from "../HardAcceptanceGate080";
import { generatePatch080EvidenceReports } from "../generateReports080";
import * as fs from "fs";
import * as path from "path";

describe("PATCH-080: Hard Acceptance Gate 080 Evaluation", () => {
  it("Evaluates and passes all Hard Acceptance Gate 080 criteria with zero failures", () => {
    const report = HardAcceptanceGate080.evaluateAll();

    // Print failing criteria if any for clear diagnostics
    const failing = report.criteria.filter(c => !c.passed);
    if (failing.length > 0) {
      console.error("Failing Gate 080 criteria:", JSON.stringify(failing, null, 2));
    }

    expect(report.failedCriteria).toBe(0);
    expect(report.overallPassed).toBe(true);
    expect(report.verdict).toBe("VERIFIED");
    expect(report.passedCriteria).toBe(report.totalCriteria);
    expect(report.totalCriteria).toBeGreaterThanOrEqual(35);
  });

  it("Generates complete forensic evidence package in reports/fem/patch-080", () => {
    const { generatedFiles, verdict } = generatePatch080EvidenceReports();
    expect(verdict).toBe("VERIFIED");
    expect(generatedFiles.length).toBeGreaterThanOrEqual(30);

    for (const filePath of generatedFiles) {
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content.length).toBeGreaterThan(10);
    }
  });
});
