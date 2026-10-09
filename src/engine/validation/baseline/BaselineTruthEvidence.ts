import * as fs from 'node:fs';
import * as path from 'node:path';
import { EvidenceReference, EvidenceType } from './BaselineTruthTypes';

/**
 * BaselineTruthEvidence
 * Helper utilities to create and verify EvidenceReference objects with filesystem and provenance checks.
 */
export class BaselineTruthEvidence {
  /**
   * Recursively enumerates code files within a directory or returns the file itself.
   */
  public static enumerateFiles(targetPath: string): string[] {
    const results: string[] = [];
    try {
      if (!fs.existsSync(targetPath)) return [];
      const stat = fs.statSync(targetPath);
      if (!stat.isDirectory()) {
        return [targetPath];
      }
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(targetPath, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.enumerateFiles(full));
        } else if (
          entry.isFile() &&
          /\.(ts|tsx|js|mjs)$/i.test(entry.name) &&
          !entry.name.endsWith('.d.ts')
        ) {
          results.push(full);
        }
      }
    } catch {
      // Graceful return on permission or read issues
    }
    return results;
  }

  /**
   * Create an EvidenceReference and verify its existence.
   */
  public static create(
    id: string,
    type: EvidenceType,
    reference: string,
    description: string,
    verifiedOverride?: boolean
  ): EvidenceReference {
    let verified = false;

    if (verifiedOverride !== undefined) {
      verified = verifiedOverride;
    } else {
      // Check if reference is an accessible file or directory with contents
      try {
        const fullPath = path.resolve(process.cwd(), reference);
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const files = this.enumerateFiles(fullPath);
            verified = files.length > 0;
          } else {
            verified = true;
          }
        }
      } catch {
        verified = false;
      }
    }

    return {
      id,
      type,
      reference,
      description,
      verified
    };
  }

  /**
   * Analyze an individual file for genuine logic vs simulation/mock markers.
   */
  private static analyzeSingleFile(fullPath: string): {
    exists: boolean;
    hasRealLogic: boolean;
    isSimulatedOrMock: boolean;
    isHardcoded: boolean;
    hasErrorHandling: boolean;
    lineCount: number;
    markers: string[];
  } {
    try {
      if (!fs.existsSync(fullPath)) {
        return {
          exists: false,
          hasRealLogic: false,
          isSimulatedOrMock: false,
          isHardcoded: false,
          hasErrorHandling: false,
          lineCount: 0,
          markers: ['FILE_NOT_FOUND']
        };
      }

      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return {
          exists: true,
          hasRealLogic: false,
          isSimulatedOrMock: false,
          isHardcoded: false,
          hasErrorHandling: false,
          lineCount: 0,
          markers: ['DIRECTORY_NOT_FILE']
        };
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      const lower = content.toLowerCase();
      const markers: string[] = [];

      // Simulation / mock checks: specifically look for simulated/mock implementations
      const isExplicitMockFile =
        path.basename(fullPath).toLowerCase().includes('mock') ||
        path.basename(fullPath).toLowerCase().includes('stub');

      const isSimulatedOrMock =
        isExplicitMockFile ||
        /\bclass\s+Mock\w+/i.test(content) ||
        /\bclass\s+Stub\w+/i.test(content) ||
        lower.includes('// mock implementation') ||
        lower.includes('/* mock implementation') ||
        lower.includes('simulated workload') ||
        lower.includes('demonstration-only') ||
        lower.includes('return mock');

      if (isSimulatedOrMock) {
        markers.push('SIMULATION_OR_MOCK_INDICATOR');
      }

      // Hardcoded verdict checks
      const isHardcoded =
        /return\s+["']PASS["']/i.test(content) ||
        /return\s*\{\s*status:\s*["']PASS["']/i.test(content) ||
        (/verdict:\s*["']PASS["']/i.test(content) && !lower.includes('evaluate('));

      if (isHardcoded) {
        markers.push('HARDCODED_VERDICT_PATTERN');
      }

      // Real logic checks (loops, matrix operations, equations, numerical solvers)
      const hasRealLogic =
        lines.length > 25 &&
        (content.includes('for (') ||
          content.includes('for(') ||
          content.includes('while') ||
          content.includes('Math.') ||
          content.includes('Float64Array') ||
          content.includes('matrix') ||
          content.includes('solve(') ||
          content.includes('residual') ||
          content.includes('jacobian') ||
          content.includes('mesh') ||
          content.includes('node') ||
          content.includes('stress') ||
          content.includes('flux') ||
          content.includes('class ') ||
          content.includes('interface '));

      const hasErrorHandling =
        content.includes('throw new Error') ||
        content.includes('try {') ||
        content.includes('catch');

      return {
        exists: true,
        hasRealLogic,
        isSimulatedOrMock,
        isHardcoded,
        hasErrorHandling,
        lineCount: lines.length,
        markers
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        exists: false,
        hasRealLogic: false,
        isSimulatedOrMock: false,
        isHardcoded: false,
        hasErrorHandling: false,
        lineCount: 0,
        markers: [`READ_ERROR: ${msg}`]
      };
    }
  }

  /**
   * Check if a file or directory contains genuine implementation vs simulation/mock markers.
   * Recursively walks directories and aggregates findings without triggering EISDIR.
   */
  public static analyzeSourceMarkers(filePath: string): {
    exists: boolean;
    hasRealLogic: boolean;
    isSimulatedOrMock: boolean;
    isHardcoded: boolean;
    hasErrorHandling: boolean;
    lineCount: number;
    markers: string[];
  } {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) {
        return {
          exists: false,
          hasRealLogic: false,
          isSimulatedOrMock: false,
          isHardcoded: false,
          hasErrorHandling: false,
          lineCount: 0,
          markers: ['FILE_NOT_FOUND']
        };
      }

      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const files = this.enumerateFiles(fullPath);
        if (files.length === 0) {
          return {
            exists: true,
            hasRealLogic: false,
            isSimulatedOrMock: false,
            isHardcoded: false,
            hasErrorHandling: false,
            lineCount: 0,
            markers: ['EMPTY_DIRECTORY']
          };
        }

        let totalLines = 0;
        let hasRealLogic = false;
        let isSimulatedOrMock = false;
        let isHardcoded = false;
        let hasErrorHandling = false;
        const allMarkers = new Set<string>();

        for (const f of files) {
          const res = this.analyzeSingleFile(f);
          totalLines += res.lineCount;
          if (res.hasRealLogic) hasRealLogic = true;
          if (res.isSimulatedOrMock) isSimulatedOrMock = true;
          if (res.isHardcoded) isHardcoded = true;
          if (res.hasErrorHandling) hasErrorHandling = true;
          res.markers.forEach((m) => allMarkers.add(m));
        }

        return {
          exists: true,
          hasRealLogic,
          isSimulatedOrMock,
          isHardcoded,
          hasErrorHandling,
          lineCount: totalLines,
          markers: Array.from(allMarkers)
        };
      }

      return this.analyzeSingleFile(fullPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        exists: false,
        hasRealLogic: false,
        isSimulatedOrMock: false,
        isHardcoded: false,
        hasErrorHandling: false,
        lineCount: 0,
        markers: [`READ_ERROR: ${msg}`]
      };
    }
  }
}
