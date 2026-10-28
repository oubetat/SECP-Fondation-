# Known Limitations - Phase V10

## SECP Programmable Material Engineering (PME) Phase V10

1. **Local Optimization Bias**: The `COORDINATE_DESCENT` strategy finds local optima. It does not guarantee global optimality in non-convex design spaces.
2. **First-Order Sensitivity Missing**: Derivatives of objectives with respect to design variables are not explicitly calculated. The engine uses discrete finite difference steps.
3. **In-Memory Candidate Tracing**: Large optimization runs with thousands of candidates are handled in-memory. Persistence for "long-running" optimization processes is deferred to Phase V12.
4. **Scalarized Multi-Objective**: Multiple objectives are currently combined via weighted sums, which might not capture the full Pareto front as effectively as non-dominated sorting algorithms.
