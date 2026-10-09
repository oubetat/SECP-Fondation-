/**
 * PATCH-178: Report File Generator Script
 *
 * Executes the benchmark suite and writes PATCH178_MATERIALS_BENCHMARK_REPORT.json
 * and PATCH178_MATERIALS_BENCHMARK_REPORT.md to disk.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MaterialsBenchmarkSuiteOrchestrator } from './index';

export function generateReportFiles(): void {
  const report = MaterialsBenchmarkSuiteOrchestrator.executeAndReport();
  const mdContent = MaterialsBenchmarkSuiteOrchestrator.getMarkdownReport();
  const jsonContent = MaterialsBenchmarkSuiteOrchestrator.getJsonReport();

  const cwd = process.cwd();
  fs.writeFileSync(path.join(cwd, 'PATCH178_MATERIALS_BENCHMARK_REPORT.md'), mdContent, 'utf-8');
  fs.writeFileSync(path.join(cwd, 'PATCH178_MATERIALS_BENCHMARK_REPORT.json'), jsonContent, 'utf-8');

  console.log('Successfully generated PATCH178_MATERIALS_BENCHMARK_REPORT.md and PATCH178_MATERIALS_BENCHMARK_REPORT.json');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateReportFiles();
}
