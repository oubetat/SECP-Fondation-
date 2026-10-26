# SECP-FSI-INDEPENDENT-REQUALIFICATION-013

This mission transitions the SECP FSI system from "physically active" to "industrially qualified." We will replace the current heuristic benchmark with a multi-resolution convergence study, execute adversarial failure tests, and verify global conservation of loads and moments to establish a definitive capability register.

> [!IMPORTANT]
> This is a forensic qualification task. We are moving from a single-point success criteria to a gradient-based convergence proof.

- **Confirmed Decision (Phase 1)**: Use fixed refinement levels (10, 20, 40 stations) to demonstrate the $O(h)$ or $O(h^2)$ error reduction trend.
- **Confirmed Decision (Phase 1)**: Implement a relative volume threshold in `DynamicMeshManager` (e.g., reject if $V < 0.01\% V_{initial}$) to ensure scale-invariant mesh safety.
- **Recommended Default**: Persist complete Aitken traces and residual history in the evidence package to allow for independent stability analysis.

## 1. Overview & Core Concept

The goal is to provide **Engineering Truth** regarding the accuracy and limits of the FSI solver. Instead of reporting "Passed/Failed," we will report the "Convergence Rate" and "Residual Equilibrium Error." This establishes trust for industrial users who need to know exactly how much to trust the simulation results at a given mesh resolution.

### Key Value
- **Transparency**: Clear documentation of the 128% error as a discretization artifact.
- **Reliability**: Proven rejection of non-physical states (inverted meshes).
- **Auditability**: Cryptographically hashed link between source code and reported results.

## 2. User Experience & Visual Design

As a principal engineering task, the "UI" is the **Evidence Package** and the **Final Verdict Dashboard**.

- **Qualification Dashboard**:
    - **Convergence Plot**: ASCII representation or data table showing Error % dropping as Mesh Density increases.
    - **Stability Heatmap**: Status indicators for different physics regimes (e.g., Low vs. High Young's Modulus).
    - **Integrity Badges**: Green/Red indicators for SHA-256 matches and Conservation Balance.

- **Visual Theme**: Utilitarian, high-density information layout (SECP Industrial Style).

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Element Formulation Verification**
    - *Chosen Approach*: Retain `QUAD_2D` but explicitly test for "Shear Locking" by varying the aspect ratio of the cantilever elements.
    - *Why*: This identifies if the 128% error is due to discretization or a fundamental limitation of the element shape function.

- **Decision 2: Rejection Thresholds**
    - *Chosen Approach*: Move from absolute `1e-18` to a relative `1e-4` of initial volume.
    - *Why*: Avoids failure in micro-scale models while maintaining safety in macro-scale industrial parts.

## 4. Technical Architecture & Data Strategy

```drawio
┌─────────────────────────────────────────────────────────┐
│            FSI Qualification Engine (013)               │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐      ┌─────────────────────────┐  │
│  │ Mesh Generator   │─────▶│ Convergence Study Unit   │  │
│  │ (10, 20, 40 sta) │      │ (Analytical vs Num)     │  │
│  └──────────────────┘      └────────────┬────────────┘  │
│                                         │               │
│  ┌──────────────────┐      ┌────────────▼────────────┐  │
│  │ Adversarial Unit │─────▶│ Conservation Auditor    │  │
│  │ (Fail Injection) │      │ (Force/Moment Balance)  │  │
│  └──────────────────┘      └────────────┬────────────┘  │
│                                         │               │
│  ┌──────────────────────────────────────▼────────────┐  │
│  │           Evidence & Provenance Manager           │  │
│  │ (SHA-256 Hashes, JSON Evidence, Final Verdict)    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Data Model & State
- **Qualification Result**:
    - `meshTrace`: Array of `{ resolution, error, wallTime }`.
    - `conservationAudit`: `{ forceBalanceError, momentBalanceError }`.
    - `adversarialReport`: List of successful rejections for (Inf, NaN, InvertedMesh).
    - `provenance`: Mapping of file paths to SHA-256 hashes.

### Interactive Component Mapping
- **`run_secp_requalification_013.ts`**: The main entry point that orchestrates the sweep across resolutions and failure cases.
- **`FSIQualificationReporter.ts`**: (New) Dedicated utility to generate the high-fidelity markdown and JSON evidence.
- **`DynamicMeshManager.ts`**: (Update) Implement relative volume checks.
- **`TwoWayFSICouplingEngine.ts`**: (Update) Ensure full iteration history is exposed for auditing.
