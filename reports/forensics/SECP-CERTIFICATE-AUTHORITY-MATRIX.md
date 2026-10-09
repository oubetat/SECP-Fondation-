# SECP Certificate Authority Matrix
**Document ID**: SECP-CAM-2026-002  
**Audit Scope**: POST-CPIS-002 Certificate Issuer Forensic Audit  
**Date**: September 24, 2026  

---

## 1. Complete Certificate Issuer Inventory

| Issuer Symbol | File Path | Issued Artifact Type | Production Reachable? | Can Reach QualityGate? | Can Authorize Physical Release? | Signature Verified? | Classification |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **`MetrologyEngine`** | `src/engine/quality-metrology/MetrologyEngine.ts` | `QualityVerificationCertificate` | **YES** | **YES** | **YES (If LEVEL_3)** | **YES** | **AUTHORITATIVE_RELEASE_CA** |
| **`EngineeringCertificationEngine`** | `src/engine/certification/EngineeringCertificationEngine.ts` | `EngineeringCertificate` | **YES** | **NO** | **NO** | **YES** | **INFORMATIONAL_DOMAIN_CA** |
| **`ManufacturingCertificateEngine`** | `src/engine/certification/ManufacturingCertificateEngine.ts` | `ManufacturingCertificate` | **YES** | **NO** | **NO** | **YES** | **INFORMATIONAL_DOMAIN_CA** |
| **`DesignCertificateEngine`** | `src/engine/certification/DesignCertificateEngine.ts` | `DesignCertificate` | **YES** | **NO** | **NO** | **YES** | **INFORMATIONAL_DOMAIN_CA** |
| **`SimulationCertificateEngine`** | `src/engine/certification/SimulationCertificateEngine.ts` | `SimulationCertificate` | **YES** | **NO** | **NO** | **YES** | **INFORMATIONAL_DOMAIN_CA** |
| **`ResultCertificationEngine`** | `src/engine/certification/ResultCertificationEngine.ts` | `ResultCertificate` | **YES** | **NO** | **NO** | **YES** | **INFORMATIONAL_DOMAIN_CA** |
| **`SECPProductionCertificationEngine`** | `src/engine/certification/SECPProductionCertificationEngine.ts` | `SECPProductionCertificationManifest` | **YES** | **NO** | **NO** | **YES** | **INFORMATIONAL_MANIFEST_CA** |

---

## 2. Alternate Certificate Substitution Boundary Verification

Forensic testing in `src/engine/trust/__tests__/AlternateAuthorityAdversarial.test.ts` proves that:

1. `SimulationCertificate`, `ManufacturingCertificate`, `DesignCertificate`, `ResultCertificate`, and `EngineeringCertificate` are **REJECTED** if presented to `QualityGate.authorizeRelease`.
2. `QualityGate` strictly requires `evidenceGrade === 'LEVEL_3_PHYSICAL_TELEMETRY'` AND `provenanceHash.startsWith('SECP-PROD-')`.
3. Certificates with `SECP-PROD-` prefix MUST be registered in `MetrologyEngine`'s authoritative store; unregistered or caller-tampered certificates are **REJECTED**.

$$\mathbf{ALTERNATE\_CERTIFICATE\_AUTHORITY = FOUND \quad (Domain\ CAs\ exist\ but\ cannot\ bypass\ QualityGate)}$$
$$\mathbf{AUTHORITATIVE\_PHYSICAL\_RELEASE\_CA = MetrologyEngine}$$
