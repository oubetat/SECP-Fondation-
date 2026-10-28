# Known Limitations - Material Truth Thread (V9)

## SECP Programmable Material Engineering (PME) Phase V9

### Declared Scope Bounds & Operational Limits

1. **In-Memory DAG Execution**: The current implementation of `MaterialTruthThreadEngine` constructs and validates DAGs in-memory during FE model assembly and evidence generation. Persistence to external persistent databases (e.g. PostgreSQL/Cloud SQL) is deferred to platform database adapters.
2. **Deterministic Hash Invalidation Scope**: Mutating canonical objects or triggering `propagateRevisionInvalidation` invalidates downstream graph nodes deterministically. It does not attempt automated repair or automatic re-execution of FE simulations without user/system re-solve invocation.
3. **Multi-Field Scale**: Graph traversal and cycle detection scale efficiently ($O(V + E)$) for single-part models up to thousands of spatial field definitions. Large multi-body assemblies (>100,000 sub-components) may require parallel graph reduction algorithms in V10.
