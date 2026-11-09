import fs from 'fs';
import path from 'path';
import ts from 'typescript';

console.log('=== SECP-TYPESCRIPT-REPAIR-001: EVIDENCE RECONCILIATION AUDIT ===');

const configPath = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
if (!configPath) {
  console.error('Could not find tsconfig.json');
  process.exit(1);
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedCommandLine = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(configPath)
);

console.log('Creating TypeScript Program for full diagnostic audit...');
const startTime = Date.now();
const program = ts.createProgram({
  rootNames: parsedCommandLine.fileNames,
  options: parsedCommandLine.options
});

const diagnostics = ts.getPreEmitDiagnostics(program);
const durationMs = Date.now() - startTime;
console.log(`TypeScript check completed in ${(durationMs / 1000).toFixed(2)}s. Total diagnostics: ${diagnostics.length}`);

// Group diagnostics by file
const diagnosticsByFile = {};
const diagnosticsByCode = {};

for (const diag of diagnostics) {
  const code = `TS${diag.code}`;
  diagnosticsByCode[code] = (diagnosticsByCode[code] || 0) + 1;

  if (diag.file) {
    const filePath = path.relative(process.cwd(), diag.file.fileName);
    if (!diagnosticsByFile[filePath]) {
      diagnosticsByFile[filePath] = [];
    }
    const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    diagnosticsByFile[filePath].push({
      code,
      line: line + 1,
      column: character + 1,
      message
    });
  } else {
    if (!diagnosticsByFile['global']) {
      diagnosticsByFile['global'] = [];
    }
    diagnosticsByFile['global'].push({
      code,
      line: 0,
      column: 0,
      message: ts.flattenDiagnosticMessageText(diag.messageText, '\n')
    });
  }
}

// Target files check
const targetFiles = [
  'src/engine/industrial-os/policy/EngineeringPolicyEngine.ts',
  'src/engine/industrial-os/policy/types.ts',
  'src/engine/persistence/FirestoreStorageEngine.ts',
  'src/engine/projectStorage.ts',
  'src/engine/featureTree.ts',
  'src/engine/cam/feature-recognition/SlotFeatureRecognizer.ts',
  'src/engine/cam/feature-recognition/StepFeatureRecognizer.ts',
  'src/engine/cam/feature-recognition/PocketFeatureRecognizer.ts'
];

console.log('\n--- TARGET CORE ENGINE FILE DIAGNOSTICS ---');
const targetDiagnostics = {};
for (const file of targetFiles) {
  const fileDiags = diagnosticsByFile[file] || [];
  targetDiagnostics[file] = {
    errorCount: fileDiags.length,
    diagnostics: fileDiags
  };
  console.log(`${file}: ${fileDiags.length} errors`);
}

// Write full tsc verification JSON
const tscVerification = {
  timestamp: new Date().toISOString(),
  exitCode: diagnostics.length > 0 ? 1 : 0,
  totalDiagnostics: diagnostics.length,
  durationSeconds: durationMs / 1000,
  diagnosticsByCode,
  targetFilesStatus: targetDiagnostics,
  fileSummary: Object.keys(diagnosticsByFile).map(file => ({
    file,
    errorCount: diagnosticsByFile[file].length
  }))
};

fs.writeFileSync('TYPECHECK_RESULTS.json', JSON.stringify(tscVerification, null, 2));

console.log('\nAudit completed. TYPECHECK_RESULTS.json written successfully.');
