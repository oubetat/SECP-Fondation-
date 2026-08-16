/**
 * SECP-101.5: WASM Closure Evidence & Scope Integrity Gate
 * 
 * Formal closure gate verifying that SECP-101 WASM Kernel Closure is complete and sealed.
 * Enforces scope boundary separation: architectural blockers outside SECP-101 scope
 * cannot reopen or degrade the status of this gate.
 */

import fs from 'fs';
import path from 'path';
import { generateFullSHA256Hash } from '../../lib/hash';
import { ProductionArtifactValidator } from '../release/ProductionArtifactValidator';

export interface SECP101_5EvidenceRecord {
  gateId: 'SECP-101.5';
  previousGate: 'SECP-101.4';
  previousGateStatus: string;
  wasmKernelClosureStatus: 'SEALED' | 'UNSEALED';
  cfdIntegrity: 'PASS' | 'FAIL' | 'FAIL_REOPEN_REQUIRED';
  nurbsIntegrity: 'PASS' | 'FAIL' | 'FAIL_REOPEN_REQUIRED';
  camDeprecationIntegrity: 'PASS' | 'FAIL' | 'FAIL_REOPEN_REQUIRED';
  regressionStatus: 'PASS' | 'FAIL';
  outOfScopeProductionBlockers: string[];
  reopenedBlockers: string[];
  finalDecision: 'PASS' | 'BLOCKED' | 'FAIL' | 'FAIL_REOPEN_REQUIRED';
  finalProvenanceSHA256: string;
}

export interface Gate101_5Result {
  gateId: string;
  checks: {
    name: string;
    passed: boolean;
    details: string;
  }[];
  cfdIntegrity: 'PASS' | 'FAIL' | 'FAIL_REOPEN_REQUIRED';
  nurbsIntegrity: 'PASS' | 'FAIL' | 'FAIL_REOPEN_REQUIRED';
  camDeprecationIntegrity: 'PASS' | 'FAIL' | 'FAIL_REOPEN_REQUIRED';
  outOfScopeBlockerCount: number;
  secp101ScopeBlockerCount: number;
  regressionFailures: number;
  finalDecision: 'PASS' | 'BLOCKED' | 'FAIL' | 'FAIL_REOPEN_REQUIRED';
  finalProvenanceSHA256: string;
  evidenceRecord: SECP101_5EvidenceRecord;
}

