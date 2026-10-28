# Engineering Exploration Request Contract

## SECP Programmable Material Engineering (PME) Phase V11

### 1. Purpose
The `EngineeringExplorationRequest` serves as the bridge between human engineering intent and AI generative capabilities. It defines the constraints, design space, and performance goals that the AI must respect while exploring material design alternatives.

---

### 2. Request Structure (`ExplorationRequest`)
- `requestId`: Unique identifier for the exploration session.
- `engineeringIntent`: High-level goal (e.g., "Maximize specific stiffness in high-stress zones").
- `targetProperties`: List of properties AI is allowed to vary (e.g., `["E", "density"]`).
- `designSpace`:
  - `geometryRevision`: Reference to the base part shape.
  - `variableBounds`: Range constraints for each design variable.
- `constraints`:
  - `hardPhysics`: Maximum allowable stress or displacement.
  - `manufacturing`: Minimum feature size or maximum property gradient.
- `budget`:
  - `maxCandidates`: Limit on generated design variations.
  - `iterations`: Number of feedback loops allowed.

---

### 3. AI Deliverable Contract (`AIProposal`)
For each candidate generated, the AI must provide:
- `candidateId`: Traceable ID.
- `designVariables`: Concrete values for the requested properties.
- `engineeringReasoning`: **Why** this specific combination was chosen (Explanation).
- `expectedOutcome`: Predicted performance impact.
- `confidenceLevel`: Self-assessed reliability of the proposal.

---

### 4. Integrity Constraints
- AI proposals **cannot** overwrite existing revision history.
- AI-generated data is marked `SYNTHETIC_AI_PROPOSAL` until validated by the `FEMCore` solver.
- Any proposal violating the `designSpace` bounds is rejected before consumption by the solver.
