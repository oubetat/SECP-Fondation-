# Uncertainty and Limitations Report

## SECP Programmable Material Engineering (PME) Phase V11

### 1. Model Uncertainty
AI proposals assume that the underlying FEM model is a perfect representation of the physical part. Discrepancies between simulation and reality (as built) are not explicitly accounted for in the AI generation phase.

### 2. Search Space Limitations
AI is restricted to the variables explicitly listed in the `targetProperties`. It cannot currently propose changes to geometry (topology optimization) or explore non-linear constitutive models unless they are pre-defined in the model.

### 3. Verification Gaps
While each candidate is verified by `FEMCore`, the AI's "engineering reasoning" is textual and might contain hallucinatory claims about manufacturing feasibility that must be independently audited in V12.

### 4. Computational Budget
Exploration is currently capped at 10 candidates per request to maintain responsiveness and credit efficiency. Large-scale ensemble exploration is deferred to industrial qualification (V12).
