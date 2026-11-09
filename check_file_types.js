import ts from 'typescript';
import path from 'path';
import fs from 'fs';

const rootDir = process.cwd();
const configFile = ts.readConfigFile(path.resolve(rootDir, 'tsconfig.json'), ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, rootDir);

export function checkFiles(filePaths) {
  const absPaths = filePaths.map(f => path.resolve(rootDir, f));
  const program = ts.createProgram(absPaths, parsedConfig.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);

  const results = diagnostics.map(diag => {
    let filename = diag.file ? path.relative(rootDir, diag.file.fileName) : 'unknown';
    let line = 0;
    let col = 0;
    if (diag.file && diag.start !== undefined) {
      const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
      line = pos.line + 1;
      col = pos.character + 1;
    }
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    return {
      file: filename,
      line,
      col,
      code: `TS${diag.code}`,
      message
    };
  });

  return results;
}

if (process.argv.length > 2) {
  const inputFiles = process.argv.slice(2);
  const diags = checkFiles(inputFiles);
  console.log(`Found ${diags.length} diagnostics for input files:`);
  diags.forEach(d => {
    console.log(`${d.file}:${d.line}:${d.col} [${d.code}] ${d.message}`);
  });
}
