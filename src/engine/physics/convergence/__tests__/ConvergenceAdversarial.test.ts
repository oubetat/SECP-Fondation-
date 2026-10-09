/**
 * SECP Industrial OS v2 — Convergence Adversarial Tests
 * PATCH-049: Numerical Convergence Framework
 */

import { describe, it, expect } from "vitest";
import { 
  ResidualHistory, 
  ConvergenceEvaluator, 
  ConvergenceCriterion, 
  ConvergenceEvidence 
} from "../index";

describe("PATCH-049: Convergence Adversarial Tests", () => {

  it("1. residual passes for one quantity while another required quantity fails -> NOT_CONVERGED", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "continuity", value: 1e-7 }, { quantity: "x-momentum", value: 1e-2 }] }
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "continuity", tolerance: 1e-6, required: true },
      { type: "ABSOLUTE_RESIDUAL", quantity: "x-momentum", tolerance: 1e-6, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria, "ALL_REQUIRED");
    expect(assessment.status).toBe("NOT_CONVERGED");
  });

  it("2. residual decreases but remains above tolerance -> NOT_CONVERGED or STAGNATED", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1.0 }] },
      { iteration: 2, residuals: [{ quantity: "mass", value: 0.5 }] },
      { iteration: 3, residuals: [{ quantity: "mass", value: 0.1 }] }
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria);
    expect(assessment.status).toBe("NOT_CONVERGED");
  });

  it("3. residual oscillates around tolerance without reaching it -> NOT_CONVERGED", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1e-5 }] },
      { iteration: 2, residuals: [{ quantity: "mass", value: 1e-7 }] },
      { iteration: 3, residuals: [{ quantity: "mass", value: 1e-5 }] } // Ends above tol
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria);
    expect(assessment.status).toBe("NOT_CONVERGED");
  });

  it("4. residual becomes NaN -> INVALID", () => {
    const history = new ResidualHistory();
    history.append({ iteration: 1, residuals: [{ quantity: "mass", value: NaN }] });

    expect(history.isValid()).toBe(false);

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria);
    expect(assessment.status).toBe("INVALID");
  });

  it("5. residual becomes Infinity -> INVALID", () => {
    const history = new ResidualHistory();
    history.append({ iteration: 1, residuals: [{ quantity: "mass", value: Infinity }] });

    expect(history.isValid()).toBe(false);

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria);
    expect(assessment.status).toBe("INVALID");
  });

  it("6. iteration numbers reordered -> INVALID", () => {
    const history = new ResidualHistory();
    history.append({ iteration: 1, residuals: [{ quantity: "mass", value: 1.0 }] });
    history.append({ iteration: 3, residuals: [{ quantity: "mass", value: 0.5 }] });
    history.append({ iteration: 2, residuals: [{ quantity: "mass", value: 0.1 }] }); // Reordered!

    expect(history.isValid()).toBe(false);
    expect(history.getValidationErrors().some(e => e.includes("Out-of-order iteration sequence"))).toBe(true);
  });

  it("7. duplicate iterations -> INVALID", () => {
    const history = new ResidualHistory();
    history.append({ iteration: 1, residuals: [{ quantity: "mass", value: 1.0 }] });
    history.append({ iteration: 1, residuals: [{ quantity: "mass", value: 0.5 }] }); // Duplicate!

    expect(history.isValid()).toBe(false);
    expect(history.getValidationErrors().some(e => e.includes("Duplicate iteration detected"))).toBe(true);
  });

  it("8. reference residual = 0 in RELATIVE_RESIDUAL -> no division by zero", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 0.0 }] }, // Initial is 0
      { iteration: 2, residuals: [{ quantity: "mass", value: 1e-5 }] }
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "RELATIVE_RESIDUAL", quantity: "mass", tolerance: 1e-4, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria);
    expect(assessment.status).toBe("NOT_CONVERGED");
    expect(assessment.criteriaResults[0].reason).toContain("zero or missing");
  });

  it("9. single iteration when CHANGE_BETWEEN_ITERATIONS required -> unsatisfied", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1e-7 }] }
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "CHANGE_BETWEEN_ITERATIONS", quantity: "mass", tolerance: 1e-6, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria);
    expect(assessment.status).toBe("NOT_CONVERGED");
  });

  it("10. maximum iterations reached while tolerance unmet -> MAX_ITERATIONS_REACHED", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1.0 }] },
      { iteration: 2, residuals: [{ quantity: "mass", value: 0.8 }] },
      { iteration: 3, residuals: [{ quantity: "mass", value: 0.6 }] },
      { iteration: 4, residuals: [{ quantity: "mass", value: 0.4 }] },
      { iteration: 5, residuals: [{ quantity: "mass", value: 0.2 }] }
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria, "ALL_REQUIRED", 5);
    expect(assessment.status).toBe("MAX_ITERATIONS_REACHED");
  });

  it("11. residual decreases for 100 iterations but physical conservation is unproven -> evidenceStatus remains UNPROVEN", () => {
    const records = [];
    for (let i = 1; i <= 100; i++) {
      records.push({ iteration: i, residuals: [{ quantity: "mass", value: 1.0 / (i * 1000) }] });
    }
    const history = new ResidualHistory(records);
    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-4, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria);
    expect(assessment.status).toBe("CONVERGED");

    const evid = ConvergenceEvidence.createEvidence("SOLVER-CFD", "1.0", "EXEC-100", history, assessment, criteria);
    expect(evid.evidenceStatus).toBe("UNPROVEN"); // Convergence != Physical Verification
  });

  it("12. wall-clock timestamp change does not alter numerical convergence assessment or canonical hash", () => {
    const history1 = new ResidualHistory([
      { iteration: 1, timestamp: 1000, residuals: [{ quantity: "mass", value: 1e-7 }] }
    ]);

    const history2 = new ResidualHistory([
      { iteration: 1, timestamp: 99999999, residuals: [{ quantity: "mass", value: 1e-7 }] }
    ]);

    expect(history1.calculateCanonicalHash()).toBe(history2.calculateCanonicalHash());

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true }
    ];

    const assessment1 = ConvergenceEvaluator.evaluate(history1, criteria);
    const assessment2 = ConvergenceEvaluator.evaluate(history2, criteria);
    expect(assessment1.status).toBe(assessment2.status);
  });

});
