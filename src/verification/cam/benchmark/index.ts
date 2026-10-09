import { CAMBenchmarkRunner } from './CAMBenchmarkRunner';
import * as fs from 'fs';
import * as path from 'path';

export { CAMBenchmarkRunner };
export * from './types';

export async function executeAndReport() {
  const report = await CAMBenchmarkRunner.runSuite();
  
  let md = `============================================================\n`;
  md += `PATCH-179 — CAM BENCHMARK\n`;
  md += `============================================================\n\n`;
  
  const passed = report.caseResults.filter(c => c.verdict === 'PASS').length;
  const failed = report.caseResults.filter(c => c.verdict === 'FAIL').length;
  const unproven = report.caseResults.filter(c => c.verdict === 'UNPROVEN').length;
  const notSupported = report.caseResults.filter(c => c.verdict === 'NOT_SUPPORTED').length;
  const invalid = report.caseResults.filter(c => c.verdict === 'INVALID').length;
  
  md += `CAM Capabilities Discovered:\nMeasured Toolpath Generation & Verification\n\n`;
  md += `Capabilities Actually Executed:\nMeasured 3-Axis Foundation\n\n`;
  
  md += `Benchmark Cases:\n${report.caseResults.length}\n\n`;
  md += `Passed:\n${passed}\n\n`;
  md += `Failed:\n${failed}\n\n`;
  md += `Unproven:\n${unproven}\n\n`;
  md += `Not Supported:\n${notSupported}\n\n`;
  md += `Invalid:\n${invalid}\n\n`;
  
  const colDetection = report.caseResults.find(c => c.caseId === 'BENCH-CAM-06')?.verdict;
  const gougeDetection = report.caseResults.find(c => c.caseId === 'BENCH-CAM-07')?.verdict;
  const kinematicsAcc = report.caseResults.find(c => c.caseId === 'BENCH-CAM-09')?.verdict;
  const toolpathDet = report.caseResults.find(c => c.caseId === 'BENCH-CAM-15')?.verdict;
  const geoAcc = report.caseResults.find(c => c.caseId === 'BENCH-CAM-17')?.verdict;
  const gcodeVer = report.caseResults.find(c => c.caseId === 'BENCH-CAM-14')?.verdict;
  
  md += `Collision Detection:\n${colDetection}\n\n`;
  md += `Gouge Detection:\n${gougeDetection}\n\n`;
  md += `Kinematics Accuracy:\n${kinematicsAcc}\n\n`;
  md += `Toolpath Determinism:\n${toolpathDet}\n\n`;
  md += `Geometric Accuracy:\n${geoAcc}\n\n`;
  md += `G-code Verification:\n${gcodeVer}\n\n`;
  
  const antiFab = report.caseResults.find(c => c.caseId === 'BENCH-CAM-18')?.verdict;
  md += `Anti-Fabrication:\n${antiFab}\n\n`;
  
  const evIntegrity = report.caseResults.find(c => c.caseId === 'BENCH-CAM-20')?.verdict;
  md += `Evidence Integrity:\n${evIntegrity}\n\n`;
  
  md += `FINAL VERDICT:\n${report.gateResult.finalVerdict}\n\n`;
  md += `============================================================\n`;

  fs.writeFileSync(path.resolve(process.cwd(), 'PATCH179_CAM_BENCHMARK_REPORT.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.resolve(process.cwd(), 'PATCH179_CAM_BENCHMARK_REPORT.md'), md);
}
