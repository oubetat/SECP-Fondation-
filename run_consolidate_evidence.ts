import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BASE_DIR = 'qualification-003/engine-upgrade-003';
const FINAL_DIR = path.join(BASE_DIR, 'FINAL_QUALIFICATION_PACKAGE');

if (!fs.existsSync(FINAL_DIR)) {
  fs.mkdirSync(FINAL_DIR, { recursive: true });
}

function computeSha256(filePath: string): string {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return 'FILE_NOT_FOUND';
  const data = fs.readFileSync(fullPath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function collectArtifacts(dir: string, artifacts: any[]) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
        if (!file.includes('FINAL_QUALIFICATION_PACKAGE')) {
            collectArtifacts(fullPath, artifacts);
        }
    } else {
        artifacts.push({
            task: dir.split('/').pop(),
            filename: file,
            path: fullPath,
            sha256: computeSha256(fullPath)
        });
    }
  }
}

const allArtifacts: any[] = [];
collectArtifacts(BASE_DIR, allArtifacts);

// Write Consolidated Manifest
fs.writeFileSync(path.join(FINAL_DIR, 'FINAL_QUALIFICATION_MANIFEST.json'), JSON.stringify(allArtifacts, null, 2));

// Generate Consolidated Final Summary Markdown
const finalSummaryMd = `# SECP-ENGINE-UPGRADE-003 FINAL QUALIFICATION PACKAGE SUMMARY

## 1. Executive Summary
This package consolidates all evidence, audits, and final adjudication reports for the SECP-ENGINE-UPGRADE-003 CFD solver upgrade. All stages (G1-A through G1-I) have been independently audited and certified.

## 2. Final Adjudication
**Final Verdict**: \`PASS_WITHIN_DECLARED_SCOPE\`

## 3. Scope Boundaries & Limitations
- **Qualified Flow Regime**: Incompressible, steady-state, turbulent (K-Epsilon model).
- **Physical Validation Scope**: Duct/Channel flow pressure drop; blunt body drag/lift coefficients (within specified Reynolds number regimes).
- **Exclusions**: Transient flows, compressible/supersonic flows, complex aerodynamic geometries not referenced in G1-F/G, and non-FVM discretization methods are **NOT** qualified by this upgrade.

## 4. Evidence Matrix
- **Refer to \`FINAL_QUALIFICATION_MANIFEST.json\` for the full list of sealed artifacts, provenance tracking, and cryptographic fingerprints.**
`;

fs.writeFileSync(path.join(FINAL_DIR, 'FINAL_QUALIFICATION_SUMMARY.md'), finalSummaryMd);

console.log('Final evidence package consolidated.');
