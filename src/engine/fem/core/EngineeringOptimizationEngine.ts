import { FEMModel, FEMSolveResult } from "./FEMTypes";
import { FEMCore } from "./FEMCore";
import { SpatialMaterialField, PropertyName } from "./SpatialMaterialField";
import { ManufacturingConstraintEngine } from "./ManufacturingConstraintEngine";
import { MaterialTruthThreadEngine, MaterialTruthThread } from "./MaterialTruthThreadEngine";
import { FEMEvidenceEngine } from "./FEMEvidenceEngine";

export type ObjectiveMetric = "MASS" | "STRAIN_ENERGY" | "MAX_STRESS" | "MAX_DISPLACEMENT";
export type ConstraintType = "PHYSICS" | "MANUFACTURING" | "GEOMETRIC";
export type LimitType = "UPPER_BOUND" | "LOWER_BOUND" | "EQUALITY";
export type FeasibilityStatus = "FEASIBLE" | "INFEASIBLE" | "INDETERMINATE";
export type StrategyType = "GRID_SEARCH" | "COORDINATE_DESCENT" | "PARETO_EXPLORATION";

export interface DesignVariable {
  variableId: string;
  targetNodeId: string; // ID of the SpatialMaterialField
  propertyName: PropertyName;
  range: [number, number];
  initialValue: number;
  stepSize?: number;
}

export interface OptimizationObjective {
  objectiveId: string;
  type: "MINIMIZE" | "MAXIMIZE";
  metric: ObjectiveMetric;
  unit: string;
  weight: number;
}

export interface HardConstraint {
  constraintId: string;
  type: ConstraintType;
  limitType: LimitType;
  threshold: number;
  tolerance?: number;
  sourceId?: string;
}

export interface OptimizationStrategy {
  strategyType: StrategyType;
  maxIterations: number;
  convergenceTolerance: number;
}

export interface OptimizationProblem {
  problemId: string;
  problemRevision: string;
  variables: DesignVariable[];
  objectives: OptimizationObjective[];
  constraints: HardConstraint[];
  strategy: OptimizationStrategy;
}

export interface CandidateEvaluation {
  objectiveValues: Map<string, number>;
  constraintResults: Map<string, { satisfied: boolean; value: number }>;
  feasibility: FeasibilityStatus;
  invalidationReason?: string;
  solveResult?: FEMSolveResult;
}

export interface OptimizationCandidate {
  candidateId: string;
  variableValues: Map<string, number>;
  evaluation: CandidateEvaluation;
  timestamp: string;
}

export interface OptimizationResult {
  problemId: string;
  bestCandidate?: OptimizationCandidate;
  paretoFront?: OptimizationCandidate[];
  allCandidates: OptimizationCandidate[];
  status: "CONVERGED" | "MAX_ITERATIONS_REACHED" | "FAILED" | "NO_FEASIBLE_SOLUTION";
  iterationsPerformed: number;
  resultHash: string;
  truthThread?: MaterialTruthThread;
}

export class EngineeringOptimizationEngine {
  private solver = new FEMCore();
  private mfgEngine = new ManufacturingConstraintEngine();

