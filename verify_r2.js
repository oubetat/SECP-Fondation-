import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import ts from 'typescript';

console.log('=== SECP-TYPESCRIPT-REPAIR-001-R2: INDEPENDENT VERIFICATION ===');

const repairDir = '/SECP_TYPESCRIPT_REPAIR_001';
const manifestPath = path.join(repairDir, 'SHA256SUMS.txt');

// 1. Artifact Hash Verification
console.log('\n--- 1. ARTIFACT HASH VERIFICATION ---');
const artifactVerification = [];
if (fs.existsSync(manifestPath)) {
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifestLines = manifestContent.split('\n').filter(l => l.trim());
    
    for (const line of manifestLines) {
        const [expectedHash, filename] = line.split(/\s+/);
        const filePath = path.join(repairDir, filename);
        
        if (fs.existsSync(filePath)) {
            const actualHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
            const match = actualHash === expectedHash;
            artifactVerification.push({ filename, expectedHash, actualHash, match });
            console.log(`[${match ? 'PASS' : 'FAIL'}] ${filename}`);
        } else {
            artifactVerification.push({ filename, expectedHash, status: 'MISSING' });
            console.log(`[FAIL] ${filename} (MISSING)`);
        }
    }
} else {
    console.error('SHA256SUMS.txt not found');
}

// 2. Full Program Diagnostic Analysis
console.log('\n--- 2. FULL PROGRAM DIAGNOSTIC ANALYSIS ---');
const configPath = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedCommandLine = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));

console.log('Creating TypeScript Program...');
const program = ts.createProgram({
    rootNames: parsedCommandLine.fileNames,
    options: parsedCommandLine.options
});

const diagnostics = ts.getPreEmitDiagnostics(program);
const uniqueDiagnostics = new Set();
const diagnosticsByFile = {};

for (const diag of diagnostics) {
    if (diag.file) {
        const filePath = path.relative(process.cwd(), diag.file.fileName);
        const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
        const key = `${filePath}:${line + 1}:${character + 1}:${diag.code}`;
        uniqueDiagnostics.add(key);
        
        if (!diagnosticsByFile[filePath]) diagnosticsByFile[filePath] = [];
        diagnosticsByFile[filePath].push({
            code: `TS${diag.code}`,
            line: line + 1,
            message: ts.flattenDiagnosticMessageText(diag.messageText, '\n')
        });
    } else {
        uniqueDiagnostics.add(`global:${diag.code}:${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}`);
    }
}

const currentUniqueCount = uniqueDiagnostics.size;
console.log(`Total Unique Diagnostics: ${currentUniqueCount}`);

// 3. Target Engine Verification
console.log('\n--- 3. TARGET ENGINE VERIFICATION ---');
const targetEngines = [
    'src/engine/industrial-os/policy/EngineeringPolicyEngine.ts',
    'src/engine/persistence/FirestoreStorageEngine.ts',
    'src/engine/projectStorage.ts',
    'src/engine/cam/feature-recognition/SlotFeatureRecognizer.ts',
    'src/engine/cam/feature-recognition/StepFeatureRecognizer.ts',
    'src/engine/cam/feature-recognition/PocketFeatureRecognizer.ts'
];

const targetEngineResults = targetEngines.map(file => ({
    file,
    diagnosticCount: (diagnosticsByFile[file] || []).length,
    status: (diagnosticsByFile[file] || []).length === 0 ? 'CLEAN' : 'DIRTY'
}));

targetEngineResults.forEach(res => console.log(`[${res.status}] ${res.file}: ${res.diagnosticCount} errors`));

// 4. Patch Audit (Unified Diffs)
console.log('\n--- 4. PATCH AUDIT ---');
// Since we don't have before files, we'll just verify the presence of the repairs
const patchFiles = [
    'src/engine/industrial-os/policy/types.ts',
    'src/engine/assembly/AssemblyConstraintTypes.ts',
    'src/engine/collaboration/DigitalThreadTypes.ts',
    'src/engine/cam/feature-recognition/FeatureTypes.ts',
    'src/engine/cam/post-processor/PostTypes.ts',
    'src/engine/cam/toolpath/ToolpathTypes.ts',
    'src/engine/featureTree.ts'
];

const patchAudit = patchFiles.map(file => {
    const content = fs.readFileSync(file, 'utf-8');
    return {
        file,
        size: content.length,
        hasTsIgnore: content.includes('@ts-ignore'),
        hasTsNocheck: content.includes('@ts-nocheck'),
        hasAny: content.includes(': any'), // Rough check
    };
});

// Output results to JSON files
fs.writeFileSync('ARTIFACT_HASH_VERIFICATION.json', JSON.stringify(artifactVerification, null, 2));
fs.writeFileSync('TARGET_ENGINE_DIAGNOSTICS.json', JSON.stringify(targetEngineResults, null, 2));
fs.writeFileSync('PATCH_DIFF_AUDIT.json', JSON.stringify(patchAudit, null, 2));

console.log('\nVerification completed. Results written to JSON.');
