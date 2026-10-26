# Minimum Qualification Test Plan: SECP-PROGRAMMABLE-MATERIAL-001

## 1. Scope
This test plan defines the software and numerical "oracles" required to qualify the SECP integration of programmable materials.

## 2. Test Hypotheses
| Test ID | Hypothesis | Success Criterion |
|---|---|---|
| **QUAL-NUM-001** | The "Grading Engine" correctly interpolates material properties at Gauss points. | Pointwise parameter error $< 10^{-12}$. |
| **QUAL-NUM-002** | The global stiffness matrix correctly reflects the spatial gradient. | Reactions match analytical solution for 1D FGM bar. |
| **QUAL-NUM-003** | The nonlinear solver converges for high-gradient material fields. | Convergence in $< 15$ iterations per load step. |
| **QUAL-NUM-004** | Material state rollback works for gradient-dependent states. | No history drift during load cutbacks. |

## 3. Test Procedures
### 3.1 1D Gradient Benchmark
1. Define a 1D bar with $E(x) = E_0 \cdot (1 + \alpha x)$.
2. Discretize with 10 elements.
3. Apply displacement control.
4. **Oracle:** Compare stress distribution $\sigma(x)$ and reaction $R$ to analytical solution.

### 3.2 Adversarial Gradient Test
1. Define a material property with a step discontinuity.
2. Verify that the `GlobalAssemblyEngine` does not "blur" the interface unless explicitly requested by the interpolation filter.
3. Verify that zero-modulus cells are rejected or handled with numerical regularization.

## 4. Required Artifacts
- **QUAL-RESULTS.json:** Automated pass/fail metrics.
- **GRADIENT-FIELD.png:** Visualization of the mapped properties on the mesh.
- **CONVERGENCE-PLOT.png:** Newton-Raphson residual history for the FGL case.

## 5. Blocking Gaps
- **GAP-PM-002 (Grading Engine):** Tests cannot be executed until the mapping function $f: (x,y,z) \to \text{Material}$ is implemented in `GlobalAssemblyEngine`.