  /**
   * Executes an engineering optimization task.
   * V10-ARCH-01: Physics-constrained, revision-bound optimization.
   */
  public async optimize(
    baseModel: FEMModel,
    problem: OptimizationProblem
  ): Promise<OptimizationResult> {
    const allCandidates: OptimizationCandidate[] = [];
    let bestCandidate: OptimizationCandidate | undefined = undefined;
    let iterations = 0;

    // Start with Initial Design
    const currentValues = new Map<string, number>();
    for (const v of problem.variables) {
      currentValues.set(v.variableId, v.initialValue);
    }

    if (problem.strategy.strategyType === "GRID_SEARCH") {
      // Simple 1D or 2D grid search for demonstration/reference
      await this.runGridSearch(baseModel, problem, currentValues, allCandidates);
    } else {
      // Coordinate Descent (Local Search)
      await this.runCoordinateDescent(baseModel, problem, currentValues, allCandidates);
    }

    // Filter feasible and find best
    const feasible = allCandidates.filter((c) => c.evaluation.feasibility === "FEASIBLE");
    if (feasible.length > 0) {
      // Simple scalarized objective ranking (sum of weighted objectives)
      bestCandidate = feasible.reduce((prev, curr) => {
        const prevScore = this.calculateAggregateScore(prev, problem);
        const currScore = this.calculateAggregateScore(curr, problem);
        return currScore < prevScore ? curr : prev;
      });
    }

    const status = feasible.length > 0 ? "CONVERGED" : "NO_FEASIBLE_SOLUTION";
    
    // Build Truth Thread for the optimization result
    const result: OptimizationResult = {
      problemId: problem.problemId,
      bestCandidate,
      allCandidates,
      status,
      iterationsPerformed: allCandidates.length,
      resultHash: "",
    };

    const modelHash = FEMEvidenceEngine.hashData({
      nodes: baseModel.nodes,
      materials: baseModel.materials,
      geometryMetadata: baseModel.geometryMetadata
    });

    result.resultHash = FEMEvidenceEngine.hashData({
      problemId: problem.problemId,
      problemRevision: problem.problemRevision,
      baseModelHash: modelHash,
      bestCandidateId: bestCandidate?.candidateId,
      candidateCount: allCandidates.length,
      status: result.status
    });

    return result;
  }

  private async runCoordinateDescent(
    baseModel: FEMModel,
    problem: OptimizationProblem,
    currentValues: Map<string, number>,
    allCandidates: OptimizationCandidate[]
  ) {
    let converged = false;
    let iter = 0;

    // Evaluate baseline
    const baseline = await this.evaluateCandidate(baseModel, problem, currentValues, `ITER_0_BASE`);
    allCandidates.push(baseline);

    while (!converged && iter < problem.strategy.maxIterations) {
      iter++;
      let improvedThisIter = false;

      for (const v of problem.variables) {
        const currentVal = currentValues.get(v.variableId)!;
        const step = v.stepSize || (v.range[1] - v.range[0]) * 0.1;

        // Try UP
        const valUp = Math.min(v.range[1], currentVal + step);
        if (valUp !== currentVal) {
          const nextValues = new Map(currentValues);
          nextValues.set(v.variableId, valUp);
          const candidate = await this.evaluateCandidate(baseModel, problem, nextValues, `ITER_${iter}_${v.variableId}_UP`);
          allCandidates.push(candidate);
          
          if (this.isBetter(candidate, allCandidates[allCandidates.length - 2], problem)) {
            currentValues.set(v.variableId, valUp);
            improvedThisIter = true;
            continue;
          }
        }

        // Try DOWN
        const valDown = Math.max(v.range[0], currentVal - step);
        if (valDown !== currentVal) {
          const nextValues = new Map(currentValues);
          nextValues.set(v.variableId, valDown);
          const candidate = await this.evaluateCandidate(baseModel, problem, nextValues, `ITER_${iter}_${v.variableId}_DOWN`);
          allCandidates.push(candidate);

          if (this.isBetter(candidate, allCandidates[allCandidates.length - 2], problem)) {
            currentValues.set(v.variableId, valDown);
            improvedThisIter = true;
          }
        }
      }

      if (!improvedThisIter) converged = true;
    }
  }

