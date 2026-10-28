# Objective and Constraint Semantics

## SECP Programmable Material Engineering (PME) Phase V10

### 1. Objective Metrics

| Metric | Context | Calculation Basis |
|---|---|---|
| `MASS` | Material Efficiency | Integration of density over the design volume $V$: $M = \int_V \rho(\mathbf{x}) dV$ |
| `STRAIN_ENERGY` | Stiffness / Compliance | $U = \frac{1}{2} \int_V \boldsymbol{\sigma} : \boldsymbol{\epsilon} dV$. Minimizing $U$ is equivalent to maximizing stiffness for a fixed load. |
| `MAX_STRESS` | Structural Integrity | $\max(\sigma_{vonMises})$ over all integration points or nodes. |
| `MAX_DISPLACEMENT` | Precision / Deflection | $\max(|\mathbf{u}|)$ over all nodes. |

---

### 2. Constraint Semantics

#### A. Physics Constraints
- **Safety Factor**: $\frac{\sigma_{yield}}{\max(\sigma_{vonMises})} \ge SF_{min}$.
- **Deflection Limit**: $\max(|\mathbf{u}|) \le \delta_{max}$.

#### B. Manufacturing Constraints (V6)
- **Gradient Limit**: $\max(|\nabla E|) \le G_{max}$ (derived from `ManufacturingConstraintProfile`).
- **Porosity Limit**: $P(\mathbf{x}) \in [P_{min}, P_{max}]$.
- **Resolution Limit**: Design features must be $> \min_{feature}$.

#### C. Geometric Constraints
- **Volume Fraction**: $\frac{V_{material}}{V_{total}} \le VF_{max}$.

---

### 3. Feasibility Logic
A candidate design is marked `FEASIBLE` if and only if:
1. The physics solver converged successfully.
2. All upper bounds: $g_i(\mathbf{x}) \le T_i$.
3. All lower bounds: $h_j(\mathbf{x}) \ge T_j$.
4. All equality constraints: $|k_m(\mathbf{x}) - T_m| \le \epsilon$.
5. `ManufacturingConstraintEngine` returns `PASS`.
