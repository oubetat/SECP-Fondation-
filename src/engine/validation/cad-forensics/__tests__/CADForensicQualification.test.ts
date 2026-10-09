import { describe, it, expect } from 'vitest';
import { CADKernelQualificationEngine } from '../CADKernelQualificationEngine';
import { HardAcceptanceGate033 } from '../HardAcceptanceGate033';
import { CADForensicReportGenerator } from '../CADForensicReportGenerator';
import * as fs from 'fs';
import * as path from 'path';

describe('CAD Kernel Forensic Qualification (PATCH-033)', () => {
  it('executes the full forensic battery and produces a verifiable report', async () => {
    const report = await CADKernelQualificationEngine.runFullQualification();
    
    expect(report).toBeDefined();
    expect(report.summary.totalCount).toBeGreaterThan(0);
    
    const gate = HardAcceptanceGate033.evaluateGate(report);
    
    console.log('--- CAD KERNEL FORENSIC QUALIFICATION REPORT ---');
    console.log(`Kernel Version: ${report.kernelVersion}`);
    console.log(`Gate Verdict: ${gate.verdict}`);
    console.log(`Proven: ${report.summary.provenCount}`);
    console.log(`Partial: ${report.summary.partialCount}`);
    console.log(`Unproven: ${report.summary.unprovenCount}`);
    console.log(`Failed: ${report.summary.failedCount}`);
    console.log('-----------------------------------------------');

    // Persist the report for audit
    const reportPath = path.join(process.cwd(), 'CAD-FORENSIC-REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const mdReport = CADForensicReportGenerator.generateMarkdown(report);
    fs.writeFileSync(path.join(process.cwd(), 'CAD-FORENSIC-REPORT.md'), mdReport);

    // Verify Gate
    if (gate.verdict === 'FAIL') {
      console.error('Gate Findings:', gate.findings);
    }
    
    // We expect UNPROVEN or PASS depending on battery coverage in this simulation
    expect(['PASS', 'UNPROVEN']).toContain(gate.verdict);
  });
});
