/**
 * PATCH-178: Materials Benchmark Suite Main Index & Orchestrator
 *
 * Public API for executing the Materials Benchmark Battery and Gate 178 evaluation.
 */

import { MaterialsBenchmarkReportGenerator } from './MaterialsBenchmarkReport';
import { MaterialsBenchmarkRunner } from './MaterialsBenchmarkRunner';
import { MaterialsBenchmarkSuiteReport } from './types';

export * from './types';
export * from './MaterialsReferenceSolutions';
export * from './MaterialsBenchmarkMetrics';
export * from './MaterialsAntiFabricationAuditor';
export * from './MaterialsBenchmarkCase';
export * from './MaterialsBenchmarkRunner';
export * from './MaterialsBenchmarkReport';
export * from './MaterialsBenchmarkGate';

export class MaterialsBenchmarkSuiteOrchestrator {
  /**
   * Executes full suite and returns complete report.
   */
  public static executeAndReport(): MaterialsBenchmarkSuiteReport {
    const report = MaterialsBenchmarkRunner.runSuite();
    return report;
  }

  /**
   * Generates report markdown string.
   */
  public static getMarkdownReport(): string {
    const report = this.executeAndReport();
    return MaterialsBenchmarkReportGenerator.generateMarkdownReport(report);
  }

  /**
   * Generates report JSON string.
   */
  public static getJsonReport(): string {
    const report = this.executeAndReport();
    return MaterialsBenchmarkReportGenerator.generateJsonReport(report);
  }
}
