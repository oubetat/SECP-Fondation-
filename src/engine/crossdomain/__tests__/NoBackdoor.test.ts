import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function getProductionFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry !== '__tests__' && entry !== 'tests' && entry !== '__test_helpers__') {
        getProductionFiles(fullPath, files);
      }
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('TASK-02 Security Audit — Zero Backdoors in Production Code', () => {
  it('production code must not import test helpers or expose backdoor seal minting', () => {
    const files = getProductionFiles('src/engine');
    
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content, `File ${file} contains mintCompromisedEnvelope`).not.toMatch(/mintCompromisedEnvelope/);
      expect(content, `File ${file} imports from __test_helpers__`).not.toMatch(/from ['"].*__test_helpers__/);
      expect(content, `File ${file} contains literal MD-SEAL`).not.toMatch(/MD-SEAL/);
      expect(content, `File ${file} contains literal TEST-SEAL`).not.toMatch(/TEST-SEAL/);
    }
  });
});
