# SECP Cyber-Physical Authority Convergence Graph
**Document ID**: SECP-ACG-2026-002  
**Audit Scope**: POST-CPIS-002 Authority Convergence & Canonical Identity Reconciliation  
**Date**: September 24, 2026  

---

## 1. Actual Production Execution Path & Authority Chain

```
[00-05] CANONICAL CAD & BREP
   │ (CadKernel, FeatureTreeEngine, BRepTopologyEngine)
   ▼
[06-11] ENGINEERING ANALYSIS & PMI
   │ (FemEngine, CfdEngine, ThermalEngine, GdtEngine)
   ▼
[12] DFM ASSESSMENT
   │ (ProductionDFMDecisionEngine)
   ▼
[13-14] CAM & TOOLPATH GENERATION
   │ (CamEngine, FiveAxisToolpathGenerator)
   ▼
[15-16] MACHINE PROGRAM VERIFICATION & MANUFACTURING
   │ (GCodePostProcessor, FiveAxisVerificationEngine, ManufacturingEngine)
   ▼
[17] PHYSICAL METROLOGY BOUNDARY
   │ (MetrologyEngine — Status: NOT_PROVISIONED)
   ▼
[18-19] QUALITY GATE & AUTHORITATIVE RELEASE
   │ (QualityGate.authorizeRelease — Status: NOT_PROVISIONED)
   ▼
[20] PRODUCTION PROOF
   │ (IndustrialReadinessEngine — Verdict: PARTIAL)
```

---

## 2. Transition Authority Matrix

| Transition | Caller | Callee | Input Contract | Output Contract | Identity Consumed | Trust State | Authority Boundary |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **00 $\rightarrow$ 04** | `CadKernel` | `BRepTopologyEngine` | `CADModelSpec` | `BRepSolid` | `partId`, `revisionId` | PROVEN | Authoritative |
| **04 $\rightarrow$ 12** | `BRepTopologyEngine` | `ProductionDFMDecisionEngine` | `BRepSolid` | `DfmAssessmentReport` | `bRepHash` | PROVEN | Authoritative |
| **12 $\rightarrow$ 13** | `ProductionDFMDecisionEngine` | `CamEngine` | `DfmAssessmentReport` | `CamJobSpec` | `dfmPayloadHash` | PROVEN | Authoritative |
| **13 $\rightarrow$ 14** | `CamEngine` | `FiveAxisToolpathGenerator` | `CamJobSpec` | `FiveAxisToolpath` | `clDataHash` | PROVEN | Authoritative |
| **14 $\rightarrow$ 15** | `FiveAxisToolpathGenerator` | `GCodePostProcessor` | `FiveAxisToolpath` | `VerifiedGCode` | `toolpathHash` | PROVEN | Authoritative |
| **15 $\rightarrow$ 16** | `GCodePostProcessor` | `ManufacturingEngine` | `VerifiedGCode` | `ManufacturingPlan` | `verifiedGCodeHash` | PROVEN | Authoritative |
| **16 $\rightarrow$ 17** | `ManufacturingEngine` | `MetrologyEngine` | `ManufacturingPlan` | `QualityVerificationCertificate` | `partSerialNumber` | **NOT_PROVISIONED** | **Physical Boundary** |
| **17 $\rightarrow$ 18** | `MetrologyEngine` | `QualityGate` | `QualityVerificationCertificate` | `boolean` | `cadRevisionHash` | **NOT_PROVISIONED** | **Fail-Closed Gate** |
| **18 $\rightarrow$ 20** | `QualityGate` | `IndustrialReadinessEngine` | `ReleaseRequest` | `IndustrialReadinessReport` | `partId`, `revisionHash` | **PARTIAL** | **Release Authority** |

---

## 3. Findings on CyberPhysicalContracts Integration Point

`CyberPhysicalContracts.ts` defines the hardware envelope structures (`MachineIdentity`, `PhysicalPartIdentity`, `MeasurementAcquisitionEnvelope`, `PhysicalProof`).

*   **Current Production Reachability**: `TEST_ONLY` (Imported strictly by `CyberPhysicalHILTestHarness.ts` and its tests).
*   **Production Execution Integration**: `MetrologyEngine` and `QualityGate` currently consume `QualityVerificationCertificate`.
*   **Recommended Minimal Convergence Architecture**: CPIS contracts should act as the input binding layer into `MetrologyEngine`, which then converts `MeasurementAcquisitionEnvelope` into the authoritative `QualityVerificationCertificate` consumed by `QualityGate`.
