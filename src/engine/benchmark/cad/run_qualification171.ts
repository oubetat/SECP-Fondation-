import * as fs from 'fs';
import * as path from 'path';
import { CadKernelQualificationFramework } from './CadKernelQualificationFramework';

export async function runQualificationAndExportArtifacts(): Promise<void> {
  console.log('⚡ Executing PATCH-171 CAD Kernel Qualification 2.0 Framework...');
  const result = await CadKernelQualificationFramework.runQualification();

  const rootDir = process.cwd();

  // 1. PATCH171_CAD_KERNEL_QUALIFICATION.json
  const qualJsonPath = path.join(rootDir, 'PATCH171_CAD_KERNEL_QUALIFICATION.json');
  fs.writeFileSync(qualJsonPath, JSON.stringify(result.qualificationReport, null, 2));
  console.log(` Saved ${qualJsonPath}`);

  // 2. PATCH171_CAD_KERNEL_QUALIFICATION.md
  const qualMdPath = path.join(rootDir, 'PATCH171_CAD_KERNEL_QUALIFICATION.md');
  fs.writeFileSync(qualMdPath, result.markdownReport);
  console.log(` Saved ${qualMdPath}`);

  // 3. PATCH171_REGRESSION_BASELINE.json
  const baselineJsonPath = path.join(rootDir, 'PATCH171_REGRESSION_BASELINE.json');
  fs.writeFileSync(baselineJsonPath, JSON.stringify(result.regressionBaseline, null, 2));
  console.log(` Saved ${baselineJsonPath}`);

  // 4. PATCH171_GEOMETRIC_ACCURACY_REPORT.json
  const geoJsonPath = path.join(rootDir, 'PATCH171_GEOMETRIC_ACCURACY_REPORT.json');
  fs.writeFileSync(geoJsonPath, JSON.stringify(result.geometricAccuracyReport, null, 2));
  console.log(` Saved ${geoJsonPath}`);

  // 5. PATCH171_TOPOLOGY_REPORT.json
  const topoJsonPath = path.join(rootDir, 'PATCH171_TOPOLOGY_REPORT.json');
  fs.writeFileSync(topoJsonPath, JSON.stringify(result.topologyReport, null, 2));
  console.log(` Saved ${topoJsonPath}`);

  // 6. PATCH171_PERFORMANCE_REPORT.json
  const perfJsonPath = path.join(rootDir, 'PATCH171_PERFORMANCE_REPORT.json');
  fs.writeFileSync(perfJsonPath, JSON.stringify(result.performanceReport, null, 2));
  console.log(` Saved ${perfJsonPath}`);

  // 7. PATCH171_DETERMINISM_REPORT.json
  const detJsonPath = path.join(rootDir, 'PATCH171_DETERMINISM_REPORT.json');
  fs.writeFileSync(detJsonPath, JSON.stringify(result.determinismReport, null, 2));
  console.log(` Saved ${detJsonPath}`);

  console.log(` Qualification complete! Verdict: ${result.qualificationReport.qualificationVerdict}`);
}

runQualificationAndExportArtifacts().catch(err => {
  console.error('Qualification execution failed:', err);
  process.exit(1);
});
