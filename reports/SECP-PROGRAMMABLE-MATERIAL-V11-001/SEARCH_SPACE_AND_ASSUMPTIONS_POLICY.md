# Search Space and Assumptions Policy

## SECP Programmable Material Engineering (PME) Phase V11

### 1. Domain Boundaries
AI exploration is strictly confined to the variables defined in the `ExplorationRequest`. Any AI attempt to modify fundamental geometry, solver tolerances, or baseline material identities (e.g., changing "Aluminum" to "Titanium" when only stiffness was requested) is considered a **Policy Violation** and will trigger immediate candidate rejection.

### 2. Physical Consistency Assumptions
- **Linear Elasticity**: Unless specified, AI proposals assume linear elastic behavior within the requested variable ranges.
- **Continuum Approximation**: Proposing material properties that vary at a scale finer than the `ManufacturingConstraintProfile.processResolution` is ignored or averaged over the element volume.

### 3. Truth Over Text
Natural language explanations provided by the AI (reasoning) are treated as **metadata** for explainability. They **do not** constitute engineering proof. Only numerical evidence from `FEMCore` is authoritative.

### 4. Convergence and Safety
If the AI proposes a candidate that leads to non-convergent solutions or matrix singularities (e.g., negative Poisson's ratio), the candidate is discarded, and the failure is logged to inform the AI of the "physical edge" of the design space.
