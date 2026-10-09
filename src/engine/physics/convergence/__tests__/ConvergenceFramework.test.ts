/**
 * SECP Industrial OS v2 — Convergence Framework Unit Tests
 * PATCH-049: Numerical Convergence Framework
 */

import { describe, it, expect } from "vitest";
import { 
  ResidualHistory, 
  ConvergenceEvaluator, 
  ConvergenceCriterion, 
  ConvergenceAnalyzer,
  ConvergenceEvidence,
  NumericalConvergenceIntegrityGate
} from "../index";

describe("PATCH-049: Convergence Framework", () => {

  it("A. creates and appends valid residual history records", () => {
    const history = new ResidualHistory();
    history.append({ iteration: 1, residuals: [{ quantity: "mass", value: 1.0 }] });
    history.append({ iteration: 2, residuals: [{ quantity: "mass", value: 0.1 }] });

    expect(history.isValid()).toBe(true);
    expect(history.length()).toBe(2);
    expect(history.min("mass")).toBe(0.1);
    expect(history.max("mass")).toBe(1.0);
  });

  it("H. evaluates absolute residual criterion", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1e-2 }] },
      { iteration: 2, residuals: [{ quantity: "mass", value: 1e-7 }] }
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria);
    expect(assessment.status).toBe("CONVERGED");
    expect(assessment.criteriaResults[0].satisfied).toBe(true);
  });

  it("I. evaluates relative residual criterion", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 100.0 }] },
      { iteration: 2, residuals: [{ quantity: "mass", value: 0.001 }] } // 1e-5 relative
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "RELATIVE_RESIDUAL", quantity: "mass", tolerance: 1e-4, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria);
    expect(assessment.status).toBe("CONVERGED");
  });

  it("J. evaluates multi-criteria with ALL_REQUIRED semantics", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1e-7 }, { quantity: "energy", value: 1.0 }] } // Energy fails
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true },
      { type: "ABSOLUTE_RESIDUAL", quantity: "energy", tolerance: 1e-6, required: true }
    ];

    const assessmentAll = ConvergenceEvaluator.evaluate(history, criteria, "ALL_REQUIRED");
    expect(assessmentAll.status).toBe("NOT_CONVERGED");

    const assessmentAny = ConvergenceEvaluator.evaluate(history, criteria, "ANY_REQUIRED");
    expect(assessmentAny.status).toBe("CONVERGED");
  });

  it("M. detects residual stagnation when residuals flatten above tolerance", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1e-2 }] },
      { iteration: 2, residuals: [{ quantity: "mass", value: 1e-2 }] },
      { iteration: 3, residuals: [{ quantity: "mass", value: 1e-2 }] },
      { iteration: 4, residuals: [{ quantity: "mass", value: 1e-2 }] },
      { iteration: 5, residuals: [{ quantity: "mass", value: 1e-2 }] }
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria);
    expect(assessment.status).toBe("STAGNATED");
    expect(assessment.diagnostics.some(d => d.type === "STAGNATION")).toBe(true);
  });

  it("N. detects divergence when residuals grow monotonically", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1.0 }] },
      { iteration: 2, residuals: [{ quantity: "mass", value: 2.0 }] },
      { iteration: 3, residuals: [{ quantity: "mass", value: 5.0 }] },
      { iteration: 4, residuals: [{ quantity: "mass", value: 20.0 }] },
      { iteration: 5, residuals: [{ quantity: "mass", value: 100.0 }] }
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(history, criteria);
    expect(assessment.status).toBe("DIVERGED");
    expect(assessment.divergenceReason).toBe("DIVERGENCE_RESIDUAL_GROWTH");
  });

  it("Q. handles transient convergence with physical simulation time separation", () => {
    const history = new ResidualHistory([
      { iteration: 1, simulationTime: 0.1, residuals: [{ quantity: "mass", value: 1e-7 }] },
      { iteration: 2, simulationTime: 0.2, residuals: [{ quantity: "mass", value: 1e-7 }] }
    ]);

    expect(history.first()?.simulationTime).toBe(0.1);
    expect(history.latest()?.simulationTime).toBe(0.2);
  });

  it("S. calculates canonical hash and detects changes in residual history", () => {
    const histA = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1.0 }] }
    ]);

    const histB = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1.001 }] }
    ]);

    const hashA = histA.calculateCanonicalHash();
    const hashB = histB.calculateCanonicalHash();
    expect(hashA).not.toBe(hashB);
  });

  it("T. links assessment to evidence record", () => {
    const history = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1e-7 }] }
    ]);
    const criteria: ConvergenceCriterion[] = [{ type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true }];
    const assessment = ConvergenceEvaluator.evaluate(history, criteria);

    const evid = ConvergenceEvidence.createEvidence("SOLVER-01", "1.0", "EXEC-1", history, assessment, criteria);
    expect(evid.evidenceStatus).toBe("UNPROVEN"); // Physical verification remains UNPROVEN
    expect(evid.residualHistoryHash).toBe(history.calculateCanonicalHash());
  });

  it("evaluates NumericalConvergenceIntegrityGate PASS", () => {
    const gateRes = NumericalConvergenceIntegrityGate.evaluateGate();
    expect(gateRes.status).toBe("PASS");
    expect(gateRes.capabilities.CONVERGENCE_FRAMEWORK).toBe(true);
    expect(gateRes.capabilities.CFD_SOLVER_CONVERGED).toBe("UNPROVEN");
  });

});
