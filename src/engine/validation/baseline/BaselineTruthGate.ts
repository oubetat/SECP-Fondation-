import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaselineTruthReportData, BaselineStatus } from './BaselineTruthTypes';

export interface BaselineTruthGateResult {
  gateId: string;
  verdict: 'PASS' | 'FAIL' | 'UNPROVEN';
  timestamp: string;
  checks: {
    name: string;
    passed: boolean;
    reason: string;
  }[];
  unresolved: string[];
  findings: string[];
}

export class BaselineTruthGate {
  private static VALID_STATUSES: Set<BaselineStatus> = new Set<BaselineStatus>([
    'WORKING',
    'FAILED',
    'UNPROVEN',
    'SIMULATED',
    'PRODUCTION_READY'
  ]);

  /**
   * Evaluate the baseline truth report against rigorous validation integrity standards.
   */
  public static evaluate(
    reportData?: BaselineTruthReportData,
    reportFilePath = 'reports/secp-baseline-truth.json'
  ): BaselineTruthGateResult {
    const checks: { name: string; passed: boolean; reason: string }[] = [];
    const unresolved: string[] = [];
    const findings: string[] = [];

    // 1. Report File Existence
    let data: BaselineTruthReportData | undefined = reportData;
    const fullPath = path.resolve(process.cwd(), reportFilePath);

    if (!data) {
      if (!fs.existsSync(fullPath)) {
        return {
          gateId: 'GATE-BASELINE-TRUTH',
          verdict: 'UNPROVEN',
          timestamp: new Date().toISOString(),
          checks: [
            {
              name: 'REPORT_EXISTS',
              passed: false,
              reason: `Report file not found at ${reportFilePath}`
            }
          ],
          unresolved: ['REPORT_FILE_MISSING'],
          findings: ['Baseline truth report has not been generated.']
        };
      }

      try {
        const raw = fs.readFileSync(fullPath, 'utf8');
        data = JSON.parse(raw) as BaselineTruthReportData;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          gateId: 'GATE-BASELINE-TRUTH',
          verdict: 'FAIL',
          timestamp: new Date().toISOString(),
          checks: [
            {
              name: 'REPORT_PARSABLE',
              passed: false,
              reason: `Failed to parse JSON report: ${msg}`
            }
          ],
          unresolved: [],
          findings: [`JSON parsing error: ${msg}`]
        };
      }
    }

    // 2. Schema Validation
    const hasValidSchema =
      data &&
      typeof data.schemaVersion === 'string' &&
      typeof data.generatedAt === 'string' &&
      Array.isArray(data.capabilities) &&
      data.capabilities.length > 0 &&
      data.summary &&
      typeof data.summary.working === 'number';

    checks.push({
      name: 'SCHEMA_INTEGRITY',
      passed: !!hasValidSchema,
      reason: hasValidSchema ? 'Report conforms to baseline schema' : 'Invalid schema structure'
    });

    if (!hasValidSchema) {
      return {
        gateId: 'GATE-BASELINE-TRUTH',
        verdict: 'FAIL',
        timestamp: new Date().toISOString(),
        checks,
        unresolved: [],
        findings: ['Report schema validation failed.']
      };
    }

    // 3. Enum Status Integrity
    let invalidStatuses = 0;
    for (const cap of data.capabilities) {
      if (!this.VALID_STATUSES.has(cap.status)) {
        invalidStatuses++;
        findings.push(`Invalid status '${cap.status}' found in capability '${cap.id}'`);
      }
    }

    checks.push({
      name: 'STATUS_ENUM_INTEGRITY',
      passed: invalidStatuses === 0,
      reason:
        invalidStatuses === 0
          ? 'All capability statuses are valid baseline taxonomy values'
          : `Detected ${invalidStatuses} invalid status values`
    });

    // 4. Metric Consistency (No Fabricated Summary Numbers)
    const actualWorking = data.capabilities.filter((c) => c.status === 'WORKING').length;
    const actualFailed = data.capabilities.filter((c) => c.status === 'FAILED').length;
    const actualUnproven = data.capabilities.filter((c) => c.status === 'UNPROVEN').length;
    const actualSimulated = data.capabilities.filter((c) => c.status === 'SIMULATED').length;
    const actualProdReady = data.capabilities.filter((c) => c.status === 'PRODUCTION_READY').length;

    const metricsMatch =
      data.summary.working === actualWorking &&
      data.summary.failed === actualFailed &&
      data.summary.unproven === actualUnproven &&
      data.summary.simulated === actualSimulated &&
      data.summary.productionReady === actualProdReady;

    checks.push({
      name: 'METRIC_AUTHENTICITY',
      passed: metricsMatch,
      reason: metricsMatch
        ? 'Summary metrics strictly match evaluated capability records'
        : 'Summary counts do not match record breakdown'
    });

    // 5. Evidence Reference Traceability
    let untraceableReferences = 0;
    for (const cap of data.capabilities) {
      const allEv = [
        ...cap.implementationEvidence,
        ...cap.executionEvidence,
        ...cap.testEvidence,
        ...cap.adversarialEvidence
      ];
      for (const ev of allEv) {
        if (!ev.id || !ev.reference || !ev.type) {
          untraceableReferences++;
        }
      }
    }

    checks.push({
      name: 'EVIDENCE_TRACEABILITY',
      passed: untraceableReferences === 0,
      reason:
        untraceableReferences === 0
          ? 'All evidence references have valid identifiers and paths'
          : `Found ${untraceableReferences} untraceable evidence references`
    });

    // 6. No Global PASS Prohibition
    const hasGlobalPassClaim =
      (data as unknown as Record<string, unknown>).verdict === 'PASS' ||
      (data as unknown as Record<string, unknown>).status === 'PASS';

    checks.push({
      name: 'NO_GLOBAL_PASS_PROHIBITION',
      passed: !hasGlobalPassClaim,
      reason: !hasGlobalPassClaim
        ? 'Report correctly maintains capability-level granularity without global PASS shortcuts'
        : 'Global PASS claim detected in report root'
    });

    // Determine final verdict
    const allPassed = checks.every((c) => c.passed);
    const anyFailed = checks.some((c) => !c.passed);

    let verdict: 'PASS' | 'FAIL' | 'UNPROVEN' = 'PASS';
    if (anyFailed) {
      verdict = 'FAIL';
    }

    return {
      gateId: 'GATE-BASELINE-TRUTH',
      verdict,
      timestamp: new Date().toISOString(),
      checks,
      unresolved,
      findings
    };
  }
}