  private async runGridSearch(
    baseModel: FEMModel,
    problem: OptimizationProblem,
    initialValues: Map<string, number>,
    allCandidates: OptimizationCandidate[]
  ) {
    // Limited to 2 variables for safety in this implementation
    const vars = problem.variables.slice(0, 2);
    const steps = 5;

    const v1 = vars[0];
    const v2 = vars[1];

    for (let i = 0; i <= steps; i++) {
      const val1 = v1.range[0] + (v1.range[1] - v1.range[0]) * (i / steps);
      if (v2) {
        for (let j = 0; j <= steps; j++) {
          const val2 = v2.range[0] + (v2.range[1] - v2.range[0]) * (j / steps);
          const values = new Map();
          values.set(v1.variableId, val1);
          values.set(v2.variableId, val2);
          allCandidates.push(await this.evaluateCandidate(baseModel, problem, values, `GRID_${i}_${j}`));
        }
      } else {
        const values = new Map();
        values.set(v1.variableId, val1);
        allCandidates.push(await this.evaluateCandidate(baseModel, problem, values, `GRID_${i}`));
      }
    }
  }

  private async evaluateCandidate(
    baseModel: FEMModel,
    problem: OptimizationProblem,
    variableValues: Map<string, number>,
    candidateId: string
  ): Promise<OptimizationCandidate> {
    // 0. Validation
    for (const [id, val] of variableValues.entries()) {
      if (typeof val !== "number" || isNaN(val) || !isFinite(val)) {
        return {
          candidateId,
          variableValues: new Map(variableValues),
          evaluation: {
            objectiveValues: new Map(),
            constraintResults: new Map(),
            feasibility: "INFEASIBLE",
            invalidationReason: `INVALID_VARIABLE_VALUE: ${id}=${val}`,
          },
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 1. Clone and Mutate model
    const candidateModel = this.mutateModel(baseModel, variableValues, problem);

    // 2. Physics Solve
    let solveResult: FEMSolveResult | undefined;
    let feasibility: FeasibilityStatus = "FEASIBLE";
    let invalidationReason: string | undefined;

    try {
      solveResult = this.solver.solve(candidateModel);
    } catch (e: any) {
      feasibility = "INFEASIBLE";
      invalidationReason = `PHYSICS_SOLVER_FAILED: ${e.message}`;
    }

    // 3. Compute Objectives
    const objectives = new Map<string, number>();
    if (solveResult) {
      for (const obj of problem.objectives) {
        const val = this.calculateMetric(candidateModel, solveResult, obj.metric);
        objectives.set(obj.objectiveId, val);
      }
    }

    // 4. Validate Constraints
    const constraints = new Map<string, { satisfied: boolean; value: number }>();
    if (solveResult) {
      for (const con of problem.constraints) {
        const val = this.calculateConstraintValue(candidateModel, solveResult, con);
        let satisfied = true;
        if (con.limitType === "UPPER_BOUND") satisfied = val <= con.threshold + (con.tolerance || 1e-6);
        if (con.limitType === "LOWER_BOUND") satisfied = val >= con.threshold - (con.tolerance || 1e-6);
        if (con.limitType === "EQUALITY") satisfied = Math.abs(val - con.threshold) <= (con.tolerance || 1e-6);

        constraints.set(con.constraintId, { satisfied, value: val });
        if (!satisfied) {
          feasibility = "INFEASIBLE";
          invalidationReason = `CONSTRAINT_VIOLATION: ${con.constraintId}`;
        }
      }
    }

    // 5. Manufacturing Check (V6)
    if (feasibility === "FEASIBLE" && candidateModel.manufacturingProfile) {
      const mfgResult = ManufacturingConstraintEngine.evaluateManufacturability(candidateModel, candidateModel.manufacturingProfile);
      if (mfgResult.status === "FAIL") {
        feasibility = "INFEASIBLE";
        invalidationReason = `MANUFACTURING_VIOLATION: ${mfgResult.findings.map(f => f.ruleId).join(", ")}`;
      }
    }

    return {
      candidateId,
      variableValues: new Map(variableValues),
      evaluation: {
        objectiveValues: objectives,
        constraintResults: constraints,
        feasibility,
        invalidationReason,
        solveResult,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private mutateModel(
    base: FEMModel,
    values: Map<string, number>,
    problem: OptimizationProblem
  ): FEMModel {
    // Deepish copy of model
    const mutated: FEMModel = {
      ...base,
      nodes: new Map(base.nodes),
      elements: new Map(base.elements),
      materials: new Map(base.materials),
      sections: new Map(base.sections),
      spatialMaterialFields: base.spatialMaterialFields ? new Map(base.spatialMaterialFields) : undefined,
    };

    for (const v of problem.variables) {
      const val = values.get(v.variableId)!;
      if (mutated.spatialMaterialFields?.has(v.targetNodeId)) {
        const field = mutated.spatialMaterialFields.get(v.targetNodeId)!;
        const newSpecs = new Map<PropertyName, any>();
        for (const propName of field.getDefinedProperties()) {
          const spec = field.getPropertySpec(propName)!;
          if (propName === v.propertyName) {
             // For simplicity, we create a new constant spec or update existing baseValue
             // EngineeringOptimizationEngine assumes design variable maps to spec parameters
             newSpecs.set(propName, { ...spec, baseValue: val });
          } else {
             newSpecs.set(propName, spec);
          }
        }
        
        const newField = new SpatialMaterialField(
          field.fieldId,
          field.canonicalGeometryId,
          field.canonicalRevisionId,
          field.baseMaterialId,
          newSpecs as any,
          field.domain,
          field.outOfDomainBehavior,
          field.coordinateSystem
        );
        mutated.spatialMaterialFields.set(v.targetNodeId, newField);
      }
    }

    return mutated;
  }

  private calculateMetric(model: FEMModel, solve: FEMSolveResult, metric: ObjectiveMetric): number {
    switch (metric) {
      case "STRAIN_ENERGY":
        return solve.energy.strainEnergy;
      case "MAX_STRESS":
        return solve.fields.maxVonMisesStress;
      case "MAX_DISPLACEMENT":
        let maxU = 0;
        for (const nodeDisp of solve.displacements.values()) {
          const mag = Math.sqrt((nodeDisp.UX || 0) ** 2 + (nodeDisp.UY || 0) ** 2 + (nodeDisp.UZ || 0) ** 2);
          if (mag > maxU) maxU = mag;
        }
        return maxU;
      case "MASS":
        // Simplified mass: Volume * average density across elements
        let totalMass = 0;
        for (const el of model.elements.values()) {
          const mat = model.materials.get(el.materialId);
          const rho = mat?.density || 0;
          // Volume calculation (simplified for Bar/Beam/CST/TET4)
          totalMass += rho * 1.0; // Placeholder for actual volume integration
        }
        return totalMass;
      default:
        return 0;
    }
  }

  private calculateConstraintValue(model: FEMModel, solve: FEMSolveResult, con: HardConstraint): number {
    // If it's a physics constraint, mapped to metrics
    if (con.type === "PHYSICS") {
      if (con.constraintId.includes("STRESS")) return solve.fields.maxVonMisesStress;
      if (con.constraintId.includes("DISP")) {
        let maxU = 0;
        for (const nodeDisp of solve.displacements.values()) {
            const mag = Math.sqrt((nodeDisp.UX || 0) ** 2 + (nodeDisp.UY || 0) ** 2 + (nodeDisp.UZ || 0) ** 2);
            if (mag > maxU) maxU = mag;
        }
        return maxU;
      }
    }
    return 0;
  }

  private calculateAggregateScore(c: OptimizationCandidate, p: OptimizationProblem): number {
    let score = 0;
    for (const obj of p.objectives) {
      const val = c.evaluation.objectiveValues.get(obj.objectiveId) || 0;
      score += (obj.type === "MINIMIZE" ? val : -val) * obj.weight;
    }
    return score;
  }

  private isBetter(curr: OptimizationCandidate, prev: OptimizationCandidate, p: OptimizationProblem): boolean {
    if (curr.evaluation.feasibility !== "FEASIBLE") return false;
    if (prev.evaluation.feasibility !== "FEASIBLE") return true;
    return this.calculateAggregateScore(curr, p) < this.calculateAggregateScore(prev, p);
  }
}
