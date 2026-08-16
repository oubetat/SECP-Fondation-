import fs from 'fs';
import path from 'path';

export interface ArtifactMetrics {
  todoCount: number;
  fixmeCount: number;
  placeholderCount: number;
  mockCount: number;
  stubCount: number;
  fakeCount: number;
  scannedFiles: number;
  trueProductionBlockers: string[];
  historicalAuditReferences: string[];
  secp101ScopeBlockers: string[];
  outOfScopeArchitecturalBlockers: string[];
}

export class ProductionArtifactValidator {
  private scanDir(dir: string, metrics: ArtifactMetrics) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.scanDir(fullPath, metrics);
      } else if (stat.isFile() && fullPath.endsWith('.ts')) {
        // Exclude test and adversarial suites, and the release folder itself
        if (fullPath.includes('AdversarialSuite') || fullPath.toLowerCase().includes('closure') || fullPath.includes('test') || fullPath.includes('/release/')) {
          continue;
        }

        metrics.scannedFiles++;
        const content = fs.readFileSync(fullPath, 'utf8').toLowerCase();

        const countOccurrences = (word: string) => {
          return (content.match(new RegExp('\\b' + word + '\\b', 'g')) || []).length;
        };

        const todos = countOccurrences('todo');
        const fixmes = countOccurrences('fixme');
        const placeholders = countOccurrences('placeholder');
        const mocks = countOccurrences('mock');
        const stubs = countOccurrences('stub');
        const fakes = countOccurrences('fake');

        metrics.todoCount += todos;
        metrics.fixmeCount += fixmes;
        metrics.placeholderCount += placeholders;
        metrics.mockCount += mocks;
        metrics.stubCount += stubs;
        metrics.fakeCount += fakes;

        const isHistorical = fullPath.match(/HardAcceptanceGate/i) || fullPath.match(/SECP/i) || fullPath.match(/SECPMaster/i);
        const targetArray = isHistorical ? metrics.historicalAuditReferences : metrics.trueProductionBlockers;

        const isSecp101Scope = fullPath.includes('WasmKernels') || fullPath.includes('/hpc/runtime/');

        const addViolation = (msg: string) => {
          targetArray.push(msg);
          if (!isHistorical) {
            if (isSecp101Scope) {
              metrics.secp101ScopeBlockers.push(msg);
            } else {
              metrics.outOfScopeArchitecturalBlockers.push(msg);
            }
          }
        };

        if (todos > 0) addViolation(`${fullPath}: Contains TODO`);
        if (fixmes > 0) addViolation(`${fullPath}: Contains FIXME`);
        if (placeholders > 0) addViolation(`${fullPath}: Contains placeholder`);
        if (mocks > 0) addViolation(`${fullPath}: Contains mock`);
        if (stubs > 0) addViolation(`${fullPath}: Contains stub`);
        if (fakes > 0) addViolation(`${fullPath}: Contains fake`);
      }
    }
  }

  public validate(baseDir: string): ArtifactMetrics {
    const metrics: ArtifactMetrics = {
      todoCount: 0,
      fixmeCount: 0,
      placeholderCount: 0,
      mockCount: 0,
      stubCount: 0,
      fakeCount: 0,
      scannedFiles: 0,
      trueProductionBlockers: [],
      historicalAuditReferences: [],
      secp101ScopeBlockers: [],
      outOfScopeArchitecturalBlockers: []
    };

    this.scanDir(baseDir, metrics);

    return metrics;
  }
}