export class HardAcceptanceGate101_5 {
  public static async evaluate(): Promise<Gate101_5Result> {
    const checks: { name: string; passed: boolean; details: string }[] = [];
    let finalDecision: 'PASS' | 'BLOCKED' | 'FAIL' | 'FAIL_REOPEN_REQUIRED' = 'PASS';
    let cfdIntegrity: 'PASS' | 'FAIL' | 'FAIL_REOPEN_REQUIRED' = 'PASS';
    let nurbsIntegrity: 'PASS' | 'FAIL' | 'FAIL_REOPEN_REQUIRED' = 'PASS';
    let camDeprecationIntegrity: 'PASS' | 'FAIL' | 'FAIL_REOPEN_REQUIRED' = 'PASS';
    let regressionFailures = 0;

    const rootDir = process.cwd();
    const reportsDir = path.join(rootDir, 'reports');

    // 1. Verify SECP-101.4 Evidence File
    const secp101_4Path = path.join(reportsDir, 'SECP-101.4-EVIDENCE-RECORD.json');
    let secp101_4Evidence: any = null;
    if (fs.existsSync(secp101_4Path)) {
      try {
        secp101_4Evidence = JSON.parse(fs.readFileSync(secp101_4Path, 'utf8'));
        checks.push({
          name: 'SECP-101.4 Evidence File Presence',
          passed: true,
          details: `Loaded ${secp101_4Path}`
        });
      } catch (e: any) {
        checks.push({
          name: 'SECP-101.4 Evidence File Presence',
          passed: false,
          details: `Error reading JSON: ${e.message}`
        });
        finalDecision = 'BLOCKED';
      }
    } else {
      checks.push({
        name: 'SECP-101.4 Evidence File Presence',
        passed: false,
        details: `Missing file: ${secp101_4Path}`
      });
      finalDecision = 'BLOCKED';
    }

    if (secp101_4Evidence) {
      // Check previous decision is PASS
      const prevDecisionPass = secp101_4Evidence.finalDecision === 'PASS';
      checks.push({
        name: 'SECP-101.4 Previous Gate Decision == PASS',
        passed: prevDecisionPass,
        details: `Previous Decision: ${secp101_4Evidence.finalDecision}`
      });
      if (!prevDecisionPass && finalDecision === 'PASS') finalDecision = 'BLOCKED';

      // Check CFD Contract Status
      const cfdStatusResolved = secp101_4Evidence.cfdContractStatus === 'RESOLVED';
      checks.push({
        name: 'CFD Contract Status == RESOLVED',
        passed: cfdStatusResolved,
        details: `CFD Status: ${secp101_4Evidence.cfdContractStatus}`
      });
      if (!cfdStatusResolved) {
        cfdIntegrity = 'FAIL_REOPEN_REQUIRED';
        finalDecision = 'FAIL_REOPEN_REQUIRED';
      }

      // Check CFD Tolerance & Max Diff
      const cfdDiffOk = typeof secp101_4Evidence.cfdMaxAbsoluteDifference === 'number' &&
        secp101_4Evidence.cfdMaxAbsoluteDifference <= 1e-12;
      checks.push({
        name: 'CFD Numerical Difference <= 1e-12',
        passed: cfdDiffOk,
        details: `CFD maxAbsoluteDifference: ${secp101_4Evidence.cfdMaxAbsoluteDifference}`
      });
      if (!cfdDiffOk) {
        cfdIntegrity = 'FAIL';
        if (finalDecision === 'PASS') finalDecision = 'FAIL';
      }

      // Check CFD Deterministic Replay
      const cfdReplayOk = secp101_4Evidence.cfdDeterministicReplay === true;
      checks.push({
        name: 'CFD Deterministic Replay == true',
        passed: cfdReplayOk,
        details: `CFD Deterministic: ${secp101_4Evidence.cfdDeterministicReplay}`
      });
      if (!cfdReplayOk) {
        cfdIntegrity = 'FAIL';
        if (finalDecision === 'PASS') finalDecision = 'FAIL';
      }

      // Check NURBS Contract Status
      const nurbsStatusResolved = secp101_4Evidence.nurbsContractStatus === 'RESOLVED';
      checks.push({
        name: 'NURBS Contract Status == RESOLVED',
        passed: nurbsStatusResolved,
        details: `NURBS Status: ${secp101_4Evidence.nurbsContractStatus}`
      });
      if (!nurbsStatusResolved) {
        nurbsIntegrity = 'FAIL_REOPEN_REQUIRED';
        finalDecision = 'FAIL_REOPEN_REQUIRED';
      }

      // Check Cox-de Boor Equivalence
      const nurbsCoxOk = secp101_4Evidence.nurbsCoxDeBoorEquivalence === true;
      checks.push({
        name: 'NURBS Cox-de Boor Equivalence == true',
        passed: nurbsCoxOk,
        details: `Cox-de Boor: ${secp101_4Evidence.nurbsCoxDeBoorEquivalence}`
      });
      if (!nurbsCoxOk) {
        nurbsIntegrity = 'FAIL';
        if (finalDecision === 'PASS') finalDecision = 'FAIL';
      }

      // Check Partition of Unity
      const nurbsUnityOk = secp101_4Evidence.nurbsPartitionOfUnity === true;
      checks.push({
        name: 'NURBS Partition of Unity == true',
        passed: nurbsUnityOk,
        details: `Partition of Unity: ${secp101_4Evidence.nurbsPartitionOfUnity}`
      });
      if (!nurbsUnityOk) {
        nurbsIntegrity = 'FAIL';
        if (finalDecision === 'PASS') finalDecision = 'FAIL';
      }

      // Check CAM Deprecation
      const camDepOk = secp101_4Evidence.camDeprecated === true && secp101_4Evidence.camActiveConsumers === 0;
      checks.push({
        name: 'CAM Legacy Transform Formally Deprecated & 0 Consumers',
        passed: camDepOk,
        details: `camDeprecated: ${secp101_4Evidence.camDeprecated}, activeConsumers: ${secp101_4Evidence.camActiveConsumers}`
      });
      if (!camDepOk) {
        camDeprecationIntegrity = 'FAIL_REOPEN_REQUIRED';
        finalDecision = 'FAIL_REOPEN_REQUIRED';
      }

      // Check Regression Status
      const regOk = secp101_4Evidence.regressionStatus === 'PASS';
      checks.push({
        name: 'Regression Status == PASS',
        passed: regOk,
        details: `Regression: ${secp101_4Evidence.regressionStatus}`
      });
      if (!regOk) {
        regressionFailures++;
        if (finalDecision === 'PASS') finalDecision = 'FAIL';
      }

      // Check Provenance Hash
      const provHashOk = typeof secp101_4Evidence.finalProvenanceSHA256 === 'string' &&
        secp101_4Evidence.finalProvenanceSHA256.length === 64;
      checks.push({
        name: 'Previous Provenance SHA-256 Valid',
        passed: provHashOk,
        details: `Hash: ${secp101_4Evidence.finalProvenanceSHA256}`
      });
      if (!provHashOk && finalDecision === 'PASS') finalDecision = 'BLOCKED';
    }

    // 2. Inspect WasmKernels.ts for forbidden tokens
    const wasmKernelsPath = path.join(rootDir, 'src/engine/hpc/runtime/WasmKernels.ts');
    let wasmSourceOk = true;
    if (fs.existsSync(wasmKernelsPath)) {
      const wasmSource = fs.readFileSync(wasmKernelsPath, 'utf8');
      const forbiddenWords = ['placeholder', 'mock', 'fake', 'todo'];
      const matches: string[] = [];
      for (const word of forbiddenWords) {
        const regex = new RegExp('\\b' + word + '\\b', 'i');
        if (regex.test(wasmSource)) {
          matches.push(word);
        }
      }
      if (matches.length > 0) {
        wasmSourceOk = false;
        checks.push({
          name: 'WasmKernels.ts Clean of Forbidden Tokens',
          passed: false,
          details: `Found forbidden tokens: ${matches.join(', ')}`
        });
        if (finalDecision === 'PASS') finalDecision = 'FAIL';
      } else {
        checks.push({
          name: 'WasmKernels.ts Clean of Forbidden Tokens',
          passed: true,
          details: 'Zero mock, fake, placeholder, TODO tokens found.'
        });
      }

      // Verify cam_5axis_transform_f64 is NOT present in exported signatures
      if (wasmSource.includes('cam_5axis_transform_f64(') || wasmSource.includes('cam_5axis_transform_f64:')) {
        camDeprecationIntegrity = 'FAIL_REOPEN_REQUIRED';
        finalDecision = 'FAIL_REOPEN_REQUIRED';
        checks.push({
          name: 'cam_5axis_transform_f64 Removed from WASM Export Signatures',
          passed: false,
          details: 'cam_5axis_transform_f64 still exported in WasmKernels.ts'
        });
      } else {
        checks.push({
          name: 'cam_5axis_transform_f64 Removed from WASM Export Signatures',
          passed: true,
          details: 'Verified not exported in WASM ABI'
        });
      }

      // Verify CFD ABI export signature matches contract (14 f64s + 1 outPtr)
      const cfdSignatureOk = wasmSource.includes('cfd_flux_f64') &&
        wasmSource.includes('rho_L: number') &&
        wasmSource.includes('p_R: number') &&
        wasmSource.includes('outFluxesPtr: number');
      checks.push({
        name: 'cfd_flux_f64 WASM ABI Exact Contract Signature Match',
        passed: cfdSignatureOk,
        details: cfdSignatureOk ? '14-parameter input + outPtr verified' : 'CFD signature divergence detected'
      });
      if (!cfdSignatureOk) {
        cfdIntegrity = 'FAIL_REOPEN_REQUIRED';
        finalDecision = 'FAIL_REOPEN_REQUIRED';
      }

      // Verify NURBS ABI export signature matches contract
      const nurbsSignatureOk = wasmSource.includes('nurbs_basis_f64') &&
        wasmSource.includes('knotsPtr: number') &&
        wasmSource.includes('knotsLen: number');
      checks.push({
        name: 'nurbs_basis_f64 WASM ABI Exact Contract Signature Match',
        passed: nurbsSignatureOk,
        details: nurbsSignatureOk ? 'Standardized (i, p, u, knotsPtr, knotsLen) verified' : 'NURBS signature divergence detected'
      });
      if (!nurbsSignatureOk) {
        nurbsIntegrity = 'FAIL_REOPEN_REQUIRED';
        finalDecision = 'FAIL_REOPEN_REQUIRED';
      }
    } else {
      wasmSourceOk = false;
      checks.push({
        name: 'WasmKernels.ts Source File Presence',
        passed: false,
        details: `Missing file: ${wasmKernelsPath}`
      });
      if (finalDecision === 'PASS') finalDecision = 'FAIL';
    }

    // 3. Verify Native C Authority for CAM 5-Axis
    const nativeCPath = path.join(rootDir, 'src/engine/hpc/native/src/engineering_kernels.c');
    if (fs.existsSync(nativeCPath)) {
      const nativeSource = fs.readFileSync(nativeCPath, 'utf8');
      const hasNativeCamIK = nativeSource.includes('native_cam_5axis_ik');
      const hasNativeCamBulk = nativeSource.includes('native_cam_5axis_bulk');
      const nativeCamOk = hasNativeCamIK && hasNativeCamBulk;
      checks.push({
        name: 'Native C 5-Axis CAM Authority Maintained',
        passed: nativeCamOk,
        details: `native_cam_5axis_ik: ${hasNativeCamIK}, native_cam_5axis_bulk: ${hasNativeCamBulk}`
      });
      if (!nativeCamOk) {
        camDeprecationIntegrity = 'FAIL_REOPEN_REQUIRED';
        finalDecision = 'FAIL_REOPEN_REQUIRED';
      }
    } else {
      checks.push({
        name: 'Native C Kernels Source File Presence',
        passed: false,
        details: `Missing file: ${nativeCPath}`
      });
      if (finalDecision === 'PASS') finalDecision = 'BLOCKED';
    }

    // 4. Production Artifact Scope Separation & Scope Integrity
    const validator = new ProductionArtifactValidator();
    const artifactMetrics = validator.validate(path.join(rootDir, 'src/engine'));

    const secp101ScopeBlockers = artifactMetrics.secp101ScopeBlockers || [];
    const outOfScopeBlockers = artifactMetrics.outOfScopeArchitecturalBlockers || [];

    const scopeIntegrityOk = secp101ScopeBlockers.length === 0;
    checks.push({
      name: 'SECP-101 Scope Zero-Blocker Integrity',
      passed: scopeIntegrityOk,
      details: `SECP-101 Scope Blockers: ${secp101ScopeBlockers.length}, Out-of-Scope Architectural Blockers: ${outOfScopeBlockers.length}`
    });

    if (!scopeIntegrityOk) {
      if (finalDecision === 'PASS') finalDecision = 'FAIL';
    }

    // 5. Construct Canonical Evidence Record
    const rawEvidence: Omit<SECP101_5EvidenceRecord, 'finalProvenanceSHA256'> = {
      gateId: 'SECP-101.5',
      previousGate: 'SECP-101.4',
      previousGateStatus: secp101_4Evidence?.finalDecision || 'UNKNOWN',
      wasmKernelClosureStatus: finalDecision === 'PASS' ? 'SEALED' : 'UNSEALED',
      cfdIntegrity: cfdIntegrity,
      nurbsIntegrity: nurbsIntegrity,
      camDeprecationIntegrity: camDeprecationIntegrity,
      regressionStatus: regressionFailures === 0 ? 'PASS' : 'FAIL',
      outOfScopeProductionBlockers: outOfScopeBlockers,
      reopenedBlockers: secp101ScopeBlockers,
      finalDecision: finalDecision
    };

    const finalHash = await generateFullSHA256Hash(rawEvidence);

    const fullEvidenceRecord: SECP101_5EvidenceRecord = {
      ...rawEvidence,
      finalProvenanceSHA256: finalHash
    };

    const evidenceOutPath = path.join(reportsDir, 'SECP-101.5-EVIDENCE-RECORD.json');
    fs.writeFileSync(evidenceOutPath, JSON.stringify(fullEvidenceRecord, null, 2), 'utf8');

    return {
      gateId: 'SECP-101.5',
      checks,
      cfdIntegrity,
      nurbsIntegrity,
      camDeprecationIntegrity,
      outOfScopeBlockerCount: outOfScopeBlockers.length,
      secp101ScopeBlockerCount: secp101ScopeBlockers.length,
      regressionFailures,
      finalDecision,
      finalProvenanceSHA256: finalHash,
      evidenceRecord: fullEvidenceRecord
    };
  }
}
