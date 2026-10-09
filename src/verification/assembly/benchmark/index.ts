import { AssemblyBenchmarkRunner } from './AssemblyBenchmarkRunner';
import * as fs from 'fs';
import * as path from 'path';

export { AssemblyBenchmarkRunner };
export * from './types';

export async function executeAndReport() {
  const report = await AssemblyBenchmarkRunner.runSuite();
  
  let md = `============================================================\n`;
  md += `PATCH-180 — ASSEMBLY BENCHMARK\n`;
  md += `============================================================\n\n`;
  
  const passed = report.caseResults.filter(c => c.verdict === 'PASS').length;
  const failed = report.caseResults.filter(c => c.verdict === 'FAIL').length;
  const unproven = report.caseResults.filter(c => c.verdict === 'UNPROVEN').length;
  const notSupported = report.caseResults.filter(c => c.verdict === 'NOT_SUPPORTED').length;
  const invalid = report.caseResults.filter(c => c.verdict === 'INVALID').length;
  
  md += `Assembly Capabilities Discovered:\nMeasured Assembly & Constraints\n\n`;
  
  md += `Benchmark Cases:\n${report.caseResults.length}\n\n`;
  md += `Passed:\n${passed}\n\n`;
  md += `Failed:\n${failed}\n\n`;
  md += `Unproven:\n${unproven}\n\n`;
  md += `Not Supported:\n${notSupported}\n\n`;
  md += `Invalid:\n${invalid}\n\n`;
  
  const basic = report.caseResults.find(c => c.caseId === 'BENCH-ASM-01')?.verdict;
  const constraints = report.caseResults.find(c => c.caseId === 'BENCH-ASM-02')?.verdict;
  const kinematics = report.caseResults.find(c => c.caseId === 'BENCH-ASM-04')?.verdict;
  const clash = report.caseResults.find(c => c.caseId === 'BENCH-ASM-05')?.verdict;
  const scalability = report.caseResults.find(c => c.caseId === 'BENCH-ASM-06')?.verdict;
  const bom = report.caseResults.find(c => c.caseId === 'BENCH-ASM-07')?.verdict;
  const determinism = report.caseResults.find(c => c.caseId === 'BENCH-ASM-08')?.verdict;
  const missingRef = report.caseResults.find(c => c.caseId === 'BENCH-ASM-10')?.verdict;
  
  md += `Basic Assembly:\n${basic}\n\n`;
  md += `Constraints:\n${constraints}\n\n`;
  md += `Kinematics:\n${kinematics}\n\n`;
  md += `Clash Detection:\n${clash}\n\n`;
  md += `Large Assembly:\n${scalability}\n\n`;
  md += `BOM Integrity:\n${bom}\n\n`;
  md += `Determinism:\n${determinism}\n\n`;
  md += `Missing Part Reference Defense:\n${missingRef}\n\n`;
  
  md += `FINAL VERDICT:\n${report.gateResult.finalVerdict}\n\n`;
  md += `============================================================\n`;

  fs.writeFileSync(path.resolve(process.cwd(), 'PATCH180_ASSEMBLY_BENCHMARK_REPORT.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.resolve(process.cwd(), 'PATCH180_ASSEMBLY_BENCHMARK_REPORT.md'), md);
}
