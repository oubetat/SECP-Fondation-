import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { LiveForensicAuditor } from './LiveForensicAuditor';

describe('SECP-SECURITY-009 Remediated Forensic Auditor (AST-Enforced)', () => {
  const engineDir = path.resolve(process.cwd(), 'src/engine');
  const auditor = new LiveForensicAuditor(engineDir);

  it('should deterministically enumerate all modules and perform AST analysis on src/engine', () => {
    const modules = auditor.discoverModules();
    console.log(`[SEC009 AST AUDITOR] Deterministically discovered ${modules.length} modules under src/engine`);
    expect(modules.length).toBeGreaterThan(4000);

    // Run AST audit specifically over PRODUCTION modules (excluding test suites, fixtures, and test utilities)
    const productionModules = modules.filter(m => 
      !m.includes('__tests__') && 
      !m.includes('.test.') && 
      !m.includes('__fixtures__') && 
      !m.includes('TestUtility')
    );
    const prodReport = auditor.runFullAudit(productionModules);

    console.log(`[SEC009 AST AUDITOR] Total Production Modules Audited: ${prodReport.totalModulesScanned}`);
    console.log(`[SEC009 AST AUDITOR] Production AUTHORITY_PRODUCER: ${prodReport.producersCount}`);
    console.log(`[SEC009 AST AUDITOR] Production AUTHORITY_CONSUMER: ${prodReport.consumersCount}`);
    console.log(`[SEC009 AST AUDITOR] Production NO_AUTHORITY: ${prodReport.noAuthorityCount}`);
    console.log(`[SEC009 AST AUDITOR] Production SUSPICIOUS_UNKNOWN: ${prodReport.suspiciousUnknownCount}`);
    console.log(`[SEC009 AST AUDITOR] Production Unauthenticated Seal Calls: ${prodReport.unauthenticatedCallsCount}`);
    console.log(`[SEC009 AST AUDITOR] Production Unresolved Dynamic Calls: ${prodReport.unresolvedCallsCount}`);
    console.log(`[SEC009 AST AUDITOR] Production Authenticated Calls: ${prodReport.authenticatedCallsCount}`);

    // Verify mathematical reconciliation of all production modules
    expect(prodReport.totalModulesScanned).toEqual(
      prodReport.producersCount +
      prodReport.unresolvedProducersCount +
      prodReport.consumersCount +
      prodReport.noAuthorityCount +
      prodReport.suspiciousUnknownCount
    );

    // All 4 production calls are fully resolved and authenticated
    expect(prodReport.authenticatedCallsCount).toBe(4);
    expect(prodReport.unresolvedCallsCount).toBe(0);
    expect(prodReport.unauthenticatedCallsCount).toBe(0);
    expect(prodReport.unresolvedProducersCount).toBe(0);

    // Consumers are NOT inflated by generic "Solver" or "Verifier" keywords
    expect(prodReport.consumersCount).toBeLessThan(50);
  });

  it('should discover intentional negative unauthenticated tests in test directories via AST', () => {
    const testModules = auditor.discoverModules().filter(m => 
      m.includes('__tests__') && !m.includes('SEC009') && !m.includes('SEC008')
    );
    const testReport = auditor.runFullAudit(testModules);

    // The AST auditor successfully discovers the negative test in AuthoritySealTrustBoundary.test.ts
    console.log(`[SEC009 AST AUDITOR] Discovered ${testReport.unauthenticatedCallsCount} intentional unauthenticated negative test(s) in test suites`);
    expect(testReport.unauthenticatedCallsCount).toBeGreaterThanOrEqual(1);
  });

  it('should execute against all 15 physical adversarial fixtures and enforce zero false negatives', () => {
    const fixtureDir = path.resolve(engineDir, 'forensic/__fixtures__/SEC009');
    expect(fs.existsSync(fixtureDir)).toBe(true);

    const fixtureFiles = fs.readdirSync(fixtureDir).map(f => path.join(fixtureDir, f));
    // Include external fixture outside src/engine
    const extFixture = path.resolve(process.cwd(), 'src/verification/__fixtures__/adv12_out_of_engine.ts');
    if (fs.existsSync(extFixture)) {
      fixtureFiles.push(extFixture);
    }

    expect(fixtureFiles.length).toBe(15);

    let authenticatedCount = 0;
    let violationCount = 0;
    let unresolvedOrSuspiciousCount = 0;

    for (const f of fixtureFiles) {
      const result = auditor.auditFile(f);
      const isSuspicious = result.classification === 'SUSPICIOUS_UNKNOWN' || result.classification === 'AUTHORITY_PRODUCER_WITH_UNRESOLVED_PATHS';

      let hasViolation = false;
      let hasUnresolved = false;
      let hasAuth = false;

      for (const call of result.sealCalls) {
        if (call.status === 'UNAUTHENTICATED_VIOLATION' || call.status === 'FORGED_CAPABILITY_VIOLATION' || call.status === 'REVOKED_REPLAY_VIOLATION' || call.status === 'DOMAIN_MISMATCH_VIOLATION') {
          hasViolation = true;
        } else if (call.status === 'UNRESOLVED_UNKNOWN') {
          hasUnresolved = true;
        } else if (call.status === 'AUTHENTICATED') {
          hasAuth = true;
        }
      }

      if (hasViolation) {
        violationCount++;
      } else if (hasUnresolved || isSuspicious) {
        unresolvedOrSuspiciousCount++;
      } else if (hasAuth) {
        authenticatedCount++;
      }
    }

    console.log(`[SEC009 ADVERSARIAL VALIDATION] Evaluated ${fixtureFiles.length} physical fixtures:`);
    console.log(` - Direct Violations Detected: ${violationCount}`);
    console.log(` - Unresolved / Suspicious (Fail-Closed): ${unresolvedOrSuspiciousCount}`);
    console.log(` - Authenticated Passes: ${authenticatedCount}`);

    // PRINCIPLE ENFORCEMENT: ZERO unauthenticated bypasses may pass as AUTHENTICATED!
    expect(authenticatedCount).toBe(0);
    // Every single adversarial bypass must either be caught as a direct violation or classified UNRESOLVED/SUSPICIOUS
    expect(violationCount).toBe(5);
    expect(unresolvedOrSuspiciousCount).toBe(10);
    expect(violationCount + unresolvedOrSuspiciousCount).toBe(15);
  });

  it('should verify test authority isolation from production build boundaries', () => {
    const setupPath = path.resolve(process.cwd(), 'src/test/setup.ts');
    expect(fs.existsSync(setupPath)).toBe(true);
    const setupContent = fs.readFileSync(setupPath, 'utf-8');
    expect(setupContent).toContain('initializeAuthorityHandshake');

    const appTsx = path.resolve(process.cwd(), 'src/App.tsx');
    expect(fs.existsSync(appTsx)).toBe(true);
    const appContent = fs.readFileSync(appTsx, 'utf-8');
    expect(appContent).not.toContain('initializeAuthorityHandshake');
    expect(appContent).not.toContain('SealingAuthorizationBoundary');
  });
});
