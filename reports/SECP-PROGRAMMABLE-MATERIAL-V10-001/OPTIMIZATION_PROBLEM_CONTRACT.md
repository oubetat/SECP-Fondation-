# Engineering Optimization Problem Contract

## SECP Programmable Material Engineering (PME) Phase V10

### 1. Scope & Objective
The `OptimizationProblemContract` defines the formal structure for engineering design optimization within SECP. It encapsulates design variables, performance objectives, hard constraints (physics/manufacturing), and the search strategy.

---

### 2. Design Variables (`DesignVariable`)
Each variable represent a degree of freedom for the optimizer.
- `variableId`: Unique identifier (e.g., `E_SLOPE`).
- `targetNodeId`: The ID of the `SpatialMaterialField` or `FEMMaterial` being modified.
- `propertyName`: The specific property (e.g., `E`, `nu`, `density`).
- `range`: `[min, max]` allowed values.
- `initialValue`: Starting point for optimization.
- `stepSize`: Discrete step or sensitivity epsilon.

---

### 3. Performance Objectives (`OptimizationObjective`)
Mathematical functions to be minimized or maximized.
- `objectiveId`: e.g., `MIN_MASS`, `MAX_STIFFNESS`.
- `type`: `MINIMIZE` | `MAXIMIZE`.
- `metric`: `MASS` | `STRAIN_ENERGY` | `MAX_STRESS` | `MAX_DISPLACEMENT`.
- `unit`: SI or industry standard (e.g., `kg`, `J`, `MPa`, `mm`).
- `weight`: For scalarized multi-objective optimization (sum of weighted objectives).

---

### 4. Constraints (`HardConstraint`)
Mandatory conditions that must be satisfied for a design to be considered `FEASIBLE`.
- `constraintId`: e.g., `STRESS_SAFETY_LIMIT`.
- `type`: `PHYSICS` | `MANUFACTURING` | `GEOMETRIC`.
- `limitType`: `UPPER_BOUND` | `LOWER_BOUND` | `EQUALITY`.
- `threshold`: Numeric value of the limit.
- `sourceId`: Reference to the `ManufacturingConstraintProfile` or material yield limit.

---

### 5. Candidate Design (`OptimizationCandidate`)
A single point in the design space.
- `candidateId`: Traceable identifier.
- `variableValues`: Map of `variableId` -> `value`.
- `results`: Map of `objectiveId` -> `computedValue`.
- `feasibility`: `FEASIBLE` | `INFEASIBLE` | `INDETERMINATE`.
- `invalidationReason`: If infeasible (e.g., `STRESS_EXCEEDED`, `NOT_MANUFACTURABLE`).

---

### 6. Search Strategy (`SearchStrategy`)
- `strategyType`: `GRID_SEARCH` | `COORDINATE_DESCENT` | `PARETO_EXPLORATION`.
- `maxIterations`: Computational budget limit.
- `convergenceTolerance`: Termination threshold.
