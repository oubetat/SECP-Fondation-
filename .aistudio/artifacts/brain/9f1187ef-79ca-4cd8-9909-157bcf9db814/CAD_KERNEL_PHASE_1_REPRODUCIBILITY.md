# SECP CAD Kernel Phase 1 Reproducibility Guide
**Campaign Identifier:** `SECP-CAD-KERNEL-PHASE-1-001`  
**Standard Authority:** SECP Canonical Model & Engineering Core  
**External Kernel Policy:** NO REPLACEMENT / NO NEW EXTERNAL KERNEL DEPENDENCY  
**Revision Identity:** `REVISION_IDENTITY_UNAVAILABLE`  
**Execution Environment:** Linux x86_64 / Node.js LTS / Vitest 1.6.1  

---

## 1. Reproduction Steps

To independently execute and verify all Phase 1 qualification suites and gate proofs, run the following shell commands in the application root directory:

### Step 1: Execute Phase 1 Dedicated Geometric Qualification Suite
```bash
npx vitest run src/engine/cad-kernel/__tests__/CADKernelPhase1Qualification.test.ts
```
*Expected Outcome:* 11 passed (100% pass rate).

### Step 2: Execute CAD Forensic Qualification Battery
```bash
npx vitest run src/engine/validation/cad-forensics/
```
*Expected Outcome:* Gate Verdict PASS (5 Proven, 4 Partial, 0 Unproven, 0 Failed).

### Step 3: Execute STEP AP242 Red Team Qualification Battery
```bash
npx vitest run src/engine/engineering/__tests__/AP242Phase2RedTeam.test.ts
```
*Expected Outcome:* 18 passed (100% pass rate).

### Step 4: Verify Full Production Applet Compilation
```bash
npm run build
```
*Expected Outcome:* Build succeeded with zero TypeScript or Vite bundle errors.

---

## 2. Cryptographic Digest Verification

Verify the SHA-256 integrity of all artifacts in the artifact directory by running:
```bash
cd /.aistudio/artifacts/brain/9f1187ef-79ca-4cd8-9909-157bcf9db814
sha256sum CAD_KERNEL_PHASE_1_*
```
The computed hashes must match `CAD_KERNEL_PHASE_1_SHA256_MANIFEST.json` byte-for-byte.
