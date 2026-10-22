/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-PHASE-5-001: Aircraft & Industrial Qualification Engine
 * QualificationReportGenerator.ts
 * 
 * Generates formal system-level qualification reports in Markdown and JSON,
 * complete with Requirements Traceability Matrix (RTM), Solver Validity Limits,
 * Merkle Tree Root hashes, and formal qualification verdicts.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { SystemQualificationReport } from './SystemQualificationEngine';

export class QualificationReportGenerator {
  /**
   * Generates a formal Markdown Qualification Report.
   */
  public static generateMarkdownReport(report: SystemQualificationReport): string {
    const lines: string[] = [];

    lines.push(`# SECP Industrial OS — Engineering Truth OS`);
    lines.push(`## SECP-PHASE-5-001: AIRCRAFT & INDUSTRIAL SYSTEM QUALIFICATION REPORT`);
    lines.push(`**تقرير التأهيل الهندسي الرسمي لمنظومة التحكم الإلكتروني — المرحلة الخامسة**\n`);

    lines.push(`### 1. بيانات التعريف والقرار النهائي (Executive Decision)`);
    lines.push(`- **Report ID:** \`${report.reportId}\``);
    lines.push(`- **Target System:** \`${report.systemId}\` (Revision: \`${report.systemRevision}\`)`);
    lines.push(`- **Target Domain:** \`${report.targetDomain}\``);
    lines.push(`- **Governing Standards:** \`${report.targetStandard}\``);
    lines.push(`- **Timestamp:** \`${report.timestamp}\``);
    lines.push(`- **Canonical System SHA-256:** \`${report.canonicalSystemHash}\``);
    lines.push(`- **Evidence Merkle Tree Root:** \`${report.evidenceMerkleRoot}\``);
    lines.push(`- **Qualification Cryptographic Signature:** \`${report.qualificationSignature}\``);
    lines.push(`- **FINAL QUALIFICATION VERDICT:** **\`${report.qualificationStatus}\`**\n`);

    lines.push(`### 2. ملخص متطلبات القبول (Acceptance Metrics Summary)`);
    lines.push(`| المقياس | القيمة المسجلة |`);
    lines.push(`| :--- | :--- |`);
    lines.push(`| إجمالي المتطلبات المعلنة (Total Declared Requirements) | **${report.totalRequirements}** |`);
    lines.push(`| المتطلبات المستوفاة بنجاح (Verified & Compliant) | **${report.verifiedRequirements}** (${((report.verifiedRequirements / report.totalRequirements) * 100).toFixed(1)}%) |`);
    lines.push(`| المتطلبات المخالفة (Failed / Breached) | **${report.failedRequirements}** |`);
    lines.push(`| المتطلبات المحجوبة بفعل إبطال الأدلة (Blocked / Invalidated) | **${report.blockedRequirements}** |`);
    lines.push(`| سجلات الأدلة المشفرة في السجل (Ledger Records) | **${report.evidenceRecordsCount}** |`);
    lines.push(`| حالة التأهيل ضمن النطاق المعلن | **${report.isFullyQualifiedWithinScope ? 'APPROVED_WITHIN_DECLARED_SCOPE' : 'DISAPPROVED'}** |\n`);

    lines.push(`### 3. مصفوفة تتبع المتطلبات الهندسية (Requirements Traceability Matrix — RTM)`);
    lines.push(`| المعرف | المعيار | النطاق | طريقة التحقق | القيمة المقاسة | معيار القبول | الحالة |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);

    for (const record of report.requirementsTraceability) {
      const req = record.requirement;
      const ev = record.evidence;
      const statusBadge = record.status === 'SATISFIED' ? '✓ SATISFIED' : `✗ ${record.status}`;
      const measured = ev ? `${ev.measuredValue}` : 'N/A';
      const criteria = `${req.acceptanceCriteria.operator} ${req.acceptanceCriteria.expectedValue} ${req.acceptanceCriteria.unit}`;
      lines.push(`| \`${req.requirementId}\` | ${req.sourceStandard} | ${req.targetReference.domain} | ${req.verificationMethod} | ${measured} | ${criteria} | **${statusBadge}** |`);
    }
    lines.push('');

    lines.push(`### 4. حدود الصلاحية الصريحة للمحللات الفيزيائية (Explicit Solver Validity Bounds)`);
    lines.push(`تنفيذاً للمبدأ الهندسي الصارم لـ SECP بأن حالة التأهيل لا تتجاوز حدود المحللات المعتمدة:`);
    for (const sv of report.solverValidityLimits) {
      lines.push(`- **مجال ${sv.domain}:** المحرك \`${sv.engine}\``);
      lines.push(`  - *نطاق الصلاحية المعتمد:* ${sv.validityScope}`);
      lines.push(`  - *الظواهر الفيزيائية غير المدعومة رسمياً (NOT_PROVEN):*`);
      for (const un of sv.unsupportedPhenomena) {
        lines.push(`    - ${un}`);
      }
    }
    lines.push('');

    lines.push(`### 5. النطاق المعلن وحدود المسؤولية الهندسية (Declared Scope & Limitations)`);
    for (const lim of report.declaredScopeAndLimitations) {
      lines.push(`- ${lim}`);
    }
    lines.push('');

    lines.push(`---\n*وثيقة رسمية صادرة عن محرك التأهيل الهندسي SECP-P5-001 ومسجلة في سجل الحقيقة الهندسية.*`);

    return lines.join('\n');
  }

  /**
   * Generates a formal JSON string of the report.
   */
  public static generateJsonReport(report: SystemQualificationReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Saves both artifacts to the root directory.
   */
  public static saveReportsToDisk(report: SystemQualificationReport, baseDir: string = '.'): { mdPath: string; jsonPath: string } {
    const mdContent = this.generateMarkdownReport(report);
    const jsonContent = this.generateJsonReport(report);

    const mdPath = join(baseDir, 'SECP-P5-QUALIFICATION-REPORT-001.md');
    const jsonPath = join(baseDir, 'SECP-P5-QUALIFICATION-REPORT-001.json');

    writeFileSync(mdPath, mdContent, 'utf-8');
    writeFileSync(jsonPath, jsonContent, 'utf-8');

    return { mdPath, jsonPath };
  }
}
