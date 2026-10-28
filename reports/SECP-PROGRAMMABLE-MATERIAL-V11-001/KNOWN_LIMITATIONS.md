# Known Limitations - Phase V11

## SECP Programmable Material Engineering (PME) Phase V11

1. **Hallucination Risk**: The AI's "engineering reasoning" is textual and might describe physical phenomena not captured in the linear elastic `FEMCore` solver.
2. **Topology Invariance**: AI exploration is currently limited to material property variations (`SpatialMaterialField`). It cannot propose new geometries or hole patterns (topology optimization).
3. **Credit/Budget Capping**: Large ensemble exploration is restricted by API quota and computational budget (max 10 candidates per request).
4. **Manual Decision Gate**: AI can propose and evaluate, but it cannot "commit" or "approve" a design for production. Final adjudication remains with the `CHIEF_ENGINEER` authority.
