# SECP Release Authority Matrix
**Document ID**: SECP-RAM-2026-002  
**Audit Scope**: POST-CPIS-002 Release Decision Path Reconciliation  
**Date**: September 24, 2026  

---

## 1. Release Authority Inventory & Call Graph

| Engine / Component | File Path | Role | Can Authorize Final Release? | Physical Evidence Required? | Bypass Risk |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **`QualityGate`** | `src/engine/verification/QualityGate.ts` | Authoritative Release Gate | **YES** | **YES (`LEVEL_3_PHYSICAL_TELEMETRY`)** | **NONE** |
| **`IndustrialReadinessEngine`** | `src/engine/release/IndustrialReadinessEngine.ts` | Multi-tier Industrial Readiness | **YES** | **YES (Evaluates Stages 00–20)** | **NONE** |
| **`ProductionArtifactValidator`** | `src/engine/release/ProductionArtifactValidator.ts` | Artifact Schema & Digest Validator | **NO** (Validation only) | **NO** | **NONE** |

---

## 2. Authoritative Release Decision Path

$$\begin{aligned}
\text{Release Request} &\longrightarrow \text{QualityGate.authorizeRelease(partId, revisionHash, certificate)} \\
&\longrightarrow \text{MetrologyEngine.getCertificate(certificate.provenanceHash)} \\
&\longrightarrow \text{Verify: evidenceGrade === LEVEL\_3\_PHYSICAL\_TELEMETRY} \\
&\longrightarrow \text{Verify: provenanceHash.startsWith('SECP-PROD-')} \\
&\longrightarrow \text{Verify: rawMeasurementHash matches registered store} \\
&\longrightarrow \text{IndustrialReadinessEngine.evaluateReadiness()} \\
&\longrightarrow \mathbf{FINAL\ VERDICT:\ PARTIAL\ (Fail-Closed\ when\ Stage\ 17\ NOT\_PROVISIONED)}
\end{aligned}$$

---

## 3. Findings

1. **Single Authoritative Release Path**: `QualityGate.authorizeRelease` $\rightarrow$ `IndustrialReadinessEngine`.
2. **No Parallel Release Authorities**: No bypass engine exists that can issue a `RELEASED_PHYSICAL` disposition without passing through `QualityGate`.
3. **Fail-Closed Guarantee**: When Stage 17 (Physical Metrology) is `NOT_PROVISIONED`, the release decision evaluates strictly to `PARTIAL`.

$$\mathbf{PARALLEL\_RELEASE\_AUTHORITY = NONE}$$
$$\mathbf{PRODUCTION\_BYPASS = NONE}$$
